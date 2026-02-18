/**
 * L7 Rules Golden Set Test
 *
 * 이 테스트는 l7Rules.ts의 정확도를 측정합니다.
 * - Precision: 검출한 이슈 중 실제 이슈의 비율
 * - Recall: 실제 이슈 중 검출한 이슈의 비율
 */

import { validateL7Label } from '../../src/utils/l7Rules.js';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';

interface LabelSample {
  label: string;
  nodeType: string;
  expected_issues: string[];
  note?: string;
}

interface GoldenSet {
  good_labels: LabelSample[];
  bad_labels_r01: LabelSample[];
  bad_labels_r02: LabelSample[];
  bad_labels_r03: LabelSample[];
  bad_labels_r04: LabelSample[];
  bad_labels_r05: LabelSample[];
  r05_false_positives: LabelSample[];
  bad_labels_r08: LabelSample[];
  bad_labels_r15: LabelSample[];
  edge_cases: LabelSample[];
}

function loadGoldenSet(): GoldenSet {
  const filePath = path.join(__dirname, 'label_samples.yaml');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  return yaml.parse(fileContent);
}

function testSample(sample: LabelSample): { pass: boolean; details: string } {
  const result = validateL7Label(sample.label, sample.nodeType);
  const actualIssues = result.issues.map(i => i.ruleId).sort();
  const expectedIssues = sample.expected_issues.sort();

  const pass = JSON.stringify(actualIssues) === JSON.stringify(expectedIssues);

  if (!pass) {
    return {
      pass: false,
      details: `Label: "${sample.label}"\n  Expected: [${expectedIssues.join(', ')}]\n  Actual:   [${actualIssues.join(', ')}]\n  Note: ${sample.note || 'N/A'}`
    };
  }

  return { pass: true, details: '' };
}

function calculateMetrics(results: { pass: boolean }[]) {
  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  const accuracy = (passed / total) * 100;

  return {
    total,
    passed,
    failed: total - passed,
    accuracy: accuracy.toFixed(2)
  };
}

function runTests() {
  console.log('=== L7 Rules Golden Set Test ===\n');

  const goldenSet = loadGoldenSet();
  const allSamples = [
    ...goldenSet.good_labels,
    ...goldenSet.bad_labels_r01,
    ...goldenSet.bad_labels_r02,
    ...goldenSet.bad_labels_r03,
    ...goldenSet.bad_labels_r04,
    ...goldenSet.bad_labels_r05,
    ...goldenSet.r05_false_positives,
    ...goldenSet.bad_labels_r08,
    ...goldenSet.bad_labels_r15,
    ...goldenSet.edge_cases
  ];

  const results = allSamples.map(testSample);
  const metrics = calculateMetrics(results);

  console.log(`Total Samples: ${metrics.total}`);
  console.log(`Passed: ${metrics.passed} (${metrics.accuracy}%)`);
  console.log(`Failed: ${metrics.failed}\n`);

  const failures = results.filter(r => !r.pass);
  if (failures.length > 0) {
    console.log('=== Failures ===\n');
    failures.forEach(f => console.log(f.details + '\n'));
  }

  // Rule별 정확도
  console.log('=== Per-Rule Accuracy ===\n');

  const ruleGroups = {
    'R-01': goldenSet.bad_labels_r01,
    'R-02': goldenSet.bad_labels_r02,
    'R-03': goldenSet.bad_labels_r03,
    'R-04': goldenSet.bad_labels_r04,
    'R-05': [...goldenSet.bad_labels_r05, ...goldenSet.r05_false_positives],
    'R-08': goldenSet.bad_labels_r08,
    'R-15': goldenSet.bad_labels_r15,
  };

  for (const [ruleId, samples] of Object.entries(ruleGroups)) {
    const ruleResults = samples.map(testSample);
    const ruleMetrics = calculateMetrics(ruleResults);
    console.log(`${ruleId}: ${ruleMetrics.accuracy}% (${ruleMetrics.passed}/${ruleMetrics.total})`);
  }

  // R-05 오탐률 특별 체크
  console.log('\n=== R-05 False Positive Analysis ===\n');
  const r05FalsePositives = goldenSet.r05_false_positives.map(testSample);
  const r05FPMetrics = calculateMetrics(r05FalsePositives);
  console.log(`R-05 False Positive Accuracy: ${r05FPMetrics.accuracy}%`);
  console.log(`(${r05FPMetrics.passed} correctly NOT flagged as R-05 out of ${r05FPMetrics.total})`);

  process.exit(failures.length > 0 ? 1 : 0);
}

runTests();
