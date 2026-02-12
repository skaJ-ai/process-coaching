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
import { SWIMLANE_COLORS, SWIMLANE_HEADER_WIDTH } from '../constants';

function SwimLaneOverlay() {
  const lanes = useStore(s => s.swimLanes);
  const boundaries = useStore(s => s.laneBoundaries);
  const setLaneBoundaries = useStore(s => s.setLaneBoundaries);
  const updateLaneLabel = useStore(s => s.updateSwimLaneLabel);
  const { x, y, zoom } = useViewport();
  if (lanes.length === 0) return null;

  const regions: { lane: typeof lanes[0]; screenTop: number; screenBottom: number; color: typeof SWIMLANE_COLORS[0] }[] = [];
  for (let i = 0; i < lanes.length; i++) {
    const topY = i === 0 ? -10000 : boundaries[i - 1];
    const botY = i < boundaries.length ? boundaries[i] : 10000;
    regions.push({ lane: lanes[i], screenTop: topY * zoom + y, screenBottom: botY * zoom + y, color: SWIMLANE_COLORS[i % SWIMLANE_COLORS.length] });
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {regions.map((r) => {
        const clampTop = Math.max(0, r.screenTop), clampBot = Math.min(window.innerHeight, r.screenBottom);
        const height = clampBot - clampTop;
        if (height <= 0) return null;
        return (
          <div key={r.lane.id}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: clampTop, height, background: r.color.bg }} />
            <div style={{ position: 'absolute', left: 0, top: clampTop, width: SWIMLANE_HEADER_WIDTH, height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,41,0.9)', borderRight: `2px solid ${r.color.border}`, pointerEvents: 'auto', zIndex: 1 }}>
              <div contentEditable suppressContentEditableWarning
                onBlur={(e) => updateLaneLabel(r.lane.id, e.currentTarget.textContent || r.lane.label)}
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', color: r.color.label, fontSize: Math.max(11, 13 * zoom), fontWeight: 600, outline: 'none', cursor: 'text', padding: '4px 2px', maxHeight: height - 16, overflow: 'hidden' }}>
                {r.lane.label}
              </div>
            </div>
          </div>
        );
      })}
      {boundaries.map((bY, i) => {
        const screenY = bY * zoom + y;
        return (
          <div key={`boundary-${i}`} style={{ position: 'absolute', left: SWIMLANE_HEADER_WIDTH, right: 0, top: screenY - 3, height: 6, cursor: 'row-resize', pointerEvents: 'auto', borderTop: `2px dashed ${SWIMLANE_COLORS[(i + 1) % SWIMLANE_COLORS.length].border}`, background: 'rgba(100,116,139,0.15)' }}
            onMouseDown={(e) => {
              e.preventDefault();
              const move = (ev: MouseEvent) => {
                const newB = [...boundaries]; newB[i] = (ev.clientY - y) / zoom;
                if (i > 0 && newB[i] < newB[i - 1] + 100) newB[i] = newB[i - 1] + 100;
                if (i < newB.length - 1 && newB[i] > newB[i + 1] - 100) newB[i] = newB[i + 1] - 100;
                setLaneBoundaries(newB);
              };
              const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
              document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
            }} />
        );
      })}
    </div>
  );
}

function EmptyStateGuide() {
  const nodes = useStore(s => s.nodes);
  const count = nodes.length;
  if (count === 0) {
    return (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 opacity-60">
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
  if (count > 0 && count < 3) {
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
  const swimLanes = useStore(s => s.swimLanes);
  const wrapper = useRef<HTMLDivElement>(null);
  const rfInstance = useReactFlow();

  const focusNodeId = useStore(s => s.focusNodeId);
  const setFocusNodeId = useStore(s => s.setFocusNodeId);
  useEffect(() => { const t = setTimeout(() => rfInstance.fitView({ padding: 0.3, duration: 200 }), 100); return () => clearTimeout(t); }, [nodes.length]);
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

  // v5: minimap node color with swim lane awareness
  const minimapNodeColor = useCallback((n: any) => {
    if (swimLanes.length > 0 && n.data?.swimLaneId) {
      const idx = swimLanes.findIndex(l => l.id === n.data.swimLaneId);
      if (idx >= 0) return SWIMLANE_COLORS[idx % SWIMLANE_COLORS.length].text;
    }
    return ({ start: '#22c55e', end: '#ef4444', decision: '#f59e0b', subprocess: '#2dd4bf' }[n.data?.nodeType as string] || '#3b82f6');
  }, [swimLanes]);

  return (
    <div ref={wrapper} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Toolbar />
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        nodeTypes={nodeTypes} edgeTypes={memoEdgeTypes}
        multiSelectionKeyCode="Shift"
        connectionRadius={30}
        onPaneClick={() => { hideCM(); setSel(null); }}
        onNodeClick={(_e, n) => setSel(n.id)}
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
