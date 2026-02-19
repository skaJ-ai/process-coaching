import { create } from 'zustand';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import { ProcessContext, ChatMessage, Suggestion, FlowNodeData, ContextMenuState, LoadingState, L7ReportItem, SwimLane, SaveStatus, ShapeType, NodeChangeEntry, NodeCategory, MetaEditTarget, L7Status, PDDAnalysisResult } from './types';
import { applyDagreLayout, reindexByPosition, generateId } from './utils/layoutEngine';
import { API_BASE_URL, SWIMLANE_COLORS } from './constants';
import { detectCompoundAction } from './utils/labelUtils';
import { validateL7Label } from './utils/l7Rules';
import { makeInitialNodes, makeEdge, serialize, buildRecentTurns, buildConversationSummary, assignSwimLanes } from './store/helpers';

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

function extractBotText(d: any): string {
  const direct = [d?.speech, d?.message, d?.guidance, d?.text, d?.content, d?.answer].find(v => typeof v === 'string' && v.trim());
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
  // Clipboard
  clipboard: { nodes: Node<FlowNodeData>[]; edges: Edge[] } | null;
  copySelected: () => void; pasteClipboard: () => void; deleteSelected: () => void;
  // Save
  saveStatus: SaveStatus; lastSaved: number | null;
  saveDraft: () => void; submitComplete: (force?: boolean) => { ok: boolean; issues: string[] };
  exportFlow: () => string; importFlow: (json: string) => void; loadFromLocalStorage: () => boolean;
  showOnboarding: boolean; hideOnboarding: () => void; dismissOnboarding: () => void; showOnboardingPanel: () => void;
  showGuide: boolean; toggleGuide: () => void;
  // Product Tour
  tourActive: boolean; tourStep: number;
  startTour: () => void; nextTourStep: () => void; skipTour: () => void;
  adminMode: boolean; toggleAdminMode: (password: string) => boolean;
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
}

export const useStore = create<AppStore>((set, get) => ({
  processContext: null,
  setProcessContext: (ctx, onReady?: () => void) => {
    const init = makeInitialNodes();
    set({ processContext: ctx, nodes: init, edges: [], messages: [], history: [{ nodes: init, edges: [] }], historyIndex: 0, saveStatus: 'unsaved', lastSaved: null, showOnboarding: !localStorage.getItem('pm-v5-onboarding-dismissed'), dividerYs: [], swimLaneLabels: ['A 주체', 'B 주체', 'C 주체', 'D 주체'] });
    // 환영 메시지 추가
    setTimeout(() => {
      get().addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: `안녕하세요! "${ctx.processName}" 프로세스 설계를 함께 시작해볼까요?\n\n왼쪽 도구 모음에서 단계를 추가하거나, 아래에 궁금한 점을 물어보세요.`,
        quickQueries: ['어떻게 시작하면 좋을까요?', '일반적인 단계는 뭐가 있나요?', '예외 처리는 어떻게 표현하나요?']
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
    const { nodes, edges, processContext } = get();
    set({ saveStatus: 'complete' });
    const json = get().exportFlow();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `process-${processContext?.processName || 'flow'}-완료-${new Date().toISOString().slice(0, 10)}.json`; a.click();
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
    set({ edges: addEdge(makeEdge(conn.source, conn.target, undefined, undefined, conn.sourceHandle || undefined, conn.targetHandle || undefined), get().edges), saveStatus: 'unsaved' });
    // v5.2: check if flow is now complete
    setTimeout(() => get().checkFlowCompletion(), 500);
  },

  addShape: (type, label, position) => {
    get().pushHistory();
    get().updateUserActivity();
    const id = generateId({ process: 'proc', decision: 'dec', subprocess: 'sub', start: 'start', end: 'end' }[type]);
    const node: Node<FlowNodeData> = { id, type, position, draggable: true, data: { label, nodeType: type, category: 'as_is', pendingEdit: true } };
    let updated = reindexByPosition([...get().nodes, node]);
    const { dividerYs, swimLaneLabels } = get();
    if (dividerYs.length > 0) updated = assignSwimLanes(updated, dividerYs, swimLaneLabels);
    set({ nodes: updated, saveStatus: 'unsaved', pendingEditNodeId: id });
    debugTrace('addShape', { id, type, label, x: position.x, y: position.y, nodeCount: updated.length });
    // v5.2: proactive coaching triggers
    setTimeout(() => {
      get().checkFirstShape();
      get().checkDecisionLabels(id);
      get().checkSwimLaneNeed();
    }, 500);
    // v5: contextual suggest on shape add
    get().triggerContextualSuggest();
    // auto L7 validation after label entry (6s delay to let user finish typing)
    setTimeout(() => get().autoValidateDebounced(), 6000);
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
    const { dividerYs, swimLaneLabels } = get();
    if (dividerYs.length > 0) updated = assignSwimLanes(updated, dividerYs, swimLaneLabels);
    set({ nodes: updated, edges: newEdges, saveStatus: 'unsaved' });
    debugTrace('addShapeAfter', { id, type, label, afterNodeId, nodeCount: updated.length, edgeCount: newEdges.length });
    get().triggerContextualSuggest();
    return id;
  },
  updateNodeLabel: (id, label, source = 'user') => {
    const prev = get().nodes.find(n => n.id === id)?.data.label;
    get().pushHistory();
    get().updateUserActivity();
    set({ nodes: get().nodes.map(n => n.id !== id ? n : { ...n, data: { ...n.data, label, pendingEdit: false, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined, changeHistory: [...(n.data.changeHistory || []), { before: n.data.label, after: label, timestamp: Date.now(), source }].slice(-10) } }), saveStatus: 'unsaved' });
    debugTrace('updateNodeLabel', { id, before: prev || null, after: label, source });
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
    const { addMessage } = get();
    if (s.action === 'MODIFY' && s.targetNodeId && s.newLabel) {
      get().updateNodeLabel(s.targetNodeId, s.newLabel, 'ai');
      addMessage({ id: generateId('msg'), role: 'bot', timestamp: Date.now(), text: `✅ "${s.newLabel}" 로 수정되었습니다.` });
      return;
    }
    if (s.action === 'DELETE' && s.targetNodeId) {
      get().deleteNode(s.targetNodeId);
      addMessage({ id: generateId('msg'), role: 'bot', timestamp: Date.now(), text: `✅ 단계가 삭제되었습니다.` });
      return;
    }
    let afterId = s.insertAfterNodeId;
    const { nodes, edges } = get();
    if (afterId && !nodes.find(n => n.id === afterId)) { const e = edges.find(e => e.target === 'end'); afterId = e?.source || 'start'; }
    const suggestionType = String((s as any).type || '').toUpperCase();
    const labelText = (s.labelSuggestion || s.newLabel || s.summary || '').toLowerCase();
    const st: ShapeType =
      suggestionType === 'START' ? 'start'
      : suggestionType === 'END' ? 'end'
      : suggestionType === 'DECISION' ? 'decision'
      : suggestionType === 'SUBPROCESS' ? 'subprocess'
      : /종료|완료|끝|finish/.test(labelText) ? 'end'
      : /시작|start|begin/.test(labelText) ? 'start'
      : /판단|결정|여부|분기|승인|반려/.test(labelText) ? 'decision'
      : 'process';
    const label = s.labelSuggestion || s.newLabel || s.summary;
    const compound = detectCompoundAction(label);
    const primaryLabel = compound.isCompound ? compound.parts[0] : label;
    const secondaryLabel = compound.isCompound ? compound.parts[1] : '';
    if (afterId) get().addShapeAfter(st, primaryLabel, afterId); else get().addShape(st, primaryLabel, { x: 300, y: 300 });
    addMessage({ id: generateId('msg'), role: 'bot', timestamp: Date.now(), text: `✅ "${primaryLabel}" 단계가 추가되었습니다.` });
    if (compound.isCompound) {
      addMessage({
        id: generateId('msg'),
        role: 'bot',
        timestamp: Date.now(),
        text: `💡 추천 문장에 동작이 2개 포함되어 있어 첫 번째 동작만 반영했어요.\n다음 셰이프를 추가해 "${secondaryLabel}"를 이어서 표현하면 L7 기준에 더 잘 맞습니다.`,
        dismissible: true
      });
    }
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

  validateNode: async (id) => {
    const { nodes, edges } = get();
    const node = nodes.find(n => n.id === id);
    if (!node || ['start', 'end', 'subprocess'].includes(node.data.nodeType)) return null;
    // Skip validation for self-loops (rework/looping tasks)
    if (edges.some(e => e.source === id && e.target === id)) return null;
    set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, l7Status: 'checking' as L7Status } } : n) });
    try {
      debugTrace('validateNode:start', { id, label: node.data.label, type: node.data.nodeType });
      const hasSwimLane = get().dividerYs.length > 0;
      const data = validateL7Label(node.data.label || '', node.data.nodeType, hasSwimLane);
      debugTrace('validateNode:success', { id, pass: !!data.pass, score: data.score ?? null, issues: (data.issues || []).length });
      set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, l7Status: (data.pass ? (data.issues?.some((i: any) => i.severity === 'warning') ? 'warning' : 'pass') : 'reject') as L7Status, l7Score: data.score ?? 0, l7Issues: (data.issues || []).map((i: any) => ({ ...i, friendlyTag: i.friendlyTag || friendlyTag(i.ruleId) })), l7Rewrite: data.rewriteSuggestion || undefined } } : n) });
      return data;
    } catch {
      debugTrace('validateNode:error', { id });
      set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, l7Status: 'none' as L7Status } } : n) }); return null;
    }
  },
  validateAllNodes: async () => {
    const { nodes, addMessage, setLoadingMessage, loadingState } = get();
    const targets = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType));
    if (!targets.length) { addMessage({ id: generateId('msg'), role: 'bot', text: '검증할 노드가 없습니다.', timestamp: Date.now() }); return; }
    let newCount = (loadingState.requestCount || 0) + 1;
    set({ loadingState: { active: true, message: `L7 검증 (0/${targets.length})`, startTime: Date.now(), elapsed: 0, requestCount: newCount } });

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
          const item = { nodeId: t.id, nodeLabel: t.data.label, pass: r.pass, score: r.score ?? 0, issues: (r.issues || []).map((x: any) => ({ ...x, friendlyTag: x.friendlyTag || friendlyTag(x.ruleId) })), rewriteSuggestion: r.rewriteSuggestion, encouragement: r.encouragement };
          items.push(item);
          if (item.issues.length > 0) {
            addMessage({
              id: generateId('msg'),
              role: 'bot',
              text: `🔎 "${t.data.label}" 검증 결과가 도착했어요.`,
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
    addMessage({ id: generateId('msg'), role: 'bot', text: `✅ L7 검증 완료: ✓${ok} 준수 | 💡${warn} 개선 | ✏${fail} 추천`, timestamp: Date.now() });
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
    const t = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType) && n.data.label.trim().length > 2 && (!n.data.l7Status || n.data.l7Status === 'none'));
    if (!t.length) return;
    set({ lastAutoValidateTime: now });
    get().validateNode(t[0].id);
  },



  history: [], historyIndex: -1,
  pushHistory: () => { const { nodes, edges, history, historyIndex } = get(); const h = history.slice(0, historyIndex + 1); h.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }); if (h.length > 50) h.shift(); set({ history: h, historyIndex: h.length - 1 }); },
  undo: () => { const { history: h, historyIndex: i } = get(); if (i <= 0) return; set({ nodes: h[i - 1].nodes, edges: h[i - 1].edges, historyIndex: i - 1 }); },
  redo: () => { const { history: h, historyIndex: i } = get(); if (i >= h.length - 1) return; set({ nodes: h[i + 1].nodes, edges: h[i + 1].edges, historyIndex: i + 1 }); },

  messages: [], loadingState: { active: false, message: '', startTime: 0, elapsed: 0, requestCount: 0 },
  addMessage: (m) => set(s => ({ messages: [...s.messages, m] })),
  setLoadingMessage: (m) => set(s => ({ loadingState: { ...s.loadingState, message: m } })),

  sendChat: async (msg) => {
    const { processContext: ctx, nodes, edges, addMessage, loadingState } = get();
    addMessage({ id: generateId('msg'), role: 'user', text: msg, timestamp: Date.now() });
    let newCount = (loadingState.requestCount || 0) + 1;
    set({ loadingState: { active: true, message: '응답 생성 중...', startTime: Date.now(), elapsed: 0, requestCount: newCount } });
    try {
      debugTrace('chat:start', { messageLength: msg.length, nodeCount: nodes.length, edgeCount: edges.length });
      const { nodes: sn, edges: se } = serialize(nodes, edges);
      const recentTurns = buildRecentTurns(get().messages);
      const conversationSummary = buildConversationSummary(get().messages);
      const r = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: ctx || {}, currentNodes: sn, currentEdges: se, recentTurns, conversationSummary })
      });
      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status} ${r.statusText} ${errText.slice(0, 300)}`);
      }
      const d = await r.json();
      const validSuggestions = (d.suggestions || []).filter((s: any) => s.summary?.trim() || s.newLabel?.trim() || s.labelSuggestion?.trim());
      debugTrace('chat:success', { hasText: !!(d.speech || d.message || d.guidance), suggestions: validSuggestions.length, quickQueries: (d.quickQueries || []).length });
      addMessage({
        id: generateId('msg'), role: 'bot', text: extractBotText(d),
        suggestions: validSuggestions.map((s: any) => ({ action: s.action || 'ADD', ...s })),
        quickQueries: d.quickQueries || [],
        timestamp: Date.now(),
      });
    }
    catch {
      debugTrace('chat:error');
      addMessage({ id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: '⚠️ AI 서버와 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.\n\n문제가 지속되면 관리자에게 문의하세요.',
        quickQueries: ['다시 시도']
      });
    }
    finally {
      const ls = get().loadingState;
      newCount = Math.max(0, (ls.requestCount || 1) - 1);
      set({ loadingState: { ...ls, active: newCount > 0, requestCount: newCount } });
    }
  },
  requestReview: async () => {
    const { processContext: ctx, nodes, edges, addMessage, loadingState } = get();
    let newCount = (loadingState.requestCount || 0) + 1;
    set({ loadingState: { active: true, message: '플로우 분석 중...', startTime: Date.now(), elapsed: 0, requestCount: newCount } });
    addMessage({ id: generateId('msg'), role: 'user', text: '🔍 플로우 분석 요청', timestamp: Date.now() });
    try {
      debugTrace('review:start', { nodeCount: nodes.length, edgeCount: edges.length });
      const { nodes: sn, edges: se } = serialize(nodes, edges);
      const r = await fetch(`${API_BASE_URL}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentNodes: sn, currentEdges: se, userMessage: '프로세스 분석 + 제안', context: ctx || {} }) });
      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status} ${r.statusText} ${errText.slice(0, 300)}`);
      }
      const d = await r.json();
      const validSuggestions = (d.suggestions || []).filter((s: any) => s.summary?.trim() || s.newLabel?.trim() || s.labelSuggestion?.trim());
      debugTrace('review:success', { hasText: !!(d.speech || d.message), suggestions: validSuggestions.length, quickQueries: (d.quickQueries || []).length });
      addMessage({
        id: generateId('msg'), role: 'bot', text: extractBotText(d) || '리뷰 완료',
        suggestions: validSuggestions.map((s: any) => ({ action: s.action || 'ADD', ...s })),
        quickQueries: d.quickQueries || [],
        timestamp: Date.now(),
      });
    }
    catch {
      debugTrace('review:error');
      addMessage({ id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: '⚠️ AI 서버와 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.\n\n문제가 지속되면 관리자에게 문의하세요.',
        quickQueries: ['🔍 플로우 분석 다시 시도']
      });
    }
    finally {
      const ls = get().loadingState;
      newCount = Math.max(0, (ls.requestCount || 1) - 1);
      set({ loadingState: { ...ls, active: newCount > 0, requestCount: newCount } });
    }
  },



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
    const updated = assignSwimLanes(get().nodes, get().dividerYs, labels);
    set({ swimLaneLabels: labels, nodes: updated });
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
    const { processContext, nodes, edges, dividerYs, swimLaneLabels } = get();
    const { nodes: sn, edges: se } = serialize(nodes, edges);
    debugTrace('exportFlow', { nodeCount: sn.length, edgeCount: se.length, dividerCount: dividerYs.length });
    return JSON.stringify({
      processContext,
      nodes: sn,
      edges: se,
      dividerYs,
      swimLaneLabels,
      // backward compat
      swimLanes: dividerYs.length > 0 ? [
        { id: 'lane-top', label: swimLaneLabels[0], order: 0, color: SWIMLANE_COLORS[0].text },
        { id: 'lane-bottom', label: swimLaneLabels[1], order: 1, color: SWIMLANE_COLORS[1].text }
      ] : [],
      laneBoundaries: dividerYs
    }, null, 2);
  },
  importFlow: (json) => {
    try {
      const d = JSON.parse(json); if (!d.nodes) return;
      const ns: Node<FlowNodeData>[] = d.nodes.map((n: any) => ({ id: n.id, type: n.type, position: n.position || { x: 0, y: 0 }, draggable: true, data: { label: n.label, nodeType: n.type, inputLabel: n.inputLabel, outputLabel: n.outputLabel, systemName: n.systemName, duration: n.duration, category: n.category || 'as_is', swimLaneId: n.swimLaneId } }));
      const es: Edge[] = (d.edges || []).map((e: any) => makeEdge(e.source, e.target, e.label || undefined, undefined, e.sourceHandle || undefined, e.targetHandle || undefined));
      // New format
      let divY = d.dividerY || 0;
      let topLbl = d.topLabel || 'A 주체';
      let botLbl = d.bottomLabel || 'B 주체';
      // backward compat: old multi-lane format → new 2-lane
      if (!divY && d.swimLanes?.length === 2 && d.laneBoundaries?.length === 1) {
        divY = d.laneBoundaries[0];
        topLbl = d.swimLanes[0]?.label || 'A 주체';
        botLbl = d.swimLanes[1]?.label || 'B 주체';
      }
      // backward compat: very old divider format
      if (!divY && d.swimLaneDividerY && d.swimLaneDividerY > 0) {
        divY = d.swimLaneDividerY;
        topLbl = d.swimLaneLabels?.top || 'A 주체';
        botLbl = d.swimLaneLabels?.bottom || 'B 주체';
      }
      set({ nodes: reindexByPosition(ns), edges: es, processContext: d.processContext || get().processContext, dividerYs: divY > 0 ? [divY] : [], swimLaneLabels: [topLbl, botLbl] });
      debugTrace('importFlow:success', { nodeCount: ns.length, edgeCount: es.length, dividerY: divY || null });
    } catch (e) { debugTrace('importFlow:error', { error: String(e) }); console.error('Import failed:', e); }
  },
  loadFromLocalStorage: () => { const j = localStorage.getItem('pm-v5-save'); if (j) { get().importFlow(j); return true; } return false; },

  showOnboarding: false,
  hideOnboarding: () => set({ showOnboarding: false }),
  dismissOnboarding: () => { localStorage.setItem('pm-v5-onboarding-dismissed', '1'); set({ showOnboarding: false }); },
  showOnboardingPanel: () => set({ showOnboarding: true }),
  showGuide: false, toggleGuide: () => set(s => ({ showGuide: !s.showGuide })),
  tourActive: false, tourStep: 0,
  startTour: () => set({ tourActive: true, tourStep: 0 }),
  nextTourStep: () => {
    const { tourStep } = get();
    if (tourStep >= 4) get().skipTour();
    else set({ tourStep: tourStep + 1 });
  },
  skipTour: () => { localStorage.setItem('pm-v5-tour-done', '1'); set({ tourActive: false, tourStep: 0 }); },
  adminMode: false, toggleAdminMode: (pw) => { if (pw === 'pm2025') { set({ adminMode: !get().adminMode }); return true; } return false; },

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
        text: '🏊 6개 이상의 단계가 있으시면, 역할별로 구분선을 추가하면 프로세스가 더 명확해질 수 있어요. 상단 툴바의 "≡ 역할 구분선" 버튼으로 활성화할 수 있습니다.',
        quickQueries: ['수영레인 설정 방법'],
        dismissible: true
      });
    }
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
    'R-15': '표준 형식',
  };
  return m[ruleId] || ruleId;
}
