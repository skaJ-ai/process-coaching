import { L7Issue } from '../types';
import { detectCompoundAction } from './labelUtils';
import {
  BANNED_VERBS,
  REFINABLE_VERBS,
  TRANSITIVE_VERBS,
  SYSTEM_NAME_PATTERNS,
  DECISION_HINTS,
} from '../config/rulesLoader';

export interface L7ValidationResult {
  pass: boolean;
  score: number;
  confidence: 'high';
  issues: L7Issue[];
  rewriteSuggestion?: string;
  encouragement?: string;
  /** R-04: 시스템명 자동 추출 결과 (UI에서 원클릭 분리에 활용) */
  detectedSystemName?: string;
}

type Severity = 'reject' | 'warning' | 'suggestion';

function issue(
  ruleId: string,
  severity: Severity,
  friendlyTag: string,
  message: string,
  suggestion?: string,
  reasoning?: string,
): L7Issue {
  return { ruleId, severity, friendlyTag, message, suggestion, reasoning };
}

function hasDecisionCriteria(label: string): boolean {
  return DECISION_HINTS.some((hint) => label.includes(hint));
}

function hasStandardEnding(label: string, nodeType: string): boolean {
  const normalized = label.trim();
  if (!normalized) return false;
  if (nodeType === 'decision') {
    return normalized.endsWith('?') || normalized.endsWith('인가?') || normalized.endsWith('여부') || hasDecisionCriteria(normalized);
  }
  return normalized.endsWith('한다') || normalized.endsWith('한다.');
}

/** 시스템명 추출: 괄호 내부 또는 "~에서" 앞 텍스트 */
function extractSystemName(label: string): string | undefined {
  for (const pattern of SYSTEM_NAME_PATTERNS) {
    const match = label.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

/** 목적어 조사(을/를/에/에서) 존재 여부 */
function hasObjectParticle(label: string): boolean {
  return /[을를]/.test(label);
}

/** 주어 조사(이/가/은/는) 존재 여부 */
function hasSubjectParticle(label: string): boolean {
  return /[이가은는]/.test(label) && /[이가은는]\s/.test(label);
}

/**
 * L7 라벨 검증 — 확정 규칙 v2 (2026-02-18)
 *
 * @param label 노드 라벨
 * @param nodeType 노드 타입 (process | decision)
 * @param hasSwimLane 스윔레인 활성화 여부 (R-06 조건부 체크용)
 */
export function validateL7Label(
  label: string,
  nodeType: string,
  hasSwimLane: boolean = false,
): L7ValidationResult {
  const text = (label || '').trim();
  const issues: L7Issue[] = [];
  let detectedSystemName: string | undefined;

  // ── R-01: 길이 부족 ──
  if (text.length < 4) {
    issues.push(issue(
      'R-01', 'warning', '길이 부족',
      '라벨이 너무 짧아 의미 전달이 어려울 수 있어요',
      '동작과 대상이 드러나도록 조금 더 구체화해보세요.',
    ));
  }

  // ── R-02: 길이 초과 ──
  if (text.length > 100) {
    issues.push(issue(
      'R-02', 'warning', '길이 초과',
      '라벨이 길어지면 핵심 동작이 흐려질 수 있어요',
      '핵심 동작 1개 중심으로 간결하게 줄여보세요.',
    ));
  }

  // ── R-03a: 금지 동사 (reject) ──
  const bannedVerb = BANNED_VERBS.find((v) => text.includes(v));
  if (bannedVerb) {
    issues.push(issue(
      'R-03a', 'reject', '금지 동사',
      `'${bannedVerb}'는 L7 라벨로 사용할 수 없어요`,
      '조회한다, 입력한다, 저장한다, 승인한다 같은 구체 동사로 바꿔주세요.',
      '이 동사는 어떤 맥락에서도 구체적 행위를 나타내지 않아 제3자가 수행할 수 없습니다.',
    ));
  }

  // ── R-03b: 구체화 권장 동사 (warning) — 금지 동사가 아닌 경우만 ──
  if (!bannedVerb) {
    const refinableVerb = Object.keys(REFINABLE_VERBS).find((v) => text.includes(v));
    if (refinableVerb) {
      const alternatives = REFINABLE_VERBS[refinableVerb];
      issues.push(issue(
        'R-03b', 'warning', '구체화 권장',
        `'${refinableVerb}' 대신 구체 동사를 쓰면 더 명확해질 수 있어요`,
        `대안: ${alternatives}`,
        '구체적 동사는 제3자가 정확히 이해할 수 있도록 도와줍니다.',
      ));
    }
  }

  // ── R-04: 시스템명 혼입 (warning + 추출) ──
  detectedSystemName = extractSystemName(text);
  if (detectedSystemName) {
    issues.push(issue(
      'R-04', 'warning', '시스템명 분리',
      `시스템명 '${detectedSystemName}'이 감지되었습니다. 메타데이터로 분리하면 라벨이 깔끔해져요`,
      `라벨은 동작만 남기고 '${detectedSystemName}'은 시스템명 필드에 입력해보세요.`,
      '라벨과 시스템명을 분리하면 프로세스 로직이 명확해집니다.',
    ));
  } else if (/[()\[\]（）]/.test(text)) {
    // 괄호는 있지만 시스템명 추출 실패 — 일반 경고
    issues.push(issue(
      'R-04', 'warning', '시스템명 분리',
      '괄호가 포함되어 있어요. 시스템명이라면 메타데이터로 분리하면 가독성이 좋아져요',
      "라벨은 동작만 남기고 시스템명은 '시스템명' 필드에 입력해보세요.",
    ));
  }

  // ── R-05: 복수 동작 (reject) ──
  const compound = detectCompoundAction(text);
  if (compound.isCompound) {
    issues.push(issue(
      'R-05', 'reject', '복수 동작',
      '한 라벨에 동작이 2개 이상 포함되어 있어요',
      `각 동작을 별도 단계로 분리해보세요: "${compound.parts[0]}" / "${compound.parts[1]}"`,
      '하나의 화면 내 연속 동작 = 1개 L7 원칙에 따라 분리가 필요합니다.',
    ));
  }

  // ── R-07: 목적어 누락 (warning) ──
  if (text.length >= 4) {
    const usedTransitive = TRANSITIVE_VERBS.find((v) => text.includes(v));
    if (usedTransitive && !hasObjectParticle(text)) {
      issues.push(issue(
        'R-07', 'warning', '목적어 누락',
        `'${usedTransitive}'는 타동사인데 목적어(을/를)가 없어요`,
        `예: "급여를 ${usedTransitive}" 형태로 대상을 명시해보세요.`,
        '목적어가 있으면 제3자가 무엇에 대한 동작인지 바로 알 수 있습니다.',
      ));
    }
  }

  // ── R-06: 주어 누락 (suggestion, 스윔레인 미사용 시만) ──
  if (!hasSwimLane && text.length >= 4 && hasObjectParticle(text) && !hasSubjectParticle(text)) {
    issues.push(issue(
      'R-06', 'suggestion', '주어 누락',
      '주체가 명시되지 않았어요',
      '스윔레인으로 역할을 구분하거나, 라벨에 주어를 추가하면 제3자가 이해하기 쉬워집니다.',
      '원본 가이드라인: (주어) + 목적어 + 동사 — 괄호는 선택이지만 명시하면 더 명확합니다.',
    ));
  }

  // ── R-08: 기준값 누락 (decision만) ──
  if (nodeType === 'decision' && !hasDecisionCriteria(text)) {
    issues.push(issue(
      'R-08', 'warning', '기준값 누락',
      '분기 기준이 드러나지 않아 의사결정 조건이 모호할 수 있어요',
      "'~여부', '~인가?' 또는 기준값(예: 1억원 초과)을 라벨에 포함해보세요.",
    ));
  }

  // ── R-15: 표준 형식 ──
  if (text.length >= 4 && !hasStandardEnding(text, nodeType)) {
    issues.push(issue(
      'R-15', 'warning', '표준 형식',
      '표준 어미를 맞추면 전체 플로우의 일관성이 좋아져요',
      nodeType === 'decision'
        ? "'~여부' 또는 '~인가?' 형태를 권장해요."
        : "'~한다' 형태로 마무리해보세요.",
    ));
  }

  // ── 점수 계산 (감점제) ──
  const rejectCount = issues.filter((i) => i.severity === 'reject').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const suggestionCount = issues.filter((i) => i.severity === 'suggestion').length;
  const score = Math.max(0, 100 - rejectCount * 30 - warningCount * 10 - suggestionCount * 3);

  // ── 판정 ──
  const pass = rejectCount === 0;

  return {
    pass,
    score,
    confidence: 'high',
    issues,
    detectedSystemName,
    encouragement: issues.length === 0
      ? '좋은 라벨입니다. 현재 기준을 잘 지키고 있어요.'
      : pass
        ? '좋은 방향입니다. 제안을 반영하면 더 명확해질 수 있어요.'
        : '수정이 필요한 항목이 있어요. 제안을 참고해주세요.',
  };
}
