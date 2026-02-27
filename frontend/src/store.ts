import { create } from 'zustand';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import { ProcessContext, ChatMessage, Suggestion, FlowNodeData, ContextMenuState, LoadingState, L7ReportItem, SwimLane, SaveStatus, ShapeType, NodeCategory, MetaEditTarget, L7Status, PDDAnalysisResult, Mode, OnboardingStep } from './types';
import { applyDagreLayout, reindexByPosition, generateId } from './utils/layoutEngine';
import { API_BASE_URL, SWIMLANE_COLORS } from './constants';
import { detectCompoundAction } from './utils/labelUtils';
import { validateL7Label } from './utils/l7Rules';
import { makeInitialNodes, makeEdge, serialize, assignSwimLanes } from './store/helpers';
import { createChatActions } from './store/chatActions';

function isDebugEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('pm-v5-debug') === '1';
  } catch {
    return false;
  }
}

function debugTrace(event: string, payload?: Record<string, any>) {
  if (!isDebugEnabled()) return;
  const now = new Date().toISOString();
  // Debug traces are intentionally opt-in through localStorage key.
  console.debug(`[pm-v5][${now}] ${event}`, payload || {});
}

interface HistoryEntry { nodes: Node<FlowNodeData>[]; edges: Edge[]; }

// Phase 1 세부 업무 Suggestion 카드 빌더 (A 방향) — L345 실제 도메인 기반, L7 규칙 준수
// 라벨 형식 규칙: Process → "[목적어를] [구체 동사]한다", Decision → "~여부"
// 금지 동사(reject): 처리한다·진행한다·관리한다·파악한다·준비한다·수행한다 등
// 구체화 권장(warning): 검토한다·분석한다·조율한다·협의한다·반영한다 등
// 타동사 을/를 필수: 조회·입력·수정·저장·집계·기록·판정·승인·반려·분류 등
function buildPhaseOneSuggestions(phaseName: string, processName: string): Suggestion[] {
  const p = phaseName;
  const pn = processName;
  const all = `${p} ${pn}`;
  const base = (
    labelSuggestion: string, summary: string,
    type: 'PROCESS' | 'DECISION' = 'PROCESS',
    branches?: Suggestion['branches']
  ): Suggestion => ({ action: 'ADD', type, labelSuggestion, summary, reason: '', confidence: 'high', branches });
  const dec = (label: string, summary: string, yes: string, no: string) =>
    base(label, summary, 'DECISION', { yes: { summary: yes, type: 'PROCESS' }, no: { summary: no, type: 'PROCESS' } });

  // ── 채용 ──────────────────────────────────────────────
  if (/서류접수|서류수령/.test(p) || /서류심사/.test(pn)) return [
    base('지원 서류를 접수한다', '지원자가 제출한 서류를 접수합니다'),
    base('서류 완비 여부를 확인한다', '제출 서류 목록이 모두 완비되었는지 확인합니다'),
    dec('서류 보완 필요 여부', '누락 서류가 있으면 보완을 요청합니다', '심사 단계 진행', '서류 보완 요청'),
  ];
  if (/서류검토|심사자료/.test(p) || /서류심사/.test(pn)) return [
    base('직무별 심사 기준을 확인한다', '직무별 서류 심사 기준을 확인합니다'),
    base('심사 기준에 따라 지원서를 검증한다', '심사 기준에 따라 지원서를 검증합니다'),
    dec('합격 기준 충족 여부', '합격 기준을 충족하는지 판단합니다', '합격 처리', '불합격 처리'),
  ];
  if (/면접설계|면접준비/.test(p) || /면접/.test(pn)) return [
    base('직무 역량 기반 면접 문항을 작성한다', '직무 역량을 측정하는 면접 문항을 작성합니다'),
    base('면접관에게 평가 기준을 안내한다', '평가 기준 및 유의사항을 면접관에게 안내합니다'),
    base('지원자에게 면접 일정을 안내한다', '지원자에게 면접 일정과 장소를 안내합니다'),
  ];
  if (/채용공고|공고게시/.test(p) || /채용계획|소싱/.test(pn)) return [
    base('부서별 채용 필요 인원을 수집한다', '부서별 필요 인원과 직무 요건을 수렴합니다'),
    base('채용 직무와 자격 조건을 작성한다', '채용 직무, 자격 조건, 우대사항을 작성합니다'),
    dec('공고 내용 승인 여부', '작성된 공고 내용의 승인을 받습니다', '공고 게시', '내용 수정'),
  ];
  if (/온보딩|입사준비/.test(p) || /온보딩|입사/.test(pn)) return [
    base('입사예정자에게 제출 서류 목록을 안내한다', '필요 서류 목록을 입사예정자에게 안내합니다'),
    base('HR 시스템 계정을 생성한다', 'HR 시스템 및 업무 계정을 생성합니다'),
    base('배치 부서에 입사 일정을 안내한다', '배치 부서와 담당자에게 입사 일정을 공유합니다'),
  ];
  if (/처우협의|처우확정/.test(p) || /처우승인/.test(pn)) return [
    base('직급별 처우 기준과 협상 범위를 확인한다', '직급별 처우 기준과 협상 가능 범위를 확인합니다'),
    base('지원자에게 처우 조건을 안내한다', '지원자와 연봉·복리후생 등 처우 조건을 안내합니다'),
    dec('처우 합의 여부', '처우 합의가 이루어졌는지 확인합니다', '처우 확정', '재협의 진행'),
  ];
  // ── 보상/급여 ─────────────────────────────────────────
  if (/급여산정/.test(p) || /정기급여/.test(pn)) return [
    base('해당 월 급여 산정 기준을 확인한다', '해당 월 급여 산정 기준과 변동사항을 확인합니다'),
    base('변동 인원 정보를 시스템에 입력한다', '입퇴사, 휴직 등 변동 인원 정보를 입력합니다'),
    base('시스템에서 급여를 계산한다', '시스템을 통해 급여를 계산합니다'),
  ];
  if (/성과산정|인센산정/.test(p) || /인센티브/.test(pn)) return [
    base('지급 대상자의 성과 데이터를 수집한다', '지급 대상자의 성과 데이터를 수집합니다'),
    base('성과 등급별 인센티브 기준을 적용한다', '성과 등급별 인센티브 기준을 적용합니다'),
    dec('지급 대상 확정 여부', '대상자 목록과 금액의 정확성을 검토합니다', '지급 승인 진행', '데이터 재검토'),
  ];
  if (/연차산정|수당산정/.test(p) || /연차수당/.test(pn)) return [
    base('연차수당 지급 대상자를 선정한다', '연차수당 지급 대상자를 선정합니다'),
    base('지급 대상 잔여 연차 일수를 확인한다', '지급 대상 잔여 연차 일수를 확인합니다'),
    base('일 단가 기준으로 수당 금액을 계산한다', '일 단가 기준으로 수당 금액을 계산합니다'),
  ];
  if (/퇴직확인|퇴직정보/.test(p) || /퇴직금/.test(pn)) return [
    base('퇴직일과 근속기간을 확인한다', '퇴직일, 근속기간, 퇴직 사유를 확인합니다'),
    base('최근 3개월 평균임금을 산정한다', '최근 3개월 평균임금을 계산합니다'),
    base('근속기간에 따른 퇴직금을 계산한다', '근속기간 × 평균임금으로 퇴직금을 산출합니다'),
  ];
  if (/자료수집/.test(p) || /연말정산/.test(pn)) return [
    base('임직원에게 소득공제 항목을 안내한다', '소득공제, 세액공제 항목을 임직원에게 안내합니다'),
    base('임직원이 제출한 공제 증빙 서류를 수집한다', '임직원이 제출한 공제 증빙 서류를 수집합니다'),
    dec('자료 완비 여부', '제출 서류의 완결성을 확인합니다', '공제 검토 진행', '자료 보완 요청'),
  ];
  if (/부과기준|금액산정/.test(p) || /국민연금|건강보험|고용보험|산재/.test(pn)) return [
    base('해당 기간 보험료 부과 기준을 확인한다', '해당 기간 보험료 부과 기준을 확인합니다'),
    base('기준에 따라 보험료를 산정한다', '기준에 따라 보험료를 계산합니다'),
    base('신고에 필요한 서류와 데이터를 수집한다', '신고에 필요한 서류와 데이터를 수집합니다'),
  ];
  // ── 복리후생 ──────────────────────────────────────────
  if (/신청접수/.test(p) || /의료비|학자금|개인연금|대부금|복리후생/.test(pn)) return [
    base('임직원이 제출한 신청서를 접수한다', '임직원이 제출한 신청서를 접수합니다'),
    base('지급 자격 요건을 확인한다', '지급 자격 요건을 확인합니다'),
    dec('자격 충족 여부', '신청 자격 요건을 충족하는지 판단합니다', '다음 단계 진행', '신청 반려'),
  ];
  if (/대상선정/.test(p) || /임원검진/.test(pn)) return [
    base('검진 대상 직급과 기준을 확인한다', '검진 대상 직급 및 기준을 확인합니다'),
    base('검진 대상 임원 명단을 작성한다', '검진 대상 임원 명단을 작성합니다'),
    base('검진 기관에 일정을 요청한다', '임원별 검진 일정 조율을 요청합니다'),
  ];
  // ── 근태 ──────────────────────────────────────────────
  if (/기준설정|근무형태/.test(p) || /근무형태/.test(pn)) return [
    base('적용할 근무형태 기준을 확인한다', '적용할 근무형태 기준을 확인합니다'),
    base('근무형태 변경 대상자를 선정한다', '근무형태 변경 대상자를 선정합니다'),
    base('시스템 등록에 필요한 정보를 작성한다', '시스템 등록에 필요한 정보를 작성합니다'),
  ];
  if (/근태수집|이상확인/.test(p) || /일반근태|초과근무/.test(pn)) return [
    base('기간 내 근태 데이터를 수집한다', '기간 내 근태 데이터를 수집합니다'),
    base('지각·결근 등 이상 근태를 확인한다', '지각, 결근, 이상 근태 항목을 확인합니다'),
    dec('이상 근태 존재 여부', '이상 항목이 있는지 판단합니다', '조정 처리 진행', '확정 처리'),
  ];
  // ── 노사 ──────────────────────────────────────────────
  if (/신고접수/.test(p) || /직장내괴롭힘/.test(pn)) return [
    base('신고자의 진술과 제출 자료를 접수한다', '신고자의 진술과 제출 자료를 접수합니다'),
    base('신고 내용을 사실 중심으로 기록한다', '신고 내용을 사실 중심으로 기록합니다'),
    dec('사건 처리 가능 여부', '신고 내용이 처리 가능한 범위인지 판단합니다', '사실 확인 진행', '신고 반려'),
  ];
  if (/교섭준비/.test(p) || /단체교섭/.test(pn)) return [
    base('노사 양측의 교섭 의제와 요구를 수집한다', '노사 양측의 요구사항과 의제를 수렴합니다'),
    base('사측의 대응 입장과 허용 범위를 작성한다', '사측의 입장과 허용 범위를 문서화합니다'),
    base('교섭에 필요한 현황 자료를 작성한다', '교섭에 필요한 현황 자료와 논거를 작성합니다'),
  ];
  if (/의제수집|협의준비/.test(p) || /협의회/.test(pn)) return [
    base('부서별 협의회 안건을 수집한다', '협의회 안건을 부서별로 수렴합니다'),
    base('상정 안건의 적합성을 검증한다', '상정할 안건의 내용을 사전 검토합니다'),
    base('협의회 진행에 필요한 자료를 작성한다', '협의회 진행에 필요한 자료를 작성합니다'),
  ];
  if (/사실조사/.test(p) || /징계/.test(pn)) return [
    base('관련 사실 관계를 조사한다', '관련 사실 관계를 파악합니다'),
    base('관련자에게 진술을 청취한다', '관련자를 면담하여 진술을 청취합니다'),
    base('관련 증거 자료를 수집한다', '관련 증거 자료를 수집하고 정리합니다'),
  ];
  if (/설계수립|설문설계/.test(p) || /SCI|서베이|진단/.test(pn)) return [
    base('진단의 목적과 범위를 설정한다', '진단/서베이의 목적과 범위를 설정합니다'),
    base('측정 목적에 맞는 진단 문항을 작성한다', '측정 목적에 맞는 문항을 설계합니다'),
    base('진단 참여 대상자를 확정한다', '진단 참여 대상자를 확정합니다'),
  ];
  if (/대상선정/.test(p) || /희망퇴직/.test(pn)) return [
    base('희망퇴직 대상자 기준을 설정한다', '희망퇴직 대상자 기준을 설정합니다'),
    base('기준에 따른 대상자 명단을 작성한다', '기준에 따른 대상자 명단을 작성합니다'),
    dec('대상자 확정 여부', '대상자 명단의 적정성을 검토합니다', '대상자 통보', '명단 재검토'),
  ];
  // ── 임원조직 ──────────────────────────────────────────
  if (/후보풀|후보군/.test(p) || /석세션|핵심리더/.test(pn)) return [
    base('후보군 선정 기준을 설정한다', '후보군 선정 기준을 설정합니다'),
    base('각 부서장으로부터 후보 추천을 수집한다', '각 부서장으로부터 후보를 추천받습니다'),
    base('후보군의 역량 적합성을 검증한다', '후보군의 역량과 적합성을 검토합니다'),
  ];
  if (/현황분석/.test(p) || /조직개편/.test(pn)) return [
    base('현재 조직 구조와 인원 현황을 조사한다', '현재 조직 구조와 인원 현황을 파악합니다'),
    base('개편이 필요한 부문과 이유를 확인한다', '개편이 필요한 부문과 이유를 분석합니다'),
    base('조직개편의 목적과 방향성을 설정한다', '개편의 목적과 방향성을 설정합니다'),
  ];
  if (/교육기획/.test(p) || /SLP|TLP|양성과정/.test(pn)) return [
    base('교육과정의 목적과 학습 목표를 설정한다', '교육과정의 목적과 학습 목표를 설정합니다'),
    base('교육 참여 대상자를 선정한다', '교육 참여 대상자를 선정합니다'),
    base('교육 커리큘럼을 설계한다', '교육 일정과 과목 구성을 설계합니다'),
  ];
  // ── 총무 ──────────────────────────────────────────────
  if (/현황파악|배정처리/.test(p) || /주차장|피트니스|회의실|숙박|시설/.test(pn)) return [
    base('운영 현황과 잔여 용량을 확인한다', '현재 운영 현황과 잔여 용량을 파악합니다'),
    base('사용 신청을 접수한다', '사용 신청을 접수합니다'),
    dec('배정 가능 여부', '신청에 따른 배정이 가능한지 확인합니다', '배정 처리', '대기/반려 처리'),
  ];
  if (/신청접수/.test(p) || /비품|자산관리/.test(pn)) return [
    base('임직원의 비품 신청을 접수한다', '임직원의 비품 신청을 접수합니다'),
    base('요청 품목의 재고를 확인한다', '요청 품목의 재고 현황을 확인합니다'),
    dec('재고 보유 여부', '재고가 있는지 확인합니다', '지급 처리', '구매 요청'),
  ];
  if (/배차신청/.test(p) || /법인차량|수행기사|출장/.test(pn)) return [
    base('배차 또는 출장 신청을 접수한다', '배차 또는 출장 신청을 접수합니다'),
    base('신청 목적과 일정을 확인한다', '일정과 목적의 타당성을 확인합니다'),
    dec('배차 승인 여부', '신청 내용의 승인 여부를 결정합니다', '배차 확정', '신청 반려'),
  ];
  // ── 해외인사 ──────────────────────────────────────────
  if (/후보선발|파견준비/.test(p) || /주재원.*부임/.test(pn)) return [
    base('법인별 파견 필요 인원을 수집한다', '법인별 주재원 필요 인원과 요건을 파악합니다'),
    base('직무 적합성 기준으로 후보자를 선정한다', '직무 적합성, 어학 능력 등 기준으로 후보자를 선정합니다'),
    dec('후보자 적합 여부', '후보자가 파견 기준을 충족하는지 확인합니다', '파견 확정', '재선정'),
  ];
  if (/실사준비/.test(p) || /실사/.test(pn)) return [
    base('실사 대상 항목과 범위를 설정한다', '실사 대상 항목과 범위를 설정합니다'),
    base('실사 수행 인원과 역할을 확정한다', '실사 수행 인원과 역할을 배정합니다'),
    base('대상 기업에 실사 자료를 요청한다', '대상 기업에 필요 자료를 요청합니다'),
  ];
  if (/계획수립/.test(p) || /PMI/.test(pn)) return [
    base('통합 추진 과제를 도출한다', '통합 추진 과제를 도출합니다'),
    base('과제별 우선순위를 설정한다', '과제별 우선순위를 설정합니다'),
    base('과제별 실행 계획을 수립한다', '과제별 일정과 담당자를 확정합니다'),
  ];
  // ── 공통 기획/계획 계열 ───────────────────────────────
  if (/기획|계획|설계/.test(p)) return [
    base('현황 분석에 필요한 자료를 수집한다', '현재 상황과 필요사항을 분석합니다'),
    base('목적과 방향성을 설정한다', '목적과 방향성을 설정합니다'),
    base('세부 실행 계획을 수립한다', '실행을 위한 세부 일정과 과제를 수립합니다'),
  ];
  if (/현황파악|현황확인|현황분석/.test(p)) return [
    base('분석에 필요한 자료를 수집한다', '분석에 필요한 자료를 수집합니다'),
    base('수집된 자료를 항목별로 분류한다', '수집된 자료를 분류하고 정리합니다'),
    base('개선 필요 이슈를 도출한다', '현황 분석을 통해 개선 포인트를 도출합니다'),
  ];
  // ── 최후 폴백 ─────────────────────────────────────────
  const prefix = pn.replace(/\s/g, '').slice(0, 4) || p.slice(0, 4);
  return [
    base(`${prefix} 신청을 접수한다`, '요청 내용을 접수합니다'),
    base(`${prefix} 내용을 확인한다`, '요청 내용을 상세히 확인합니다'),
    dec('처리 가능 여부', '처리 가능한지 판단합니다', '다음 단계 진행', '반려 처리'),
  ];
}

// Phase 완료 시점 암묵지·예외 체크리스트 — Phase 이름 키워드 매핑
function phaseCheckQueries(phaseName: string): string[] {
  const p = phaseName;
  if (/접수|수령/.test(p)) return [
    '서류 미비 시 보완 요청 프로세스가 있나요?',
    '대리 접수나 온라인 접수도 가능한가요?',
    '접수 마감일이 있다면 마감 후 처리는 어떻게 하나요?',
  ];
  if (/심사|검토|평가/.test(p)) return [
    '동점이나 경계선 케이스는 어떻게 결정하나요?',
    '심사 기준 예외 적용이 필요한 경우가 있나요?',
    '결과에 이의신청이 들어오면 어떻게 처리하나요?',
  ];
  if (/면접/.test(p)) return [
    '면접 당일 결시자가 생기면 어떻게 처리하나요?',
    '면접관이 지원자와 이해충돌이 있는 경우의 처리는?',
    '온라인·오프라인 면접 방식 차이가 있나요?',
  ];
  if (/승인|결재|결정|판정/.test(p)) return [
    '결재권자 부재 시 대결(代決) 기준이 있나요?',
    '반려 후 재상신 처리는 어떻게 하나요?',
    '긴급 승인이 필요한 경우는 어떻게 하나요?',
  ];
  if (/산정|계산|급여/.test(p)) return [
    '중도 입퇴사자 일할계산 기준이 있나요?',
    '계산 오류 발견 시 재처리 프로세스가 있나요?',
    '공제 항목 이의제기 처리는 어떻게 하나요?',
  ];
  if (/통보|안내|발급|공지/.test(p)) return [
    '통보 수단(이메일/우편/시스템)이 정해져 있나요?',
    '통보 후 미확인자나 미열람자 처리는?',
    '통보 내용 오류 발생 시 정정 처리는?',
  ];
  if (/지급|처리|실행/.test(p)) return [
    '지급 오류 발생 시 환수 절차가 있나요?',
    '수취 거부나 계좌 오류 시 처리는?',
    '세금 처리나 원천징수 방식이 정해져 있나요?',
  ];
  if (/조사|확인|검증/.test(p)) return [
    '조사 결과가 불명확할 때 어떻게 판단하나요?',
    '당사자가 조사에 협조하지 않으면 어떻게 하나요?',
    '외부 전문가나 법률 자문이 필요한 경우가 있나요?',
  ];
  if (/준비|기획|계획/.test(p)) return [
    '계획이 변경되거나 취소될 경우 어떻게 처리하나요?',
    '이해관계자 승인이 필요한 시점이 있나요?',
    '예산이나 자원이 부족할 경우의 대안은?',
  ];
  // 기본 암묵지 질문
  return [
    '이 단계에서 가장 자주 발생하는 예외 케이스가 뭔가요?',
    '이 단계가 지연되는 주요 원인이 있나요?',
    '담당자가 바뀌어도 일관되게 처리할 수 있는 기준이 있나요?',
  ];
}

function extractBotText(d: any): string {
  // 표준 필드 우선, 하위 호환 필드는 fallback
  const direct = [d?.message, d?.speech, d?.guidance, d?.text, d?.content, d?.answer].find(v => typeof v === 'string' && v.trim());
  if (direct) return String(direct).trim();
  const nested = d?.choices?.[0]?.message?.content;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  if (d && typeof d === 'object') {
    try {
      const compact = JSON.stringify(d);
      if (compact && compact !== '{}') return compact;
    } catch {}
  }
  return '응답 실패.';
}

interface AppStore {
  processContext: ProcessContext | null; setProcessContext: (ctx: ProcessContext, onReady?: () => void) => void;
  mode: Mode; setMode: (mode: Mode) => void;
  nodes: Node<FlowNodeData>[]; edges: Edge[];
  selectedNodeId: string | null; setSelectedNodeId: (id: string | null) => void;
  selectedEdgeId: string | null; setSelectedEdgeId: (id: string | null) => void;
  setNodes: (n: Node<FlowNodeData>[]) => void; setEdges: (e: Edge[]) => void;
  onNodesChange: (c: NodeChange[]) => void; onEdgesChange: (c: EdgeChange[]) => void; onConnect: (c: Connection) => void;
  addShape: (type: ShapeType, label: string, position: { x: number; y: number }) => string;
  addShapeAfter: (type: ShapeType, label: string, afterNodeId: string) => string;
  updateNodeLabel: (id: string, label: string, source?: 'user' | 'ai') => void;
  updateNodeMeta: (id: string, meta: { inputLabel?: string; outputLabel?: string; systemName?: string; duration?: string }) => void;
  setNodeCategory: (id: string, category: NodeCategory) => void;
  deleteNode: (id: string) => void; changeNodeType: (id: string, newType: ShapeType) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void; deleteEdge: (edgeId: string) => void;
  applySuggestion: (s: Suggestion) => void; applySuggestionWithEdit: (s: Suggestion, editedLabel: string) => void;
  validateNode: (id: string) => Promise<any>; validateAllNodes: () => Promise<void>; applyL7Rewrite: (id: string) => void;
  lastAutoValidateTime: number; autoValidateDebounced: () => void;

  // v5.1: Focus Node
  focusNodeId: string | null; setFocusNodeId: (id: string | null) => void;
  // v5.1: Force Complete
  forceComplete: () => void;

  history: HistoryEntry[]; historyIndex: number; pushHistory: () => void; undo: () => void; redo: () => void;
  applyAutoLayout: () => void;
  categorizeNodesAI: () => Promise<void>;
  messages: ChatMessage[]; loadingState: LoadingState; addMessage: (m: ChatMessage) => void; setLoadingMessage: (m: string) => void;
  sendChat: (msg: string) => Promise<void>; requestReview: () => Promise<void>;

  contextMenu: ContextMenuState; showContextMenu: (m: ContextMenuState) => void; hideContextMenu: () => void;
  metaEditTarget: MetaEditTarget | null; openMetaEdit: (target: MetaEditTarget) => void; closeMetaEdit: () => void;
  // v5.2: multi-lane swim lane system (up to 4 lanes)
  dividerYs: number[];
  swimLaneLabels: string[];
  setDividerYs: (ys: number[]) => void;
  setSwimLaneLabels: (labels: string[]) => void;
  addDividerY: (y: number) => void;
  removeDividerY: (index: number) => void;
  // Phase lane system (vertical dividers)
  dividerXs: number[];
  phaseLabels: string[];
  setDividerXs: (xs: number[]) => void;
  setPhaseLabels: (labels: string[]) => void;
  addDividerX: (x: number) => void;
  removeDividerX: (index: number) => void;
  // Clipboard
  clipboard: { nodes: Node<FlowNodeData>[]; edges: Edge[] } | null;
  copySelected: () => void; pasteClipboard: () => void; deleteSelected: () => void;
  // Save
  saveStatus: SaveStatus; lastSaved: number | null;
  saveDraft: () => void; submitComplete: (force?: boolean) => { ok: boolean; issues: string[] };
  exportFlow: () => string; importFlow: (json: string) => void; loadFromLocalStorage: () => boolean;
  showOnboarding: boolean; hideOnboarding: () => void; dismissOnboarding: () => void; showOnboardingPanel: () => void;
  // v6: onboarding state machine
  onboardingStep: OnboardingStep;
  setOnboardingStep: (step: OnboardingStep) => void;
  advanceOnboarding: () => void;
  skipOnboarding: () => void;
  suggestPhases: () => Promise<void>;
  phaseDetailCount: number;
  phaseDetailMaxPhaseIdx: number;
  // v6: PDD history
  pddHistory: { content: string; timestamp: number }[];
  addPddHistory: (content: string) => void;
  showGuide: boolean; toggleGuide: () => void;
  // Product Tour
  tourActive: boolean; tourStep: number;
  startTour: () => void; nextTourStep: () => void; skipTour: () => void;
  // PDD
  pddAnalysis: PDDAnalysisResult | null; analyzePDD: () => Promise<void>;
  // v5: pending inline edit
  pendingEditNodeId: string | null; clearPendingEdit: () => void;
  // v5: theme

  // v5: contextual suggest debounce
  _contextualSuggestTimer: any;
  triggerContextualSuggest: () => void;
  // v5.2: user activity tracking
  lastUserActivity: number;
  updateUserActivity: () => void;
  isUserActive: () => boolean;
  // v5.2: proactive coaching
  _lastCoachingTrigger: Record<string, number>;
  checkFirstShape: () => void;
  checkOrphanedNodes: () => void;
  checkFlowCompletion: () => void;
  checkDecisionLabels: (nodeId: string) => void;
  checkSwimLaneNeed: () => void;
  celebrateL7Success: () => void;
  // v5.3: one-click fixes
  splitCompoundNode: (nodeId: string) => void;
  separateSystemName: (nodeId: string) => void;
  resetToSetup: () => void;
}

export const useStore = create<AppStore>((set, get) => ({
  processContext: null,
  mode: null,
  setMode: (mode) => set({ mode }),
  setProcessContext: (ctx, onReady?: () => void) => {
    const init = makeInitialNodes();
    set({ processContext: ctx, nodes: init, edges: [], messages: [], history: [{ nodes: init, edges: [] }], historyIndex: 0, saveStatus: 'unsaved', lastSaved: null, showOnboarding: !localStorage.getItem('pm-v5-onboarding-dismissed'), onboardingStep: 'welcome' as OnboardingStep, pddHistory: [], dividerYs: [], swimLaneLabels: ['A 주체', 'B 주체', 'C 주체', 'D 주체'], dividerXs: [], phaseLabels: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'] });
    // 환영 메시지 추가
    setTimeout(() => {
      get().addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: `안녕하세요! "${ctx.processName}" 프로세스 설계를 함께 시작해볼까요?\n\n아래에서 온보딩을 시작하거나 바로 캔버스에 우클릭해서 셰이프를 추가해도 됩니다.`,
        quickActions: [
          { label: '온보딩 시작하기', storeAction: 'advanceOnboarding' },
          { label: '건너뛰기', storeAction: 'skipOnboarding' }
        ]
      });
      onReady?.();
      if (!localStorage.getItem('pm-v5-tour-done')) {
        setTimeout(() => get().startTour(), 600);
      }
    }, 300);
  },
  nodes: [], edges: [], selectedNodeId: null, selectedEdgeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedEdgeId: (id) => set({ selectedEdgeId: id }),
  focusNodeId: null, setFocusNodeId: (id) => { set({ focusNodeId: null }); setTimeout(() => set({ focusNodeId: id }), 10); },
  forceComplete: () => {
    const { nodes, edges, processContext, mode } = get();
    set({ saveStatus: 'complete' });
    const modeStr = mode || 'AS-IS';
    const l6 = processContext?.processName || 'flow';
    const now = new Date();
    const dateTime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const json = get().exportFlow();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${modeStr}-${l6}-완료-${dateTime}.json`;
    a.click();
  },
  setNodes: (n) => set({ nodes: n }), setEdges: (e) => set({ edges: e }),
  onNodesChange: (c) => {
    get().updateUserActivity();
    const nn = applyNodeChanges(c, get().nodes) as Node<FlowNodeData>[];
    const hasDrag = c.some(ch => ch.type === 'position' && (ch as any).dragging === false);
    const { dividerYs, swimLaneLabels } = get();
    const updated = hasDrag && dividerYs.length > 0 ? assignSwimLanes(nn, dividerYs, swimLaneLabels) : nn;
    set({ nodes: updated, saveStatus: 'unsaved' });
  },
  onEdgesChange: (c) => {
    get().updateUserActivity();
    set({ edges: applyEdgeChanges(c, get().edges), saveStatus: 'unsaved' });
    // v5.2: check for orphaned nodes after edge changes
    setTimeout(() => get().checkOrphanedNodes(), 500);
  },
  onConnect: (conn) => {
    if (!conn.source || !conn.target) return;
    debugTrace('onConnect', { source: conn.source, target: conn.target, sourceHandle: conn.sourceHandle || null, targetHandle: conn.targetHandle || null });
    get().pushHistory();
    get().updateUserActivity();
    // Decision 노드에서 나가는 엣지 자동 라벨: 첫 번째=Yes, 두 번째=No
    const sourceNode = get().nodes.find(n => n.id === conn.source);
    let autoLabel: string | undefined;
    if (sourceNode?.data.nodeType === 'decision') {
      const existingOut = get().edges.filter(e => e.source === conn.source).length;
      autoLabel = existingOut === 0 ? 'Yes' : existingOut === 1 ? 'No' : undefined;
    }
    set({ edges: addEdge(makeEdge(conn.source, conn.target, autoLabel, undefined, conn.sourceHandle || undefined, conn.targetHandle || undefined), get().edges), saveStatus: 'unsaved' });
    // v5.2: check if flow is now complete
    setTimeout(() => get().checkFlowCompletion(), 500);
  },

  addShape: (type, label, position) => {
    get().pushHistory();
    get().updateUserActivity();
    const id = generateId({ process: 'proc', decision: 'dec', subprocess: 'sub', start: 'start', end: 'end', parallel: 'par' }[type] ?? 'node');
    // End 노드: 시작 노드와 수평으로 멀리 배치
    let pos = position;
    if (type === 'end') {
      const startNode = get().nodes.find(n => n.data.nodeType === 'start');
      if (startNode) {
        pos = { x: startNode.position.x + 1500, y: startNode.position.y };
      }
    }
    const node: Node<FlowNodeData> = {
      id, type, position: pos, draggable: true,
      data: { label, nodeType: type, category: 'as_is', addedBy: 'user', pendingEdit: true },
    };
    let updated = reindexByPosition([...get().nodes, node]);
    const { dividerYs, swimLaneLabels } = get();
    if (dividerYs.length > 0) updated = assignSwimLanes(updated, dividerYs, swimLaneLabels);
    set({ nodes: updated, saveStatus: 'unsaved', pendingEditNodeId: id });
    debugTrace('addShape', { id, type, label, x: position.x, y: position.y, nodeCount: updated.length });
    // v5.2: proactive coaching triggers
    const { onboardingStep: obs } = get();
    if (obs === 'idle' || obs === 'done') {
      setTimeout(() => {
        get().checkFirstShape();
        get().checkDecisionLabels(id);
        get().checkSwimLaneNeed();
      }, 500);
    } else if (obs === 'phase_detail') {
      const newCount = get().phaseDetailCount + 1;
      set({ phaseDetailCount: newCount });

      // 노드 x좌표로 현재 Phase 구간 계산
      const { dividerXs: dxs, phaseLabels: plabels, phaseDetailMaxPhaseIdx: prevMaxIdx } = get();
      const nodePhaseIdx = dxs.length > 0
        ? (() => { const i = dxs.findIndex(dx => position.x < dx); return i === -1 ? dxs.length : i; })()
        : 0;

      if (nodePhaseIdx > prevMaxIdx) {
        // ── 새 Phase 구간 진입 감지 ──────────────────────────
        set({ phaseDetailMaxPhaseIdx: nodePhaseIdx });
        const prevPhaseName = plabels[prevMaxIdx] || `Phase ${prevMaxIdx + 1}`;
        const newPhaseName  = plabels[nodePhaseIdx] || `Phase ${nodePhaseIdx + 1}`;
        const ctx = get().processContext;

        setTimeout(() => {
          // 이전 Phase의 Decision 누락 여부 체크
          const leftBound  = prevMaxIdx > 0 ? dxs[prevMaxIdx - 1] : -Infinity;
          const rightBound = dxs[prevMaxIdx] ?? Infinity;
          const prevNodes  = get().nodes.filter(n =>
            n.position.x >= leftBound && n.position.x < rightBound &&
            !['start', 'end'].includes(n.data.nodeType)
          );
          const hasDecision = prevNodes.some(n => n.data.nodeType === 'decision');

          if (prevNodes.length > 0 && !hasDecision) {
            get().addMessage({
              id: generateId('msg'), role: 'bot', timestamp: Date.now(),
              text: `Phase ${prevMaxIdx + 1} '${prevPhaseName}' 구간에 판단(◇ Decision) 분기가 없네요.\n\n이 단계에서 결과에 따라 흐름이 갈리는 경우가 있다면 Decision 노드로 표현해보세요.`,
              quickQueries: phaseCheckQueries(prevPhaseName),
            });
          }

          // 새 Phase 진입 코칭 + 노드 제안
          get().addMessage({
            id: generateId('msg'), role: 'bot', timestamp: Date.now(),
            text: `Phase ${nodePhaseIdx + 1} '${newPhaseName}' 구간으로 넘어왔네요!\n\n이 구간에서 보통 일어나는 세부 단계를 추천해드릴게요. 직접 그리거나 챗봇에 물어봐도 됩니다. 💬`,
            suggestions: buildPhaseOneSuggestions(newPhaseName, ctx?.processName || ''),
            quickActions: [{ label: '✅ 완성 → L7 검증으로', storeAction: 'advanceOnboarding' }],
          });
        }, 800);

      } else if (newCount === 1) {
        // Phase 1 첫 노드 — 시작 격려
        setTimeout(() => get().addMessage({
          id: generateId('msg'), role: 'bot', timestamp: Date.now(),
          text: '좋은 시작이에요! 이 Phase 구간의 단계들을 계속 추가해보세요.\n\n판단이 갈리는 지점(예: "합격 여부", "서류 완비 여부")이 있다면 ◇ Decision 노드도 활용해보세요.',
          quickQueries: ['다음에 어떤 단계가 있을까?', 'Decision 노드는 언제 써야 해?'],
        }), 900);
      }
    }
    // v5: contextual suggest on shape add
    get().triggerContextualSuggest();
    // auto L7 validation after label entry (6s delay to let user finish typing)
    setTimeout(() => get().autoValidateDebounced(), 6000);
    return id;
  },
  addShapeAfter: (type, label, afterNodeId) => {
    const { nodes, edges } = get(); get().pushHistory();
    const id = generateId(type === 'decision' ? 'dec' : type === 'subprocess' ? 'sub' : type === 'parallel' ? 'par' : 'proc');
    const after = nodes.find(n => n.id === afterNodeId);
    // ⚠️ x 좌표를 start 노드와 수직 정렬 (엣지 꺾임 방지)
    const startNode = nodes.find(n => n.data.nodeType === 'start');
    const startX = startNode?.position.x ?? 300;
    const pos = after ? { x: startX, y: after.position.y + 150 } : { x: startX, y: 300 };
    const node: Node<FlowNodeData> = { id, type, position: pos, draggable: true, data: { label, nodeType: type, category: 'as_is', addedBy: 'user' } };
    const outEdge = edges.find(e => e.source === afterNodeId);
    let newEdges = [...edges];
    if (outEdge) {
      // 기존 엣지 제거 후 재연결: afterNode → 새 노드 → 기존 타겟
      newEdges = newEdges.filter(e => e.id !== outEdge.id);
      // afterNode의 bottom-source → 새 노드의 top-target
      newEdges.push(makeEdge(afterNodeId, id, undefined, undefined, 'bottom-source', 'top-target'));
      // 새 노드의 bottom-source → 기존 타겟의 원래 핸들 유지
      newEdges.push(makeEdge(id, outEdge.target, undefined, undefined, 'bottom-source', outEdge.targetHandle || 'top-target'));
    }
    else {
      // afterNode 다음에 추가 (아래 방향): bottom-source → top-target
      newEdges.push(makeEdge(afterNodeId, id, undefined, undefined, 'bottom-source', 'top-target'));
    }
    let updated = reindexByPosition([...nodes, node]);
    const { dividerYs, swimLaneLabels } = get();
    if (dividerYs.length > 0) updated = assignSwimLanes(updated, dividerYs, swimLaneLabels);
    set({ nodes: updated, edges: newEdges, saveStatus: 'unsaved' });
    debugTrace('addShapeAfter', { id, type, label, afterNodeId, nodeCount: updated.length, edgeCount: newEdges.length });
    get().triggerContextualSuggest();
    return id;
  },
  updateNodeLabel: (id, label, source = 'user') => {
    const node = get().nodes.find(n => n.id === id);
    const nodeType = node?.data.nodeType;
    const prev = node?.data.label;
    get().pushHistory();
    get().updateUserActivity();
    set({ nodes: get().nodes.map(n => n.id !== id ? n : { ...n, data: { ...n.data, label, pendingEdit: false, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined } }), saveStatus: 'unsaved' });
    debugTrace('updateNodeLabel', { id, before: prev || null, after: label, source });
    // 온보딩 set_scope: 종료 노드 라벨을 실제로 편집하면 define_phases로 자동 진행
    if (get().onboardingStep === 'set_scope' && nodeType === 'end' && label.trim() && label !== '종료') {
      setTimeout(() => get().advanceOnboarding(), 600);
    }
  },
  updateNodeMeta: (id, meta) => { get().pushHistory(); set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...meta } } : n), saveStatus: 'unsaved' }); },
  setNodeCategory: (id, category) => { get().pushHistory(); set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, category } } : n), saveStatus: 'unsaved' }); },
  deleteNode: (id) => {
    const { nodes, edges } = get();
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    if (node.data.nodeType === 'start') { if (nodes.filter(n => n.data.nodeType === 'start').length <= 1) return; }
    get().pushHistory();
    // parallel 노드: Split/Join 구조가 복잡하므로 재연결 없이 단순 제거
    if (node.data.nodeType === 'parallel') {
      set({ nodes: reindexByPosition(nodes.filter(n => n.id !== id)), edges: edges.filter(e => e.source !== id && e.target !== id), saveStatus: 'unsaved' });
      return;
    }
    const inE = edges.filter(e => e.target === id), outE = edges.filter(e => e.source === id);
    let newEdges = edges.filter(e => e.source !== id && e.target !== id);
    for (const i of inE) for (const o of outE) newEdges.push(makeEdge(i.source, o.target));
    set({ nodes: reindexByPosition(nodes.filter(n => n.id !== id)), edges: newEdges, saveStatus: 'unsaved' });
  },
  changeNodeType: (id, nt) => { get().pushHistory(); set({ nodes: get().nodes.map(n => n.id === id ? { ...n, type: nt, data: { ...n.data, nodeType: nt } } : n), saveStatus: 'unsaved' }); },

  updateEdgeLabel: (eid, label) => { get().pushHistory(); set({ edges: get().edges.map(e => e.id === eid ? { ...e, label: label || undefined, labelStyle: label ? { fill: '#e2e8f0', fontWeight: 500, fontSize: 12 } : undefined, labelBgStyle: label ? { fill: '#1e293b', fillOpacity: 0.9 } : undefined, labelBgPadding: label ? [6, 4] as [number, number] : undefined } : e), saveStatus: 'unsaved' }); },
  deleteEdge: (eid) => { get().pushHistory(); set({ edges: get().edges.filter(e => e.id !== eid), saveStatus: 'unsaved' }); },

  applySuggestion: (s) => {
    if (s.action === 'MODIFY') {
      if (!s.targetNodeId) {
        // T-04: targetNodeId 없으면 수정 대상 불명 → 사용자에게 안내
        get().addMessage({ id: generateId('msg'), role: 'bot', text: '수정할 노드를 특정하지 못했어요. 노드를 직접 선택한 후 라벨을 편집해주세요.', timestamp: Date.now() });
        return;
      }
      const modifyLabel = s.newLabel || s.labelSuggestion;
      if (modifyLabel) { get().updateNodeLabel(s.targetNodeId, modifyLabel, 'ai'); }
      return;
    }
    if (s.action === 'DELETE' && s.targetNodeId) {
      get().deleteNode(s.targetNodeId);
      return;
    }
    let afterId = s.insertAfterNodeId;
    const { nodes, edges } = get();
    // 유효하지 않은 ID면 초기화
    if (afterId && !nodes.find(n => n.id === afterId)) afterId = undefined;

    // ⚠️ 순차 추가 보장: insertAfterNodeId가 현재 가장 마지막 노드가 아니면 무시
    // → 여러 suggestion을 순서대로 클릭할 때 역순 배치 방지
    if (afterId) {
      const processNodes = nodes.filter(n => !['start', 'end'].includes(n.data.nodeType));
      const lastNode = processNodes.length > 0
        ? processNodes.reduce((a, b) => a.position.y >= b.position.y ? a : b)
        : nodes.find(n => n.data.nodeType === 'start');

      // afterId가 lastNode 또는 end 직전이 아니면 무시하고 폴백
      const endNode = nodes.find(n => n.data.nodeType === 'end');
      const beforeEnd = endNode ? edges.find(e => e.target === endNode.id)?.source : null;
      const isValidInsertPoint = afterId === lastNode?.id || afterId === beforeEnd;

      if (!isValidInsertPoint) {
        afterId = undefined;
      }
    }

    // afterId 없으면 스마트 폴백: 종료 노드 직전 → 마지막 프로세스 노드 → start 노드 순
    if (!afterId) {
      const endNode = nodes.find(n => n.data.nodeType === 'end');
      if (endNode) {
        const edgeToEnd = edges.find(e => e.target === endNode.id);
        afterId = edgeToEnd?.source;
      }
      if (!afterId) {
        const processNodes = nodes.filter(n => !['start', 'end'].includes(n.data.nodeType));
        if (processNodes.length > 0) {
          afterId = processNodes.reduce((a, b) => a.position.y >= b.position.y ? a : b).id;
        }
      }
      if (!afterId) {
        const startNode = nodes.find(n => n.data.nodeType === 'start');
        afterId = startNode?.id;
      }
    }
    const suggestionType = String((s as any).type || '').toUpperCase();
    const labelText = (s.labelSuggestion || s.newLabel || s.summary || '').toLowerCase();
    const st: ShapeType =
      suggestionType === 'START' ? 'start'
      : suggestionType === 'END' ? 'end'
      : suggestionType === 'DECISION' ? 'decision'
      : suggestionType === 'SUBPROCESS' ? 'subprocess'
      : suggestionType === 'PARALLEL' ? 'parallel'
      : /종료|완료|끝|finish/.test(labelText) ? 'end'
      : /시작|start|begin/.test(labelText) ? 'start'
      : /판단|결정|여부|분기|승인|반려/.test(labelText) ? 'decision'
      : 'process';
    // labelSuggestion이 없으면 적용 불가 (summary는 설명 텍스트라 라벨로 사용 불가)
    const label = s.labelSuggestion || s.newLabel;
    if (!label) return;
    const compound = detectCompoundAction(label);
    const primaryLabel = compound.isCompound ? compound.parts[0] : label;
    let newNodeId: string;
    if (get().onboardingStep === 'phase_detail' && s.action === 'ADD') {
      // Phase 1 구간 내 수직 스택 배치
      const { nodes: ns, dividerXs } = get();
      const startNode = ns.find(n => n.data.nodeType === 'start');
      const sx = startNode?.position.x ?? 300;
      const sy = startNode?.position.y ?? 200;
      const phase1End = dividerXs.length > 0 ? Math.min(...dividerXs) : sx + 700;
      const phase1X = Math.round((sx + phase1End) / 2);
      const workNodes = ns.filter(n => !['start', 'end'].includes(n.data.nodeType));
      const lastY = workNodes.length > 0 ? Math.max(...workNodes.map(n => n.position.y)) + 160 : sy + 180;
      newNodeId = get().addShape(st, primaryLabel, { x: phase1X, y: lastY });
    } else {
      newNodeId = afterId ? get().addShapeAfter(st, primaryLabel, afterId) : get().addShape(st, primaryLabel, { x: 300, y: 300 });
    }
    // Issue 5: AI가 추가한 노드 표시 (재수정 제안 방지용)
    set({ nodes: get().nodes.map(n => n.id === newNodeId ? { ...n, data: { ...n.data, addedBy: 'ai' as const } } : n) });
  },
  applySuggestionWithEdit: (s, l) => {
    const m = { ...s };
    if (s.action === 'MODIFY') {
      m.newLabel = l;
    } else {
      m.summary = l;
      m.labelSuggestion = l;
    }
    get().applySuggestion(m);
  },

  validateAllNodes: async () => {
    const { nodes, addMessage, setLoadingMessage, loadingState } = get();
    const targets = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType));
    if (!targets.length) { addMessage({ id: generateId('msg'), role: 'bot', text: '검증할 노드가 없습니다.', timestamp: Date.now() }); return; }
    let newCount = (loadingState.requestCount || 0) + 1;
    set({ loadingState: { active: true, message: `L7 검증 (0/${targets.length})`, startTime: Date.now(), elapsed: 0, requestCount: newCount } });
    // React가 로딩 상태를 실제로 렌더할 수 있도록 한 프레임 양보
    await new Promise(r => setTimeout(r, 0));

    // Parallel Execution (Batch 4)
    const BATCH_SIZE = 4;
    const items: L7ReportItem[] = [];

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      setLoadingMessage(`L7 검증 (${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length})...`);
      const results = await Promise.allSettled(batch.map(t => get().validateNode(t.id)));

      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value) {
          const nodeId = batch[idx].id;
          // T-05: 검증 완료 시점의 최신 노드 상태 사용 (배치 캡처 스냅샷 대신)
          const liveNode = get().nodes.find(n => n.id === nodeId);
          if (!liveNode) return;
          const r = res.value;
          const item = { nodeId: liveNode.id, nodeLabel: liveNode.data.label, pass: r.pass, score: r.score ?? 0, issues: (r.issues || []).map((x: any) => ({ ...x, friendlyTag: x.friendlyTag || friendlyTag(x.ruleId) })), rewriteSuggestion: r.rewriteSuggestion, encouragement: r.encouragement };
          items.push(item);
          if (item.issues.length > 0) {
            addMessage({
              id: generateId('msg'),
              role: 'bot',
              text: `🔎 "${liveNode.data.label}" 검증 결과가 도착했어요.`,
              l7Report: [item],
              timestamp: Date.now()
            });
          }
        }
      });
    }
    const ls = get().loadingState;
    newCount = Math.max(0, (ls.requestCount || 1) - 1);
    set({ loadingState: { ...ls, active: newCount > 0, requestCount: newCount } });
    const ok = items.filter(r => r.pass && !r.issues.some(i => i.severity === 'warning')).length;
    const warn = items.filter(r => r.pass && r.issues.some(i => i.severity === 'warning')).length;
    const fail = items.filter(r => !r.pass).length;
    // 플레이스홀더 라벨 등으로 검증 생략된 노드 수 안내
    const skipped = targets.length - items.length;
    const skippedNote = skipped > 0 ? ` · ⚪ ${skipped} 라벨 미입력(검증 생략)` : '';
    addMessage({ id: generateId('msg'), role: 'bot', text: `✅ L7 검증 완료: 🟢${ok} 🟡${warn} 🔴${fail}${skippedNote}`, timestamp: Date.now() });
    // v5.2: celebrate if all pass
    setTimeout(() => get().celebrateL7Success(), 500);
  },
  applyL7Rewrite: (id) => {
    const n = get().nodes.find(n => n.id === id);
    if (!n?.data.l7Rewrite) return;
    const { addMessage } = get();
    const compound = detectCompoundAction(n.data.l7Rewrite);
    const primaryLabel = compound.isCompound ? compound.parts[0] : n.data.l7Rewrite;
    get().updateNodeLabel(id, primaryLabel, 'ai');
    set({ nodes: get().nodes.map(x => x.id === id ? { ...x, data: { ...x.data, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined } } : x) });
    if (compound.isCompound) {
      addMessage({
        id: generateId('msg'),
        role: 'bot',
        timestamp: Date.now(),
        text: `💡 AI 추천에 복수 동작이 있어 첫 동작만 적용했어요. 다음 단계로 "${compound.parts[1]}" 셰이프를 추가해 주세요.`,
        dismissible: true
      });
    }
  },
  lastAutoValidateTime: 0,
  autoValidateDebounced: () => {
    const now = Date.now();
    const { nodes, lastAutoValidateTime, loadingState, isUserActive } = get();
    // Skip if loading or user is actively editing (within 10s)
    if (loadingState.active || isUserActive() || now - lastAutoValidateTime < 5000) return;
    const PLACEHOLDER_LABELS = new Set(['새 태스크', '새 단계', '분기 조건?', '판단 조건', 'L6 프로세스', '하위 절차']);
    const t = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType) && n.data.label.trim().length > 2 && !PLACEHOLDER_LABELS.has(n.data.label.trim()) && (!n.data.l7Status || n.data.l7Status === 'none'));
    if (!t.length) return;
    set({ lastAutoValidateTime: now });
    get().validateNode(t[0].id);
  },



  history: [], historyIndex: -1,
  pushHistory: () => { const { nodes, edges, history, historyIndex } = get(); const h = history.slice(0, historyIndex + 1); h.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }); if (h.length > 50) h.shift(); set({ history: h, historyIndex: h.length - 1 }); },
  undo: () => { const { history: h, historyIndex: i } = get(); if (i <= 0) return; set({ nodes: h[i - 1].nodes, edges: h[i - 1].edges, historyIndex: i - 1 }); },
  redo: () => { const { history: h, historyIndex: i } = get(); if (i >= h.length - 1) return; set({ nodes: h[i + 1].nodes, edges: h[i + 1].edges, historyIndex: i + 1 }); },
  applyAutoLayout: () => {
    const { nodes, edges, pushHistory } = get();
    if (nodes.length === 0) return;
    pushHistory();
    const { nodes: layoutedNodes, edges: layoutedEdges } = applyDagreLayout(nodes, edges);
    const reindexed = reindexByPosition(layoutedNodes);
    set({ nodes: reindexed, edges: layoutedEdges });
  },
  categorizeNodesAI: async () => {
    const { nodes, processContext, mode } = get();
    if (mode !== 'TO-BE') {
      alert('TO-BE 모드에서만 사용할 수 있습니다.');
      return;
    }
    if (nodes.length === 0) return;
    set({ loadingState: { active: true, message: 'AI 카테고리 분류 중...', startTime: Date.now(), elapsed: 0, requestCount: 1 } });
    try {
      const { nodes: sn } = serialize(nodes, []);
      const r = await fetch(`${API_BASE_URL}/categorize-nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: processContext || {}, nodes: sn })
      });
      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status}: ${errText.slice(0, 200)}`);
      }
      const data = await r.json();
      if (data.categorizations && Array.isArray(data.categorizations)) {
        const updatedNodes = nodes.map(n => {
          const cat = data.categorizations.find((c: any) => c.nodeId === n.id);
          if (cat && cat.category) {
            return { ...n, data: { ...n.data, category: cat.category } };
          }
          return n;
        });
        set({ nodes: updatedNodes, loadingState: { active: false, message: '', startTime: 0, elapsed: 0, requestCount: 0 } });
        alert(`${data.categorizations.length}개 노드 카테고리 분류 완료`);
      } else {
        throw new Error('카테고리 분류 응답이 올바르지 않습니다.');
      }
    } catch (e) {
      console.error('categorizeNodesAI error:', e);
      alert('카테고리 분류 실패: ' + (e instanceof Error ? e.message : '알 수 없는 오류'));
      set({ loadingState: { active: false, message: '', startTime: 0, elapsed: 0, requestCount: 0 } });
    }
  },

  messages: [], loadingState: { active: false, message: '', startTime: 0, elapsed: 0, requestCount: 0 },
  addMessage: (m) => set(s => ({ messages: [...s.messages, m] })),
  setLoadingMessage: (m) => set(s => ({ loadingState: { ...s.loadingState, message: m } })),
  ...createChatActions(set as any, get as any, { generateId, debugTrace, extractBotText, friendlyTag }),



  contextMenu: { show: false, x: 0, y: 0 },
  showContextMenu: (m) => set({ contextMenu: m }), hideContextMenu: () => set({ contextMenu: { show: false, x: 0, y: 0 } }),
  metaEditTarget: null,
  openMetaEdit: (target) => set({ metaEditTarget: target }), closeMetaEdit: () => set({ metaEditTarget: null }),

  // v5.2: multi-lane swim lane system (up to 4 lanes)
  dividerYs: [],
  swimLaneLabels: ['A 주체', 'B 주체', 'C 주체', 'D 주체'],
  setDividerYs: (ys) => {
    const clamped = ys
      .slice(0, 3)
      .map(y => Number(y))
      .filter(y => Number.isFinite(y));
    const updated = assignSwimLanes(get().nodes, clamped, get().swimLaneLabels);
    set({ dividerYs: clamped, nodes: updated });
  },
  setSwimLaneLabels: (labels) => {
    const { onboardingStep, swimLaneLabels: prev, nodes, dividerYs } = get();
    const updated = assignSwimLanes(nodes, dividerYs, labels);
    set({ swimLaneLabels: labels, nodes: updated });
    // 온보딩 edit_swimlane: A→B 순서로 편집 감지, 둘 다 바꾸면 자동 진행
    if (onboardingStep === 'edit_swimlane') {
      const defaults = ['A 주체', 'B 주체', 'C 주체', 'D 주체'];
      const prevEdited = prev.filter((l, i) => l !== defaults[i]).length;
      const nowEdited = labels.filter((l, i) => l !== defaults[i]).length;
      if (prevEdited < 1 && nowEdited >= 1) {
        get().addMessage({ id: generateId('msg'), role: 'bot', timestamp: Date.now(), text: '👍 A주체 완료! 이제 B주체 이름도 바꿔보세요.', dismissible: true });
      } else if (nowEdited >= 2) {
        setTimeout(() => get().advanceOnboarding(), 400);
      }
    }
  },
  addDividerY: (y) => {
    if (get().dividerYs.length < 3) {
      const newYs = [...get().dividerYs, y];
      get().setDividerYs(newYs);
    }
  },
  removeDividerY: (index) => {
    const newYs = get().dividerYs.filter((_, i) => i !== index);
    get().setDividerYs(newYs);
  },

  // Phase lane system (vertical dividers)
  dividerXs: [],
  phaseLabels: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'],
  setDividerXs: (xs) => set({ dividerXs: xs.filter(x => Number.isFinite(x)) }),
  setPhaseLabels: (labels) => set({ phaseLabels: labels }),
  addDividerX: (x) => { if (get().dividerXs.length < 4) set(s => ({ dividerXs: [...s.dividerXs, x] })); },
  removeDividerX: (index) => set(s => ({ dividerXs: s.dividerXs.filter((_, i) => i !== index) })),

  // Clipboard
  clipboard: null,
  copySelected: () => { const { nodes, edges } = get(); const sel = nodes.filter(n => n.selected && n.data.nodeType !== 'start'); if (!sel.length) return; const ids = new Set(sel.map(n => n.id)); set({ clipboard: { nodes: JSON.parse(JSON.stringify(sel)), edges: JSON.parse(JSON.stringify(edges.filter(e => ids.has(e.source) && ids.has(e.target)))) } }); },
  pasteClipboard: () => {
    const { clipboard, nodes, edges, dividerYs, swimLaneLabels } = get(); if (!clipboard?.nodes.length) return; get().pushHistory();
    const idMap: Record<string, string> = {};
    const nn = clipboard.nodes.map(n => { const nid = generateId(n.data.nodeType); idMap[n.id] = nid; return { ...n, id: nid, selected: true, position: { x: n.position.x + 40, y: n.position.y + 40 }, data: { ...n.data, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined } }; });
    const ne = clipboard.edges.map(e => makeEdge(idMap[e.source] || e.source, idMap[e.target] || e.target, (e.label as string) || undefined));
    let u = reindexByPosition([...nodes.map(n => ({ ...n, selected: false })), ...nn]);
    if (dividerYs.length > 0) u = assignSwimLanes(u, dividerYs, swimLaneLabels);
    set({ nodes: u, edges: [...edges, ...ne], saveStatus: 'unsaved' });
  },
  deleteSelected: () => {
    const { nodes, edges } = get();
    const selN = nodes.filter(n => n.selected); const selE = edges.filter(e => e.selected);
    const delIds = new Set(selN.filter(n => !(n.data.nodeType === 'start' && nodes.filter(x => x.data.nodeType === 'start').length <= 1)).map(n => n.id));
    const delEIds = new Set(selE.map(e => e.id));
    if (!delIds.size && !delEIds.size) return;
    get().pushHistory();
    set({ nodes: reindexByPosition(nodes.filter(n => !delIds.has(n.id))), edges: edges.filter(e => !delEIds.has(e.id) && !delIds.has(e.source) && !delIds.has(e.target)), saveStatus: 'unsaved' });
  },

  saveStatus: 'unsaved', lastSaved: null,
  saveDraft: () => { localStorage.setItem('pm-v5-save', get().exportFlow()); set({ saveStatus: 'draft', lastSaved: Date.now() }); },
  submitComplete: (force = false) => {
    const { nodes, edges, processContext, mode } = get();
    const issues: string[] = [];
    if (!nodes.some(n => n.data.nodeType === 'end')) issues.push('종료 노드가 없습니다. 우클릭으로 추가해주세요.');
    const orphans = nodes.filter(n => !['start', 'end'].includes(n.data.nodeType) && !edges.some(e => e.source === n.id || e.target === n.id));
    if (orphans.length) issues.push(`연결되지 않은 노드 ${orphans.length}개`);
    const unc = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType) && (!n.data.l7Status || n.data.l7Status === 'none'));
    if (unc.length) issues.push(`L7 검증 미실행 노드 ${unc.length}개`);
    if (force || !issues.length) {
      set({ saveStatus: 'complete' });
      const modeStr = mode || 'AS-IS';
      const l6 = processContext?.processName || 'flow';
      const now = new Date();
      const dateTime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const json = get().exportFlow();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `${modeStr}-${l6}-완료-${dateTime}.json`; a.click();
    }
    return { ok: force || !issues.length, issues };
  },
  exportFlow: () => {
    const { processContext, nodes, edges, dividerYs, swimLaneLabels, dividerXs, phaseLabels } = get();
    const { nodes: sn, edges: se } = serialize(nodes, edges);
    debugTrace('exportFlow', { nodeCount: sn.length, edgeCount: se.length, dividerCount: dividerYs.length });
    return JSON.stringify({
      processContext,
      nodes: sn,
      edges: se,
      dividerYs,
      swimLaneLabels,
      dividerXs,
      phaseLabels,
    }, null, 2);
  },
  importFlow: (json) => {
    try {
      const d = JSON.parse(json); if (!d.nodes) return;
      const ns: Node<FlowNodeData>[] = d.nodes
        .filter((n: any) => n.type !== 'phase') // 구버전 Phase 노드 제거
        .map((n: any) => ({ id: n.id, type: n.type, position: n.position || { x: 0, y: 0 }, draggable: true, data: { label: n.label, nodeType: n.type, inputLabel: n.inputLabel, outputLabel: n.outputLabel, systemName: n.systemName, duration: n.duration, category: n.category || 'as_is', swimLaneId: n.swimLaneId } }));
      const es: Edge[] = (d.edges || []).map((e: any) => makeEdge(e.source, e.target, e.label || undefined, undefined, e.sourceHandle || undefined, e.targetHandle || undefined));

      // 스윔레인 복원 — 신규 포맷(dividerYs 배열) 우선, 구버전 하위 호환
      let divYs: number[] = [];
      let laneLabels: string[] = ['A 주체', 'B 주체'];

      if (d.dividerYs && Array.isArray(d.dividerYs) && d.dividerYs.length > 0) {
        // 현재 포맷: dividerYs 배열 + swimLaneLabels 배열
        divYs = d.dividerYs;
        if (Array.isArray(d.swimLaneLabels) && d.swimLaneLabels.length >= 2) {
          laneLabels = d.swimLaneLabels;
        }
      } else {
        // 구버전 하위 호환
        let divY = d.dividerY || 0;
        let topLbl = d.topLabel || 'A 주체';
        let botLbl = d.bottomLabel || 'B 주체';
        if (!divY && d.swimLanes?.length === 2 && d.laneBoundaries?.length >= 1) {
          divY = d.laneBoundaries[0];
          topLbl = d.swimLanes[0]?.label || 'A 주체';
          botLbl = d.swimLanes[1]?.label || 'B 주체';
        }
        if (!divY && d.swimLaneDividerY && d.swimLaneDividerY > 0) {
          divY = d.swimLaneDividerY;
          topLbl = (d.swimLaneLabels as any)?.top || 'A 주체';
          botLbl = (d.swimLaneLabels as any)?.bottom || 'B 주체';
        }
        if (divY > 0) divYs = [divY];
        laneLabels = [topLbl, botLbl];
      }

      const divXs: number[] = Array.isArray(d.dividerXs) ? d.dividerXs.filter((x: any) => Number.isFinite(x)) : [];
      const pLabels: string[] = Array.isArray(d.phaseLabels) && d.phaseLabels.length >= 2 ? d.phaseLabels : ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'];
      set({ nodes: reindexByPosition(ns), edges: es, processContext: d.processContext || get().processContext, dividerYs: divYs, swimLaneLabels: laneLabels, dividerXs: divXs, phaseLabels: pLabels });
      debugTrace('importFlow:success', { nodeCount: ns.length, edgeCount: es.length, dividerYs: divYs });
    } catch (e) { debugTrace('importFlow:error', { error: String(e) }); console.error('Import failed:', e); }
  },
  loadFromLocalStorage: () => { const j = localStorage.getItem('pm-v5-save'); if (j) { get().importFlow(j); return true; } return false; },

  showOnboarding: false,
  hideOnboarding: () => set({ showOnboarding: false }),
  dismissOnboarding: () => { localStorage.setItem('pm-v5-onboarding-dismissed', '1'); set({ showOnboarding: false }); },
  showOnboardingPanel: () => set({ showOnboarding: true }),

  // v6: onboarding state machine
  onboardingStep: 'idle' as OnboardingStep,
  phaseDetailCount: 0,
  phaseDetailMaxPhaseIdx: 0,
  setOnboardingStep: (step) => set({ onboardingStep: step }),
  advanceOnboarding: () => {
    const { onboardingStep, addMessage, dividerYs } = get();
    const order: OnboardingStep[] = ['idle', 'welcome', 'ask_swimlane', 'edit_swimlane', 'set_scope', 'define_phases', 'phase_detail', 'done'];
    const idx = order.indexOf(onboardingStep);
    let next = order[idx + 1] ?? 'done';
    // 역할 구분선 없으면 edit_swimlane 스킵
    if (next === 'edit_swimlane' && dividerYs.length === 0) next = 'set_scope';
    set({ onboardingStep: next });
    if (next === 'ask_swimlane') {
      const ctx = get().processContext;
      const processName = ctx?.processName || '이 프로세스';
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: `"${processName}"에 등장하는 주체가 누구누구인가요?\n\n예: 담당자 + 면접위원, 담당자 + 임직원처럼 주체가 2인 이상이라면 역할 구분선이 필요합니다.\n담당자가 전부 처리한다면 없어도 됩니다.`,
        quickActions: [
          { label: '역할 구분선 추가하기', storeAction: 'addSwimLaneAndAdvance' },
          { label: '단독 처리 - 다음', storeAction: 'advanceOnboarding' },
        ],
      });
    } else if (next === 'edit_swimlane') {
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: '역할 구분선이 추가됐어요!\n\n캔버스 좌측에서 깜빡이는 라벨을 클릭해서 실제 담당자/역할명으로 바꿔보세요.\nA주체 → B주체 순서로 바꾸면 자동으로 다음 단계로 넘어갑니다.',
      });
    } else if (next === 'set_scope') {
      // 종료 노드 없으면 자동 추가 (시작과 수평 정렬, 멀리 배치)
      const endExists = get().nodes.find(n => n.data.nodeType === 'end');
      if (!endExists) {
        get().addShape('end', '종료', { x: 0, y: 0 }); // 스마트 포지셔닝이 실제 위치 결정
        setTimeout(() => set({ pendingEditNodeId: null }), 10); // 자동 인라인 편집 억제
      }
      const scopeCtx = get().processContext;
      const scopeName = scopeCtx?.processName || '이 프로세스';
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: `다음으로 '${scopeName}'의 프로세스 범위를 한정해볼게요.\n\n시작 노드에는 이 L6가 어떤 트리거에 의해 착수되는지, 종료 노드에는 어떤 결과물/산출물로 완수되는지를 입력해보세요.\n\n예: 시작 "채용 요청 접수" → 종료 "최종 합격자 결정"`,
        quickActions: [
          { label: '🟢 시작 노드 작성하기', storeAction: 'focusStartNode', noActioned: true },
          { label: '🔴 종료 노드 작성하기', storeAction: 'focusEndNode', noActioned: true },
        ],
      });
    } else if (next === 'define_phases') {
      const dpCtx = get().processContext;
      const dpName = dpCtx?.processName || '이 업무';
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: `좋아요! 이제 '${dpName}'을 3~5개의 Phase로 나눠볼게요.\n\nAI가 이 업무에 맞는 Phase를 자동 추천할 수 있어요. 생성 후 캔버스 위 라벨을 클릭하면 이름 수정이 가능하고, 구분선은 드래그로 위치를 조정할 수 있어요.\n\n직접 그리시려면 상단 툴바의 'Phase 구분선' 버튼으로 구분선을 추가한 뒤, '✅ Phase 확정 완료'를 눌러주세요.`,
        quickActions: [
          { label: '✨ Phase 자동 생성', storeAction: 'suggestPhases', noActioned: true },
          { label: '✅ Phase 확정 완료', storeAction: 'advanceOnboarding' },
        ],
      });
    } else if (next === 'phase_detail') {
      set({ phaseDetailCount: 0, phaseDetailMaxPhaseIdx: 0 });
      const pdCtx = get().processContext;
      const phase1Name = get().phaseLabels[0] || 'Phase 1';
      const phase1Suggestions = buildPhaseOneSuggestions(phase1Name, pdCtx?.processName || '');
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: `Phase 1 '${phase1Name}' 구간부터 채워볼게요!\n\n이 구간에서 보통 일어나는 세부 단계를 추천해드릴게요. '추가' 버튼으로 캔버스에 바로 넣을 수 있어요.\n직접 우클릭으로 그리거나, 챗봇에 물어봐도 됩니다. 💬`,
        suggestions: phase1Suggestions,
        quickActions: [{ label: '✅ 완성 → L7 검증으로', storeAction: 'advanceOnboarding' }],
      });
    } else if (next === 'done') {
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: '🎉 기본 흐름 완성! 이제 L7 검증으로 각 단계의 표현이 적절한지 확인해봐요.\n위의 "L7 전체 검증" 버튼을 눌러보세요.',
        dismissible: true,
      });
      set({ onboardingStep: 'done' });
    }
  },
  skipOnboarding: () => {
    set({ onboardingStep: 'done' });
    get().addMessage({ id: generateId('msg'), role: 'bot', timestamp: Date.now(), text: '온보딩을 건너뛰었습니다. 언제든 질문하거나 우클릭으로 셰이프를 추가하세요!', dismissible: true });
  },

  suggestPhases: async () => {
    const { processContext, nodes } = get();
    if (!processContext) return;
    set({ loadingState: { active: true, message: 'Phase 구간 분석 중...', startTime: Date.now(), elapsed: 0 } });
    const prompt = `HR 업무 "${processContext.processName}"(L4: ${processContext.l4}, L5: ${processContext.l5})의 내부를 논리적으로 3~4개 Phase로 분해해줘.\n\n【중요 제약】이 L6 업무 자체의 내부 흐름만 Phase로 나눠야 해. 이 업무의 선행·후행에 해당하는 다른 L6(예: 신청접수, 결과통보 등)는 포함하지 마. 예를 들어 "서류심사"라면 "서류접수"가 아니라 "심사기준 파악"부터 시작해야 해.\n\n각 Phase 이름은 4~6글자 명사형(예: "심사기준파악", "서류검토", "합부판정"). 아래처럼 JSON 배열만 출력해 (설명 없이):\n["Phase1", "Phase2", "Phase3"]`;
    // LLM 응답에서 Phase 배열을 추출하는 헬퍼
    const extractPhaseNames = (text: string): string[] => {
      // 1차: JSON 배열 직접 파싱
      const jsonMatch = text.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length >= 2) return parsed.map(String).map(s => s.trim()).filter(Boolean);
        } catch {
          const items = jsonMatch[0].replace(/[\[\]"'「」【】]/g, '').split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean);
          if (items.length >= 2) return items;
        }
      }
      // 2차: 번호 목록 (1. 접수 / ① 검토 형식)
      const listItems = [...text.matchAll(/[①②③④⑤1-5][.\s、]\s*([가-힣a-zA-Z]{2,6})/g)].map(m => m[1]);
      if (listItems.length >= 2) return listItems;
      // 3차: 화살표 구분 텍스트 ("접수 → 검토 → 처리")
      if (/[→>→]/.test(text)) {
        const arrows = text.split(/\s*[→>→]\s*/)
          .map(s => s.match(/[가-힣a-zA-Z]{2,6}/)?.[0] ?? '')
          .filter(Boolean);
        if (arrows.length >= 2) return arrows;
      }
      return [];
    };
    // 업무명+L4/L5 기반 휴리스틱 폴백 — L345 실제 도메인 기반 명사형
    const heuristicFallback = (ctx: { processName: string; l4: string; l5: string }): string[] => {
      const n = ctx.processName;
      const l4 = ctx.l4 || '';
      const l5 = ctx.l5 || '';
      const all = `${n} ${l4} ${l5}`;
      // ── 채용 ────────────────────────────────────────────
      // ※ Phase명은 해당 L6 내부만 분해. 선행·후행 L6 업무(신청접수, 결과통보 등)는 포함하지 않음
      if (/서류심사|서류검토/.test(all)) return ['심사기준 파악', '서류 검토', '합부 판단', '합격자 확정'];
      if (/자격검증|GSAT|코딩테스트/.test(all)) return ['검증대상 확정', '시험 실시', '결과 채점', '합부 판정'];
      if (/면접/.test(all) && /선발|채용/.test(all)) return ['면접 준비', '면접 진행', '평가결과 집계', '합격자 선정'];
      if (/처우승인|처우협의|처우확정/.test(all)) return ['처우기준 확인', '처우 협의', '승인 결정', '처우 확정'];
      if (/온보딩|입사/.test(all)) return ['입사준비', '입사처리', '온보딩 실시', '적응 확인'];
      if (/채용.*계획|계획.*수립/.test(all) && /채용/.test(l4)) return ['채용수요 파악', '채용계획 수립', '계획 승인', '공고 준비'];
      if (/직무기술서/.test(all)) return ['현황 파악', '기술서 작성', '검토 승인', '배포 등록'];
      if (/소싱|인재발굴/.test(all)) return ['채널분석', '채널선정', '소싱실시', '결과관리'];
      if (/선확보|인력관리/.test(all) && /채용/.test(l4)) return ['현황파악', '관리계획수립', '관리실시', '결과보고'];
      // ── 급여/보상 ──────────────────────────────────────
      if (/정기급여|월급/.test(all)) return ['급여 산정', '내역 검토', '지급 승인', '급여 지급'];
      if (/인센티브/.test(all) && /지급/.test(l4)) return ['성과 산정', '내역 검토', '지급 승인', '인센 지급'];
      if (/연차수당/.test(all)) return ['연차 산정', '기준 확인', '지급 승인', '수당 지급'];
      if (/퇴직금/.test(all)) return ['퇴직 확인', '퇴직금 산정', '지급 승인', '퇴직금 지급'];
      if (/미지급금/.test(all)) return ['대상 확인', '금액 산정', '지급 승인', '미지급금 지급'];
      if (/연말정산/.test(all)) return ['자료 수집', '공제 검토', '세액 산출', '정산 완료'];
      if (/임금조정/.test(all)) return ['현황 분석', '조정안 수립', '승인 결정', '조정 적용'];
      if (/경영계획/.test(all) && /보상/.test(l4)) return ['현황 분석', '계획 수립', '승인 결정', '계획 확정'];
      // ── 법정복리후생 ─────────────────────────────────────
      if (/국민연금/.test(all)) return ['부과기준 확인', '보험료 산정', '신고 처리', '완료 통보'];
      if (/건강보험|노인장기요양/.test(all)) return ['정산기준 확인', '금액 산정', '신고 처리', '정산 완료'];
      if (/고용보험/.test(all)) return ['자격 확인', '신고 처리', '승인 처리', '완료 확인'];
      if (/산재보험/.test(all)) return ['신고 접수', '내용 확인', '신고 처리', '완료 통보'];
      // ── 기업복리후생 ─────────────────────────────────────
      if (/개인연금/.test(all)) return ['신청 접수', '자격 확인', '승인 처리', '납입 처리'];
      if (/의료비/.test(all)) return ['신청 접수', '영수증 확인', '지급 승인', '의료비 지급'];
      if (/학자금/.test(all)) return ['신청 접수', '자격 확인', '지급 승인', '학자금 지급'];
      if (/워터파크|휴양소/.test(all)) return ['신청 접수', '배정 처리', '이용 확인', '정산 처리'];
      if (/대부금/.test(all)) return ['신청 접수', '자격 심사', '승인 결정', '대출 실행'];
      if (/임원검진/.test(all)) return ['대상 선정', '검진 예약', '검진 실시', '결과 관리'];
      // ── 근태 ────────────────────────────────────────────
      if (/근무형태/.test(all)) return ['기준 확인', '대상 선정', '승인 결정', '시스템 반영'];
      if (/초과근무/.test(all)) return ['신청 접수', '승인 처리', '시간 집계', '수당 처리'];
      if (/근무무효|일반근태/.test(all)) return ['근태 수집', '이상 확인', '조정 처리', '확정 완료'];
      if (/휴가생성|임직원휴가/.test(all)) return ['기준 확인', '휴가 산정', '일정 생성', '시스템 반영'];
      // ── 노사 ────────────────────────────────────────────
      if (/직장내괴롭힘|괴롭힘/.test(all)) return ['신고 접수', '사실 확인', '조치 결정', '사후 관리'];
      if (/희망퇴직/.test(all)) return ['대상 선정', '신청 접수', '처우 협의', '퇴직 처리'];
      if (/단체교섭|교섭창구/.test(all)) return ['교섭 준비', '교섭 진행', '합의 결정', '협약 체결'];
      if (/단체협약/.test(all)) return ['협약 검토', '의견 수렴', '협약 체결', '이행 관리'];
      if (/정기협의회|협의위원/.test(all)) return ['의제 수집', '협의 준비', '협의 진행', '결과 관리'];
      if (/분쟁조정|쟁의/.test(all)) return ['신청 접수', '조정 준비', '조정 진행', '결과 처리'];
      if (/징계/.test(all)) return ['사실 조사', '위원회 소집', '징계 결정', '결과 통보'];
      if (/SCI|서베이|My Pulse/.test(all)) return ['설계 수립', '설문 배포', '결과 분석', '보고 완료'];
      if (/타운홀|Culture Week/.test(all)) return ['행사 기획', '행사 준비', '행사 진행', '결과 공유'];
      if (/동행파악|마음건강/.test(all)) return ['대상 선정', '면담 실시', '결과 정리', '지원 조치'];
      if (/Change Agent/.test(all)) return ['요원 선발', '역할 교육', '활동 실시', '결과 공유'];
      if (/조합관리/.test(all)) return ['현황 파악', '조합원 관리', '활동 지원', '결과 관리'];
      // ── 임원조직 ─────────────────────────────────────────
      if (/석세션|승계/.test(all)) return ['후보풀 구성', '역량 평가', '계획 수립', '계획 승인'];
      if (/조직개편/.test(all)) return ['현황 분석', '개편안 수립', '승인 결정', '개편 실행'];
      if (/조직도/.test(all)) return ['현황 확인', '조직도 작성', '검토 승인', '배포 공지'];
      if (/임원.*계약|임원.*퇴임/.test(all)) return ['계약 검토', '계약 체결', '등기 처리', '완료 통보'];
      if (/핵심리더/.test(all)) return ['후보 선정', '역량 평가', '선발 결정', '결과 통보'];
      if (/피드백.*면담|임원.*면담/.test(all)) return ['면담 준비', '면담 실시', '결과 정리', '후속 조치'];
      if (/SLP|TLP|양성과정|그룹장/.test(all)) return ['교육 기획', '참여 선발', '교육 운영', '수료 처리'];
      if (/임원부부|명상/.test(all)) return ['대상 선정', '일정 조율', '과정 운영', '수료 처리'];
      // ── 총무 ─────────────────────────────────────────────
      if (/날인|증명서/.test(all)) return ['신청 접수', '내용 확인', '날인 처리', '발급 완료'];
      if (/주차장/.test(all)) return ['신청 접수', '현황 확인', '배정 처리', '이용 관리'];
      if (/피트니스|회의실|숙박|시설|레이아웃/.test(all)) return ['신청 접수', '현황 확인', '배정 처리', '이용 확인'];
      if (/비품/.test(all)) return ['신청 접수', '재고 확인', '지급 처리', '자산 등록'];
      if (/법인차량|수행기사|업무버스/.test(all)) return ['배차 신청', '배차 승인', '운행 관리', '정산 처리'];
      if (/출장/.test(all)) return ['출장 신청', '출장 승인', '출장 지원', '경비 정산'];
      if (/사택/.test(all)) return ['신청 접수', '배정 결정', '입주 지원', '관리 이행'];
      if (/협력사/.test(all)) return ['업체 선정', '계약 체결', '이행 관리', '실적 점검'];
      if (/화음|두발로|S-Calling|안내센터/.test(all)) return ['현황 파악', '운영계획 수립', '운영 실시', '결과 점검'];
      // ── 해외인사 ─────────────────────────────────────────
      if (/부임/.test(all)) return ['후보 선발', '파견 준비', '부임 처리', '정착 지원'];
      if (/귀임/.test(all)) return ['귀임 결정', '귀임 준비', '귀임 처리', '복귀 지원'];
      if (/주재원.*관리/.test(all)) return ['현황 파악', '관리계획 수립', '관리 실시', '결과 보고'];
      if (/실사/.test(all)) return ['실사 준비', '문서 수집', '결과 분석', '보고 완료'];
      if (/PMI/.test(all)) return ['계획 수립', '실적 점검', '이슈 해결', '완료 보고'];
      if (/VP.*승격|승격.*운영/.test(all)) return ['후보 선정', '역량 평가', '승격 결정', '결과 통보'];
      if (/보상.*운영/.test(all) && /해외/.test(all)) return ['보상기준 확인', '금액 산정', '지급 승인', '보상 지급'];
      if (/STEP|양성파견|교격파견/.test(all)) return ['대상 선발', '파견 준비', '운영 관리', '복귀 처리'];
      if (/현지.*채용|재입사/.test(all)) return ['채용기준 확인', '후보 발굴', '심사 선발', '합격 처리'];
      // ── 최후 폴백 ─────────────────────────────────────────
      const prefix = n.replace(/\s/g, '').slice(0, 3);
      return [`${prefix} 신청`, `${prefix} 검토`, `${prefix} 처리`, `${prefix} 완료`];
    };
    const applyPhases = (phaseNames: string[]) => {
      const count = phaseNames.length;
      const sx = get().nodes.find(n => n.data.nodeType === 'start')?.position.x ?? 300;
      const ex = get().nodes.find(n => n.data.nodeType === 'end')?.position.x ?? (sx + 1500);
      get().setDividerXs(Array.from({ length: count - 1 }, (_, i) => sx + (ex - sx) * (i + 1) / count));
      const labels = [...get().phaseLabels];
      phaseNames.forEach((name, i) => { labels[i] = name; });
      get().setPhaseLabels(labels);
    };
    try {
      const resp = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, context: processContext || {}, currentNodes: [], currentEdges: [], recentTurns: [], conversationSummary: '' }),
      });
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json();
      const text = extractBotText(data);
      let phaseNames: string[] = [];
      try { phaseNames = extractPhaseNames(text); } catch { /* extractPhaseNames 실패 시 heuristic으로 */ }
      if (phaseNames.length < 2) phaseNames = heuristicFallback(processContext);
      if (phaseNames.length > 5) phaseNames = phaseNames.slice(0, 5);
      applyPhases(phaseNames);
      get().addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(), dismissible: true,
        text: `${phaseNames.length}단계 Phase를 그렸어요: ${phaseNames.join(' → ')}\n\n라벨을 클릭해서 이름을 수정하거나, 구분선을 드래그해서 범위를 조정하세요.`,
        quickActions: [{ label: '✅ Phase 확정 완료', storeAction: 'advanceOnboarding' }],
      });
    } catch {
      // 폴백: 업무명 기반 추론
      const fallback = heuristicFallback(processContext);
      applyPhases(fallback);
      get().addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(), dismissible: true,
        text: `연결이 원활하지 않아 '${processContext.processName}' 기반으로 ${fallback.length}단계 Phase를 추천했어요: ${fallback.join(' → ')}\n\n라벨을 클릭해서 수정할 수 있어요.`,
        quickActions: [{ label: '✅ Phase 확정 완료', storeAction: 'advanceOnboarding' }],
      });
    } finally {
      set({ loadingState: { active: false, message: '', startTime: 0, elapsed: 0 } });
    }
  },

  // v6: PDD history
  pddHistory: [],
  addPddHistory: (content) => set(s => ({ pddHistory: [...s.pddHistory, { content, timestamp: Date.now() }] })),

  showGuide: false, toggleGuide: () => set(s => ({ showGuide: !s.showGuide })),
  tourActive: false, tourStep: 0,
  startTour: () => set({ tourActive: true, tourStep: 0 }),
  nextTourStep: () => {
    const { tourStep } = get();
    if (tourStep >= 4) get().skipTour();
    else set({ tourStep: tourStep + 1 });
  },
  skipTour: () => { localStorage.setItem('pm-v5-tour-done', '1'); set({ tourActive: false, tourStep: 0 }); },

  // PDD Analysis
  pddAnalysis: null,
  analyzePDD: async () => {
    const { nodes, edges, processContext } = get();
    set({ loadingState: { active: true, message: 'PDD 자동분석 중...', startTime: Date.now(), elapsed: 0 } });
    try {
      debugTrace('analyzePDD:start', { nodeCount: nodes.length, edgeCount: edges.length });
      const { nodes: sn, edges: se } = serialize(nodes, edges);
      const r = await fetch(`${API_BASE_URL}/analyze-pdd`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: processContext || {}, currentNodes: sn, currentEdges: se }) });
      const data = await r.json();
      debugTrace('analyzePDD:success', { recommendationCount: (data?.recommendations || []).length });
      set({ pddAnalysis: data });
    } catch {
      debugTrace('analyzePDD:error');
      set({ pddAnalysis: null });
    }
    finally { set({ loadingState: { active: false, message: '', startTime: 0, elapsed: 0 } }); }
  },

  // v5: pending inline edit
  pendingEditNodeId: null,
  clearPendingEdit: () => set({ pendingEditNodeId: null }),

  _lastCoachingTrigger: {} as Record<string, number>,

  // v5.2: user activity tracking
  lastUserActivity: Date.now(),
  updateUserActivity: () => set({ lastUserActivity: Date.now() }),
  isUserActive: () => {
    const now = Date.now();
    const { lastUserActivity } = get();
    return (now - lastUserActivity) < 10000; // Active if interaction within 10s
  },

  // v5: contextual suggest — after adding shapes, debounced
  _contextualSuggestTimer: null as any,
  triggerContextualSuggest: () => {
    const timer = get()._contextualSuggestTimer;
    if (timer) clearTimeout(timer);
    const newTimer = setTimeout(async () => {
      const { nodes, edges, processContext, loadingState, addMessage, isUserActive } = get();
      if (loadingState.active || isUserActive()) return; // Skip if user is still active
      const processNodes = nodes.filter(n => ['process', 'decision', 'subprocess'].includes(n.data.nodeType));
      if (processNodes.length < 2) return; // don't suggest with too few nodes
      try {
        const { nodes: sn, edges: se } = serialize(nodes, edges);
        debugTrace('contextualSuggest:start', { nodeCount: sn.length, edgeCount: se.length });
        const r = await fetch(`${API_BASE_URL}/contextual-suggest`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: processContext || {}, currentNodes: sn, currentEdges: se }),
        });
        const d = await r.json();
        debugTrace('contextualSuggest:success', { hasGuidance: !!(d.guidance || d.hint), quickQueries: (d.quickQueries || []).length });
        if (d.guidance || d.quickQueries?.length) {
          addMessage({
            id: generateId('msg'), role: 'bot', timestamp: Date.now(),
            text: d.guidance || d.hint || '💡 플로우가 업데이트되었습니다.',
            quickQueries: d.quickQueries || [],
          });
        }
      } catch { debugTrace('contextualSuggest:error'); }
    }, 8000); // Increased from 5s to 8s for more user inactivity buffer
    set({ _contextualSuggestTimer: newTimer });
  },

  // v5.2: Proactive Coaching Triggers (with deduplication guard)
  checkFirstShape: async () => {
    const { nodes, edges, processContext, addMessage, _lastCoachingTrigger } = get();
    if (_lastCoachingTrigger['firstShape']) return; // 1회만 발화
    if (nodes.length <= 2) { // Only 시작 + 1 shape
      set({ _lastCoachingTrigger: { ..._lastCoachingTrigger, firstShape: Date.now() } });
      try {
        const { nodes: sn, edges: se } = serialize(nodes, edges);
        const r = await fetch(`${API_BASE_URL}/first-shape-welcome`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: processContext || {}, currentNodes: sn, currentEdges: se }),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.text) {
            addMessage({ id: generateId('msg'), role: 'bot', timestamp: Date.now(), text: d.text, quickQueries: d.quickQueries || [], dismissible: true });
          }
        }
      } catch { /* silent */ }
    }
  },

  checkOrphanedNodes: () => {
    const { nodes, edges, addMessage, _lastCoachingTrigger } = get();
    const now = Date.now();
    if (_lastCoachingTrigger['orphan'] && now - _lastCoachingTrigger['orphan'] < 60000) return;
    const allNodeIds = new Set(nodes.map(n => n.id));
    const sourceIds = new Set(edges.map(e => e.source));
    const targetIds = new Set(edges.map(e => e.target));
    const orphans = Array.from(allNodeIds).filter(id => !sourceIds.has(id) && !targetIds.has(id) && nodes.find(n => n.id === id)?.data.nodeType !== 'start');
    if (orphans.length > 0) {
      set({ _lastCoachingTrigger: { ..._lastCoachingTrigger, orphan: now } });
      const orphanLabels = orphans.map(id => nodes.find(n => n.id === id)?.data.label).filter(Boolean);
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: `🔗 ${orphans.length}개의 노드가 연결되지 않았어요: ${orphanLabels.join(', ')}. 어느 단계 이후에 실행되는지 연결해주시면 플로우가 더 명확해질 거예요.`,
        quickQueries: ['연결 구조를 어떻게 정하면 좋을까요?'],
        dismissible: true
      });
    }
  },

  checkFlowCompletion: () => {
    const { nodes, edges, addMessage, _lastCoachingTrigger } = get();
    if (_lastCoachingTrigger['completion']) return; // 1회만 발화
    const hasStart = nodes.some(n => n.data.nodeType === 'start');
    const hasEnd = nodes.some(n => n.data.nodeType === 'end');
    const processCount = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType)).length;
    if (hasStart && hasEnd && processCount >= 3 && edges.length >= processCount - 1) {
      set({ _lastCoachingTrigger: { ..._lastCoachingTrigger, completion: Date.now() } });
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: '✨ 플로우의 기본 구조가 완성된 것 같아요! 이제 각 단계의 L7 라벨을 다듬거나 L7 검증을 실행해보시겠어요?',
        quickQueries: ['L7 검증 실행', '라벨 다듬기 팁 주세요'],
        dismissible: true
      });
    }
  },

  checkDecisionLabels: (nodeId) => {
    const { nodes, edges, addMessage, _lastCoachingTrigger } = get();
    const now = Date.now();
    const key = `decision_${nodeId}`;
    if (_lastCoachingTrigger[key]) return; // 같은 노드에 대해 1회만
    const node = nodes.find(n => n.id === nodeId);
    if (node?.data.nodeType === 'decision') {
      const outEdges = edges.filter(e => e.source === nodeId);
      if (outEdges.length > 0 && !outEdges.some(e => e.label)) {
        set({ _lastCoachingTrigger: { ..._lastCoachingTrigger, [key]: now } });
        addMessage({
          id: generateId('msg'), role: 'bot', timestamp: Date.now(),
          text: `💭 분기점 "${node.data.label}"의 연결선에 조건을 표시하면 더 명확해질 수 있어요. 예: [예], [아니오], [예외] 등으로 라벨을 추가해보세요.`,
          quickQueries: ['분기 라벨링 예시 보기'],
          dismissible: true
        });
      }
    }
  },

  checkSwimLaneNeed: () => {
    const { nodes, dividerYs, addMessage, _lastCoachingTrigger } = get();
    if (_lastCoachingTrigger['swimLane']) return; // 1회만 발화
    const now = Date.now();
    const processCount = nodes.filter(n => !['start', 'end'].includes(n.data.nodeType)).length;
    if (processCount >= 6 && dividerYs.length === 0) {
      set({ _lastCoachingTrigger: { ..._lastCoachingTrigger, swimLane: now } });
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: '🏊 주체가 2명 이상이라면 역할 구분선을 추가해보세요. 단독 처리라면 없어도 됩니다.',
        quickActions: [{ label: '역할 구분선 설정하기', storeAction: 'toggleSwimLane' }],
        dismissible: true
      });
    }
  },

  // v5.3: one-click fixes
  splitCompoundNode: (nodeId: string) => {
    const { nodes, edges } = get();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const compound = detectCompoundAction(node.data.label);
    if (!compound.isCompound || compound.parts.length < 2) return;
    get().pushHistory();
    // 1. 기존 노드 라벨을 parts[0]으로 변경
    get().updateNodeLabel(nodeId, compound.parts[0], 'ai');
    // 2. 새 노드 생성 (parts[1]) — addShapeAfter가 엣지 재연결을 자동 처리
    get().addShapeAfter('process', compound.parts[1], nodeId);
    // L7 상태 초기화 (재검증 필요)
    set({ nodes: get().nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined } } : n) });
  },

  separateSystemName: (nodeId: string) => {
    const node = get().nodes.find(n => n.id === nodeId);
    if (!node) return;
    const result = validateL7Label(node.data.label, node.data.nodeType);
    if (!result.detectedSystemName) return;
    get().pushHistory();
    const sysName = result.detectedSystemName;
    // 라벨에서 시스템명 패턴 제거
    const escaped = sysName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let newLabel = node.data.label
      .replace(new RegExp(`[(\[（]${escaped}[)\\]）]\\s*`), '')
      .replace(new RegExp(`^${escaped}에서\\s*`), '')
      .trim();
    get().updateNodeLabel(nodeId, newLabel, 'ai');
    get().updateNodeMeta(nodeId, { systemName: sysName });
    // L7 상태 초기화 (재검증 필요)
    set({ nodes: get().nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined } } : n) });
  },

  resetToSetup: () => {
    // 현재 작업을 로컬 스토리지에 저장 후 초기 화면으로 복귀
    get().saveDraft();
    set({ processContext: null, mode: null, pddHistory: [], onboardingStep: 'idle' as OnboardingStep, dividerXs: [], phaseLabels: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'] });
  },

  celebrateL7Success: () => {
    const { nodes, addMessage, _lastCoachingTrigger } = get();
    if (_lastCoachingTrigger['l7Success']) return; // 1회만 발화
    const processNodes = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType));
    if (processNodes.length > 0 && processNodes.every(n => n.data.l7Status === 'pass')) {
      set({ _lastCoachingTrigger: { ..._lastCoachingTrigger, l7Success: Date.now() } });
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: '🎉 모든 단계가 L7 표준을 준수하고 있어요! 멋진 프로세스 설계입니다. 이제 검수나 공유를 진행하실 준비가 완료되었습니다.',
        dismissible: true
      });
    }
  },
}));

function friendlyTag(ruleId: string): string {
  const m: Record<string, string> = {
    'R-01': '길이 부족', 'R-02': '길이 초과',
    'R-03a': '금지 동사', 'R-03b': '구체화 권장', 'R-03': '구체화 권장',
    'R-04': '시스템명 분리', 'R-05': '복수 동작',
    'R-06': '주어 누락', 'R-07': '목적어 누락', 'R-08': '기준값 누락',
    'R-09': 'Decision 형식',
    'R-15': '표준 형식',
  };
  return m[ruleId] || ruleId;
}
