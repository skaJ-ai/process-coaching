import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, { Background, ConnectionMode, Controls, Edge, MiniMap, ReactFlowProvider, useReactFlow, useViewport, useStore as useRFStore, BackgroundVariant } from 'reactflow';
import { createPortal } from 'react-dom';
import 'reactflow/dist/style.css';
import { useStore } from '../store';
import { nodeTypes, edgeTypes } from './CustomNodes';
import Toolbar from './Toolbar';
import ContextMenu from './ContextMenu';
import NodeDetailPanel from './NodeDetailPanel';
import MetaEditModal from './MetaEditModal';
import HelpGuide from './HelpGuide';
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

function EmptyStateGuide() {
  const nodes = useStore(s => s.nodes);
  const count = nodes.length;
  if (count <= 1) {
    return (
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-none z-0 opacity-60">
        <div className="border-2 border-dashed border-slate-600 rounded-3xl p-12 text-center space-y-4">
          <div className="text-4xl">🖱️</div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-300">빈 캔버스</h3>
            <p className="text-slate-400">우클릭하여 첫 번째 셰이프를 추가하세요</p>
          </div>
          <div className="inline-block bg-slate-800/50 px-4 py-2 rounded-lg text-sm text-slate-400 border border-slate-700/50">
            💡 <b>시작</b> → <b>업무단계</b> → <b>종료</b> 순서로<br />만들어 보세요
          </div>
        </div>
      </div>
    );
  }
  if (count === 2) {
    return (
      <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-10 animate-pulse">
        <div className="bg-blue-600/20 border border-blue-500/50 text-blue-200 px-6 py-2 rounded-full text-sm font-medium shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          🔗 셰이프를 연결하려면 파란 점을 드래그하세요
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
  const displayEdges = useMemo(() => {
    const sourceGroups = new Map<string, Edge[]>();
    for (const edge of edges) {
      if (edge.source === edge.target) continue;
      const key = `${edge.source}:${edge.sourceHandle || 'default'}`;
      const group = sourceGroups.get(key);
      if (group) group.push(edge);
      else sourceGroups.set(key, [edge]);
    }

    const bySourceEdgeId = new Map<string, { index: number; total: number }>();
    for (const group of sourceGroups.values()) {
      const sorted = [...group].sort((a, b) => a.target.localeCompare(b.target));
      sorted.forEach((edge, idx) => bySourceEdgeId.set(edge.id, { index: idx, total: sorted.length }));
    }

    return edges.map((edge) => {
      const groupInfo = bySourceEdgeId.get(edge.id);
      const level = groupInfo ? groupInfo.index % 3 : 0;
      const isSelected = edge.id === selectedEdgeId;
      const baseStyle = edge.style || {};

      const enhanced = groupInfo && groupInfo.total > 1
        ? {
            ...edge,
            type: edge.type === 'selfLoop' ? edge.type : 'smartStep',
            data: {
              ...edge.data,
              laneOffset: groupInfo.index * 12,
            },
            style: {
              ...baseStyle,
              strokeWidth: isSelected ? 3 : 2 + level * 0.35,
              strokeDasharray: level === 0 ? undefined : level === 1 ? '7 4' : '3 3',
              opacity: isSelected ? 1 : 0.94,
            },
            zIndex: isSelected ? 20 : 10 + level,
          }
        : {
            ...edge,
            type: edge.type === 'selfLoop' ? edge.type : 'smartStep',
            data: {
              ...edge.data,
              laneOffset: 0,
            },
            style: {
              ...baseStyle,
              strokeWidth: isSelected ? 3 : baseStyle.strokeWidth,
            },
            zIndex: isSelected ? 20 : edge.zIndex,
          };

      if (isSelected) {
        return {
          ...enhanced,
          style: {
            ...enhanced.style,
            stroke: '#3b82f6',
            filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))',
          },
        };
      }

      return {
        ...enhanced,
        style: {
          ...enhanced.style,
          filter: undefined,
        },
      };
    });
  }, [edges, selectedEdgeId]);

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
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Toolbar />
      <ReactFlow
        nodes={nodes} edges={displayEdges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        nodeTypes={nodeTypes} edgeTypes={memoEdgeTypes}
        connectionMode={ConnectionMode.Loose}
        multiSelectionKeyCode="Shift"
        connectionRadius={42}
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
        defaultEdgeOptions={{ type: 'smartStep' }}
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
      <EmptyStateGuide />
      {metaEditTarget && <MetaEditModal nodeId={metaEditTarget.nodeId} initial={{ inputLabel: metaEditTarget.inputLabel, outputLabel: metaEditTarget.outputLabel, systemName: metaEditTarget.systemName, duration: metaEditTarget.duration }} onSave={(id, meta) => updateNodeMeta(id, meta)} onClose={closeMetaEdit} />}
      {showGuide && <HelpGuide onClose={toggleGuide} />}
    </div>
  );
}

export default function FlowChart() { return <ReactFlowProvider><FlowCanvas /></ReactFlowProvider>; }
