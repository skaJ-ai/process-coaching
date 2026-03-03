import { create } from 'zustand';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import { ProcessContext, ChatMessage, Suggestion, FlowNodeData, ContextMenuState, LoadingState, L7ReportItem, SwimLane, SaveStatus, ShapeType, NodeCategory, MetaEditTarget, L7Status, PDDAnalysisResult, Mode, OnboardingStep, DraftItem } from './types';
import { applyDagreLayout, reindexByPosition, generateId } from './utils/layoutEngine';
import { API_BASE_URL, SWIMLANE_COLORS, NODE_DIMENSIONS } from './constants';
import { detectCompoundAction } from './utils/labelUtils';
import { validateL7Label } from './utils/l7Rules';
import { makeInitialNodes, makeEdge, serialize, assignSwimLanes } from './store/helpers';
import { createChatActions } from './store/chatActions';

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
  // 표준 필드 우선, 하위 호환 필드는 fallback
  const direct = [d?.message, d?.speech, d?.guidance, d?.text, d?.content, d?.answer].find(v => typeof v === 'string' && v.trim());
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
  mode: Mode; setMode: (mode: Mode) => void;
  nodes: Node<FlowNodeData>[]; edges: Edge[];
  selectedNodeId: string | null; setSelectedNodeId: (id: string | null) => void;
  selectedEdgeId: string | null; setSelectedEdgeId: (id: string | null) => void;
  selectedNodeIds: string[]; setSelectedNodeIds: (ids: string[]) => void;
  alignNodes: (axis: 'horizontal' | 'vertical') => void;
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
  applyAutoLayout: () => void;
  categorizeNodesAI: () => Promise<void>;
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
  // v6: onboarding state machine
  onboardingStep: OnboardingStep;
  setOnboardingStep: (step: OnboardingStep) => void;
  advanceOnboarding: () => void;
  skipOnboarding: () => void;
  // v6: PDD history
  pddHistory: { content: string; timestamp: number }[];
  addPddHistory: (content: string) => void;
  showGuide: boolean; toggleGuide: () => void;
  // Product Tour
  tourActive: boolean; tourStep: number;
  startTour: () => void; nextTourStep: () => void; skipTour: () => void;
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
  // v5.3: one-click fixes
  splitCompoundNode: (nodeId: string) => void;
  separateSystemName: (nodeId: string) => void;
  resetToSetup: () => void;
  // Draft Lane
  draftItems: DraftItem[];
  addToDraft: (suggestion: Suggestion) => void;
  removeFromDraft: (id: string) => void;
  applyDraftItem: (id: string) => void;
  clearDraft: () => void;
}

export const useStore = create<AppStore>((set, get) => ({
  processContext: null,
  mode: null,
  setMode: (mode) => set({ mode }),
  setProcessContext: (ctx, onReady?: () => void) => {
    const init = makeInitialNodes();
    set({ processContext: ctx, nodes: init, edges: [], messages: [], history: [{ nodes: init, edges: [] }], historyIndex: 0, saveStatus: 'unsaved', lastSaved: null, showOnboarding: !localStorage.getItem('pm-v5-onboarding-dismissed'), onboardingStep: 'welcome' as OnboardingStep, pddHistory: [], dividerYs: [], swimLaneLabels: ['A 주체', 'B 주체', 'C 주체', 'D 주체'] });
    // 환영 메시지 추가
    setTimeout(() => {
      get().addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: `안녕하세요! "${ctx.processName}" 프로세스 설계를 함께 시작해볼까요?\n\n아래에서 온보딩을 시작하거나 바로 캔버스에 우클릭해서 셰이프를 추가해도 됩니다.`,
        quickActions: [
          { label: '온보딩 시작하기', storeAction: 'advanceOnboarding' },
          { label: '건너뛰기', storeAction: 'skipOnboarding' }
        ]
      });
      onReady?.();
      if (!localStorage.getItem('pm-v5-tour-done')) {
        setTimeout(() => get().startTour(), 600);
      }
    }, 300);
  },
  nodes: [], edges: [], selectedNodeId: null, selectedEdgeId: null, selectedNodeIds: [],
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedEdgeId: (id) => set({ selectedEdgeId: id }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  alignNodes: (axis) => {
    const { nodes, selectedNodeIds } = get();
    if (selectedNodeIds.length < 2) return;
    const FIXED_TYPES = new Set(['start', 'end']);
    const movable = nodes.filter(n => selectedNodeIds.includes(n.id) && !FIXED_TYPES.has(n.data.nodeType));
    if (movable.length < 1) return;
    get().pushHistory();
    const avg = axis === 'horizontal'
      ? Math.round(movable.reduce((s, n) => s + n.position.y, 0) / movable.length)
      : Math.round(movable.reduce((s, n) => s + n.position.x, 0) / movable.length);
    const movableIds = new Set(movable.map(n => n.id));
    set({
      nodes: nodes.map(n =>
        movableIds.has(n.id)
          ? { ...n, position: axis === 'horizontal' ? { ...n.position, y: avg } : { ...n.position, x: avg } }
          : n
      ),
      saveStatus: 'unsaved',
    });
    debugTrace('alignNodes', { axis, avg, movable: movable.length, skipped: selectedNodeIds.length - movable.length });
  },
  focusNodeId: null, setFocusNodeId: (id) => { set({ focusNodeId: null }); setTimeout(() => set({ focusNodeId: id }), 10); },
  forceComplete: () => {
    const { nodes, edges, processContext, mode } = get();
    set({ saveStatus: 'complete' });
    const modeStr = mode || 'AS-IS';
    const l6 = processContext?.processName || 'flow';
    const now = new Date();
    const dateTime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const json = get().exportFlow();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${modeStr}-${l6}-완료-${dateTime}.json`;
    a.click();
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
    // Decision 노드에서 나가는 엣지 자동 라벨: 첫 번째=Yes, 두 번째=No
    const sourceNode = get().nodes.find(n => n.id === conn.source);
    let autoLabel: string | undefined;
    if (sourceNode?.data.nodeType === 'decision') {
      const existingOut = get().edges.filter(e => e.source === conn.source).length;
      autoLabel = existingOut === 0 ? 'Yes' : existingOut === 1 ? 'No' : undefined;
    }
    set({ edges: addEdge(makeEdge(conn.source, conn.target, autoLabel, undefined, conn.sourceHandle || undefined, conn.targetHandle || undefined), get().edges), saveStatus: 'unsaved' });
    // v5.2: check if flow is now complete
    setTimeout(() => get().checkFlowCompletion(), 500);
  },

  addShape: (type, label, position) => {
    get().pushHistory();
    get().updateUserActivity();
    const id = generateId({ process: 'proc', decision: 'dec', subprocess: 'sub', start: 'start', end: 'end', parallel: 'par' }[type] ?? 'node');
    // 모든 노드(start/end 포함): 120px 이내 가장 인근 노드와 핸들 기준 수직/수평 정렬
    let pos = position;
    const existingNodes = get().nodes;
    const SNAP_THRESHOLD = 120;
    if (existingNodes.length > 0) {
      const nearest = existingNodes.reduce((best, n) => {
        const dims = NODE_DIMENSIONS[n.data.nodeType] || NODE_DIMENSIONS.process;
        const cx = n.position.x + dims.width / 2;
        const cy = n.position.y + dims.height / 2;
        const d = Math.hypot(position.x - cx, position.y - cy);
        return d < best.dist ? { node: n, dist: d } : best;
      }, (() => {
        const n0 = existingNodes[0];
        const d0 = NODE_DIMENSIONS[n0.data.nodeType] || NODE_DIMENSIONS.process;
        return { node: n0, dist: Math.hypot(position.x - (n0.position.x + d0.width / 2), position.y - (n0.position.y + d0.height / 2)) };
      })());
      if (nearest.dist < SNAP_THRESHOLD) {
        const nearestDims = NODE_DIMENSIONS[nearest.node.data.nodeType] || NODE_DIMENSIONS.process;
        const newDims = NODE_DIMENSIONS[type] || NODE_DIMENSIONS.process;
        const nearestCx = nearest.node.position.x + nearestDims.width / 2;
        const nearestCy = nearest.node.position.y + nearestDims.height / 2;
        const dx = Math.abs(position.x - nearestCx);
        const dy = Math.abs(position.y - nearestCy);
        if (dx > dy) {
          // 좌우 → 핸들 Y 정렬 (중심 Y 일치)
          pos = { x: position.x, y: nearestCy - newDims.height / 2 };
        } else if (dy > dx) {
          // 상하 → 핸들 X 정렬 (중심 X 일치)
          pos = { x: nearestCx - newDims.width / 2, y: position.y };
        }
      }
    }
    const node: Node<FlowNodeData> = {
      id, type, position: pos, draggable: true,
      data: { label, nodeType: type, category: 'as_is', addedBy: 'user', pendingEdit: true },
    };
    let updated = reindexByPosition([...get().nodes, node]);
    const { dividerYs, swimLaneLabels } = get();
    if (dividerYs.length > 0) updated = assignSwimLanes(updated, dividerYs, swimLaneLabels);
    set({ nodes: updated, saveStatus: 'unsaved', pendingEditNodeId: id });
    debugTrace('addShape', { id, type, label, x: position.x, y: position.y, nodeCount: updated.length });
    // v5.2: proactive coaching triggers
    const { onboardingStep: obs } = get();
    const isOnboardingActive = ['welcome', 'ask_swimlane', 'edit_swimlane', 'set_scope'].includes(obs);
    if (obs === 'idle' || obs === 'skipped') {
      // idle/skipped: first-shape welcome + decision + swimlane checks
      setTimeout(() => {
        get().checkFirstShape();
        get().checkDecisionLabels(id);
        get().checkSwimLaneNeed();
      }, 500);
    } else if (obs === 'done') {
      // done(인터뷰 후): first-shape welcome 제외 — 인터뷰가 이미 웰컴 역할을 함
      setTimeout(() => {
        get().checkDecisionLabels(id);
        get().checkSwimLaneNeed();
      }, 500);
    }
    // v5: contextual suggest on shape add — 온보딩 진행 중에는 억제
    if (!isOnboardingActive) get().triggerContextualSuggest();
    // auto L7 validation after label entry (6s delay to let user finish typing)
    setTimeout(() => get().autoValidateDebounced(), 6000);
    return id;
  },
  addShapeAfter: (type, label, afterNodeId) => {
    const { nodes, edges } = get(); get().pushHistory();
    const id = generateId(type === 'decision' ? 'dec' : type === 'subprocess' ? 'sub' : type === 'parallel' ? 'par' : 'proc');
    const after = nodes.find(n => n.id === afterNodeId);
    // 중심 기준 x 정렬: after 노드의 중심 x에 새 노드 중심을 맞춤
    const startNode = nodes.find(n => n.data.nodeType === 'start');
    const startDims = NODE_DIMENSIONS.start;
    const startCenterX = startNode ? startNode.position.x + startDims.width / 2 : 360;
    const afterDims = after ? (NODE_DIMENSIONS[after.data.nodeType] || NODE_DIMENSIONS.process) : startDims;
    const afterCenterX = after ? after.position.x + afterDims.width / 2 : startCenterX;
    const newDims = NODE_DIMENSIONS[type] || NODE_DIMENSIONS.process;
    const newX = afterCenterX - newDims.width / 2;
    const pos = after ? { x: newX, y: after.position.y + 150 } : { x: newX, y: 300 };
    const node: Node<FlowNodeData> = { id, type, position: pos, draggable: true, data: { label, nodeType: type, category: 'as_is', addedBy: 'user' } };
    const outEdge = edges.find(e => e.source === afterNodeId);
    let newEdges = [...edges];
    if (outEdge) {
      // 기존 엣지 제거 후 재연결: afterNode → 새 노드 → 기존 타겟
      newEdges = newEdges.filter(e => e.id !== outEdge.id);
      // afterNode의 bottom-source → 새 노드의 top-target
      newEdges.push(makeEdge(afterNodeId, id, undefined, undefined, 'bottom-source', 'top-target'));
      // 새 노드의 bottom-source → 기존 타겟의 원래 핸들 유지
      newEdges.push(makeEdge(id, outEdge.target, undefined, undefined, 'bottom-source', outEdge.targetHandle || 'top-target'));
    }
    else {
      // afterNode 다음에 추가 (아래 방향): bottom-source → top-target
      newEdges.push(makeEdge(afterNodeId, id, undefined, undefined, 'bottom-source', 'top-target'));
    }
    let updated = reindexByPosition([...nodes, node]);
    const { dividerYs, swimLaneLabels } = get();
    if (dividerYs.length > 0) updated = assignSwimLanes(updated, dividerYs, swimLaneLabels);
    set({ nodes: updated, edges: newEdges, saveStatus: 'unsaved' });
    debugTrace('addShapeAfter', { id, type, label, afterNodeId, nodeCount: updated.length, edgeCount: newEdges.length });
    get().triggerContextualSuggest();
    return id;
  },
  updateNodeLabel: (id, label, source = 'user') => {
    const node = get().nodes.find(n => n.id === id);
    const nodeType = node?.data.nodeType;
    const prev = node?.data.label;
    const wasPendingEdit = node?.data.pendingEdit;
    get().pushHistory();
    get().updateUserActivity();
    set({ nodes: get().nodes.map(n => n.id !== id ? n : { ...n, data: { ...n.data, label, pendingEdit: false, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined } }), saveStatus: 'unsaved' });
    debugTrace('updateNodeLabel', { id, before: prev || null, after: label, source });
    // 신규 셰이프 라벨 확정 직후 즉시 L7 검증
    const PLACEHOLDER_LABELS_UNL = new Set(['새 태스크', '새 단계', '분기 조건?', '판단 조건', 'L6 프로세스', '하위 절차']);
    if (
      wasPendingEdit &&
      source === 'user' &&
      ['process', 'decision'].includes(nodeType ?? '') &&
      label.trim().length > 2 &&
      !PLACEHOLDER_LABELS_UNL.has(label.trim())
    ) {
      setTimeout(() => get().validateNode(id), 300);
    }
    // 온보딩 set_scope: 종료 노드 라벨을 실제로 편집하면 define_phases로 자동 진행
    if (get().onboardingStep === 'set_scope' && nodeType === 'end' && label.trim() && label !== '종료') {
      setTimeout(() => get().advanceOnboarding(), 600);
    }
  },
  updateNodeMeta: (id, meta) => { get().pushHistory(); set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...meta } } : n), saveStatus: 'unsaved' }); },
  setNodeCategory: (id, category) => { get().pushHistory(); set({ nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, category } } : n), saveStatus: 'unsaved' }); },
  deleteNode: (id) => {
    const { nodes, edges } = get();
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    if (node.data.nodeType === 'start') { if (nodes.filter(n => n.data.nodeType === 'start').length <= 1) return; }
    get().pushHistory();
    // parallel 노드: Split/Join 구조가 복잡하므로 재연결 없이 단순 제거
    if (node.data.nodeType === 'parallel') {
      set({ nodes: reindexByPosition(nodes.filter(n => n.id !== id)), edges: edges.filter(e => e.source !== id && e.target !== id), saveStatus: 'unsaved' });
      return;
    }
    const inE = edges.filter(e => e.target === id), outE = edges.filter(e => e.source === id);
    let newEdges = edges.filter(e => e.source !== id && e.target !== id);
    for (const i of inE) for (const o of outE) newEdges.push(makeEdge(i.source, o.target));
    set({ nodes: reindexByPosition(nodes.filter(n => n.id !== id)), edges: newEdges, saveStatus: 'unsaved' });
  },
  changeNodeType: (id, nt) => { get().pushHistory(); set({ nodes: get().nodes.map(n => n.id === id ? { ...n, type: nt, data: { ...n.data, nodeType: nt } } : n), saveStatus: 'unsaved' }); },

  updateEdgeLabel: (eid, label) => { get().pushHistory(); set({ edges: get().edges.map(e => e.id === eid ? { ...e, label: label || undefined, labelStyle: label ? { fill: '#e2e8f0', fontWeight: 500, fontSize: 12 } : undefined, labelBgStyle: label ? { fill: '#1e293b', fillOpacity: 0.9 } : undefined, labelBgPadding: label ? [6, 4] as [number, number] : undefined } : e), saveStatus: 'unsaved' }); },
  deleteEdge: (eid) => { get().pushHistory(); set({ edges: get().edges.filter(e => e.id !== eid), saveStatus: 'unsaved' }); },

  applySuggestion: (s) => {
    if (s.action === 'MODIFY') {
      if (!s.targetNodeId) {
        // T-04: targetNodeId 없으면 수정 대상 불명 → 사용자에게 안내
        get().addMessage({ id: generateId('msg'), role: 'bot', text: '수정할 노드를 특정하지 못했어요. 노드를 직접 선택한 후 라벨을 편집해주세요.', timestamp: Date.now() });
        return;
      }
      const modifyLabel = s.newLabel || s.labelSuggestion;
      if (modifyLabel) { get().updateNodeLabel(s.targetNodeId, modifyLabel, 'ai'); }
      return;
    }
    if (s.action === 'DELETE' && s.targetNodeId) {
      get().deleteNode(s.targetNodeId);
      return;
    }
    let afterId = s.insertAfterNodeId;
    const { nodes, edges } = get();
    // 유효하지 않은 ID면 초기화
    if (afterId && !nodes.find(n => n.id === afterId)) afterId = undefined;

    // ⚠️ 순차 추가 보장: insertAfterNodeId가 현재 가장 마지막 노드가 아니면 무시
    // → 여러 suggestion을 순서대로 클릭할 때 역순 배치 방지
    if (afterId) {
      const processNodes = nodes.filter(n => !['start', 'end'].includes(n.data.nodeType));
      const lastNode = processNodes.length > 0
        ? processNodes.reduce((a, b) => a.position.y >= b.position.y ? a : b)
        : nodes.find(n => n.data.nodeType === 'start');

      // afterId가 lastNode 또는 end 직전이 아니면 무시하고 폴백
      const endNode = nodes.find(n => n.data.nodeType === 'end');
      const beforeEnd = endNode ? edges.find(e => e.target === endNode.id)?.source : null;
      const isValidInsertPoint = afterId === lastNode?.id || afterId === beforeEnd;

      if (!isValidInsertPoint) {
        afterId = undefined;
      }
    }

    // afterId 없으면 스마트 폴백: 종료 노드 직전 → 마지막 프로세스 노드 → start 노드 순
    if (!afterId) {
      const endNode = nodes.find(n => n.data.nodeType === 'end');
      if (endNode) {
        const edgeToEnd = edges.find(e => e.target === endNode.id);
        afterId = edgeToEnd?.source;
      }
      if (!afterId) {
        const processNodes = nodes.filter(n => !['start', 'end'].includes(n.data.nodeType));
        if (processNodes.length > 0) {
          afterId = processNodes.reduce((a, b) => a.position.y >= b.position.y ? a : b).id;
        }
      }
      if (!afterId) {
        const startNode = nodes.find(n => n.data.nodeType === 'start');
        afterId = startNode?.id;
      }
    }
    const suggestionType = String((s as any).type || '').toUpperCase();
    const labelText = (s.labelSuggestion || s.newLabel || s.summary || '').toLowerCase();
    const st: ShapeType =
      suggestionType === 'START' ? 'start'
      : suggestionType === 'END' ? 'end'
      : suggestionType === 'DECISION' ? 'decision'
      : suggestionType === 'SUBPROCESS' ? 'subprocess'
      : suggestionType === 'PARALLEL' ? 'parallel'
      : /종료|완료|끝|finish/.test(labelText) ? 'end'
      : /시작|start|begin/.test(labelText) ? 'start'
      : /판단|결정|여부|분기|승인|반려/.test(labelText) ? 'decision'
      : 'process';
    // labelSuggestion이 없으면 적용 불가 (summary는 설명 텍스트라 라벨로 사용 불가)
    const label = s.labelSuggestion || s.newLabel;
    if (!label) return;
    const compound = detectCompoundAction(label);
    const primaryLabel = compound.isCompound ? compound.parts[0] : label;
    let newNodeId: string;
    {
      newNodeId = afterId ? get().addShapeAfter(st, primaryLabel, afterId) : get().addShape(st, primaryLabel, { x: 300, y: 300 });
    }
    // Issue 5: AI가 추가한 노드 표시 (재수정 제안 방지용)
    set({ nodes: get().nodes.map(n => n.id === newNodeId ? { ...n, data: { ...n.data, addedBy: 'ai' as const } } : n) });
    // AI 추천 셰이프 즉시 L7 검증 (process/decision만)
    if (['process', 'decision'].includes(st) && primaryLabel.trim().length > 2) {
      setTimeout(() => get().validateNode(newNodeId), 400);
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

  validateAllNodes: async () => {
    const { nodes, addMessage, setLoadingMessage, loadingState } = get();
    const targets = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType));
    if (!targets.length) { addMessage({ id: generateId('msg'), role: 'bot', text: '검증할 노드가 없습니다.', timestamp: Date.now() }); return; }
    let newCount = (loadingState.requestCount || 0) + 1;
    set({ loadingState: { active: true, message: `L7 검증 (0/${targets.length})`, startTime: Date.now(), elapsed: 0, requestCount: newCount } });
    // React가 로딩 상태를 실제로 렌더할 수 있도록 한 프레임 양보
    await new Promise(r => setTimeout(r, 0));

    // Parallel Execution (Batch 4)
    const BATCH_SIZE = 4;
    const items: L7ReportItem[] = [];

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      setLoadingMessage(`L7 검증 (${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length})...`);
      const results = await Promise.allSettled(batch.map(t => get().validateNode(t.id)));

      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value) {
          const nodeId = batch[idx].id;
          // T-05: 검증 완료 시점의 최신 노드 상태 사용 (배치 캡처 스냅샷 대신)
          const liveNode = get().nodes.find(n => n.id === nodeId);
          if (!liveNode) return;
          const r = res.value;
          const item = { nodeId: liveNode.id, nodeLabel: liveNode.data.label, pass: r.pass, score: r.score ?? 0, issues: (r.issues || []).map((x: any) => ({ ...x, friendlyTag: x.friendlyTag || friendlyTag(x.ruleId) })), rewriteSuggestion: r.rewriteSuggestion, encouragement: r.encouragement };
          items.push(item);
          if (item.issues.length > 0) {
            addMessage({
              id: generateId('msg'),
              role: 'bot',
              text: `🔎 "${liveNode.data.label}" 검증 결과가 도착했어요.`,
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
    // 플레이스홀더 라벨 등으로 검증 생략된 노드 수 안내
    const skipped = targets.length - items.length;
    const skippedNote = skipped > 0 ? ` · ⚪ ${skipped} 라벨 미입력(검증 생략)` : '';
    addMessage({ id: generateId('msg'), role: 'bot', text: `✅ L7 검증 완료: 🟢${ok} 🟡${warn} 🔴${fail}${skippedNote}`, timestamp: Date.now() });
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
    const PLACEHOLDER_LABELS = new Set(['새 태스크', '새 단계', '분기 조건?', '판단 조건', 'L6 프로세스', '하위 절차']);
    const t = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType) && n.data.label.trim().length > 2 && !PLACEHOLDER_LABELS.has(n.data.label.trim()) && (!n.data.l7Status || n.data.l7Status === 'none'));
    if (!t.length) return;
    set({ lastAutoValidateTime: now });
    get().validateNode(t[0].id);
  },



  history: [], historyIndex: -1,
  pushHistory: () => { const { nodes, edges, history, historyIndex } = get(); const h = history.slice(0, historyIndex + 1); h.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }); if (h.length > 50) h.shift(); set({ history: h, historyIndex: h.length - 1 }); },
  undo: () => { const { history: h, historyIndex: i } = get(); if (i <= 0) return; set({ nodes: h[i - 1].nodes, edges: h[i - 1].edges, historyIndex: i - 1 }); },
  redo: () => { const { history: h, historyIndex: i } = get(); if (i >= h.length - 1) return; set({ nodes: h[i + 1].nodes, edges: h[i + 1].edges, historyIndex: i + 1 }); },
  applyAutoLayout: () => {
    const { nodes, edges, pushHistory } = get();
    if (nodes.length === 0) return;
    pushHistory();
    const { nodes: layoutedNodes, edges: layoutedEdges } = applyDagreLayout(nodes, edges);
    const reindexed = reindexByPosition(layoutedNodes);
    set({ nodes: reindexed, edges: layoutedEdges });
  },
  categorizeNodesAI: async () => {
    const { nodes, processContext, mode } = get();
    if (mode !== 'TO-BE') {
      alert('TO-BE 모드에서만 사용할 수 있습니다.');
      return;
    }
    if (nodes.length === 0) return;
    set({ loadingState: { active: true, message: 'AI 카테고리 분류 중...', startTime: Date.now(), elapsed: 0, requestCount: 1 } });
    try {
      const { nodes: sn } = serialize(nodes, []);
      const r = await fetch(`${API_BASE_URL}/categorize-nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: processContext || {}, nodes: sn })
      });
      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status}: ${errText.slice(0, 200)}`);
      }
      const data = await r.json();
      if (data.categorizations && Array.isArray(data.categorizations)) {
        const updatedNodes = nodes.map(n => {
          const cat = data.categorizations.find((c: any) => c.nodeId === n.id);
          if (cat && cat.category) {
            return { ...n, data: { ...n.data, category: cat.category } };
          }
          return n;
        });
        set({ nodes: updatedNodes, loadingState: { active: false, message: '', startTime: 0, elapsed: 0, requestCount: 0 } });
        alert(`${data.categorizations.length}개 노드 카테고리 분류 완료`);
      } else {
        throw new Error('카테고리 분류 응답이 올바르지 않습니다.');
      }
    } catch (e) {
      console.error('categorizeNodesAI error:', e);
      alert('카테고리 분류 실패: ' + (e instanceof Error ? e.message : '알 수 없는 오류'));
      set({ loadingState: { active: false, message: '', startTime: 0, elapsed: 0, requestCount: 0 } });
    }
  },

  messages: [], loadingState: { active: false, message: '', startTime: 0, elapsed: 0, requestCount: 0 },
  addMessage: (m) => set(s => ({ messages: [...s.messages, m] })),
  setLoadingMessage: (m) => set(s => ({ loadingState: { ...s.loadingState, message: m } })),
  ...createChatActions(set as any, get as any, { generateId, debugTrace, extractBotText, friendlyTag }),



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
    const { onboardingStep, swimLaneLabels: prev, nodes, dividerYs } = get();
    const updated = assignSwimLanes(nodes, dividerYs, labels);
    set({ swimLaneLabels: labels, nodes: updated });
    // 온보딩 edit_swimlane: A→B 순서로 편집 감지, 둘 다 바꾸면 자동 진행
    if (onboardingStep === 'edit_swimlane') {
      const defaults = ['A 주체', 'B 주체', 'C 주체', 'D 주체'];
      const prevEdited = prev.filter((l, i) => l !== defaults[i]).length;
      const nowEdited = labels.filter((l, i) => l !== defaults[i]).length;
      if (prevEdited < 1 && nowEdited >= 1) {
        get().addMessage({ id: generateId('msg'), role: 'bot', timestamp: Date.now(), text: '👍 A주체 완료! 이제 B주체 이름도 바꿔보세요.', dismissible: true });
      } else if (nowEdited >= 2) {
        setTimeout(() => get().advanceOnboarding(), 400);
      }
    }
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
    const { nodes, edges, processContext, mode } = get();
    const issues: string[] = [];
    if (!nodes.some(n => n.data.nodeType === 'end')) issues.push('종료 노드가 없습니다. 우클릭으로 추가해주세요.');
    const orphans = nodes.filter(n => !['start', 'end'].includes(n.data.nodeType) && !edges.some(e => e.source === n.id || e.target === n.id));
    if (orphans.length) issues.push(`연결되지 않은 노드 ${orphans.length}개`);
    const unc = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType) && (!n.data.l7Status || n.data.l7Status === 'none'));
    if (unc.length) issues.push(`L7 검증 미실행 노드 ${unc.length}개`);
    if (force || !issues.length) {
      set({ saveStatus: 'complete' });
      const modeStr = mode || 'AS-IS';
      const l6 = processContext?.processName || 'flow';
      const now = new Date();
      const dateTime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const json = get().exportFlow();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `${modeStr}-${l6}-완료-${dateTime}.json`; a.click();
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
    }, null, 2);
  },
  importFlow: (json) => {
    try {
      const d = JSON.parse(json); if (!d.nodes) return;
      const ns: Node<FlowNodeData>[] = d.nodes
        .filter((n: any) => n.type !== 'phase') // 구버전 Phase 노드 제거
        .map((n: any) => ({ id: n.id, type: n.type, position: n.position || { x: 0, y: 0 }, draggable: true, data: { label: n.label, nodeType: n.type, inputLabel: n.inputLabel, outputLabel: n.outputLabel, systemName: n.systemName, duration: n.duration, category: n.category || 'as_is', swimLaneId: n.swimLaneId } }));
      const es: Edge[] = (d.edges || []).map((e: any) => makeEdge(e.source, e.target, e.label || undefined, undefined, e.sourceHandle || undefined, e.targetHandle || undefined));

      // 스윔레인 복원 — 신규 포맷(dividerYs 배열) 우선, 구버전 하위 호환
      let divYs: number[] = [];
      let laneLabels: string[] = ['A 주체', 'B 주체'];

      if (d.dividerYs && Array.isArray(d.dividerYs) && d.dividerYs.length > 0) {
        // 현재 포맷: dividerYs 배열 + swimLaneLabels 배열
        divYs = d.dividerYs;
        if (Array.isArray(d.swimLaneLabels) && d.swimLaneLabels.length >= 2) {
          laneLabels = d.swimLaneLabels;
        }
      } else {
        // 구버전 하위 호환
        let divY = d.dividerY || 0;
        let topLbl = d.topLabel || 'A 주체';
        let botLbl = d.bottomLabel || 'B 주체';
        if (!divY && d.swimLanes?.length === 2 && d.laneBoundaries?.length >= 1) {
          divY = d.laneBoundaries[0];
          topLbl = d.swimLanes[0]?.label || 'A 주체';
          botLbl = d.swimLanes[1]?.label || 'B 주체';
        }
        if (!divY && d.swimLaneDividerY && d.swimLaneDividerY > 0) {
          divY = d.swimLaneDividerY;
          topLbl = (d.swimLaneLabels as any)?.top || 'A 주체';
          botLbl = (d.swimLaneLabels as any)?.bottom || 'B 주체';
        }
        if (divY > 0) divYs = [divY];
        laneLabels = [topLbl, botLbl];
      }

      set({ nodes: reindexByPosition(ns), edges: es, processContext: d.processContext || get().processContext, dividerYs: divYs, swimLaneLabels: laneLabels });
      debugTrace('importFlow:success', { nodeCount: ns.length, edgeCount: es.length, dividerYs: divYs });
    } catch (e) { debugTrace('importFlow:error', { error: String(e) }); console.error('Import failed:', e); }
  },
  loadFromLocalStorage: () => { const j = localStorage.getItem('pm-v5-save'); if (j) { get().importFlow(j); return true; } return false; },

  showOnboarding: false,
  hideOnboarding: () => set({ showOnboarding: false }),
  dismissOnboarding: () => { localStorage.setItem('pm-v5-onboarding-dismissed', '1'); set({ showOnboarding: false }); },
  showOnboardingPanel: () => set({ showOnboarding: true }),

  // v6: onboarding state machine
  onboardingStep: 'idle' as OnboardingStep,
  setOnboardingStep: (step) => set({ onboardingStep: step }),
  advanceOnboarding: () => {
    const { onboardingStep, addMessage, dividerYs } = get();
    const order: OnboardingStep[] = ['idle', 'welcome', 'ask_swimlane', 'edit_swimlane', 'set_scope', 'done'];
    const idx = order.indexOf(onboardingStep);
    let next = order[idx + 1] ?? 'done';
    // 역할 구분선 없으면 edit_swimlane 스킵
    if (next === 'edit_swimlane' && dividerYs.length === 0) next = 'set_scope';
    set({ onboardingStep: next });
    if (next === 'ask_swimlane') {
      const ctx = get().processContext;
      const processName = ctx?.processName || '이 프로세스';
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: `"${processName}"에 등장하는 주체가 누구누구인가요?\n\n예: 담당자 + 면접위원, 담당자 + 임직원처럼 주체가 2인 이상이라면 역할 구분선이 필요합니다.\n담당자가 전부 처리한다면 없어도 됩니다.`,
        quickActions: [
          { label: '역할 구분선 추가하기', storeAction: 'addSwimLaneAndAdvance' },
          { label: '단독 처리 - 다음', storeAction: 'advanceOnboarding' },
        ],
      });
    } else if (next === 'edit_swimlane') {
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: '역할 구분선이 추가됐어요!\n\n캔버스 좌측에서 깜빡이는 라벨을 클릭해서 실제 담당자/역할명으로 바꿔보세요.\nA주체 → B주체 순서로 바꾸면 자동으로 다음 단계로 넘어갑니다.',
      });
    } else if (next === 'set_scope') {
      // 종료 노드 없으면 자동 추가 (시작과 수평 정렬, 멀리 배치)
      const endExists = get().nodes.find(n => n.data.nodeType === 'end');
      if (!endExists) {
        // start 노드 기준으로 오른쪽 멀리 배치 (x + 600, 같은 y)
        const sn = get().nodes.find(n => n.data.nodeType === 'start');
        const endPos = { x: (sn?.position.x ?? 300) + 1200, y: sn?.position.y ?? 100 };
        get().addShape('end', '종료', endPos);
        setTimeout(() => set({ pendingEditNodeId: null }), 10); // 자동 인라인 편집 억제
      }
      const scopeCtx = get().processContext;
      const scopeName = scopeCtx?.processName || '이 프로세스';
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: `다음으로 '${scopeName}'의 프로세스 범위를 한정해볼게요.\n\n시작 노드에는 이 L6가 어떤 트리거에 의해 착수되는지, 종료 노드에는 어떤 결과물/산출물로 완수되는지를 입력해보세요.\n\n예: 시작 "채용 요청 접수" → 종료 "최종 합격자 결정"`,
        quickActions: [
          { label: '🟢 시작 노드 작성하기', storeAction: 'focusStartNode', noActioned: true },
          { label: '🔴 종료 노드 작성하기', storeAction: 'focusEndNode', noActioned: true },
        ],
      });
    } else if (next === 'done') {
      const ctx = get().processContext;
      const processName = ctx?.processName || '이 프로세스';
      // 종료 노드 작성 직후 → 시작 노드로 줌 복귀 (set_scope 시작 화면과 동일)
      const startNode = get().nodes.find(n => n.data.nodeType === 'start');
      if (startNode) {
        setTimeout(() => get().setFocusNodeId(startNode.id), 400);
      }
      addMessage({
        id: generateId('msg'), role: 'bot', timestamp: Date.now(),
        text: `🎉 기본 설정 완료!\n\n이제 "${processName}"의 단계들을 채워볼까요?\nAI가 순서대로 질문할게요. 자연스럽게 답해주시면 노드 추가를 제안해드릴게요.`,
        quickActions: [
          { label: '🎙 AI 인터뷰로 시작하기', storeAction: 'startInterviewFlow' },
        ],
        dismissible: true,
      });
      set({ onboardingStep: 'done' });
    }
  },
  skipOnboarding: () => {
    set({ onboardingStep: 'skipped' as OnboardingStep });
    get().addMessage({ id: generateId('msg'), role: 'bot', timestamp: Date.now(), text: '온보딩을 건너뛰었습니다. 언제든 질문하거나 우클릭으로 셰이프를 추가하세요!', dismissible: true });
  },


  // v6: PDD history
  pddHistory: [],
  addPddHistory: (content) => set(s => ({ pddHistory: [...s.pddHistory, { content, timestamp: Date.now() }] })),

  showGuide: false, toggleGuide: () => set(s => ({ showGuide: !s.showGuide })),
  tourActive: false, tourStep: 0,
  startTour: () => set({ tourActive: true, tourStep: 0 }),
  nextTourStep: () => {
    const { tourStep } = get();
    if (tourStep >= 4) get().skipTour();
    else set({ tourStep: tourStep + 1 });
  },
  skipTour: () => { localStorage.setItem('pm-v5-tour-done', '1'); set({ tourActive: false, tourStep: 0 }); },

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
      const { nodes, edges, processContext, loadingState, addMessage, isUserActive, onboardingStep } = get();
      // 온보딩 단계 진행 중이면 억제 — 온보딩 대화와 충돌 방지
      const onboardingActive = ['welcome', 'ask_swimlane', 'edit_swimlane', 'set_scope'].includes(onboardingStep);
      if (loadingState.active || isUserActive() || onboardingActive) return; // Skip if user is still active
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
    // start/end 제외한 process 노드가 정확히 1개일 때 발화 (start+end+1process = 3 이상)
    const processNodeCount = nodes.filter(n => !['start', 'end'].includes(n.data.nodeType)).length;
    if (processNodeCount === 1) {
      set({ _lastCoachingTrigger: { ..._lastCoachingTrigger, firstShape: Date.now() } });
      try {
        const { nodes: sn, edges: se } = serialize(nodes, edges);
        const r = await fetch(`${API_BASE_URL}/first-shape-welcome`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: processContext || {}, currentNodes: sn, currentEdges: se }),
        });
        if (r.ok) {
          const d = await r.json();
          const welcomeText = d.message || d.text;
          if (welcomeText) {
            addMessage({ id: generateId('msg'), role: 'bot', timestamp: Date.now(), text: welcomeText, suggestions: d.suggestions || [], quickQueries: d.quickQueries || [], dismissible: true });
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
        text: '🏊 주체가 2명 이상이라면 역할 구분선을 추가해보세요. 단독 처리라면 없어도 됩니다.',
        quickActions: [{ label: '역할 구분선 설정하기', storeAction: 'toggleSwimLane' }],
        dismissible: true
      });
    }
  },

  // v5.3: one-click fixes
  splitCompoundNode: (nodeId: string) => {
    const { nodes, edges } = get();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const compound = detectCompoundAction(node.data.label);
    if (!compound.isCompound || compound.parts.length < 2) return;
    get().pushHistory();
    // 1. 기존 노드 라벨을 parts[0]으로 변경
    get().updateNodeLabel(nodeId, compound.parts[0], 'ai');
    // 2. 새 노드 생성 (parts[1]) — addShapeAfter가 엣지 재연결을 자동 처리
    get().addShapeAfter('process', compound.parts[1], nodeId);
    // L7 상태 초기화 (재검증 필요)
    set({ nodes: get().nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined } } : n) });
  },

  separateSystemName: (nodeId: string) => {
    const node = get().nodes.find(n => n.id === nodeId);
    if (!node) return;
    const result = validateL7Label(node.data.label, node.data.nodeType);
    if (!result.detectedSystemName) return;
    get().pushHistory();
    const sysName = result.detectedSystemName;
    // 라벨에서 시스템명 패턴 제거
    const escaped = sysName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let newLabel = node.data.label
      .replace(new RegExp(`[(\[（]${escaped}[)\\]）]\\s*`), '')
      .replace(new RegExp(`^${escaped}에서\\s*`), '')
      .trim();
    get().updateNodeLabel(nodeId, newLabel, 'ai');
    get().updateNodeMeta(nodeId, { systemName: sysName });
    // L7 상태 초기화 (재검증 필요)
    set({ nodes: get().nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, l7Status: 'none' as L7Status, l7Issues: [], l7Rewrite: undefined } } : n) });
  },

  resetToSetup: () => {
    // 현재 작업을 로컬 스토리지에 저장 후 초기 화면으로 복귀
    get().saveDraft();
    set({ processContext: null, mode: null, pddHistory: [], onboardingStep: 'idle' as OnboardingStep });
  },

  // Draft Lane
  draftItems: [],
  addToDraft: (suggestion) => {
    set((s) => ({
      draftItems: [...s.draftItems, { id: generateId('draft'), suggestion, stagedAt: Date.now() }],
    }));
  },
  removeFromDraft: (id) => {
    set((s) => ({ draftItems: s.draftItems.filter((d) => d.id !== id) }));
  },
  applyDraftItem: (id) => {
    const { draftItems, applySuggestion, removeFromDraft } = get();
    const item = draftItems.find((d) => d.id === id);
    if (!item) return;
    applySuggestion(item.suggestion);
    removeFromDraft(id);
  },
  clearDraft: () => set({ draftItems: [] }),

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
    'R-09': 'Decision 형식',
    'R-15': '표준 형식',
  };
  return m[ruleId] || ruleId;
}
