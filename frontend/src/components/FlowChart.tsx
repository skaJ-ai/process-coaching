import React, { useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider, useReactFlow, useViewport, BackgroundVariant } from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store';
import { nodeTypes, edgeTypes } from './CustomNodes';
import Toolbar from './Toolbar';
import ContextMenu from './ContextMenu';
import NodeDetailPanel from './NodeDetailPanel';
import MetaEditModal from './MetaEditModal';
import HelpGuide from './HelpGuide';
import { SWIMLANE_COLORS } from '../constants';

function SwimLaneOverlay() {
  const dividerYs = useStore(s => s.dividerYs);
  const swimLaneLabels = useStore(s => s.swimLaneLabels);
  const setDividerYs = useStore(s => s.setDividerYs);
  const setSwimLaneLabels = useStore(s => s.setSwimLaneLabels);
  const addDividerY = useStore(s => s.addDividerY);
  const removeDividerY = useStore(s => s.removeDividerY);
  const rfInstance = useReactFlow();
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [tempLabel, setTempLabel] = React.useState('');

  if (dividerYs.length === 0) return null;

  const handleDividerDrag = (index: number, initialY: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startFlowY = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY }).y;

    const move = (ev: MouseEvent) => {
      const currentFlowY = rfInstance.screenToFlowPosition({ x: ev.clientX, y: ev.clientY }).y;
      const delta = currentFlowY - startFlowY;
      const newY = Math.max(100, Math.min(initialY + delta, 2000));
      const newYs = [...dividerYs];
      newYs[index] = newY;
      setDividerYs(newYs);
    };

    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const handleLabelChange = (index: number, newLabel: string) => {
    const newLabels = [...swimLaneLabels];
    newLabels[index] = newLabel;
    setSwimLaneLabels(newLabels);
  };

  const laneCount = dividerYs.length + 1;
  const sortedDividerYs = [...dividerYs].sort((a, b) => a - b);

  return (
    <>
      {sortedDividerYs.map((divY, idx) => (
        <React.Fragment key={`divider-${idx}`}>
          {/* Divider line */}
          <div style={{ position: 'absolute', left: -10000, width: 20000, top: divY - 1.5, height: 3, borderTop: '3px dashed #94a3b8', pointerEvents: 'none', zIndex: 5, opacity: 0.6 }} />

          {/* Drag handle */}
          <div style={{ position: 'absolute', right: 20, top: divY - 30, width: 40, height: 60, background: 'rgba(148, 163, 184, 0.15)', border: '2px solid #94a3b8', borderRadius: '8px', cursor: 'row-resize', pointerEvents: 'auto', zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseDown={handleDividerDrag(idx, divY)} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.3)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)'; }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 'bold' }}>⋮⋮</span>
          </div>

          {/* Remove button */}
          {dividerYs.length > 1 && <button onClick={() => removeDividerY(dividerYs.indexOf(divY))} style={{ position: 'absolute', right: 70, top: divY - 25, width: 24, height: 24, borderRadius: '4px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5', cursor: 'pointer', fontSize: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6 }}>×</button>}
        </React.Fragment>
      ))}

      {/* Labels for each lane */}
      {Array.from({ length: laneCount }).map((_, laneIdx) => {
        const prevY = laneIdx === 0 ? -Infinity : sortedDividerYs[laneIdx - 1];
        const nextY = laneIdx === dividerYs.length ? Infinity : sortedDividerYs[laneIdx];
        const midY = prevY === -Infinity ? nextY - 80 : nextY === Infinity ? prevY + 60 : (prevY + nextY) / 2;

        return (
          <div key={`label-${laneIdx}`} style={{ position: 'absolute', left: 20, top: midY - 10, fontSize: 13, fontWeight: 600, color: '#94a3b8', background: 'rgba(15,23,41,0.85)', padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.2)', pointerEvents: 'auto', zIndex: 6, cursor: editingIdx === laneIdx ? 'text' : 'pointer' }} onClick={() => { setEditingIdx(laneIdx); setTempLabel(swimLaneLabels[laneIdx]); }}>
            {editingIdx === laneIdx ? (
              <input autoFocus type="text" value={tempLabel} onChange={(e) => setTempLabel(e.target.value)} onBlur={() => { handleLabelChange(laneIdx, tempLabel); setEditingIdx(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { handleLabelChange(laneIdx, tempLabel); setEditingIdx(null); } if (e.key === 'Escape') setEditingIdx(null); }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 600, outline: 'none', width: '80px', fontFamily: 'inherit' }} />
            ) : (
              swimLaneLabels[laneIdx]
            )}
          </div>
        );
      })}

      {/* Add divider button */}
      {dividerYs.length < 3 && (
        <button onClick={() => addDividerY(sortedDividerYs[sortedDividerYs.length - 1] + 200)} style={{ position: 'absolute', right: 20, bottom: 20, width: 36, height: 36, borderRadius: '6px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.5)', color: '#93c5fd', cursor: 'pointer', fontSize: 18, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6 }}>+</button>
      )}
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
  const wrapper = useRef<HTMLDivElement>(null);
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

  // v5.1: minimap node color with 2-lane swim lane awareness
  const minimapNodeColor = useCallback((n: any) => {
    const { dividerY, topLabel, bottomLabel } = useStore.getState();
    if (dividerY > 0 && n.data?.swimLaneId) {
      if (n.data.swimLaneId === topLabel) return SWIMLANE_COLORS[0].text;
      if (n.data.swimLaneId === bottomLabel) return SWIMLANE_COLORS[1].text;
    }
    return ({
      start: '#22c55e',
      end: '#ef4444',
      decision: '#f59e0b',
      subprocess: '#2dd4bf'
    }[n.data?.nodeType as string] || '#3b82f6');
  }, []);

  return (
    <div ref={wrapper} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Toolbar />
      <ReactFlow
        nodes={nodes} edges={edges.map(e => e.id === selectedEdgeId ? { ...e, style: { ...e.style, stroke: '#3b82f6', strokeWidth: 3, filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))' } } : { ...e, style: { ...e.style, stroke: undefined, strokeWidth: undefined, filter: undefined } })}
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
        defaultEdgeOptions={{ type: 'step' }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2} maxZoom={2} snapToGrid snapGrid={[10, 10]}
        connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
      >
        <SwimLaneOverlay />
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
