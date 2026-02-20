import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider, useReactFlow, useViewport, useStore as useRFStore, BackgroundVariant } from 'reactflow';
import { createPortal } from 'react-dom';
import 'reactflow/dist/style.css';
import { useStore } from '../store';
import { nodeTypes, edgeTypes } from './CustomNodes';
import Toolbar from './Toolbar';
import ContextMenu from './ContextMenu';
import NodeDetailPanel from './NodeDetailPanel';
import MetaEditModal from './MetaEditModal';
import HelpGuide from './HelpGuide';
import TourOverlay from './TourOverlay';
import { SWIMLANE_COLORS } from '../constants';

function SwimLaneOverlay({ wrapperRef }: { wrapperRef: React.RefObject<HTMLDivElement> }) {
  const dividerYs = useStore(s => s.dividerYs);
  const nodes = useStore(s => s.nodes);
  const swimLaneLabels = useStore(s => s.swimLaneLabels);
  const setDividerYs = useStore(s => s.setDividerYs);
  const setSwimLaneLabels = useStore(s => s.setSwimLaneLabels);
  const removeDividerY = useStore(s => s.removeDividerY);
  const rfInstance = useReactFlow();
  useViewport(); // viewport 변화 시 컨트롤 위치 재계산
  const viewportNode = useRFStore((s) => s.domNode?.querySelector('.react-flow__viewport') as HTMLElement | null);
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [tempLabel, setTempLabel] = React.useState('');
  const dividerYsRef = useRef(dividerYs);
  const dragRef = useRef<{ index: number; startFlowY: number; initialY: number } | null>(null);

  useEffect(() => {
    dividerYsRef.current = dividerYs;
  }, [dividerYs]);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
  }, []);

  const onDragMove = useCallback((ev: MouseEvent) => {
    const state = dragRef.current;
    if (!state) return;
    if (ev.buttons === 0) {
      stopDrag();
      return;
    }
    const currentFlowY = rfInstance.screenToFlowPosition({ x: ev.clientX, y: ev.clientY }).y;
    const delta = currentFlowY - state.startFlowY;
    const maxNodeY = nodes.length ? Math.max(...nodes.map((n) => n.position.y)) : 1200;
    const maxDividerY = Math.max(3000, maxNodeY + 1000);
    const newY = Math.min(state.initialY + delta, maxDividerY);
    const newYs = [...dividerYsRef.current];
    newYs[state.index] = newY;
    setDividerYs(newYs);
  }, [rfInstance, setDividerYs, stopDrag]);

  const onDragEnd = useCallback(() => {
    stopDrag();
  }, [stopDrag]);

  useEffect(() => {
    return () => {
      stopDrag();
    };
  }, [stopDrag]);

  if (dividerYs.length === 0 || !viewportNode) return null;
  const sortedDividers = [...dividerYs]
    .map((y, idx) => ({ y, idx }))
    .sort((a, b) => a.y - b.y);
  const laneCount = sortedDividers.length + 1;
  const lineThickness = 3;
  const handleWidth = 34;
  const handleHeight = 48;
  const removeSize = 22;

  const handleDividerDragStart = (index: number, initialY: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      index,
      initialY,
      startFlowY: rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY }).y
    };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  };

  const handleLabelChange = (index: number, newLabel: string) => {
    const newLabels = [...swimLaneLabels];
    newLabels[index] = newLabel;
    setSwimLaneLabels(newLabels);
  };

  const lines = (
    <>
      {sortedDividers.map(({ y, idx }) => (
        <div key={`divider-${idx}`} style={{ position: 'absolute', left: -20000, width: 40000, top: y - lineThickness / 2, height: lineThickness, borderTop: `${lineThickness}px dashed #94a3b8`, pointerEvents: 'none', zIndex: 5, opacity: 0.65 }} />
      ))}
    </>
  );

  const rect = wrapperRef.current?.getBoundingClientRect();
  const controls = rect ? (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
      {sortedDividers.map(({ y, idx }) => {
        const lineScreenY = rfInstance.flowToScreenPosition({ x: 0, y }).y - rect.top;
        const handleLeft = rect.width - handleWidth - 10;
        return (
          <React.Fragment key={`ctrl-${idx}`}>
            <div
              style={{ position: 'absolute', left: handleLeft, top: lineScreenY - handleHeight / 2, width: handleWidth, height: handleHeight, background: 'rgba(148, 163, 184, 0.2)', border: '1px solid rgba(148, 163, 184, 0.8)', borderRadius: 6, cursor: 'row-resize', pointerEvents: 'auto', zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseDown={handleDividerDragStart(idx, y)}
            >
              <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 'bold' }}>⋮⋮</span>
            </div>
            {dividerYs.length > 1 && (
              <button onClick={() => removeDividerY(idx)} style={{ position: 'absolute', left: handleLeft - removeSize - 6, top: lineScreenY - removeSize / 2, width: removeSize, height: removeSize, borderRadius: 4, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5', cursor: 'pointer', fontSize: 12, fontWeight: 'bold', pointerEvents: 'auto', zIndex: 6 }}>×</button>
            )}
          </React.Fragment>
        );
      })}

      {Array.from({ length: laneCount }).map((_, laneIdx) => {
        const prevY = laneIdx === 0 ? sortedDividers[0].y - 160 : sortedDividers[laneIdx - 1].y;
        const nextY = laneIdx === sortedDividers.length ? sortedDividers[sortedDividers.length - 1].y + 120 : sortedDividers[laneIdx].y;
        const midFlowY = (prevY + nextY) / 2;
        const midY = rfInstance.flowToScreenPosition({ x: 0, y: midFlowY }).y - rect.top;
        return (
          <div key={`label-${laneIdx}`} style={{ position: 'absolute', left: 8, top: midY - 12, fontSize: 12, fontWeight: 600, color: '#cbd5e1', background: 'rgba(15,23,41,0.88)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.25)', pointerEvents: 'auto', cursor: editingIdx === laneIdx ? 'text' : 'pointer', zIndex: 6 }} onClick={() => { setEditingIdx(laneIdx); setTempLabel(swimLaneLabels[laneIdx]); }}>
            {editingIdx === laneIdx ? (
              <input
                autoFocus
                type="text"
                id={`swimlane-label-${laneIdx}`}
                name={`swimlane_label_${laneIdx}`}
                aria-label={`스윔레인 ${laneIdx + 1} 라벨`}
                value={tempLabel}
                onChange={(e) => setTempLabel(e.target.value)}
                onBlur={() => { handleLabelChange(laneIdx, tempLabel); setEditingIdx(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { handleLabelChange(laneIdx, tempLabel); setEditingIdx(null); } if (e.key === 'Escape') setEditingIdx(null); }}
                style={{ background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 12, fontWeight: 600, outline: 'none', width: '88px', fontFamily: 'inherit' }}
              />
            ) : (
              swimLaneLabels[laneIdx]
            )}
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      {createPortal(lines, viewportNode)}
      {controls}
    </>
  );
}

// Vertical ghost flow (includes start node to avoid confusion)
function GhostFlow() {
  return (
    <svg width="250" height="360" viewBox="0 0 250 360">
      <defs>
        <marker id="ga" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#334155" />
        </marker>
      </defs>
      {/* Start circle */}
      <circle cx="80" cy="18" r="16" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x="80" y="22" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontWeight="600">시작</text>
      {/* Arrow from Start ↓ */}
      <line x1="80" y1="36" x2="80" y2="58" stroke="#334155" strokeWidth="1.5" markerEnd="url(#ga)" />
      {/* Process 1 */}
      <rect x="25" y="60" width="110" height="38" rx="7" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x="80" y="83" textAnchor="middle" fill="#93c5fd" fontSize="11">요청을 접수한다</text>
      {/* Arrow ↓ */}
      <line x1="80" y1="100" x2="80" y2="122" stroke="#334155" strokeWidth="1.5" markerEnd="url(#ga)" />
      {/* Process 2 */}
      <rect x="25" y="124" width="110" height="38" rx="7" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x="80" y="147" textAnchor="middle" fill="#93c5fd" fontSize="11">내용을 검토한다</text>
      {/* Arrow ↓ */}
      <line x1="80" y1="164" x2="80" y2="186" stroke="#334155" strokeWidth="1.5" markerEnd="url(#ga)" />
      {/* Decision diamond — center (80, 214) */}
      <polygon points="80,186 114,214 80,242 46,214" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x="80" y="218" textAnchor="middle" fill="#fcd34d" fontSize="10">승인 여부 판단</text>
      {/* Arrow ↓ 예 */}
      <line x1="80" y1="244" x2="80" y2="266" stroke="#334155" strokeWidth="1.5" markerEnd="url(#ga)" />
      <text x="90" y="260" fill="#64748b" fontSize="9">예</text>
      {/* Process Yes */}
      <rect x="25" y="268" width="110" height="38" rx="7" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x="80" y="291" textAnchor="middle" fill="#93c5fd" fontSize="11">요청을 처리한다</text>
      {/* Arrow ↓ to End */}
      <line x1="80" y1="308" x2="80" y2="343" stroke="#334155" strokeWidth="1.5" markerEnd="url(#ga)" />
      {/* Arrow → 아니오 */}
      <line x1="116" y1="214" x2="158" y2="214" stroke="#334155" strokeWidth="1.5" markerEnd="url(#ga)" />
      <text x="136" y="208" textAnchor="middle" fill="#64748b" fontSize="9">아니오</text>
      {/* Process No */}
      <rect x="160" y="194" width="82" height="38" rx="7" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x="201" y="217" textAnchor="middle" fill="#93c5fd" fontSize="10">보완을 요청한다</text>
      {/* Process No → End (path right→down→left) */}
      <path d="M 201 234 L 201 360 L 99 360" stroke="#334155" strokeWidth="1.5" fill="none" markerEnd="url(#ga)" />
      {/* End circle */}
      <circle cx="80" cy="360" r="18" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x="80" y="364" textAnchor="middle" fill="#f87171" fontSize="10" fontWeight="600">종료</text>
    </svg>
  );
}

function CanvasGuide({ rfInstance }: { rfInstance: ReturnType<typeof useReactFlow> }) {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const addShape = useStore(s => s.addShape);
  const onConnect = useStore(s => s.onConnect);
  const updateEdgeLabel = useStore(s => s.updateEdgeLabel);

  const workNodes = nodes.filter(n => !['start', 'end'].includes(n.data.nodeType));

  const handleQuickStart = () => {
    // Reuse existing start node — do NOT create a new one
    const existingStart = useStore.getState().nodes.find(n => n.data.nodeType === 'start');
    const sId = existingStart?.id ?? 'start';
    const cx = 190; // process node x (width 220 → center at 300)

    // Vertical layout, centered at x≈300
    const p1   = addShape('process',  '요청을 접수한다',  { x: cx,       y: 180 });
    const p2   = addShape('process',  '내용을 검토한다',  { x: cx,       y: 330 });
    const d1   = addShape('decision', '승인 여부 판단',   { x: cx + 30,  y: 480 }); // decision 160px wide → center 300
    const pYes = addShape('process',  '요청을 처리한다',  { x: cx,       y: 690 });
    const pNo  = addShape('process',  '보완을 요청한다',  { x: cx + 280, y: 530 });
    const eId  = addShape('end',      '종료',             { x: cx + 80,  y: 870 }); // end 60px wide → center 300

    // 중복 방지 연결 헬퍼 — 동일 source→target 이미 존재하면 스킵
    const safeConnect = (src: string, tgt: string, sh: string, th: string) => {
      const exists = useStore.getState().edges.some(e => e.source === src && e.target === tgt);
      if (!exists) onConnect({ source: src, target: tgt, sourceHandle: sh, targetHandle: th });
    };

    setTimeout(() => {
      safeConnect(sId,  p1,   'bottom-source', 'top-target');
      safeConnect(p1,   p2,   'bottom-source', 'top-target');
      safeConnect(p2,   d1,   'bottom-source', 'top-target');
      safeConnect(d1,   pYes, 'bottom-source', 'top-target');
      safeConnect(d1,   pNo,  'right-source',  'left-target');
      safeConnect(pYes, eId,  'bottom-source', 'top-target');
      safeConnect(pNo,  eId,  'bottom-source', 'top-target');

      // Attach 예/아니오 labels to decision branches
      setTimeout(() => {
        const curEdges = useStore.getState().edges;
        const yesEdge = curEdges.find(e => e.source === d1 && e.target === pYes);
        const noEdge  = curEdges.find(e => e.source === d1 && e.target === pNo);
        if (yesEdge) updateEdgeLabel(yesEdge.id, '예');
        if (noEdge)  updateEdgeLabel(noEdge.id,  '아니오');
        rfInstance.fitView({ padding: 0.2, duration: 500 });
      }, 120);
    }, 80);
  };

  // Phase 0: only start node exists → show ghost + CTA at bottom (avoids overlapping the start node)
  if (workNodes.length === 0) {
    return (
      <div className="absolute bottom-32 inset-x-0 flex items-end justify-center gap-10 pointer-events-none z-0 select-none">
        {/* Ghost SVG */}
        <div style={{ opacity: 0.22 }}>
          <div className="text-[10px] text-slate-600 mb-1.5 font-medium tracking-wide">예시 플로우</div>
          <GhostFlow />
        </div>
        {/* CTA card */}
        <div className="flex flex-col items-start gap-2 pb-6" style={{ maxWidth: 240 }}>
          <p className="text-sm text-slate-400 leading-relaxed">
            시작 노드 아래에 셰이프를 연결하거나<br />빠른 시작으로 예시 플로우를 만들어보세요<br />
            <span className="text-slate-500 text-xs">셰이프 하나 = 한 동작</span>
          </p>
          <button
            onClick={handleQuickStart}
            className="pointer-events-auto mt-1 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', boxShadow: '0 4px 20px rgba(79,70,229,0.35)' }}
          >
            ⚡ 빠른 시작
          </button>
          {/* 단축키 힌트 테이블 */}
          <div className="mt-2 rounded-lg overflow-hidden" style={{ border: '1px solid #1e293b', background: 'rgba(15,23,41,0.7)' }}>
            {[
              ['우클릭', '셰이프 추가'],
              ['파란 점 드래그', '연결'],
              ['더블클릭', '이름 수정'],
              ['Ctrl+Z', '되돌리기'],
              ['Delete', '삭제'],
            ].map(([key, desc]) => (
              <div key={key} className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 border-b border-slate-800/60 last:border-0">
                <kbd style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4, padding: '1px 5px', fontSize: 10, color: '#94a3b8', fontFamily: 'inherit', lineHeight: 1.6 }}>{key}</kbd>
                <span className="text-[11px] text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Phase 1: nodes exist but not connected yet
  if (workNodes.length >= 1 && edges.length === 0) {
    return (
      <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-10 animate-pulse">
        <div className="bg-indigo-600/15 border border-indigo-500/40 text-indigo-200 px-5 py-2 rounded-full text-sm font-medium shadow-lg">
          🔗 파란 핸들을 드래그해서 노드를 연결하세요
        </div>
      </div>
    );
  }

  return null;
}

function FlowCanvas() {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const onNodesChange = useStore(s => s.onNodesChange);
  const onEdgesChange = useStore(s => s.onEdgesChange);
  const onConnect = useStore(s => s.onConnect);
  const showCM = useStore(s => s.showContextMenu);
  const hideCM = useStore(s => s.hideContextMenu);
  const updateEdgeLabel = useStore(s => s.updateEdgeLabel);
  const setSel = useStore(s => s.setSelectedNodeId);
  const setSelEdge = useStore(s => s.setSelectedEdgeId);
  const selectedEdgeId = useStore(s => s.selectedEdgeId);
  const undo = useStore(s => s.undo);
  const redo = useStore(s => s.redo);
  const saveDraft = useStore(s => s.saveDraft);
  const copySelected = useStore(s => s.copySelected);
  const pasteClipboard = useStore(s => s.pasteClipboard);
  const deleteSelected = useStore(s => s.deleteSelected);
  const autoValidate = useStore(s => s.autoValidateDebounced);
  const metaEditTarget = useStore(s => s.metaEditTarget);
  const closeMetaEdit = useStore(s => s.closeMetaEdit);
  const updateNodeMeta = useStore(s => s.updateNodeMeta);
  const showGuide = useStore(s => s.showGuide);
  const toggleGuide = useStore(s => s.toggleGuide);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfInstance = useReactFlow();

  const focusNodeId = useStore(s => s.focusNodeId);
  const setFocusNodeId = useStore(s => s.setFocusNodeId);
  useEffect(() => { const t = setTimeout(() => autoValidate(), 3000); return () => clearTimeout(t); }, [nodes, autoValidate]);

  useEffect(() => {
    if (focusNodeId) {
      rfInstance.fitView({ nodes: [{ id: focusNodeId as string }], duration: 300, padding: 0.5 });
      setSel(focusNodeId);
      setFocusNodeId(null);
    }
  }, [focusNodeId, rfInstance, setSel, setFocusNodeId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (e.target as HTMLElement).isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveDraft(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !inInput) { e.preventDefault(); copySelected(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !inInput) { e.preventDefault(); pasteClipboard(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput) { e.preventDefault(); deleteSelected(); }
      if (e.key === 'F1' || (e.key === '/' && !e.ctrlKey && !e.metaKey && !inInput)) { e.preventDefault(); toggleGuide(); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [undo, redo, saveDraft, copySelected, pasteClipboard, deleteSelected, toggleGuide]);

  useEffect(() => { const t = setTimeout(saveDraft, 30000); return () => clearTimeout(t); }, [nodes, edges, saveDraft]);
  const memoEdgeTypes = useMemo(() => edgeTypes, []);

  // Auto-spread: assign sibling indices so edges from the same handle fan out
  // 판단 노드(decision)에서 출발하는 엣지는 isFromDecision=true → 점선 처리
  const edgesWithSpread = useMemo(() => {
    const decisionNodeIds = new Set(nodes.filter(n => n.data?.nodeType === 'decision').map(n => n.id));
    const srcGroups: Record<string, string[]> = {};
    const tgtGroups: Record<string, string[]> = {};
    edges.forEach(e => {
      if (e.type === 'selfloop') return;
      const sk = `${e.source}::${e.sourceHandle ?? ''}`;
      const tk = `${e.target}::${e.targetHandle ?? ''}`;
      if (!srcGroups[sk]) srcGroups[sk] = [];
      if (!tgtGroups[tk]) tgtGroups[tk] = [];
      srcGroups[sk].push(e.id);
      tgtGroups[tk].push(e.id);
    });
    return edges.map(e => {
      const isSelfLoop = e.type === 'selfloop';
      const isSelected = e.id === selectedEdgeId;
      const isDecision = decisionNodeIds.has(e.source);
      const edgeStyle = isSelected
        ? { ...e.style, stroke: '#3b82f6', strokeWidth: 3, filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))' }
        : { ...e.style, stroke: undefined, strokeWidth: undefined, filter: undefined };
      if (isSelfLoop) return { ...e, type: 'selfloop', style: edgeStyle };
      const sk = `${e.source}::${e.sourceHandle ?? ''}`;
      const tk = `${e.target}::${e.targetHandle ?? ''}`;
      const sg = srcGroups[sk] ?? [e.id];
      const tg = tgtGroups[tk] ?? [e.id];
      return {
        ...e,
        type: 'spread',
        style: edgeStyle,
        data: {
          ...e.data,
          sourceSiblingIndex: sg.indexOf(e.id),
          sourceSiblingCount: sg.length,
          targetSiblingIndex: tg.indexOf(e.id),
          targetSiblingCount: tg.length,
          isFromDecision: isDecision,
        },
      };
    });
  }, [edges, selectedEdgeId, nodes]);

  // v5.1: minimap node color with 2-lane swim lane awareness
  const minimapNodeColor = useCallback((n: any) => {
    const { dividerYs, swimLaneLabels } = useStore.getState();
    if (dividerYs.length > 0 && n.data?.swimLaneId) {
      if (n.data.swimLaneId === swimLaneLabels[0]) return SWIMLANE_COLORS[0].text;
      if (n.data.swimLaneId === swimLaneLabels[1]) return SWIMLANE_COLORS[1].text;
    }
    return ({
      start: '#22c55e',
      end: '#ef4444',
      decision: '#f59e0b',
      subprocess: '#2dd4bf'
    }[n.data?.nodeType as string] || '#3b82f6');
  }, []);

  return (
    <div ref={wrapperRef} data-tour="canvas" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Toolbar />
      <ReactFlow
        nodes={nodes} edges={edgesWithSpread}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        nodeTypes={nodeTypes} edgeTypes={memoEdgeTypes}
        multiSelectionKeyCode="Shift"
        connectionRadius={30}
        onPaneClick={() => { hideCM(); setSel(null); setSelEdge(null); }}
        onNodeClick={(_e, n) => { setSel(n.id); setSelEdge(null); }}
        onEdgeClick={(_e, edge) => { setSelEdge(edge.id); setSel(null); }}
        onEdgeDoubleClick={(_e, edge) => { const l = prompt('엣지 라벨:', (edge.label as string) || ''); if (l !== null) updateEdgeLabel(edge.id, l); }}
        onNodeContextMenu={(e, n) => { e.preventDefault(); showCM({ show: true, x: e.clientX, y: e.clientY, nodeId: n.id }); }}
        onEdgeContextMenu={(e, edge) => { e.preventDefault(); showCM({ show: true, x: e.clientX, y: e.clientY, edgeId: edge.id }); }}
        onPaneContextMenu={e => {
          e.preventDefault();
          const flowPos = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
          showCM({ show: true, x: e.clientX, y: e.clientY, flowX: flowPos.x, flowY: flowPos.y });
        }}
        fitView fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2} maxZoom={2} snapToGrid snapGrid={[10, 10]}
        connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
      >
        <SwimLaneOverlay wrapperRef={wrapperRef} />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
        <Controls position="bottom-right" />
        <MiniMap position="bottom-left" nodeColor={minimapNodeColor} maskColor="rgba(15,23,41,0.8)" style={{ border: '1px solid #2a3a52', borderRadius: 8 }} />
      </ReactFlow>
      <ContextMenu />
      <NodeDetailPanel />
      <CanvasGuide rfInstance={rfInstance} />
      {metaEditTarget && <MetaEditModal nodeId={metaEditTarget.nodeId} initial={{ inputLabel: metaEditTarget.inputLabel, outputLabel: metaEditTarget.outputLabel, systemName: metaEditTarget.systemName, duration: metaEditTarget.duration }} onSave={(id, meta) => updateNodeMeta(id, meta)} onClose={closeMetaEdit} />}
      {showGuide && <HelpGuide onClose={toggleGuide} />}
      <TourOverlay />
    </div>
  );
}

export default function FlowChart() { return <ReactFlowProvider><FlowCanvas /></ReactFlowProvider>; }
