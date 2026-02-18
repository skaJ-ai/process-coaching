/**
 * L7 Rules Golden Set Test
 */

import { validateL7Label } from '../../src/utils/l7Rules';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

describe('L7 Rules Golden Set', () => {
  const goldenSet = loadGoldenSet();

  describe('Good labels', () => {
    test.each(goldenSet.good_labels)(
      'should pass for: $label',
      ({ label, nodeType, expected_issues }) => {
        const result = validateL7Label(label, nodeType);
        const actualIssues = result.issues.map(i => i.ruleId).sort();
        expect(actualIssues).toEqual(expected_issues.sort());
      }
    );
  });

  describe('R-01: 길이 부족', () => {
    test.each(goldenSet.bad_labels_r01)(
      'should detect R-01 for: $label',
      ({ label, nodeType, expected_issues }) => {
        const result = validateL7Label(label, nodeType);
        const actualIssues = result.issues.map(i => i.ruleId).sort();
        expect(actualIssues).toEqual(expected_issues.sort());
      }
    );
  });

  describe('R-02: 길이 초과', () => {
    test.each(goldenSet.bad_labels_r02)(
      'should detect R-02 for long labels',
      ({ label, nodeType, expected_issues }) => {
        const result = validateL7Label(label, nodeType);
        const actualIssues = result.issues.map(i => i.ruleId).sort();
        expect(actualIssues).toEqual(expect.arrayContaining(expected_issues));
      }
    );
  });

  describe('R-03: 모호 동사', () => {
    test.each(goldenSet.bad_labels_r03)(
      'should detect R-03 for: $label',
      ({ label, nodeType, expected_issues }) => {
        const result = validateL7Label(label, nodeType);
        const actualIssues = result.issues.map(i => i.ruleId).sort();
        expect(actualIssues).toEqual(expected_issues.sort());
      }
    );
  });

  describe('R-04: 시스템명 괄호 혼입', () => {
    test.each(goldenSet.bad_labels_r04)(
      'should detect R-04 for: $label',
      ({ label, nodeType, expected_issues }) => {
        const result = validateL7Label(label, nodeType);
        const actualIssues = result.issues.map(i => i.ruleId).sort();
        expect(actualIssues).toEqual(expected_issues.sort());
      }
    );
  });

  describe('R-05: 복수 동작', () => {
    test.each(goldenSet.bad_labels_r05)(
      'should detect R-05 for: $label',
      ({ label, nodeType, expected_issues }) => {
        const result = validateL7Label(label, nodeType);
        const actualIssues = result.issues.map(i => i.ruleId).sort();
        expect(actualIssues).toEqual(expected_issues.sort());
      }
    );

    describe('R-05 False Positives', () => {
      test.each(goldenSet.r05_false_positives)(
        'should NOT falsely detect R-05 for: $label ($note)',
        ({ label, nodeType, expected_issues }) => {
          const result = validateL7Label(label, nodeType);
          const actualIssues = result.issues.map(i => i.ruleId).sort();

          // R-05가 expected_issues에 없으면, actualIssues에도 R-05가 없어야 함
          if (!expected_issues.includes('R-05')) {
            expect(actualIssues).not.toContain('R-05');
          }
        }
      );
    });
  });

  describe('R-08: decision 기준값 누락', () => {
    test.each(goldenSet.bad_labels_r08)(
      'should detect R-08 for: $label',
      ({ label, nodeType, expected_issues }) => {
        const result = validateL7Label(label, nodeType);
        const actualIssues = result.issues.map(i => i.ruleId).sort();
        expect(actualIssues).toEqual(expect.arrayContaining(expected_issues));
      }
    );
  });

  describe('R-15: 표준 형식', () => {
    test.each(goldenSet.bad_labels_r15)(
      'should detect R-15 for: $label',
      ({ label, nodeType, expected_issues }) => {
        const result = validateL7Label(label, nodeType);
        const actualIssues = result.issues.map(i => i.ruleId).sort();
        expect(actualIssues).toEqual(expected_issues.sort());
      }
    );
  });

  describe('Edge cases', () => {
    test.each(goldenSet.edge_cases)(
      'should handle edge case: $note',
      ({ label, nodeType, expected_issues }) => {
        const result = validateL7Label(label, nodeType);
        const actualIssues = result.issues.map(i => i.ruleId).sort();
        expect(actualIssues).toEqual(expect.arrayContaining(expected_issues));
      }
    );
  });
});
