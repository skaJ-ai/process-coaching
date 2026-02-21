import { Edge, MarkerType, Node } from 'reactflow';
import { ChatMessage, FlowNodeData } from '../types';
import { NODE_DIMENSIONS } from '../constants';

export function makeInitialNodes(): Node<FlowNodeData>[] {
  return [
    // y: 40 → 20으로 상향 (온보딩 가이드와 겹침 방지)
    { id: 'start', type: 'start', position: { x: 300, y: 20 }, data: { label: '시작', nodeType: 'start' }, draggable: true },
  ];
}

const BARE_POSITIONS = new Set(['top', 'bottom', 'left', 'right']);

export function makeEdge(source: string, target: string, label?: string, color?: string, sourceHandle?: string, targetHandle?: string): Edge {
  // Normalize legacy handle IDs: "bottom" → "bottom-source", "top" → "top-target" etc.
  const sh = sourceHandle && BARE_POSITIONS.has(sourceHandle) ? `${sourceHandle}-source` : sourceHandle;
  const th = targetHandle && BARE_POSITIONS.has(targetHandle) ? `${targetHandle}-target` : targetHandle;
  const c = color || '#475569';
  return {
    id: `edge-${source}-${target}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source,
    target,
    sourceHandle: sh || undefined,
    targetHandle: th || undefined,
    type: source === target ? 'selfLoop' : 'step',
    label: label || undefined,
    labelStyle: label ? { fill: '#e2e8f0', fontWeight: 500, fontSize: 12 } : undefined,
    labelBgStyle: label ? { fill: '#1e293b', fillOpacity: 0.9 } : undefined,
    labelBgPadding: label ? ([6, 4] as [number, number]) : undefined,
    style: { stroke: c },
    markerEnd: { type: MarkerType.ArrowClosed, color: c },
  };
}

export function serialize(nodes: Node<FlowNodeData>[], edges: Edge[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      label: n.data.label,
      position: n.position,
      inputLabel: n.data.inputLabel,
      outputLabel: n.data.outputLabel,
      systemName: n.data.systemName,
      duration: n.data.duration,
      category: n.data.category || 'as_is',
      swimLaneId: n.data.swimLaneId || null,
      addedBy: n.data.addedBy || 'user', // Issue 5: AI 추가 노드 추적
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: (e.label as string) || null,
      sourceHandle: e.sourceHandle || null,
      targetHandle: e.targetHandle || null,
    })),
  };
}

export function buildRecentTurns(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  // 4턴 → 10턴 확장: AI가 과거 제안을 더 잘 기억하도록
  return messages
    .filter((m) => m.role === 'user' || m.role === 'bot')
    .slice(-10)
    .map((m) => ({
      role: m.role === 'bot' ? ('assistant' as const) : ('user' as const),
      content: m.text,
    }));
}

export function buildConversationSummary(messages: ChatMessage[]): string {
  // 16턴/2000자: 대화 텍스트 + suggestions/L7 메타데이터 포함
  const recent = messages
    .filter((m) => m.role === 'user' || m.role === 'bot')
    .slice(-16);
  const texts = recent.map((m) => {
    const base = `${m.role === 'bot' ? 'A' : 'U'}: ${m.text.replace(/\s+/g, ' ').trim()}`;
    const meta: string[] = [];
    if (m.suggestions && m.suggestions.length > 0) {
      const actions = m.suggestions.map((s) => `${s.action}:${s.labelSuggestion || s.summary || ''}`).join(',');
      meta.push(`[${m.suggestions.length}제안:${actions}]`);
    }
    if (m.l7Report && m.l7Report.length > 0) {
      const issues = m.l7Report.reduce((sum, r) => sum + (r.issues?.length || 0), 0);
      meta.push(`[L7:${m.l7Report.length}건,이슈${issues}]`);
    }
    return meta.length > 0 ? `${base} ${meta.join(' ')}` : base;
  });
  return texts.join(' | ').slice(0, 2000);
}

export function assignSwimLanes(nodes: Node<FlowNodeData>[], dividerYs: number[], labels: string[]): Node<FlowNodeData>[] {
  if (dividerYs.length === 0 || labels.length === 0) {
    return nodes.map((n) => ({ ...n, data: { ...n.data, swimLaneId: undefined } }));
  }

  const sortedDividers = [...dividerYs].sort((a, b) => a - b);
  return nodes.map((n) => {
    const dims = NODE_DIMENSIONS[n.data.nodeType] || NODE_DIMENSIONS.process;
    const centerY = n.position.y + dims.height / 2;

    let laneIndex = 0;
    for (let i = 0; i < sortedDividers.length; i++) {
      if (centerY >= sortedDividers[i]) laneIndex = i + 1;
    }
    laneIndex = Math.min(laneIndex, labels.length - 1);
    return { ...n, data: { ...n.data, swimLaneId: labels[laneIndex] } };
  });
}
