/**
 * YAML ↔ rulesLoader.ts 동기화 검증 스크립트
 *
 * 목적:
 *   l7_rules.yaml의 리스트 값이 rulesLoader.ts와 일치하는지 확인한다.
 *   CI 또는 사전 커밋 훅에서 실행하여 불일치를 조기에 잡는다.
 *
 * 실행:
 *   node scripts/check-rules-sync.cjs
 *
 * 종료 코드:
 *   0 = 동기화 정상
 *   1 = 불일치 발견
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const YAML_PATH = path.join(ROOT, 'src/config/l7_rules.yaml');
const TS_PATH = path.join(ROOT, 'src/config/rulesLoader.ts');

// ─── YAML 파서 (리스트 값만 추출) ───────────────────────────────────────────

function parseYamlListUnder(yaml, parentKey, listKey) {
  const lines = yaml.split('\n');
  let inParent = false;
  let inList = false;
  const result = [];

  for (const line of lines) {
    // 부모 키 블록 진입
    if (new RegExp(`^  ${parentKey}:`).test(line)) {
      inParent = true;
      inList = false;
      continue;
    }
    if (!inParent) continue;

    // 리스트 키 진입
    if (new RegExp(`^    ${listKey}:`).test(line)) {
      inList = true;
      continue;
    }

    if (inList) {
      const item = line.match(/^\s+-\s+"?(.+?)"?\s*$/);
      if (item) {
        result.push(item[1]);
      } else if (line.match(/^\s{4,}\w/) && !line.match(/^\s+-/)) {
        // 다른 키 시작 → 리스트 종료
        inList = false;
      }
    }

    // 다음 최상위 규칙 블록 시작 → 부모 종료
    if (/^  R-\d+:/.test(line) && inParent) {
      inParent = false;
      inList = false;
    }
  }
  return result;
}

// ─── TS 파서 (배열 상수 값 추출) ────────────────────────────────────────────

function parseTsArray(ts, constName) {
  const match = ts.match(
    new RegExp(`export const ${constName}[^=]*=\\s*\\[([\\s\\S]*?)\\];`)
  );
  if (!match) return null;
  const body = match[1];
  const items = [];
  for (const m of body.matchAll(/'([^']+)'/g)) {
    items.push(m[1]);
  }
  // 정규식 패턴도 추출 (RegExp 리터럴)
  for (const m of body.matchAll(/\/([^/]+)\//g)) {
    items.push(m[1]);
  }
  return items;
}

// ─── 비교 ────────────────────────────────────────────────────────────────────

function setDiff(a, b) {
  const bSet = new Set(b);
  return a.filter(x => !bSet.has(x));
}

function check(label, yaml_items, ts_items) {
  if (!ts_items) {
    console.error(`  ✗ ${label}: rulesLoader.ts에서 상수를 찾지 못했습니다.`);
    return false;
  }
  const onlyInYaml = setDiff(yaml_items, ts_items);
  const onlyInTs = setDiff(ts_items, yaml_items);

  if (onlyInYaml.length === 0 && onlyInTs.length === 0) {
    console.log(`  ✓ ${label}: 동기화 정상 (${yaml_items.length}개)`);
    return true;
  }

  console.error(`  ✗ ${label}: 불일치 발견`);
  if (onlyInYaml.length > 0) console.error(`    YAML에만 있음: ${onlyInYaml.join(', ')}`);
  if (onlyInTs.length > 0)   console.error(`    TS에만 있음:   ${onlyInTs.join(', ')}`);
  return false;
}

// ─── main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('=== YAML ↔ rulesLoader.ts 동기화 검증 ===\n');

  const yaml = fs.readFileSync(YAML_PATH, 'utf8');
  const ts   = fs.readFileSync(TS_PATH, 'utf8');

  let allOk = true;

  // R-03: vague_verbs ↔ VAGUE_VERBS
  const yamlVagueVerbs = parseYamlListUnder(yaml, 'R-03', 'vague_verbs');
  const tsVagueVerbs   = parseTsArray(ts, 'VAGUE_VERBS');
  if (!check('R-03 vague_verbs ↔ VAGUE_VERBS', yamlVagueVerbs, tsVagueVerbs)) allOk = false;

  // R-08: decision_hints ↔ DECISION_HINTS
  const yamlDecisionHints = parseYamlListUnder(yaml, 'R-08', 'decision_hints');
  const tsDecisionHints   = parseTsArray(ts, 'DECISION_HINTS');
  if (!check('R-08 decision_hints ↔ DECISION_HINTS', yamlDecisionHints, tsDecisionHints)) allOk = false;

  // R-05 패턴 개수 일치 여부 (정규식 내용은 수동 확인)
  const yamlCompound = parseYamlListUnder(yaml, 'R-05', 'compound_patterns');
  const yamlIntent   = parseYamlListUnder(yaml, 'R-05', 'intent_exclude_patterns');

  const tsCompoundMatch = ts.match(/export const COMPOUND_PATTERNS[^=]*=\s*\[[\s\S]*?\];/);
  const tsIntentMatch   = ts.match(/export const INTENT_EXCLUDE_PATTERNS[^=]*=\s*\[[\s\S]*?\];/);
  const tsCompoundCount = (tsCompoundMatch?.[0].match(/\/[^/]+\//g) || []).length;
  const tsIntentCount   = (tsIntentMatch?.[0].match(/\/[^/]+\//g) || []).length;

  if (yamlCompound.length === tsCompoundCount) {
    console.log(`  ✓ R-05 compound_patterns 개수 일치: ${yamlCompound.length}개`);
  } else {
    console.error(`  ✗ R-05 compound_patterns 개수 불일치: YAML=${yamlCompound.length}, TS=${tsCompoundCount}`);
    allOk = false;
  }
  if (yamlIntent.length === tsIntentCount) {
    console.log(`  ✓ R-05 intent_exclude_patterns 개수 일치: ${yamlIntent.length}개`);
  } else {
    console.error(`  ✗ R-05 intent_exclude_patterns 개수 불일치: YAML=${yamlIntent.length}, TS=${tsIntentCount}`);
    allOk = false;
  }

  console.log('');
  if (allOk) {
    console.log('모든 항목 동기화 정상.\n');
    process.exit(0);
  } else {
    console.error('동기화 불일치 발견. l7_rules.yaml 또는 rulesLoader.ts를 수정하세요.\n');
    process.exit(1);
  }
}

main();
