import { create } from 'zustand';
import { Node, Edge, Connection, addEdge, MarkerType, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import { ProcessContext, ChatMessage, Suggestion, FlowNodeData, ContextMenuState, LoadingState, L7ReportItem, SwimLane, SaveStatus, ShapeType, NodeChangeEntry, NodeCategory, MetaEditTarget, L7Status, PDDAnalysisResult } from './types';
import { applyDagreLayout, reindexByPosition, generateId } from './utils/layoutEngine';
import { API_BASE_URL, SWIMLANE_COLORS, NODE_DIMENSIONS } from './constants';

function makeInitialNodes(): Node<FlowNodeData>[] {
  return [
    { id: 'start', type: 'start', position: { x: 300, y: 40 }, data: { label: '시작', nodeType: 'start' }, draggable: true },
  ];
}

interface HistoryEntry { nodes: Node<FlowNodeData>[]; edges: Edge[]; }

function makeEdge(source: string, target: string, label?: string, color?: string, sourceHandle?: string, targetHandle?: string): Edge {
  const c = color || '#475569';
  return {
    id: `edge-${source}-${target}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source, target, sourceHandle: sourceHandle || undefined, targetHandle: targetHandle || undefined,
    type: source === target ? 'selfLoop' : 'step',
    label: label || undefined,
    labelStyle: label ? { fill: '#e2e8f0', fontWeight: 500, fontSize: 12 } : undefined,
    labelBgStyle: label ? { fill: '#1e293b', fillOpacity: 0.9 } : undefined,
    labelBgPadding: label ? [6, 4] as [number, number] : undefined,
    style: { stroke: c }, markerEnd: { type: MarkerType.ArrowClosed, color: c },
  };
}

function serialize(nodes: Node<FlowNodeData>[], edges: Edge[]) {
  return {
    nodes: nodes.map(n => ({
      id: n.id, type: n.data.nodeType, label: n.data.label, position: n.position,
      inputLabel: n.data.inputLabel, outputLabel: n.data.outputLabel, systemName: n.data.systemName,
      duration: n.data.duration, category: n.data.category || 'as_is', swimLaneId: n.data.swimLaneId || null,
    })),
    edges: edges.map(e => ({
      id: e.id, source: e.source, target: e.target, label: (e.label as string) || null,
      sourceHandle: e.sourceHandle || null, targetHandle: e.targetHandle || null,
    })),
  };
}

// v5: assign swim lane by Y position within lane boundaries
function assignSwimLanes(nodes: Node<FlowNodeData>[], lanes: SwimLane[], laneBoundaries: number[]): Node<FlowNodeData>[] {
  if (lanes.length === 0) return nodes.map(n => ({ ...n, data: { ...n.data, swimLaneId: undefined } }));
  return nodes.map(n => {
    const dims = NODE_DIMENSIONS[n.data.nodeType] || NODE_DIMENSIONS.process;
    const centerY = n.position.y + dims.height / 2;
    let laneId = lanes[lanes.length - 1]?.id;
    for (let i = 0; i < laneBoundaries.length; i++) {
      if (centerY < laneBoundaries[i]) { laneId = lanes[i]?.id; break; }
    }
    return { ...n, data: { ...n.data, swimLaneId: laneId } };
  });
}

interface AppStore {
  processContext: ProcessContext | null; setProcessContext: (ctx: ProcessContext) => void;
  nodes: Node<FlowNodeData>[]; edges: Edge[];
  selectedNodeId: string | null; setSelectedNodeId: (id: string | null) => void;
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
  messages: ChatMessage[]; loadingState: LoadingState; addMessage: (m: ChatMessage) => void; setLoadingMessage: (m: string) => void;
  sendChat: (msg: string) => Promise<void>; requestReview: () => Promise<void>;

  contextMenu: ContextMenuState; showContextMenu: (m: ContextMenuState) => void; hideContextMenu: () => void;
  metaEditTarget: MetaEditTarget | null; openMetaEdit: (target: MetaEditTarget) => void; closeMetaEdit: () => void;
  // v5: multi swim lanes
  swimLanes: SwimLane[];
  laneBoundaries: number[];
  addSwimLane: (label: string) => void;
  removeSwimLane: (id: string) => void;
  updateSwimLaneLabel: (id: string, label: string) => void;
  setLaneBoundaries: (b: number[]) => void;
  // v5 compat shims
  swimLaneDividerY: number;
  swimLaneLabels: { top: string; bottom: string };
  setSwimLaneDividerY: (y: number) => void;
  setSwimLaneLabels: (labels: { top: string; bottom: string }) => void;
  // Clipboard
  clipboard: { nodes: Node<FlowNodeData>[]; edges: Edge[] } | null;
  copySelected: () => void; pasteClipboard: () => void; deleteSelected: () => void;
  // Save
  saveStatus: SaveStatus; lastSaved: number | null;
  saveDraft: () => void; submitComplete: (force?: boolean) => { ok: boolean; issues: string[] };
  exportFlow: () => string; importFlow: (json: string) => void; loadFromLocalStorage: () => boolean;
  showOnboarding: boolean; dismissOnboarding: () => void;
  showGuide: boolean; toggleGuide: () => void;
  adminMode: boolean; toggleAdminMode: (password: string) => boolean;
  // PDD
  pddAnalysis: PDDAnalysisResult | null; analyzePDD: () => Promise<void>;
  // v5: pending inline edit
  pendingEditNodeId: string | null; clearPendingEdit: () => void;
  // v5: theme

  // v5: contextual suggest debounce
  _contextualSuggestTimer: any;
  triggerContextualSuggest: () => void;
}

export const useStore = create<AppStore>((set, get) => ({
  processContext: null,
  setProcessContext: (ctx) => {
    const init = makeInitialNodes();
    set({ processContext: ctx, nodes: init, edges: [], messages: [], history: [{ nodes: init, edges: [] }], historyIndex: 0, saveStatus: 'unsaved', lastSaved: null, showOnboarding: !localStorage.getItem('pm-v5-onboarding-dismissed') });
  },
  nodes: [], edges: [], selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  focusNodeId: null, setFocusNodeId: (id) => set({ focusNodeId: id }),
  forceComplete: () => {
    const { nodes, edges, processContext } = get();
    set({ saveStatus: 'complete' });
    const json = get().exportFlow();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `process-${processContext?.processName || 'flow'}-완료-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  },
  setNodes: (n) => set({ nodes: n }), setEdges: (e) => set({ edges: e }),
  onNodesChange: (c) => {
    const nn = applyNodeChanges(c, get().nodes) as Node<FlowNodeData>[];
    const hasDrag = c.some(ch => ch.type === 'position' && (ch as any).dragging === false);
    const { swimLanes, laneBoundaries } = get();
    const updated = hasDrag && swimLanes.length > 0 ? assignSwimLanes(nn, swimLanes, laneBoundaries) : nn;
    set({ nodes: updated, saveStatus: 'unsaved' });
  },
  onEdgesChange: (c) => set({ edges: applyEdgeChanges(c, get().edges), saveStatus: 'unsaved' }),
  onConnect: (conn) => {
    if (!conn.source || !conn.target) return;
    get().pushHistory();
    set({ edges: addEdge(makeEdge(conn.source, conn.target, undefined, undefined, conn.sourceHandle || undefined, conn.targetHandle || undefined), get().edges), saveStatus: 'unsaved' });
  },

  addShape: (type, label, position) => {
    get().pushHistory();
    const id = generateId({ process: 'proc', decision: 'dec', subprocess: 'sub', start: 'start', end: 'end' }[type]);
    const node: Node<FlowNodeData> = { id, type, position, draggable: true, data: { label, nodeType: type, category: 'as_is', pendingEdit: true } };
    let updated = reindexByPosition([...get().nodes, node]);
    const { swimLanes, laneBoundaries } = get();
    if (swimLanes.length > 0) updated = assignSwimLanes(updated, swimLanes, laneBoundaries);
    set({ nodes: updated, saveStatus: 'unsaved', pendingEditNodeId: id });
    // v5: contextual suggest on shape add
    get().triggerContextualSuggest();
    return id;
  },
  addShapeAfter: (type, label, afterNodeId) => {
    const { nodes, edges } = get(); get().pushHistory();
    const id = generateId(type === 'decision' ? 'dec' : type === 'subprocess' ? 'sub' : 'proc');
    const after = nodes.find(n => n.id === afterNodeId);
    const pos = after ? { x: after.position.x, y: after.position.y + 150 } : { x: 300, y: 300 };
    const node: Node<FlowNodeData> = { id, type, position: pos, draggable: true, data: { label, nodeType: type, category: 'as_is' } };
    const outEdge = edges.find(e => e.source === afterNodeId);
    let newEdges = [...edges];
    if (outEdge) { newEdges = newEdges.filter(e => e.id !== outEdge.id); newEdges.push(makeEdge(afterNodeId, id)); newEdges.push(makeEdge(id, outEdge.target)); }
    else newEdges.push(makeEdge(afterNodeId, id));
    let updated = reindexByPosition([...nodes, node]);
    const { swimLanes, laneBoundaries } = get();
    if (swimLanes.length > 0) updated = assignSwimLanes(updated, swimLanes, laneBoundaries);
    set({ nodes: updated, edges: newEdges, saveStatus: 'unsaved' });
    get().triggerContextualSuggest();
    return id;
  },
  updateNodeLabel: (id, label, source = 'user') => {
    get().pushHistory();
    set({ nodes: get().nodes.map(n => n.id !== id ? n : { ...n, data: { ...n.data, label, pendingEdit: false, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined, changeHistory: [...(n.data.changeHistory || []), { before: n.data.label, after: label, timestamp: Date.now(), source }].slice(-10) } }), saveStatus: 'unsaved' });
  },
  updateNodeMeta: (id, meta) => { get().pushHistory(); set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...meta } } : n), saveStatus: 'unsaved' }); },
  setNodeCategory: (id, category) => { get().pushHistory(); set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, category } } : n), saveStatus: 'unsaved' }); },
  deleteNode: (id) => {
    const { nodes, edges } = get();
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    if (node.data.nodeType === 'start') { if (nodes.filter(n => n.data.nodeType === 'start').length <= 1) return; }
    get().pushHistory();
    const inE = edges.filter(e => e.target === id), outE = edges.filter(e => e.source === id);
    let newEdges = edges.filter(e => e.source !== id && e.target !== id);
    for (const i of inE) for (const o of outE) newEdges.push(makeEdge(i.source, o.target));
    set({ nodes: reindexByPosition(nodes.filter(n => n.id !== id)), edges: newEdges, saveStatus: 'unsaved' });
  },
  changeNodeType: (id, nt) => { get().pushHistory(); set({ nodes: get().nodes.map(n => n.id === id ? { ...n, type: nt, data: { ...n.data, nodeType: nt } } : n), saveStatus: 'unsaved' }); },

  updateEdgeLabel: (eid, label) => { get().pushHistory(); set({ edges: get().edges.map(e => e.id === eid ? { ...e, label: label || undefined, labelStyle: label ? { fill: '#e2e8f0', fontWeight: 500, fontSize: 12 } : undefined, labelBgStyle: label ? { fill: '#1e293b', fillOpacity: 0.9 } : undefined, labelBgPadding: label ? [6, 4] as [number, number] : undefined } : e), saveStatus: 'unsaved' }); },
  deleteEdge: (eid) => { get().pushHistory(); set({ edges: get().edges.filter(e => e.id !== eid), saveStatus: 'unsaved' }); },

  applySuggestion: (s) => {
    if (s.action === 'MODIFY' && s.targetNodeId && s.newLabel) { get().updateNodeLabel(s.targetNodeId, s.newLabel, 'ai'); return; }
    if (s.action === 'DELETE' && s.targetNodeId) { get().deleteNode(s.targetNodeId); return; }
    let afterId = s.insertAfterNodeId;
    const { nodes, edges } = get();
    if (afterId && !nodes.find(n => n.id === afterId)) { const e = edges.find(e => e.target === 'end'); afterId = e?.source || 'start'; }
    const st: ShapeType = s.type === 'DECISION' ? 'decision' : s.type === 'SUBPROCESS' ? 'subprocess' : 'process';
    if (afterId) get().addShapeAfter(st, s.summary, afterId); else get().addShape(st, s.summary, { x: 300, y: 300 });
  },
  applySuggestionWithEdit: (s, l) => { const m = { ...s }; if (s.action === 'MODIFY') m.newLabel = l; else m.summary = l; get().applySuggestion(m); },

  validateNode: async (id) => {
    const { nodes, edges, processContext } = get();
    const node = nodes.find(n => n.id === id);
    if (!node || ['start', 'end', 'subprocess'].includes(node.data.nodeType)) return null;
    // Skip validation for self-loops (rework/looping tasks)
    if (edges.some(e => e.source === id && e.target === id)) return null;
    set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, l7Status: 'checking' as L7Status } } : n) });
    try {
      const { nodes: sn, edges: se } = serialize(nodes, edges);
      const res = await fetch(`${API_BASE_URL}/validate-l7`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodeId: id, label: node.data.label, nodeType: node.data.nodeType, context: processContext || {}, currentNodes: sn, currentEdges: se }) });
      const data = await res.json();
      set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, l7Status: (data.pass ? (data.issues?.some((i: any) => i.severity === 'warning') ? 'warning' : 'pass') : 'reject') as L7Status, l7Score: data.score ?? 0, l7Issues: (data.issues || []).map((i: any) => ({ ...i, friendlyTag: i.friendlyTag || friendlyTag(i.ruleId) })), l7Rewrite: data.rewriteSuggestion || undefined } } : n) });
      return data;
    } catch { set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, l7Status: 'none' as L7Status } } : n) }); return null; }
  },
  validateAllNodes: async () => {
    const { nodes, addMessage, setLoadingMessage } = get();
    const targets = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType));
    if (!targets.length) { addMessage({ id: generateId('msg'), role: 'bot', text: '검증할 노드가 없습니다.', timestamp: Date.now() }); return; }
    set({ loadingState: { active: true, message: `L7 검증 (0/${targets.length})`, startTime: Date.now(), elapsed: 0 } });

    // Parallel Execution (Batch 4)
    const BATCH_SIZE = 4;
    const items: L7ReportItem[] = [];

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      setLoadingMessage(`L7 검증 (${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length})...`);
      const results = await Promise.allSettled(batch.map(t => get().validateNode(t.id)));

      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value) {
          const t = batch[idx];
          const r = res.value;
          items.push({ nodeId: t.id, nodeLabel: t.data.label, pass: r.pass, score: r.score ?? 0, issues: (r.issues || []).map((x: any) => ({ ...x, friendlyTag: x.friendlyTag || friendlyTag(x.ruleId) })), rewriteSuggestion: r.rewriteSuggestion });
        }
      });
    }
    set({ loadingState: { active: false, message: '', startTime: 0, elapsed: 0 } });
    const ok = items.filter(r => r.pass && !r.issues.some(i => i.severity === 'warning')).length;
    const warn = items.filter(r => r.pass && r.issues.some(i => i.severity === 'warning')).length;
    const fail = items.filter(r => !r.pass).length;
    addMessage({ id: generateId('msg'), role: 'bot', text: `✅ L7 검증 완료: ✓${ok} 준수 | 💡${warn} 개선 | ✏${fail} 추천`, l7Report: items, timestamp: Date.now() });
  },
  applyL7Rewrite: (id) => { const n = get().nodes.find(n => n.id === id); if (!n?.data.l7Rewrite) return; get().updateNodeLabel(id, n.data.l7Rewrite, 'ai'); set({ nodes: get().nodes.map(x => x.id === id ? { ...x, data: { ...x.data, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined } } : x) }); },
  lastAutoValidateTime: 0,
  autoValidateDebounced: () => {
    const now = Date.now(); const { nodes, lastAutoValidateTime, loadingState } = get();
    if (now - lastAutoValidateTime < 3000 || loadingState.active) return;
    const t = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType) && n.data.label.trim().length > 2 && (!n.data.l7Status || n.data.l7Status === 'none'));
    if (!t.length) return; set({ lastAutoValidateTime: now }); get().validateNode(t[0].id);
  },



  history: [], historyIndex: -1,
  pushHistory: () => { const { nodes, edges, history, historyIndex } = get(); const h = history.slice(0, historyIndex + 1); h.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }); if (h.length > 50) h.shift(); set({ history: h, historyIndex: h.length - 1 }); },
  undo: () => { const { history: h, historyIndex: i } = get(); if (i <= 0) return; set({ nodes: h[i - 1].nodes, edges: h[i - 1].edges, historyIndex: i - 1 }); },
  redo: () => { const { history: h, historyIndex: i } = get(); if (i >= h.length - 1) return; set({ nodes: h[i + 1].nodes, edges: h[i + 1].edges, historyIndex: i + 1 }); },

  messages: [], loadingState: { active: false, message: '', startTime: 0, elapsed: 0 },
  addMessage: (m) => set(s => ({ messages: [...s.messages, m] })),
  setLoadingMessage: (m) => set(s => ({ loadingState: { ...s.loadingState, message: m } })),

  sendChat: async (msg) => {
    const { processContext: ctx, nodes, edges, addMessage } = get();
    addMessage({ id: generateId('msg'), role: 'user', text: msg, timestamp: Date.now() });
    set({ loadingState: { active: true, message: '응답 생성 중...', startTime: Date.now(), elapsed: 0 } });
    try {
      const { nodes: sn, edges: se } = serialize(nodes, edges);
      const r = await fetch(`${API_BASE_URL}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, context: ctx || {}, currentNodes: sn, currentEdges: se }) });
      const d = await r.json();
      const validSuggestions = (d.suggestions || []).filter((s: any) => s.summary?.trim() || s.newLabel?.trim());
      addMessage({
        id: generateId('msg'), role: 'bot', text: d.speech || d.message || d.guidance || '응답 실패.',
        suggestions: validSuggestions.map((s: any) => ({ action: s.action || 'ADD', ...s })),
        quickQueries: d.quickQueries || [],
        timestamp: Date.now(),
      });
    }
    catch { addMessage({ id: generateId('msg'), role: 'bot', text: '서버 통신 오류.', timestamp: Date.now() }); }
    finally { set({ loadingState: { active: false, message: '', startTime: 0, elapsed: 0 } }); }
  },
  requestReview: async () => {
    const { processContext: ctx, nodes, edges, addMessage } = get();
    set({ loadingState: { active: true, message: '플로우 분석 중...', startTime: Date.now(), elapsed: 0 } });
    addMessage({ id: generateId('msg'), role: 'user', text: '🔍 플로우 분석 요청', timestamp: Date.now() });
    try {
      const { nodes: sn, edges: se } = serialize(nodes, edges);
      const r = await fetch(`${API_BASE_URL}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentNodes: sn, currentEdges: se, userMessage: '프로세스 분석 + 제안', context: ctx || {} }) });
      const d = await r.json();
      const validSuggestions = (d.suggestions || []).filter((s: any) => s.summary?.trim() || s.newLabel?.trim());
      addMessage({
        id: generateId('msg'), role: 'bot', text: d.speech || d.message || '리뷰 완료',
        suggestions: validSuggestions.map((s: any) => ({ action: s.action || 'ADD', ...s })),
        quickQueries: d.quickQueries || [],
        timestamp: Date.now(),
      });
    }
    catch { addMessage({ id: generateId('msg'), role: 'bot', text: '서버 통신 오류.', timestamp: Date.now() }); }
    finally { set({ loadingState: { active: false, message: '', startTime: 0, elapsed: 0 } }); }
  },



  contextMenu: { show: false, x: 0, y: 0 },
  showContextMenu: (m) => set({ contextMenu: m }), hideContextMenu: () => set({ contextMenu: { show: false, x: 0, y: 0 } }),
  metaEditTarget: null,
  openMetaEdit: (target) => set({ metaEditTarget: target }), closeMetaEdit: () => set({ metaEditTarget: null }),

  // v5: multi swim lanes
  swimLanes: [],
  laneBoundaries: [],
  addSwimLane: (label) => {
    const { swimLanes } = get();
    const id = generateId('lane');
    const colorIdx = swimLanes.length % SWIMLANE_COLORS.length;
    const lane: SwimLane = { id, label, order: swimLanes.length, color: SWIMLANE_COLORS[colorIdx].text };
    const newLanes = [...swimLanes, lane];
    // auto-set boundaries evenly
    const totalH = 800;
    const boundaries = newLanes.slice(0, -1).map((_, i) => ((i + 1) / newLanes.length) * totalH);
    set({ swimLanes: newLanes, laneBoundaries: boundaries });
  },
  removeSwimLane: (id) => {
    const newLanes = get().swimLanes.filter(l => l.id !== id).map((l, i) => ({ ...l, order: i }));
    const totalH = 800;
    const boundaries = newLanes.length > 1 ? newLanes.slice(0, -1).map((_, i) => ((i + 1) / newLanes.length) * totalH) : [];
    set({ swimLanes: newLanes, laneBoundaries: boundaries });
  },
  updateSwimLaneLabel: (id, label) => {
    set({ swimLanes: get().swimLanes.map(l => l.id === id ? { ...l, label } : l) });
  },
  setLaneBoundaries: (b) => {
    const updated = assignSwimLanes(get().nodes, get().swimLanes, b);
    set({ laneBoundaries: b, nodes: updated });
  },
  // v5 compat: map old divider to 2-lane system
  swimLaneDividerY: 0,
  swimLaneLabels: { top: 'A 주체', bottom: 'B 주체' },
  setSwimLaneDividerY: () => { },
  setSwimLaneLabels: () => { },

  // Clipboard
  clipboard: null,
  copySelected: () => { const { nodes, edges } = get(); const sel = nodes.filter(n => n.selected && n.data.nodeType !== 'start'); if (!sel.length) return; const ids = new Set(sel.map(n => n.id)); set({ clipboard: { nodes: JSON.parse(JSON.stringify(sel)), edges: JSON.parse(JSON.stringify(edges.filter(e => ids.has(e.source) && ids.has(e.target)))) } }); },
  pasteClipboard: () => {
    const { clipboard, nodes, edges, swimLanes, laneBoundaries } = get(); if (!clipboard?.nodes.length) return; get().pushHistory();
    const idMap: Record<string, string> = {};
    const nn = clipboard.nodes.map(n => { const nid = generateId(n.data.nodeType); idMap[n.id] = nid; return { ...n, id: nid, selected: true, position: { x: n.position.x + 40, y: n.position.y + 40 }, data: { ...n.data, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined } }; });
    const ne = clipboard.edges.map(e => makeEdge(idMap[e.source] || e.source, idMap[e.target] || e.target, (e.label as string) || undefined));
    let u = reindexByPosition([...nodes.map(n => ({ ...n, selected: false })), ...nn]);
    if (swimLanes.length > 0) u = assignSwimLanes(u, swimLanes, laneBoundaries);
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
    const { nodes, edges, processContext } = get();
    const issues: string[] = [];
    if (!nodes.some(n => n.data.nodeType === 'end')) issues.push('종료 노드가 없습니다. 우클릭으로 추가해주세요.');
    const orphans = nodes.filter(n => !['start', 'end'].includes(n.data.nodeType) && !edges.some(e => e.source === n.id || e.target === n.id));
    if (orphans.length) issues.push(`연결되지 않은 노드 ${orphans.length}개`);
    const unc = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType) && (!n.data.l7Status || n.data.l7Status === 'none'));
    if (unc.length) issues.push(`L7 검증 미실행 노드 ${unc.length}개`);
    if (force || !issues.length) {
      set({ saveStatus: 'complete' });
      const json = get().exportFlow();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `process-${processContext?.processName || 'flow'}-완료-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    }
    return { ok: force || !issues.length, issues };
  },
  exportFlow: () => {
    const { processContext, nodes, edges, swimLanes, laneBoundaries } = get();
    const { nodes: sn, edges: se } = serialize(nodes, edges);
    return JSON.stringify({ processContext, nodes: sn, edges: se, swimLanes, laneBoundaries }, null, 2);
  },
  importFlow: (json) => {
    try {
      const d = JSON.parse(json); if (!d.nodes) return;
      const ns: Node<FlowNodeData>[] = d.nodes.map((n: any) => ({ id: n.id, type: n.type, position: n.position || { x: 0, y: 0 }, draggable: true, data: { label: n.label, nodeType: n.type, inputLabel: n.inputLabel, outputLabel: n.outputLabel, systemName: n.systemName, duration: n.duration, category: n.category || 'as_is', swimLaneId: n.swimLaneId } }));
      const es: Edge[] = (d.edges || []).map((e: any) => makeEdge(e.source, e.target, e.label || undefined, undefined, e.sourceHandle || undefined, e.targetHandle || undefined));
      // backward compat: old divider format → new multi-lane
      let lanes = d.swimLanes || [];
      let boundaries = d.laneBoundaries || [];
      if (d.swimLaneDividerY && d.swimLaneDividerY > 0 && !lanes.length) {
        const topLabel = d.swimLaneLabels?.top || 'A 주체';
        const bottomLabel = d.swimLaneLabels?.bottom || 'B 주체';
        lanes = [
          { id: 'lane-top', label: topLabel, order: 0, color: SWIMLANE_COLORS[0].text },
          { id: 'lane-bottom', label: bottomLabel, order: 1, color: SWIMLANE_COLORS[1].text },
        ];
        boundaries = [d.swimLaneDividerY];
      }
      set({ nodes: reindexByPosition(ns), edges: es, processContext: d.processContext || get().processContext, swimLanes: lanes, laneBoundaries: boundaries });
    } catch (e) { console.error('Import failed:', e); }
  },
  loadFromLocalStorage: () => { const j = localStorage.getItem('pm-v5-save'); if (j) { get().importFlow(j); return true; } return false; },

  showOnboarding: false, dismissOnboarding: () => { localStorage.setItem('pm-v5-onboarding-dismissed', '1'); set({ showOnboarding: false }); },
  showGuide: false, toggleGuide: () => set(s => ({ showGuide: !s.showGuide })),
  adminMode: false, toggleAdminMode: (pw) => { if (pw === 'pm2025') { set({ adminMode: !get().adminMode }); return true; } return false; },

  // PDD Analysis
  pddAnalysis: null,
  analyzePDD: async () => {
    const { nodes, edges, processContext } = get();
    set({ loadingState: { active: true, message: 'PDD 자동분석 중...', startTime: Date.now(), elapsed: 0 } });
    try {
      const { nodes: sn, edges: se } = serialize(nodes, edges);
      const r = await fetch(`${API_BASE_URL}/analyze-pdd`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: processContext || {}, currentNodes: sn, currentEdges: se }) });
      set({ pddAnalysis: await r.json() });
    } catch { set({ pddAnalysis: null }); }
    finally { set({ loadingState: { active: false, message: '', startTime: 0, elapsed: 0 } }); }
  },

  // v5: pending inline edit
  pendingEditNodeId: null,
  clearPendingEdit: () => set({ pendingEditNodeId: null }),



  // v5: contextual suggest — after adding shapes, debounced
  _contextualSuggestTimer: null as any,
  triggerContextualSuggest: () => {
    const timer = get()._contextualSuggestTimer;
    if (timer) clearTimeout(timer);
    const newTimer = setTimeout(async () => {
      const { nodes, edges, processContext, loadingState, addMessage } = get();
      if (loadingState.active) return;
      const processNodes = nodes.filter(n => ['process', 'decision', 'subprocess'].includes(n.data.nodeType));
      if (processNodes.length < 2) return; // don't suggest with too few nodes
      try {
        const { nodes: sn, edges: se } = serialize(nodes, edges);
        const r = await fetch(`${API_BASE_URL}/contextual-suggest`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: processContext || {}, currentNodes: sn, currentEdges: se }),
        });
        const d = await r.json();
        if (d.guidance || d.quickQueries?.length) {
          addMessage({
            id: generateId('msg'), role: 'bot', timestamp: Date.now(),
            text: d.guidance || d.hint || '💡 플로우가 업데이트되었습니다.',
            quickQueries: d.quickQueries || [],
          });
        }
      } catch { /* silent */ }
    }, 5000);
    set({ _contextualSuggestTimer: newTimer });
  },
}));

function friendlyTag(ruleId: string): string {
  const m: Record<string, string> = {
    'R-01': '복수 동사', 'R-02': '목적어 누락', 'R-03': '금지 동사', 'R-04': '복합 동사',
    'R-05': '위치 누락', 'R-06': '추상적 위치', 'R-07': '오프라인 대상 불명',
    'R-08': '입력 대상 누락', 'R-09': '산출물 누락', 'R-10': '상태변화 누락', 'R-11': '완료조건 누락',
    'R-12': '판단 기준 없음', 'R-13': '기준값 누락', 'R-14': '결과값 누락',
    'R-15': '비표준 동사', 'R-16': '금지 동사 사용', 'R-17': '동사 치환 가능',
  };
  return m[ruleId] || ruleId;
}
