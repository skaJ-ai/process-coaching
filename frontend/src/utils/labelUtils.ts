/**
 * L7 라벨 유틸리티 함수들
 */

import { COMPOUND_PATTERNS, INTENT_EXCLUDE_PATTERNS } from '../config/rulesLoader';

export interface CompoundActionDetection {
  isCompound: boolean;
  parts: string[];
}

/**
 * 라벨에 복합문(여러 동작)이 있는지 감지
 * 예: "지원서를 접수하고, 적격여부를 판정한다" → isCompound: true, parts: ["지원서를 접수한다", "적격여부를 판정한다"]
 */
export function detectCompoundAction(label: string): CompoundActionDetection {
  if (!label) return { isCompound: false, parts: [label] };

  // 의도/희망 표현 제외 — 복수 동작이 아님 (rulesLoader의 INTENT_EXCLUDE_PATTERNS)
  if (INTENT_EXCLUDE_PATTERNS.some(p => p.test(label))) {
    return { isCompound: false, parts: [label] };
  }

  // 복합문 패턴들 (rulesLoader의 COMPOUND_PATTERNS)
  const patterns = COMPOUND_PATTERNS.map(regex => ({ regex, name: '그리고' }));

  for (const { regex, name } of patterns) {
    const match = label.match(regex);
    if (match && match[1] && match[2]) {
      // 추출한 부분을 정규화 (뒤에 다 붙임)
      const part1 = match[1].endsWith('한다') || match[1].endsWith('하') ? match[1] : match[1] + '다';
      const part2 = match[2].endsWith('한다') ? match[2] : match[2].endsWith('다') ? match[2] : match[2] + '다';
      return {
        isCompound: true,
        parts: [part1, part2],
      };
    }
  }

  return { isCompound: false, parts: [label] };
}

/**
 * 라벨 길이 체크
 */
export function validateLabelLength(label: string): { valid: boolean; issue?: string } {
  const trimmed = label.trim();
  if (trimmed.length < 4) return { valid: false, issue: '길이 부족 (4자 이상 권장)' };
  if (trimmed.length > 100) return { valid: false, issue: '길이 초과 (100자 이내 권장)' };
  return { valid: true };
}
