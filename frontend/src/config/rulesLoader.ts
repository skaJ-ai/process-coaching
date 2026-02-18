/**
 * L7 규칙 런타임 설정 — l7_rules.yaml의 TypeScript 미러
 *
 * 이 파일은 l7_rules.yaml을 정확히 반영해야 한다.
 * YAML이 변경되면 이 파일도 함께 변경할 것.
 *
 * 설계 의도:
 * - YAML: 사람이 읽는 정의 문서, 향후 BE 공유 기반
 * - 이 파일: 프론트엔드 런타임이 실제 참조하는 단일 소스
 * - 나중에 CI에서 YAML ↔ 이 파일 동기화 검증 추가 가능
 */

// R-03a: 금지 동사 — 어떤 맥락에서도 L7 라벨로 부적합 (severity: reject)
export const BANNED_VERBS: string[] = [
  '처리한다',
  '진행한다',
  '관리한다',
  '대응한다',
  '지원한다',
];

// R-03b: 구체화 권장 동사 — 대안 동사로 바꾸면 더 명확 (severity: warning)
export const REFINABLE_VERBS: Record<string, string> = {
  '확인한다': '조회한다, 비교한다, 검증한다',
  '검토한다': '비교한다, 판정한다, 검증한다',
  '개선한다': '수정한다, 재작성한다',
  '최적화한다': '수정한다, 재설정한다',
  '정리한다': '분류한다, 집계한다, 삭제한다',
  '공유한다': '안내한다, 발송한다, 공지한다',
  '조율한다': '요청한다, 협의한다',
  '협의한다': '요청한다, 회의한다',
  '반영한다': '입력한다, 수정한다, 저장한다',
};

// 하위호환: 기존 코드에서 VAGUE_VERBS를 참조하는 곳 대응
export const VAGUE_VERBS: string[] = [...BANNED_VERBS, ...Object.keys(REFINABLE_VERBS)];

// R-07: 타동사 목록 — 목적어(을/를)가 필요한 동사
export const TRANSITIVE_VERBS: string[] = [
  '조회한다', '입력한다', '수정한다', '저장한다', '추출한다', '비교한다',
  '집계한다', '기록한다', '첨부한다', '판정한다', '승인한다', '반려한다',
];

// R-04: 시스템명 추출 패턴 — 괄호 내부 또는 "~에서" 앞 텍스트
export const SYSTEM_NAME_PATTERNS: RegExp[] = [
  /[(\[（]([^)\]）]+)[)\]）]/,       // (시스템명) 또는 [시스템명]
  /^(.+?)(에서)\s/,                  // "SAP에서 급여를 조회한다"
];

// R-05: 복수 동작 감지 패턴 (l7_rules.yaml의 compound_patterns와 동기화)
export const COMPOUND_PATTERNS: RegExp[] = [
  /(.+?하고),?\s*(.+?한다)/,
  /(.+?하며),?\s*(.+?한다)/,
  /(.+?한)\s+후\s*(.+?한다)/,
  /(.+?한다),\s*(.+?한다)/,
];

// R-05: 의도/희망 표현 예외 패턴 (l7_rules.yaml의 intent_exclude_patterns와 동기화)
export const INTENT_EXCLUDE_PATTERNS: RegExp[] = [
  /하고자\s*(한다|합니다|했다|했습니다)/,
  /하고\s*싶다/,
  /하고\s*싶었다/,
];

// R-08: decision 노드 판단 기준 힌트 목록 (l7_rules.yaml의 decision_hints와 동기화)
export const DECISION_HINTS: string[] = [
  '여부',
  '?',
  '인가',
  '인지',
  '이상',
  '이하',
  '초과',
  '미만',
  '승인',
  '반려',
  '가능',
  '불가',
];
