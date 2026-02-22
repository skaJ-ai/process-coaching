def describe_flow(nodes, edges, summary=False):
    """
    플로우 상태를 텍스트로 요약
    summary=True: 통계+라벨 목록만 (토큰 절약, Knowledge 분기용)
    summary=False: 전체 노드 상세 + 연결 구조 (기본, Coaching 분기용)
    """
    if not nodes:
        return "플로우 비어있음."

    node_types = {"start": 0, "end": 0, "process": 0, "decision": 0, "subprocess": 0}
    for n in nodes:
        nt = getattr(n, "type", None) or getattr(n, "nodeType", None) or (n.data.get("nodeType") if hasattr(n, "data") else None) or "process"
        node_types[nt] = node_types.get(nt, 0) + 1

    total_nodes = len(nodes)
    total_edges = len(edges)
    has_swim_lanes = any(getattr(n, "swimLaneId", None) or (hasattr(n, "data") and n.data.get("swimLaneId")) for n in nodes)

    if total_nodes <= 2:
        phase = "초기 단계"
    elif total_nodes <= 5 or node_types.get("end", 0) == 0:
        phase = "진행 중"
    else:
        phase = "완성 단계"

    # start/end 노드는 고아 판정에서 제외 (항상 연결 없어도 정상)
    flow_node_ids = {
        n.id if hasattr(n, "id") else getattr(n, "id", None)
        for n in nodes
        if (getattr(n, "type", None) or getattr(n, "nodeType", None) or
            (hasattr(n, "data") and n.data.get("nodeType"))) not in ("start", "end")
    }
    source_ids = {e["source"] if isinstance(e, dict) else e.source for e in edges}
    target_ids = {e["target"] if isinstance(e, dict) else e.target for e in edges}

    orphan_count = len(flow_node_ids - source_ids - target_ids)
    orphan_nodes = list(flow_node_ids - source_ids - target_ids)

    has_start = node_types.get("start", 0) > 0
    has_end = node_types.get("end", 0) > 0
    disconnected_ends = [
        (n.id if hasattr(n, "id") else None)
        for n in nodes
        if (getattr(n, "type", None) or getattr(n, "nodeType", None) or (hasattr(n, "data") and n.data.get("nodeType"))) == "end"
        and (n.id if hasattr(n, "id") else None) not in target_ids
    ]

    hr_keywords = {"승인": 0, "결재": 0, "예외": 0, "검토": 0, "판정": 0, "요청": 0}
    for n in nodes:
        label = getattr(n, "label", "") or (n.data.get("label", "") if hasattr(n, "data") else "")
        for kw in hr_keywords:
            if kw in label:
                hr_keywords[kw] += 1
    hr_coverage = ", ".join([f"{kw}({v}건)" for kw, v in hr_keywords.items() if v > 0]) or "없음"

    lines = [
        f"[플로우 통계] 총 {total_nodes}개 노드, {total_edges}개 연결",
        f"  구성: 시작({node_types['start']}) > 태스크({node_types['process']}) / 분기({node_types['decision']}) / L6 프로세스({node_types['subprocess']}) > 종료({node_types['end']})",
        f"  수영레인: {'사용 중' if has_swim_lanes else '미사용'}",
        f"[진행도] {phase}",
        f"[구조 상태] 시작({has_start}), 종료({has_end}), 고아({orphan_count}), 연결율({100*total_edges//max(total_nodes-1,1)}%)",
    ]
    if orphan_count > 0:
        lines.append(f"  ⚠ {orphan_count}개 연결안됨: {orphan_nodes}")
    if not has_end:
        lines.append("  ⚠ 종료 노드 없음")
    if disconnected_ends:
        lines.append(f"  ⚠ {len(disconnected_ends)}개 종료 노드 연결 안됨")

    lines.append(f"[HR 프로세스 요소] {hr_coverage}")

    # 기존 노드 라벨 목록 (중복 방지용, 항상 표시)
    process_labels = [
        (n.data.get("label", "") if hasattr(n, "data") else getattr(n, "label", ""))
        for n in nodes
        if (getattr(n, "type", None) or getattr(n, "nodeType", None) or (hasattr(n, "data") and n.data.get("nodeType"))) in ("process", "decision")
    ]
    if process_labels:
        lines.append("")
        lines.append("현재 존재하는 업무/판단 라벨 (중복 방지용):")
        # 요약 모드에서는 최대 10개만 표시
        display_labels = process_labels[:10] if summary else process_labels
        for label in display_labels:
            if label:
                lines.append(f"  - \"{label}\"")
        if summary and len(process_labels) > 10:
            lines.append(f"  ... 외 {len(process_labels) - 10}개")

    # 요약 모드면 여기서 종료
    if summary:
        return "\n".join(lines)

    # 상세 모드: 노드/엣지 전체 목록
    lines.append("")
    lines.append("==== 노드 상세 목록 (ID는 insertAfterNodeId/targetNodeId에 사용) ====")

    for n in nodes:
        node_id = getattr(n, "id", "?")
        node_type = getattr(n, "type", None) or getattr(n, "nodeType", None) or (n.data.get("nodeType") if hasattr(n, "data") else None) or "process"
        label = getattr(n, "label", "") or (n.data.get("label", "") if hasattr(n, "data") else "")
        t = {"process": "태스크", "decision": "분기", "subprocess": "서브", "start": "시작", "end": "종료"}.get(node_type, node_type)

        meta = ""
        # Issue 5: AI 추가 노드 표시 (재수정 제안 금지용)
        added_by = getattr(n, "addedBy", None) or (n.data.get("addedBy") if hasattr(n, "data") else None)
        if added_by == "ai":
            meta += " [AI추가]"
        system_name = getattr(n, "systemName", None) or (n.data.get("systemName") if hasattr(n, "data") else None)
        if system_name:
            meta += f" SYS:{system_name}"
        duration = getattr(n, "duration", None) or (n.data.get("duration") if hasattr(n, "data") else None)
        if duration:
            meta += f" ⏱{duration}"
        swimlane = getattr(n, "swimLaneId", None) or (n.data.get("swimLaneId") if hasattr(n, "data") else None)
        if swimlane:
            meta += f" 레인:{swimlane}"
        meta_str = f" ({meta.strip()})" if meta.strip() else ""
        lines.append(f"  {node_id} | {t} | {label}{meta_str}")

    lines.append("")
    lines.append("연결 구조:")
    for e in edges:
        source = e["source"] if isinstance(e, dict) else e.source
        target = e["target"] if isinstance(e, dict) else e.target
        label = e.get("label", "") if isinstance(e, dict) else (e.label if hasattr(e, "label") else "")
        lines.append(f"  {source} → {target}{f' [{label}]' if label else ''}")

    return "\n".join(lines)


import re

# ── 동사 분류 (L7 가이드라인 v2, 2026-02-18 확정) ──
BANNED_VERBS = ["처리한다", "진행한다", "관리한다", "대응한다", "지원한다"]
REFINABLE_VERBS = {
    "확인한다": "조회한다, 비교한다, 검증한다",
    "검토한다": "비교한다, 판정한다, 검증한다",
    "개선한다": "수정한다, 재작성한다",
    "최적화한다": "수정한다, 재설정한다",
    "정리한다": "분류한다, 집계한다, 삭제한다",
    "공유한다": "안내한다, 발송한다, 공지한다",
    "조율한다": "요청한다, 협의한다",
    "협의한다": "요청한다, 회의한다",
    "반영한다": "입력한다, 수정한다, 저장한다",
}
TRANSITIVE_VERBS = [
    "조회한다", "입력한다", "수정한다", "저장한다", "추출한다", "비교한다",
    "집계한다", "기록한다", "첨부한다", "판정한다", "승인한다", "반려한다",
]
DECISION_HINTS = ["여부", "?", "인가", "인지", "이상", "이하", "초과", "미만", "승인", "반려", "가능", "불가"]
SYSTEM_NAME_RE = [
    re.compile(r"[(\[（]([^)\]）]+)[)\]）]"),
    re.compile(r"^(.+?)(에서)\s"),
]
# 시스템명이 아닌 파일 형식/일반 용어 (프론트 l7Rules.ts NON_SYSTEM_TERMS와 동기화)
NON_SYSTEM_TERMS = {"PPT", "PDF", "EXCEL", "HWP", "CSV", "XML", "JSON", "HTML",
                    "피피티", "엑셀", "워드", "한글", "파워포인트"}
SYSTEM_KEYWORDS_RE = re.compile(r"시스템|플랫폼|포털|ERP|솔루션|모듈")
COMPOUND_RE = [
    re.compile(r"(.+?하고),?\s*(.+?한다)"),
    re.compile(r"(.+?하며),?\s*(.+?한다)"),
    re.compile(r"(.+?한)\s+후\s*(.+?한다)"),
    re.compile(r"(.+?한다),\s*(.+?한다)"),
]
# R-05 예외: 의도/희망 표현 — 복수 동작이 아님 (rulesLoader.ts의 INTENT_EXCLUDE_PATTERNS와 동기화)
INTENT_EXCLUDE_RE = [
    re.compile(r"하고자\s*(한다|합니다|했다|했습니다)"),
    re.compile(r"하고\s*싶다"),
    re.compile(r"하고\s*싶었다"),
]


def mock_validate(label, node_type="process", llm_failed=False):
    """Rule-based L7 validation — v2 (2026-02-20 확정, R-06 제거)"""
    issues = []
    text = label.strip()

    # R-01: 길이 부족
    if len(text) < 4:
        issues.append({"ruleId": "R-01", "severity": "warning", "friendlyTag": "길이 부족", "message": "라벨이 너무 짧아 의미 전달이 어려울 수 있어요", "suggestion": "동작과 대상이 드러나도록 조금 더 구체화해보세요.", "reasoning": "명확한 라벨은 제3자가 정확히 이해할 수 있도록 도와줍니다"})

    # R-02: 길이 초과
    if len(text) > 100:
        issues.append({"ruleId": "R-02", "severity": "warning", "friendlyTag": "길이 초과", "message": "라벨이 길어지면 핵심 동작이 흐려질 수 있어요", "suggestion": "핵심 동작 1개 중심으로 간결하게 줄여보세요.", "reasoning": "간결한 표현이 플로우 전체의 가독성을 높입니다"})

    # R-03a: 금지 동사 (reject)
    banned_verb = next((v for v in BANNED_VERBS if v in text), None)
    if banned_verb:
        issues.append({"ruleId": "R-03a", "severity": "reject", "friendlyTag": "금지 동사", "message": f"'{banned_verb}'는 L7 라벨로 사용할 수 없어요", "suggestion": "조회한다, 입력한다, 저장한다, 승인한다 같은 구체 동사로 바꿔주세요.", "reasoning": "이 동사는 어떤 맥락에서도 구체적 행위를 나타내지 않아 제3자가 수행할 수 없습니다."})

    # R-04: 시스템명 혼입 (warning + 추출) — 전체 노드 적용
    detected_system = None
    for pattern in SYSTEM_NAME_RE:
        m = pattern.search(text)
        if m and m.group(1):
            candidate = m.group(1).strip()
            # NON_SYSTEM_TERMS 제외 (파일 형식 등)
            if candidate.upper() in NON_SYSTEM_TERMS:
                continue
            # 영문 대문자 포함 → 시스템명으로 판정
            has_upper = bool(re.search(r"[A-Z]", candidate))
            # 한국어 전용 → 시스템 키워드 필요
            if has_upper or SYSTEM_KEYWORDS_RE.search(candidate):
                detected_system = candidate
                break
    if detected_system:
        issues.append({"ruleId": "R-04", "severity": "warning", "friendlyTag": "시스템명 분리", "message": f"시스템명 '{detected_system}'이 감지되었습니다. 메타데이터로 분리하면 라벨이 깔끔해져요", "suggestion": f"라벨은 동작만 남기고 '{detected_system}'은 시스템명 필드에 입력해보세요.", "reasoning": "라벨과 시스템명을 분리하면 프로세스 로직이 명확해집니다."})

    # ── Decision 노드: 동사 기반 룰(R-03b/R-05/R-07) 스킵 ──
    # 판단 조건은 "~여부", "~인가?" 형식으로 동사가 없는 게 정상. Process 노드에서만 아래 룰 적용.
    if node_type != "decision":
        # R-03b: 구체화 권장 동사 (warning) — 금지 동사가 아닌 경우만
        if not banned_verb:
            refinable_verb = next((v for v in REFINABLE_VERBS if v in text), None)
            if refinable_verb:
                alternatives = REFINABLE_VERBS[refinable_verb]
                issues.append({"ruleId": "R-03b", "severity": "warning", "friendlyTag": "구체화 권장", "message": f"'{refinable_verb}' 대신 구체 동사를 쓰면 더 명확해질 수 있어요", "suggestion": f"대안: {alternatives}", "reasoning": "구체적 동사는 제3자가 정확히 이해할 수 있도록 도와줍니다."})

        # R-05: 복수 동작 (reject) — 의도/희망 표현(~하고자 한다 등)은 제외
        if not any(p.search(text) for p in INTENT_EXCLUDE_RE):
            for pattern in COMPOUND_RE:
                m = pattern.search(text)
                if m and m.group(1) and m.group(2):
                    p1 = m.group(1) if m.group(1).endswith("다") else m.group(1) + "다"
                    p2 = m.group(2) if m.group(2).endswith("다") else m.group(2) + "다"
                    issues.append({"ruleId": "R-05", "severity": "reject", "friendlyTag": "복수 동작", "message": "한 라벨에 동작이 2개 이상 포함되어 있어요", "suggestion": f'각 동작을 별도 단계로 분리해보세요: "{p1}" / "{p2}"', "reasoning": "하나의 화면 내 연속 동작 = 1개 L7 원칙에 따라 분리가 필요합니다."})
                    break

        # R-07: 목적어 누락 (reject) — 프론트와 동일하게 reject 처리
        if len(text) >= 4:
            used_transitive = next((v for v in TRANSITIVE_VERBS if v in text), None)
            if used_transitive and not re.search(r"[을를]", text):
                issues.append({"ruleId": "R-07", "severity": "reject", "friendlyTag": "목적어 누락", "message": f"'{used_transitive}'는 타동사인데 목적어(을/를)가 없어요", "suggestion": f'예: "급여를 {used_transitive}" 형태로 대상을 명시해보세요.', "reasoning": "목적어가 있으면 제3자가 무엇에 대한 동작인지 바로 알 수 있습니다."})

    # R-08: 기준값 누락 (decision만)
    if node_type == "decision":
        if not any(h in text for h in DECISION_HINTS):
            issues.append({"ruleId": "R-08", "severity": "warning", "friendlyTag": "기준값 누락", "message": "분기 기준이 드러나지 않아 판단 조건이 모호할 수 있어요", "suggestion": "Decision 5패턴 중 하나를 사용해보세요: '~여부'(범용), '~인가?'(유형 판별), '~가 있는가?'(존재 확인), '~되어 있는가?'(상태 확인), 'D-N 이전인가?'(기한 기준). 예: '승인 여부', '대기자가 있는가?', 'D-7 이전인가?'", "reasoning": "명확한 기준은 분기 누락과 운영 해석 차이를 줄여줍니다."})

    # R-09: Decision 노드에 Process 형식(~한다/~합다) 사용
    if node_type == "decision" and re.search(r"[한합]다\s*$", text):
        issues.append({"ruleId": "R-09", "severity": "warning", "friendlyTag": "Decision 형식", "message": "판단 노드에 '~한다' 형식이 사용되었어요. '~여부' 또는 '~인가?' 형태가 적합합니다", "suggestion": "'승인 여부', '적격 인가?' 등 판단 조건 형식으로 바꿔주세요.", "reasoning": "Decision 노드는 분기 조건을 나타내므로 동작형 어미보다 조건형 어미가 적합합니다."})

    # 점수 계산 (감점제)
    reject_count = len([i for i in issues if i["severity"] == "reject"])
    warning_count = len([i for i in issues if i["severity"] == "warning"])
    suggestion_count = len([i for i in issues if i["severity"] == "suggestion"])
    score = max(0, 100 - reject_count * 30 - warning_count * 10 - suggestion_count * 3)
    is_pass = reject_count == 0

    encouragement = "잘 작성하셨어요!" if not issues else ("좋은 방향입니다. 제안을 반영하면 더 명확해질 수 있어요." if is_pass else "수정이 필요한 항목이 있어요. 제안을 참고해주세요.")
    result = {"pass": is_pass, "score": score, "confidence": "high", "issues": issues, "rewriteSuggestion": None, "encouragement": encouragement}
    if detected_system:
        result["detectedSystemName"] = detected_system
    if llm_failed:
        result["llm_failed"] = True
        result["warning"] = "⚠️ AI 분석이 불가능해 표준 가이드라인으로 검증했습니다."
    return result


def mock_quick_queries(nodes, edges):
    qs = []
    pn = [n for n in nodes if n.type == "process"]
    dn = [n for n in nodes if n.type == "decision"]
    if not any(n.type == "end" for n in nodes) and len(pn) >= 2:
        qs.append("어떤 상황에서 이 프로세스가 완료되나요?")
    if not dn and len(pn) >= 3:
        qs.append("중간에 판단이나 승인이 필요한 지점이 있을까요?")
    if len(pn) >= 2:
        qs.append("예외적으로 처리해야 하는 상황은 어떤 것들이 있을까요?")
    if any(n.systemName for n in nodes):
        qs.append("시스템 간 데이터 연계는 어떻게 이루어지나요?")
    return qs[:3]


def mock_review(nodes, edges):
    suggestions = []
    end_nodes = [n for n in nodes if n.type == "end"]
    if not end_nodes:
        suggestions.append({"action": "ADD", "type": "END", "summary": "종료 노드 추가", "labelSuggestion": "종료", "reason": "플로우의 끝을 명확히 표시하면 완결성이 높아집니다", "reasoning": "프로세스의 시작과 끝이 명확하면 제3자가 전체 범위를 이해하기 쉬워집니다. HR 프로세스에서는 특히 완료 조건(예: 결과 저장, 알림)을 명시하는 것이 중요합니다.", "confidence": "high", "newLabel": "종료"})
    orphans = [n for n in nodes if n.type not in ("start", "end") and not any(e.source == n.id or e.target == n.id for e in edges)]
    if orphans:
        suggestions.append({"action": "MODIFY", "summary": f"연결되지 않은 노드 {len(orphans)}개 발견", "reason": "모든 단계를 연결하면 플로우가 더 명확해집니다", "reasoning": "독립적으로 떠있는 노드는 실행 순서가 불명확합니다. 어느 단계 이후에 수행되는지, 또는 병렬로 진행되는지를 표현하면 운영 효율성이 높아집니다.", "confidence": "high"})
    decisions = [n for n in nodes if n.type == "decision"]
    if not decisions and len(nodes) > 5:
        suggestions.append({"action": "ADD", "type": "DECISION", "summary": "분기점 추가 고려", "labelSuggestion": "승인 여부", "reason": "승인/반려 같은 판단 지점을 추가하면 실제 프로세스에 더 가까워집니다", "reasoning": "HR 프로세스는 대부분 조건부 분기를 포함합니다(예: 조건 검토 → 승인/반려 결정). 5개 이상의 단계가 있는데 분기가 없다면, 예외 처리나 검토 프로세스를 추가하는 것이 좋습니다.", "confidence": "medium"})

    tone = "긍정적" if len(suggestions) < 2 else "건설적"
    speech = "좋은 구조예요! " if len(nodes) > 2 else "프로세스 설계를 시작해볼게요. "
    speech += f"{len(suggestions)}가지 개선 아이디어를 공유드릴게요." if suggestions else "구조적으로 탄탄합니다. 세부 내용을 다듬어가시면 됩니다!"
    return {"speech": speech, "suggestions": suggestions, "quickQueries": mock_quick_queries(nodes, edges), "tone": tone}
