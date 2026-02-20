import React, { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, EdgeProps, getSmoothStepPath } from 'reactflow';
import { FlowNodeData, L7Status } from '../types';
import { CATEGORY_COLORS } from '../constants';
import { useStore } from '../store';

const statusMap: Record<L7Status, { color: string; badge: string }> = {
  none: { color: '', badge: '' }, checking: { color: '#a855f7', badge: '⟳' },
  pass: { color: '#22c55e', badge: '✓' }, warning: { color: '#f59e0b', badge: '💡' }, reject: { color: '#f97316', badge: '✏' },
};

const AllHandles = ({ color = '#60a5fa' }: { color?: string }) => (<>
  <Handle type="target" position={Position.Top} id="top-target" style={{ top: -7, left: '50%', width: 14, height: 14, background: color, border: '2px solid #0f1729', borderRadius: '50%', zIndex: 10 }} />
  <Handle type="source" position={Position.Top} id="top-source" style={{ top: -7, left: '50%', width: 14, height: 14, background: 'transparent', border: 'none', zIndex: 11 }} />
  <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ bottom: -7, left: '50%', width: 14, height: 14, background: color, border: '2px solid #0f1729', borderRadius: '50%', zIndex: 10 }} />
  <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ bottom: -7, left: '50%', width: 14, height: 14, background: 'transparent', border: 'none', zIndex: 11 }} />
  <Handle type="target" position={Position.Left} id="left-target" style={{ left: -7, top: '50%', width: 14, height: 14, background: color, border: '2px solid #0f1729', borderRadius: '50%', zIndex: 10 }} />
  <Handle type="source" position={Position.Left} id="left-source" style={{ left: -7, top: '50%', width: 14, height: 14, background: 'transparent', border: 'none', zIndex: 11 }} />
  <Handle type="target" position={Position.Right} id="right-target" style={{ right: -7, top: '50%', width: 14, height: 14, background: color, border: '2px solid #0f1729', borderRadius: '50%', zIndex: 10 }} />
  <Handle type="source" position={Position.Right} id="right-source" style={{ right: -7, top: '50%', width: 14, height: 14, background: 'transparent', border: 'none', zIndex: 11 }} />
</>);

function useInlineEdit(nodeId: string, currentLabel: string, autoPending?: boolean) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(currentLabel);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const updateLabel = useStore(s => s.updateNodeLabel);
  const pendingEditNodeId = useStore(s => s.pendingEditNodeId);
  const clearPendingEdit = useStore(s => s.clearPendingEdit);
  useEffect(() => { setEditText(currentLabel); }, [currentLabel]);
  useEffect(() => { if (editing && textRef.current) { textRef.current.focus(); textRef.current.select(); } }, [editing]);
  useEffect(() => { if (autoPending && pendingEditNodeId === nodeId) { setEditing(true); setEditText(currentLabel); clearPendingEdit(); } }, [pendingEditNodeId, nodeId, autoPending, clearPendingEdit, currentLabel]);
  const startEdit = (e: React.MouseEvent) => { e.stopPropagation(); setEditing(true); setEditText(currentLabel); };
  const commitEdit = () => { setEditing(false); if (editText.trim() && editText !== currentLabel) updateLabel(nodeId, editText.trim()); else setEditText(currentLabel); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') { setEditing(false); setEditText(currentLabel); } };
  return { editing, editText, setEditText, textRef, startEdit, commitEdit, handleKeyDown };
}

const CircleHandle = ({ pos, id, color, size = 14, isConnectableStart, isConnectableEnd }: { pos: Position; id: string; color: string; size?: number; isConnectableStart?: boolean; isConnectableEnd?: boolean }) => {
  const styles: Record<string, any> = { width: size, height: size, background: color, border: '2px solid #0f1729', borderRadius: '50%' };
  if (pos === Position.Top) Object.assign(styles, { top: -5 });
  if (pos === Position.Bottom) Object.assign(styles, { bottom: -5 });
  if (pos === Position.Left) Object.assign(styles, { left: -5 });
  if (pos === Position.Right) Object.assign(styles, { right: -5 });
  return <Handle type="source" position={pos} id={id} style={styles} isConnectableStart={isConnectableStart} isConnectableEnd={isConnectableEnd} />;
};

export const StartNode = memo(({ id, data }: NodeProps<FlowNodeData>) => {
  const ie = useInlineEdit(id, data.label);
  return (<div className="relative flex items-center justify-center w-[60px] h-[60px] rounded-full" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 0 20px rgba(34,197,94,0.3)' }} onDoubleClick={ie.startEdit}>
    {ie.editing ? <textarea id={`start-label-${id}`} name={`start_label_${id}`} aria-label="시작 노드 라벨 편집" ref={ie.textRef} value={ie.editText} onChange={e => ie.setEditText(e.target.value)} onBlur={ie.commitEdit} onKeyDown={ie.handleKeyDown} className="w-[56px] bg-transparent text-white text-[10px] font-semibold text-center leading-tight outline-none resize-none" rows={2} />
      : <span className="text-white text-[10px] font-semibold text-center leading-tight px-1" style={{ wordBreak: 'break-all' }}>{data.label}</span>}
    {[Position.Bottom, Position.Right, Position.Left, Position.Top].map(p => <Handle key={p} type="source" position={p} id={p.toLowerCase() + '-source'} style={{ [p === Position.Top ? 'top' : p === Position.Bottom ? 'bottom' : p === Position.Left ? 'left' : 'right']: -5, width: 14, height: 14, background: '#4ade80', border: '2px solid #0f1729', borderRadius: '50%', opacity: 0.5 }} />)}
  </div>);
});
StartNode.displayName = 'StartNode';

export const EndNode = memo(({ id, data }: NodeProps<FlowNodeData>) => {
  const ie = useInlineEdit(id, data.label);
  return (<div className="relative flex items-center justify-center w-[60px] h-[60px] rounded-full" style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 0 20px rgba(239,68,68,0.3)' }} onDoubleClick={ie.startEdit}>
    {ie.editing ? <textarea id={`end-label-${id}`} name={`end_label_${id}`} aria-label="종료 노드 라벨 편집" ref={ie.textRef} value={ie.editText} onChange={e => ie.setEditText(e.target.value)} onBlur={ie.commitEdit} onKeyDown={ie.handleKeyDown} className="w-[56px] bg-transparent text-white text-[10px] font-semibold text-center leading-tight outline-none resize-none" rows={2} />
      : <span className="text-white text-[10px] font-semibold text-center leading-tight px-1" style={{ wordBreak: 'break-all' }}>{data.label}</span>}
    {[Position.Top, Position.Bottom, Position.Left, Position.Right].map(p => <Handle key={p} type="target" position={p} id={p.toLowerCase() + '-target'} style={{ [p === Position.Top ? 'top' : p === Position.Bottom ? 'bottom' : p === Position.Left ? 'left' : 'right']: -5, width: 14, height: 14, background: '#f87171', border: '2px solid #0f1729', borderRadius: '50%' }} />)}
  </div>);
});
EndNode.displayName = 'EndNode';

export const ProcessNode = memo(({ id, data, selected }: NodeProps<FlowNodeData>) => {
  const cat = CATEGORY_COLORS[data.category || 'as_is']; const status = statusMap[data.l7Status || 'none']; const sc = status.color; const badge = status.badge;
  const borderColor = selected ? '#3b82f6' : (sc || cat.border);
  const shadow = selected ? '0 0 0 3px rgba(59,130,246,0.4),0 0 20px rgba(59,130,246,0.2)' : sc ? `0 0 16px ${sc}33` : '0 4px 16px rgba(0,0,0,0.3)';
  const ie = useInlineEdit(id, data.label, true);
  return (<div className="relative flex flex-col rounded-lg transition-all" style={{ minWidth: 220, maxWidth: 320, minHeight: 60, background: cat.gradient, border: `2px solid ${borderColor}`, boxShadow: shadow }}>
    <AllHandles color={selected ? '#3b82f6' : '#60a5fa'} />
    {data.inputLabel && <div className="absolute -top-5 left-2 text-[9px] text-cyan-400 bg-cyan-900/30 px-1.5 py-0.5 rounded border border-cyan-800/40">IN: {data.inputLabel}</div>}
    {data.category && data.category !== 'as_is' && <div className="absolute -top-5 right-2 text-[9px] px-1.5 py-0.5 rounded-sm z-20" style={{ background: cat.border + '22', color: cat.border, border: `1px solid ${cat.border}44`, fontWeight: 600 }}>{cat.label}</div>}
    <div className="flex items-center px-4 py-3" onDoubleClick={ie.startEdit}>
      {ie.editing ? <textarea id={`process-label-${id}`} name={`process_label_${id}`} aria-label="프로세스 노드 라벨 편집" ref={ie.textRef} value={ie.editText} onChange={e => ie.setEditText(e.target.value)} onBlur={ie.commitEdit} onKeyDown={ie.handleKeyDown} className="flex-1 bg-transparent text-slate-200 text-sm font-medium leading-snug outline-none resize-none border-b border-blue-500/50" style={{ minHeight: '20px' }} rows={Math.max(1, Math.ceil(ie.editText.length / 25))} />
        : <span className="text-slate-200 text-sm font-medium leading-snug flex-1" style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}>{data.label}</span>}
      {data.systemName && <span className="text-[9px] text-purple-300 bg-purple-900/30 px-1 py-0.5 rounded ml-1 flex-shrink-0">{data.systemName}</span>}
      {sc && badge && <div className="flex-shrink-0 ml-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: `${sc}22`, border: `1.5px solid ${sc}`, color: sc }}>{badge}</div>}
    </div>
    {data.outputLabel && <div className="absolute -bottom-5 right-2 text-[9px] text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-800/40">OUT: {data.outputLabel}</div>}
    {data.duration && <div className="absolute -bottom-5 left-2 text-[9px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded border border-green-800/40">⏱ {data.duration}</div>}

  </div>);
});
ProcessNode.displayName = 'ProcessNode';

export const DecisionNode = memo(({ id, data, selected }: NodeProps<FlowNodeData>) => {
  const cat = CATEGORY_COLORS[data.category || 'as_is'];
  const defaultBg = selected ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#92400e,#78350f)';
  const bg = (data.category && data.category !== 'as_is') ? cat.gradient : defaultBg;
  const ie = useInlineEdit(id, data.label, true);
  const status = statusMap[data.l7Status || 'none']; const sc = status.color; const badge = status.badge;
  return (<div className="relative" style={{ width: 160, height: 160 }}>
    <AllHandles color={selected ? '#fbbf24' : '#f59e0b'} />
    {data.category && data.category !== 'as_is' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded-sm z-20" style={{ background: cat.border + '22', color: cat.border, border: `1px solid ${cat.border}44`, fontWeight: 600 }}>{cat.label}</div>}
    <div className={`absolute inset-0 flex items-center justify-center ${selected ? 'drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]' : ''}`} style={{ clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)', background: bg }} onDoubleClick={ie.startEdit}>
      {ie.editing ? (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <textarea id={`decision-label-${id}`} name={`decision_label_${id}`} aria-label="판단 노드 라벨 편집" ref={ie.textRef} value={ie.editText} onChange={e => ie.setEditText(e.target.value)} onBlur={ie.commitEdit} onKeyDown={ie.handleKeyDown} className="bg-amber-950/90 text-amber-100 text-xs font-semibold text-center leading-tight outline-none resize-none border border-amber-500/50 rounded px-2 py-1" style={{ width: '120px', minHeight: '40px' }} rows={Math.max(2, Math.ceil(ie.editText.length / 20))} />
        </div>
      ) : (
        <span className="text-amber-100 text-xs font-semibold text-center px-6 leading-tight max-w-[120px]" style={{ wordBreak: 'break-all' }}>{data.label}</span>
      )}
    </div>
    {sc && badge && <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] z-20" style={{ background: `${sc}22`, border: `1.5px solid ${sc}`, color: sc }}>{badge}</div>}
  </div>);
});
DecisionNode.displayName = 'DecisionNode';

export const SubprocessNode = memo(({ id, data, selected }: NodeProps<FlowNodeData>) => {
  const cat = CATEGORY_COLORS[data.category || 'as_is'];
  const defaultBg = 'linear-gradient(135deg, #115e59, #0f2a2a)';
  const bg = (data.category && data.category !== 'as_is') ? cat.gradient : defaultBg;
  const borderColor = (data.category && data.category !== 'as_is') ? cat.border : '#14b8a6';
  const shadow = selected ? '0 0 0 3px rgba(45,212,191,0.4),0 0 20px rgba(45,212,191,0.2)' : '0 4px 16px rgba(0,0,0,0.3)';
  const ie = useInlineEdit(id, data.label, true);
  return (<div className="relative flex items-center rounded-lg transition-all" style={{ minWidth: 220, maxWidth: 320, minHeight: 60, background: bg, border: `2px solid ${selected ? '#2dd4bf' : borderColor}`, boxShadow: shadow }}>
    <AllHandles color={selected ? '#2dd4bf' : '#5eead4'} />
    <div style={{ position: 'absolute', left: 14, top: 6, bottom: 6, width: 2, background: borderColor, opacity: 0.5, borderRadius: 1 }} />
    <div style={{ position: 'absolute', right: 14, top: 6, bottom: 6, width: 2, background: borderColor, opacity: 0.5, borderRadius: 1 }} />
    {data.category && data.category !== 'as_is' && <div className="absolute -top-5 right-2 text-[9px] px-1.5 py-0.5 rounded-sm z-20" style={{ background: cat.border + '22', color: cat.border, border: `1px solid ${cat.border}44`, fontWeight: 600 }}>{cat.label}</div>}
    <div className="flex-1 px-7 py-3" onDoubleClick={ie.startEdit}>
      {ie.editing ? <textarea id={`subprocess-label-${id}`} name={`subprocess_label_${id}`} aria-label="서브프로세스 노드 라벨 편집" ref={ie.textRef} value={ie.editText} onChange={e => ie.setEditText(e.target.value)} onBlur={ie.commitEdit} onKeyDown={ie.handleKeyDown} className="w-full bg-transparent text-teal-100 text-sm font-medium leading-snug outline-none resize-none border-b border-teal-500/50" style={{ minHeight: '20px' }} rows={Math.max(1, Math.ceil(ie.editText.length / 25))} />
        : <span className="text-teal-100 text-sm font-medium leading-snug" style={{ wordBreak: 'break-all' }}>{data.label}</span>}
    </div>
  </div>);
});
SubprocessNode.displayName = 'SubprocessNode';

export function SelfLoopEdge({ id, sourceX, sourceY, targetX, targetY, sourceHandleId, targetHandleId, style, markerEnd, label }: EdgeProps) {
  // Orthogonal Polyline Self Loop: Start -> P2 -> P3 -> P4 -> End
  const M = 40; // Margin

  const getDir = (hid: string | undefined | null) => {
    if (!hid) return { x: 1, y: 0, isVert: false };
    if (hid.includes('top')) return { x: 0, y: -1, isVert: true };
    if (hid.includes('bottom')) return { x: 0, y: 1, isVert: true };
    if (hid.includes('left')) return { x: -1, y: 0, isVert: false };
    if (hid.includes('right')) return { x: 1, y: 0, isVert: false };
    return { x: 1, y: 0, isVert: false };
  };

  const sDir = getDir(sourceHandleId);
  const tDir = getDir(targetHandleId);

  // P2: Start + Normal * Margin
  const p2x = sourceX + sDir.x * M;
  const p2y = sourceY + sDir.y * M;

  // P_pre_end: End + Normal * Margin
  const pPreEndx = targetX + tDir.x * M;
  const pPreEndy = targetY + tDir.y * M;

  // P3: Corner Point logic
  // If Source is Vertical, we go Vert first, so Corner X matches Target's X extension
  // If Source is Horizontal, we go Horiz first, so Corner Y matches Target's Y extension
  let p3x, p3y;
  if (sDir.isVert) {
    p3x = pPreEndx;
    p3y = p2y;
  } else {
    p3x = p2x;
    p3y = pPreEndy;
  }

  const path = `M ${sourceX} ${sourceY} L ${p2x} ${p2y} L ${p3x} ${p3y} L ${pPreEndx} ${pPreEndy} L ${targetX} ${targetY}`;

  // Label on the middle segment (P2->P3) or P3->PreEnd
  const labelX = (p2x + p3x + pPreEndx) / 3;
  const labelY = (p2y + p3y + pPreEndy) / 3;

  return (<><path id={id} d={path} style={{ ...style, fill: 'none' }} className="react-flow__edge-path" markerEnd={markerEnd as string} />
    {label && <foreignObject x={p3x - 40} y={p3y - 12} width={80} height={24}><div style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4, fontSize: 11, textAlign: 'center', color: '#e2e8f0', whiteSpace: 'nowrap' }}>{label as string}</div></foreignObject>}</>);
}

export function SpreadEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, markerEnd, label }: EdgeProps) {
  const SPREAD = 18;
  const srcCount: number = (data?.sourceSiblingCount as number) || 1;
  const srcIdx: number = (data?.sourceSiblingIndex as number) || 0;
  const tgtCount: number = (data?.targetSiblingCount as number) || 1;
  const tgtIdx: number = (data?.targetSiblingIndex as number) || 0;
  const isDecision: boolean = !!(data?.isFromDecision);

  const getOffset = (pos: Position, idx: number, count: number): { dx: number; dy: number } => {
    if (count <= 1) return { dx: 0, dy: 0 };
    const mid = (count - 1) / 2;
    const offset = (idx - mid) * SPREAD;
    if (pos === Position.Top || pos === Position.Bottom) return { dx: offset, dy: 0 };
    return { dx: 0, dy: offset };
  };

  const srcOff = getOffset(sourcePosition, srcIdx, srcCount);
  const tgtOff = getOffset(targetPosition, tgtIdx, tgtCount);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: sourceX + srcOff.dx, sourceY: sourceY + srcOff.dy,
    targetX: targetX + tgtOff.dx, targetY: targetY + tgtOff.dy,
    sourcePosition, targetPosition, borderRadius: 8,
  });

  const edgeStyle = isDecision
    ? { ...style, strokeDasharray: '6 3', fill: 'none' }
    : { ...style, fill: 'none' };

  return (<>
    <path id={id} d={edgePath} style={edgeStyle} className="react-flow__edge-path" markerEnd={markerEnd as string} />
    {label && <foreignObject x={labelX - 40} y={labelY - 12} width={80} height={24}><div style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4, fontSize: 11, textAlign: 'center', color: '#e2e8f0', whiteSpace: 'nowrap' }}>{label as string}</div></foreignObject>}
  </>);
}

export const nodeTypes = { start: StartNode, end: EndNode, process: ProcessNode, decision: DecisionNode, subprocess: SubprocessNode };
export const edgeTypes = { selfLoop: SelfLoopEdge, spread: SpreadEdge };
