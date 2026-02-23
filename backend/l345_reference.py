"""L345 HR 프로세스 참조 데이터 — L345_example.md 기반 (리얼 데이터)

사용자의 L4/L5 컨텍스트에 맞는 L3 블록을 동적으로 반환하여
LLM 프롬프트에 삽입. 전체 321줄 대신 해당 L3만 주입하여 토큰 절약.
"""

import re
from typing import Optional

# ── L345 트리: L3 → L4 → [L5 목록] ──
L345_TREE: dict[str, dict[str, list[str]]] = {
    "채용": {
        "채용계획": ["채용 계획 수립(경영계획)", "직무기술서 작성"],
        "인재발굴": ["인재 소싱 채널 선정 및 역칭"],
        "선발전형": ["서류심사", "자격 검증(GSAT, 코딩 테스트 등)", "면접", "채용 및 처우 승인"],
        "채용 후속조치": ["선확보 인력 관리", "입사 및 온보딩"],
    },
    "보상/근태": {
        "지급업무": ["정기급여", "인센티브", "연차수당"],
        "퇴직정산": ["퇴직자 미지급금 지급", "퇴직금 지급"],
        "연말정산": ["연말정산"],
        "보상기획": ["경영계획", "임금조정"],
        "법정복리후생": ["국민연금 정기결정", "국민연금", "건강보험/노인장기요양보험 정산", "고용보험", "고용보험 자격관리", "산재보험 신고", "산재보험"],
        "기업복리후생": ["개인연금", "개인연금운영(납입액 변경)", "의료비", "학자금", "워터파크", "휴양소", "대부금", "임원검진"],
        "근태운영 및 관리": ["근무형태 생성", "근무무효확정", "Office근무시간사후관리", "초과근무시간관리", "일반근태", "임직원휴가생성"],
    },
    "노사": {
        "조직문화": ["Change Agent", "SCI 진단", "Culture Week", "타운홀미팅", "My Pulse 서베이"],
        "협의회": ["협의위원", "정기협의회", "사업장 행사"],
        "노동조합": ["조합관리", "교섭창구", "단체교섭", "분쟁조정", "쟁의행위", "단체협약"],
        "ER": ["직장내괴롭힘", "희망퇴직", "동행파악", "마음건강", "상생공존문화"],
        "사건사고 관리": ["생활자 기념쿠키 지급", "여가지원 행사", "면담질의지 준비", "면담기록/요약", "유사사례 및 판례 확인", "징계항목 제안"],
    },
    "임원조직": {
        "인력운영": ["임원 석세션 플랜", "임원 피드백 면담", "핵심리더 선발", "조직도 작성", "임원 계약 및 퇴임", "퇴임임원 후속조치"],
        "조직개편": ["수시 조직개편", "정기 조직개편"],
        "교육/양성": ["임원 부부 명상과정", "SLP/TLP 과정", "그룹장 양성과정"],
    },
    "총무": {
        "사내 서비스 운영": ["날인 및 증명서 관리", "사내 화음 운영", "두발로 운영", "안내센터 운영", "사내 전화(S-Calling) 운영"],
        "사내 인프라 관리": ["사무실 레이아웃 관리", "피트니스 관리", "주차장 관리", "숙박시설 운영 (기숙사, 포레스트)", "회의실 운영", "외부 사무실 운영"],
        "임직원 지원": ["사택 관리", "비품 관리", "임직원 자산관리"],
        "차량 관리": ["건물 관리 (공용 등)", "임원 지원", "임직원 출장지원", "법인 차량 관리", "수행기사 관리", "업무버스 관리"],
        "협력사 관리": ["상주협력사 관리", "승무협력사 관리"],
    },
    "해외인사": {
        "인력운영": ["파견자 문의 대응", "주재원 인사(선발/부임)", "주재원 인사(관리)", "주재원 인사(귀임)"],
        "공통": ["STEP 운영", "양성 파견 운영(현전/STEP)", "교격 파견 부임/귀임", "양성 파견 운영(본전/STEP)"],
        "임원인사": ["VP 승격", "현지인 평가"],
        "주재원 제도": ["지료 관리", "조직 관리", "평가 운영", "승격 운영", "보상 운영", "징계 관리"],
        "보상": ["인센티브 지급조정 정비"],
        "채용": ["재입사 기준 관리", "현지 한국인 채용 관리", "글로벌 리더 양성 교육"],
        "노사관리": ["거점(법인) 교육", "주재원 교육"],
        "M&A": ["(실사) 실사문서 분류", "(실사) 실사문서 목록", "(실사) 실사결과 분석", "(실사) 시사점 도출 및 보고", "(PMI) 계획 수립", "(PMI) 실적 점검", "(PMI) Best Practice 분석", "(자회사 운영) 운영 방식 개선"],
    },
}

# ── L4→L3 역방향 인덱스 (초기화 시 1회 빌드) ──
# first-wins: 해외인사가 "채용", "보상", "인력운영" 등 다른 L3와 동명 키를 가지므로
# 먼저 등록된 L3 항목을 보존하여 오분류 방지
_L4_TO_L3: dict[str, str] = {}
for _l3, _l4_dict in L345_TREE.items():
    for _l4 in _l4_dict:
        if _l4 not in _L4_TO_L3:
            _L4_TO_L3[_l4] = _l3


def _normalize_korean(raw: str) -> str:
    """'채용(Recruiting)' → '채용', '서류 전형(Screening)' → '서류 전형'"""
    m = re.match(r"^([^(（]+)", raw.strip())
    return m.group(1).strip() if m else raw.strip()


def find_l3_for_l4(l4_raw: str) -> Optional[tuple[str, str]]:
    """L4 문자열에서 해당 (L3, 정규화된 L4명) 반환. 매칭 실패 시 None.

    매칭 우선순위:
    1. L4 정확 매칭
    2. L3 이름 정확·접두사 매칭 — 부분 L4 매칭보다 우선
       예: "채용 공고 작성" → "채용" L3 (해외인사 L4 "채용"보다 우선)
    3. L4 부분 매칭 — 더 긴(구체적인) 키 우선
    4. L3 이름 포함 매칭 (느슨)
    """
    normalized = _normalize_korean(l4_raw)
    if not normalized:
        return None

    # 1. L4 정확 매칭
    if normalized in _L4_TO_L3:
        return (_L4_TO_L3[normalized], normalized)

    # 2. L3 이름 정확·접두사 매칭
    #    "채용 공고 작성".startswith("채용") → "채용" L3 반환
    #    → 해외인사 L4 "채용"의 부분 매칭보다 먼저 처리
    for l3_name in L345_TREE:
        if normalized == l3_name or normalized.startswith(l3_name):
            return (l3_name, "")

    # 3. L4 부분 매칭 — 더 긴(구체적인) 키 우선으로 오매칭 최소화
    candidates = [
        (len(l4_key), l4_key, l3_name)
        for l4_key, l3_name in _L4_TO_L3.items()
        if l4_key in normalized or normalized in l4_key
    ]
    if candidates:
        candidates.sort(key=lambda x: -x[0])
        _, best_key, best_l3 = candidates[0]
        return (best_l3, best_key)

    # 4. L3 이름 포함 매칭 (느슨)
    for l3_name in L345_TREE:
        if l3_name in normalized or normalized in l3_name:
            return (l3_name, "")

    return None


def _find_l5_in_tree(l5_raw: str, l3_name: str) -> Optional[tuple[str, str]]:
    """L3 블록 내에서 L5가 어느 L4에 속하는지 찾기. (L4명, L5명) 반환."""
    normalized = _normalize_korean(l5_raw)
    if not normalized or l3_name not in L345_TREE:
        return None

    for l4_key, l5_list in L345_TREE[l3_name].items():
        for l5 in l5_list:
            if normalized in l5 or l5 in normalized or normalized == l5:
                return (l4_key, l5)

    return None


def get_l345_context(l4_raw: str, l5_raw: str = "", process_name: str = "") -> str:
    """사용자의 L4/L5에 맞는 L3 블록을 프롬프트 삽입용 문자열로 반환.

    Returns:
        포맷된 L345 참조 블록. 매칭 실패 시 빈 문자열.
    """
    result = find_l3_for_l4(l4_raw)
    if not result:
        return ""

    l3_name, matched_l4 = result
    l3_block = L345_TREE[l3_name]

    # L5 위치 파악
    current_l4 = matched_l4
    current_l5 = ""
    if l5_raw:
        l5_result = _find_l5_in_tree(l5_raw, l3_name)
        if l5_result:
            current_l4, current_l5 = l5_result

    # 현재 작업 위치 표시
    current_desc_parts = []
    if current_l4:
        current_desc_parts.append(current_l4)
    if current_l5:
        current_desc_parts.append(current_l5)
    if process_name:
        pn = _normalize_korean(process_name)
        if pn and pn not in " ".join(current_desc_parts):
            current_desc_parts.append(pn)

    current_desc = " > ".join(current_desc_parts) if current_desc_parts else "미상"

    # L3 블록 포맷
    lines = [
        f"[HR 프로세스 참조: {l3_name}]",
        f"현재 작업: {current_desc}",
        "",
        f"{l3_name}의 전체 구조:",
    ]

    for l4_key, l5_list in l3_block.items():
        l5_formatted = []
        for l5 in l5_list:
            if l5 == current_l5:
                l5_formatted.append(f"{l5} \u2190 \ud604\uc7ac")
            else:
                l5_formatted.append(l5)

        marker = " \u2190" if l4_key == current_l4 and not current_l5 else ""
        lines.append(f"  {l4_key}{marker}: {', '.join(l5_formatted)}")

    lines.append("")
    lines.append("이 구조를 참고하여 누락 단계, 전후 흐름, 분기점을 제안하세요.")

    return "\n".join(lines)
