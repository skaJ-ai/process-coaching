import { Edge, Node } from 'reactflow';
import { FlowNodeData } from '../types';

export type StructRuleId =
  | 'S-01' | 'S-02' | 'S-03' | 'S-04' | 'S-05'
  | 'S-06' | 'S-07' | 'S-08' | 'S-09' | 'S-10' | 'S-11' | 'S-12' | 'S-13'
  | 'S-14' | 'S-15';

export interface StructIssue {
  ruleId: StructRuleId;
  severity: 'warning';
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
}

export interface StructAnalysisResult {
  issues: StructIssue[];
}

const DEFAULT_LABELS = ['새 태스크', '새 판단', '새 서브프로세스', 'New Task'];

export function analyzeStructure(nodes: Node<FlowNodeData>[], edges: Edge[], mode?: string | null): StructAnalysisResult {
  const issues: StructIssue[] = [];
  const flowNodes = nodes.filter((n) => !['start', 'end'].includes(n.data.nodeType));
  const deleteTargetIds = new Set(
    mode === 'TO-BE' ? nodes.filter((n) => n.data.category === 'delete_target').map((n) => n.id) : []
  );

  // ── S-01: 종료 노드 필수 ──
  const hasEnd = nodes.some((n) => n.data.nodeType === 'end');
  if (!hasEnd) {
    issues.push({
      ruleId: 'S-01',
      severity: 'warning',
      message: '종료 노드가 없으면 프로세스 범위가 불명확할 수 있어요.',
    });
  }

  // ── S-02: 빈 라벨 방치 ──
  const defaultLabelIds = flowNodes
    .filter((n) => {
      const label = (n.data.label || '').trim();
      return !label || DEFAULT_LABELS.includes(label);
    })
    .map((n) => n.id);
  if (defaultLabelIds.length > 0) {
    issues.push({
      ruleId: 'S-02',
      severity: 'warning',
      message: `기본 라벨이 그대로인 단계가 ${defaultLabelIds.length}개 있어요. 구체적인 라벨로 바꿔주세요.`,
      nodeIds: defaultLabelIds,
    });
  }

  // ── S-03: 고아 노드 (연결 없는 노드) — delete_target 제외 (고립이 정상) ──
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.source);
    connected.add(e.target);
  }
  const orphanIds = flowNodes
    .filter((n) => !connected.has(n.id) && !deleteTargetIds.has(n.id))
    .map((n) => n.id);
  if (orphanIds.length > 0) {
    issues.push({
      ruleId: 'S-03',
      severity: 'warning',
      message: `연결되지 않은 단계 ${orphanIds.length}개가 있습니다.`,
      nodeIds: orphanIds,
    });
  }

  // ── S-04: 흐름 끊김 (process/decision에 나가는 연결 없음) — delete_target 제외 ──
  const noOutgoingIds = flowNodes
    .filter((n) => ['process', 'decision', 'subprocess', 'parallel'].includes(n.data.nodeType))
    .filter((n) => !deleteTargetIds.has(n.id))
    .filter((n) => connected.has(n.id)) // 고아가 아닌 노드만 (고아는 S-03에서 처리)
    .filter((n) => !edges.some((e) => e.source === n.id))
    .map((n) => n.id);
  if (noOutgoingIds.length > 0) {
    issues.push({
      ruleId: 'S-04',
      severity: 'warning',
      message: `나가는 연결이 없는 단계 ${noOutgoingIds.length}개가 있어요. 흐름이 끊길 수 있습니다.`,
      nodeIds: noOutgoingIds,
    });
  }

  // ── S-05: 암묵적 분기 (process 노드에서 다중 outgoing) ──
  const implicitBranchIds = nodes
    .filter((n) => n.data.nodeType === 'process' || n.data.nodeType === 'subprocess')
    .filter((n) => edges.filter((e) => e.source === n.id).length > 1)
    .map((n) => n.id);
  if (implicitBranchIds.length > 0) {
    issues.push({
      ruleId: 'S-05',
      severity: 'warning',
      message: `프로세스 노드에서 2개 이상 분기하는 곳이 ${implicitBranchIds.length}개 있어요. 판단 노드로 분기 조건을 명시하면 더 명확해집니다.`,
      nodeIds: implicitBranchIds,
    });
  }

  // ── S-06: 중복 연결 (동일 source→target 2개 이상) ──
  const edgeKeys = new Map<string, string[]>();
  for (const e of edges) {
    const key = `${e.source}->${e.target}`;
    const arr = edgeKeys.get(key) || [];
    arr.push(e.id);
    edgeKeys.set(key, arr);
  }
  const duplicateEdgeIds: string[] = [];
  for (const [, ids] of edgeKeys) {
    if (ids.length > 1) {
      duplicateEdgeIds.push(...ids.slice(1)); // 첫 번째는 유지, 나머지 중복
    }
  }
  if (duplicateEdgeIds.length > 0) {
    const dupSourceNodeIds = [...new Set(
      duplicateEdgeIds.map((eid) => edges.find((e) => e.id === eid)?.source).filter(Boolean),
    )] as string[];
    issues.push({
      ruleId: 'S-06',
      severity: 'warning',
      message: `동일한 방향의 중복 연결이 ${duplicateEdgeIds.length}개 있어요.`,
      edgeIds: duplicateEdgeIds,
      nodeIds: dupSourceNodeIds,
    });
  }

  // ── S-07: 무의미 판단 (decision에 outgoing 1개만) ──
  const decisionNodes = nodes.filter((n) => n.data.nodeType === 'decision');
  const trivialDecisionIds = decisionNodes
    .filter((n) => edges.filter((e) => e.source === n.id).length === 1)
    .map((n) => n.id);
  if (trivialDecisionIds.length > 0) {
    issues.push({
      ruleId: 'S-07',
      severity: 'warning',
      message: `분기 경로가 1개뿐인 판단 노드 ${trivialDecisionIds.length}개가 있어요. 분기가 불필요하다면 프로세스 노드로 변경해보세요.`,
      nodeIds: trivialDecisionIds,
    });
  }

  // ── S-08: 조건 라벨 누락 (decision outgoing에 라벨 없음) ──
  const unlabeledDecisionEdgeIds: string[] = [];
  const unlabeledDecisionNodeIds: string[] = [];
  for (const dn of decisionNodes) {
    const outEdges = edges.filter((e) => e.source === dn.id);
    if (outEdges.length >= 2) {
      const unlabeled = outEdges.filter((e) => !e.label || (typeof e.label === 'string' && !e.label.trim()));
      if (unlabeled.length > 0) {
        unlabeledDecisionEdgeIds.push(...unlabeled.map((e) => e.id));
        unlabeledDecisionNodeIds.push(dn.id);
      }
    }
  }
  if (unlabeledDecisionEdgeIds.length > 0) {
    issues.push({
      ruleId: 'S-08',
      severity: 'warning',
      message: `판단 노드의 분기 연결 ${unlabeledDecisionEdgeIds.length}개에 조건 라벨이 없어요. 'Yes/No' 또는 구체적 조건을 적어주세요. 💡 판단 노드에서 새로 연결하면 Yes/No가 자동으로 붙습니다.`,
      edgeIds: unlabeledDecisionEdgeIds,
      nodeIds: unlabeledDecisionNodeIds,
    });
  }

  // ── S-09: 다중 시작 확인 ──
  const startNodes = nodes.filter((n) => n.data.nodeType === 'start');
  if (startNodes.length > 1) {
    issues.push({
      ruleId: 'S-09',
      severity: 'warning',
      message: `시작 노드가 ${startNodes.length}개 있어요. 의도된 구조인지 확인해주세요. 일반적으로 프로세스는 시작점이 1개입니다.`,
      nodeIds: startNodes.map((n) => n.id),
    });
  }

  // ── S-10: 과다 분기 (decision outgoing 4개 이상) ──
  const excessiveBranchIds = decisionNodes
    .filter((n) => edges.filter((e) => e.source === n.id).length >= 4)
    .map((n) => n.id);
  if (excessiveBranchIds.length > 0) {
    issues.push({
      ruleId: 'S-10',
      severity: 'warning',
      message: `분기가 4개 이상인 판단 노드 ${excessiveBranchIds.length}개가 있어요. 중첩 판단으로 분해하면 가독성이 좋아집니다.`,
      nodeIds: excessiveBranchIds,
    });
  }

  // ── S-11: 모델 복잡도 (총 노드 50개 초과) ──
  if (flowNodes.length > 50) {
    issues.push({
      ruleId: 'S-11',
      severity: 'warning',
      message: `전체 노드가 ${flowNodes.length}개로, 50개를 초과했어요. 서브프로세스로 분해하면 관리가 쉬워집니다.`,
    });
  }

  // ── S-12: 탈출 조건 없는 루프 (무한 루프 위험) ──
  // 사이클을 탐지하고, 사이클 내 모든 노드에서 사이클 밖으로 나가는 경로가 없으면 경고
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const arr = adjacency.get(e.source) || [];
    arr.push(e.target);
    adjacency.set(e.source, arr);
  }
  const nodeSet = new Set(nodes.map((n) => n.id));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(nodeId: string, path: string[]) {
    if (!nodeSet.has(nodeId)) return;
    if (inStack.has(nodeId)) {
      // 사이클 발견: path에서 nodeId 위치부터 현재까지
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart >= 0) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);
    for (const next of adjacency.get(nodeId) || []) {
      dfs(next, path);
    }
    path.pop();
    inStack.delete(nodeId);
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) {
      dfs(n.id, []);
    }
  }

  // 각 사이클에서 탈출 경로가 있는지 확인
  for (const cycle of cycles) {
    const cycleSet = new Set(cycle);
    const hasExit = cycle.some((nid) => {
      const targets = adjacency.get(nid) || [];
      return targets.some((t) => !cycleSet.has(t));
    });
    if (!hasExit) {
      const cycleLabels = cycle
        .map((nid) => nodes.find((n) => n.id === nid)?.data.label)
        .filter(Boolean)
        .join(' → ');
      issues.push({
        ruleId: 'S-12',
        severity: 'warning',
        message: `탈출 조건이 없는 루프가 감지되었어요: ${cycleLabels}. 루프 내 판단 노드에 탈출 분기를 추가해주세요.`,
        nodeIds: cycle,
      });
    }
  }

  // ── S-13: TO-BE 삭제 대상 노드 연결 잔존 ──
  if (mode === 'TO-BE' && deleteTargetIds.size > 0) {
    const connectedDeleteIds = [...deleteTargetIds].filter((id) =>
      edges.some((e) => e.source === id || e.target === id)
    );
    if (connectedDeleteIds.length > 0) {
      issues.push({
        ruleId: 'S-13',
        severity: 'warning',
        message: `삭제 대상 셰이프 ${connectedDeleteIds.length}개에 연결이 남아 있어요. 삭제 대상은 고립 노드여야 합니다. 연결된 엣지를 제거해주세요.`,
        nodeIds: connectedDeleteIds,
      });
    }
  }

  // ── S-14: 병렬 Split without Join ──
  // ── S-15: 병렬 Join without Split ──
  const parallelNodes = nodes.filter((n) => n.data.nodeType === 'parallel');
  if (parallelNodes.length > 0) {
    const parallelSplits = parallelNodes.filter((n) => edges.filter((e) => e.source === n.id).length >= 2);
    const parallelJoins = parallelNodes.filter((n) => edges.filter((e) => e.target === n.id).length >= 2);
    if (parallelSplits.length > parallelJoins.length) {
      issues.push({
        ruleId: 'S-14',
        severity: 'warning',
        message: `병렬 분기(Split) 게이트웨이 ${parallelSplits.length}개에 대응하는 병렬 합류(Join)가 부족해요. Split/Join은 반드시 쌍으로 사용해야 합니다.`,
        nodeIds: parallelSplits.map((n) => n.id),
      });
    }
    if (parallelJoins.length > parallelSplits.length) {
      issues.push({
        ruleId: 'S-15',
        severity: 'warning',
        message: `병렬 합류(Join) 게이트웨이 ${parallelJoins.length}개에 대응하는 병렬 분기(Split)가 부족해요. Join에는 반드시 선행 Split이 있어야 합니다.`,
        nodeIds: parallelJoins.map((n) => n.id),
      });
    }
  }

  return { issues };
}
