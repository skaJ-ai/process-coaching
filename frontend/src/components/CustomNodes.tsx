import React, { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, EdgeProps, getSmoothStepPath } from 'reactflow';
import { FlowNodeData, L7Status } from '../types';
import { CATEGORY_COLORS } from '../constants';
import { useStore } from '../store';

// ─── L7 상태 정의 (Zapier 스타일: 텍스트 + 색상) ───────────────────────────
const statusMap: Record<L7Status, { color: string; text: string; bar: string }> = {
  none:     { color: '',        text: '',          bar: 'transparent' },
  checking: { color: '#a855f7', text: '검토 중…',  bar: '#a855f7' },
  pass:     { color: '#10b981', text: '표현 적합',  bar: '#10b981' },
  warning:  { color: '#f59e0b', text: '검토 권장',  bar: '#f59e0b' },
  reject:   { color: '#ef4444', text: '수정 필요',  bar: '#ef4444' },
};

// ─── 노드 타입 아이콘 ───────────────────────────────────────────────────────
const NODE_ICONS: Record<string, string> = {
  process:    '▶',
  decision:   '⬦',
  subprocess: '⊞',
  start:      '●',
  end:        '■',
};

// ─── 카테고리 정의 (비기술 라벨 적용) ─────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; leftBar: string; badge: string }> = {
  as_is:          { label: '',          leftBar: '#3b82f6', badge: '' },
  digital_worker: { label: 'AI·자동화', leftBar: '#7c3aed', badge: '⚙' },
  ssc_transfer:   { label: 'SSC 이관',  leftBar: '#10b981', badge: '→' },
  delete_target:  { label: '삭제 예정', leftBar: '#ef4444', badge: '✕' },
  new_addition:   { label: '신규 추가', leftBar: '#eab308', badge: '+' },
};

// ─── AllHandles ────────────────────────────────────────────────────────────
const AllHandles = ({ color = '#60a5fa' }: { color?: string }) => (<>
  <Handle type="target"  position={Position.Top}    id="top-target"    style={{ top: -7,    left: '50%', width: 14, height: 14, background: color,       border: '2px solid #0f1729', borderRadius: '50%', zIndex: 10 }} />
  <Handle type="source"  position={Position.Top}    id="top-source"    style={{ top: -7,    left: '50%', width: 14, height: 14, background: 'transparent', border: 'none',              zIndex: 11 }} />
  <Handle type="target"  position={Position.Bottom} id="bottom-target" style={{ bottom: -7, left: '50%', width: 14, height: 14, background: color,       border: '2px solid #0f1729', borderRadius: '50%', zIndex: 10 }} />
  <Handle type="source"  position={Position.Bottom} id="bottom-source" style={{ bottom: -7, left: '50%', width: 14, height: 14, background: 'transparent', border: 'none',              zIndex: 11 }} />
  <Handle type="target"  position={Position.Left}   id="left-target"   style={{ left: -7,   top: '50%',  width: 14, height: 14, background: color,       border: '2px solid #0f1729', borderRadius: '50%', zIndex: 10 }} />
  <Handle type="source"  position={Position.Left}   id="left-source"   style={{ left: -7,   top: '50%',  width: 14, height: 14, background: 'transparent', border: 'none',              zIndex: 11 }} />
  <Handle type="target"  position={Position.Right}  id="right-target"  style={{ right: -7,  top: '50%',  width: 14, height: 14, background: color,       border: '2px solid #0f1729', borderRadius: '50%', zIndex: 10 }} />
  <Handle type="source"  position={Position.Right}  id="right-source"  style={{ right: -7,  top: '50%',  width: 14, height: 14, background: 'transparent', border: 'none',              zIndex: 11 }} />
</>);

// ─── 인라인 편집 훅 ────────────────────────────────────────────────────────
function useInlineEdit(nodeId: string, currentLabel: string, autoPending?: boolean) {
  const [editing, setEditing]   = useState(false);
  const [editText, setEditText] = useState(currentLabel);
  const textRef       = useRef<HTMLTextAreaElement>(null);
  const updateLabel   = useStore(s => s.updateNodeLabel);
  const pendingEditNodeId = useStore(s => s.pendingEditNodeId);
  const clearPendingEdit  = useStore(s => s.clearPendingEdit);
  useEffect(() => { setEditText(currentLabel); }, [currentLabel]);
  useEffect(() => { if (editing && textRef.current) { textRef.current.focus(); textRef.current.select(); } }, [editing]);
  useEffect(() => { if (autoPending && pendingEditNodeId === nodeId) { setEditing(true); setEditText(currentLabel); clearPendingEdit(); } }, [pendingEditNodeId, nodeId, autoPending, clearPendingEdit, currentLabel]);
  const startEdit   = (e: React.MouseEvent) => { e.stopPropagation(); setEditing(true); setEditText(currentLabel); };
  const commitEdit  = () => { setEditing(false); if (editText.trim() && editText !== currentLabel) updateLabel(nodeId, editText.trim()); else setEditText(currentLabel); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditing(false); setEditText(currentLabel); }
  };
  return { editing, editText, setEditText, textRef, startEdit, commitEdit, handleKeyDown };
}

// ─── StartNode ─────────────────────────────────────────────────────────────
export const StartNode = memo(({ id, data }: NodeProps<FlowNodeData>) => {
  const ie = useInlineEdit(id, data.label);
  return (
    <div
      className="relative flex items-center justify-center w-[60px] h-[60px] rounded-full"
      style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 0 20px rgba(34,197,94,0.3)' }}
      onDoubleClick={ie.startEdit}
    >
      {ie.editing
        ? <textarea id={`start-label-${id}`} name={`start_label_${id}`} aria-label="시작 노드 라벨 편집"
            ref={ie.textRef} value={ie.editText} onChange={e => ie.setEditText(e.target.value)}
            onBlur={ie.commitEdit} onKeyDown={ie.handleKeyDown}
            className="w-[56px] bg-transparent text-white text-[10px] font-semibold text-center leading-tight outline-none resize-none" rows={2} />
        : <span className="text-white text-[10px] font-semibold text-center leading-tight px-1" style={{ wordBreak: 'break-all' }}>{data.label}</span>
      }
      {[Position.Bottom, Position.Right, Position.Left, Position.Top].map(p =>
        <Handle key={p} type="source" position={p} id={p.toLowerCase() + '-source'}
          style={{ [p === Position.Top ? 'top' : p === Position.Bottom ? 'bottom' : p === Position.Left ? 'left' : 'right']: -5, width: 14, height: 14, background: '#4ade80', border: '2px solid #0f1729', borderRadius: '50%', opacity: 0.5 }} />
      )}
    </div>
  );
});
StartNode.displayName = 'StartNode';

// ─── EndNode ───────────────────────────────────────────────────────────────
export const EndNode = memo(({ id, data }: NodeProps<FlowNodeData>) => {
  const ie = useInlineEdit(id, data.label);
  return (
    <div
      className="relative flex items-center justify-center w-[60px] h-[60px] rounded-full"
      style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 0 20px rgba(239,68,68,0.3)' }}
      onDoubleClick={ie.startEdit}
    >
      {ie.editing
        ? <textarea id={`end-label-${id}`} name={`end_label_${id}`} aria-label="종료 노드 라벨 편집"
            ref={ie.textRef} value={ie.editText} onChange={e => ie.setEditText(e.target.value)}
            onBlur={ie.commitEdit} onKeyDown={ie.handleKeyDown}
            className="w-[56px] bg-transparent text-white text-[10px] font-semibold text-center leading-tight outline-none resize-none" rows={2} />
        : <span className="text-white text-[10px] font-semibold text-center leading-tight px-1" style={{ wordBreak: 'break-all' }}>{data.label}</span>
      }
      {[Position.Top, Position.Bottom, Position.Left, Position.Right].map(p =>
        <Handle key={p} type="target" position={p} id={p.toLowerCase() + '-target'}
          style={{ [p === Position.Top ? 'top' : p === Position.Bottom ? 'bottom' : p === Position.Left ? 'left' : 'right']: -5, width: 14, height: 14, background: '#f87171', border: '2px solid #0f1729', borderRadius: '50%' }} />
      )}
    </div>
  );
});
EndNode.displayName = 'EndNode';

// ─── ProcessNode — Zapier 카드 스타일 ─────────────────────────────────────
export const ProcessNode = memo(({ id, data, selected }: NodeProps<FlowNodeData>) => {
  const status  = statusMap[data.l7Status || 'none'];
  const catKey  = data.category || 'as_is';
  const catMeta = CATEGORY_META[catKey] ?? CATEGORY_META['as_is'];
  const ie      = useInlineEdit(id, data.label, true);

  // 좌측 상태 바 색상: L7 상태 우선, 없으면 카테고리 색
  const leftBarColor = status.bar !== 'transparent' && status.bar !== ''
    ? status.bar
    : catMeta.leftBar;

  const borderColor = selected ? '#3b82f6' : '#2a3a52';
  const shadow      = selected
    ? '0 0 0 2px rgba(59,130,246,0.5), 0 4px 20px rgba(59,130,246,0.15)'
    : '0 2px 8px rgba(0,0,0,0.35)';

  return (
    <div
      className="relative flex flex-col rounded-xl transition-all overflow-hidden"
      style={{
        minWidth: 220, maxWidth: 320, minHeight: 64,
        background: 'linear-gradient(135deg, #1a2d44, #0f1e30)',
        border: `1.5px solid ${borderColor}`,
        boxShadow: shadow,
      }}
    >
      <AllHandles color={selected ? '#3b82f6' : '#60a5fa'} />

      {/* ── 좌측 상태 바 (L7 or 카테고리) ── */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 4, background: leftBarColor, borderRadius: '12px 0 0 12px',
      }} />

      {/* ── 카테고리 배지 (as_is 제외) ── */}
      {catKey !== 'as_is' && (
        <div style={{
          position: 'absolute', top: 6, right: 8,
          background: `${catMeta.leftBar}22`, color: catMeta.leftBar,
          border: `1px solid ${catMeta.leftBar}55`,
          borderRadius: 4, padding: '1px 6px',
          fontSize: 10, fontWeight: 700, lineHeight: 1.6,
        }}>
          {catMeta.badge} {catMeta.label}
        </div>
      )}

      {/* ── 메인 본문 ── */}
      <div className="flex items-start gap-2.5 pl-4 pr-3 py-3" onDoubleClick={ie.startEdit}>
        {/* 단계 번호 */}
        {data.stepNumber != null && (
          <div style={{
            flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
            background: '#1e3a5f', border: '1.5px solid #3b82f6',
            color: '#93c5fd', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {data.stepNumber}
          </div>
        )}

        {/* 라벨 */}
        {ie.editing
          ? <textarea
              id={`process-label-${id}`} name={`process_label_${id}`} aria-label="단계 라벨 편집"
              ref={ie.textRef} value={ie.editText}
              onChange={e => ie.setEditText(e.target.value)}
              onBlur={ie.commitEdit} onKeyDown={ie.handleKeyDown}
              className="flex-1 bg-transparent text-slate-100 text-sm font-medium leading-snug outline-none resize-none border-b border-blue-500/50"
              style={{ minHeight: '20px' }}
              rows={Math.max(1, Math.ceil(ie.editText.length / 25))}
            />
          : <span className="flex-1 text-slate-100 text-sm font-medium leading-snug" style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}>
              {data.label}
            </span>
        }

        {/* 시스템명 */}
        {data.systemName && (
          <span style={{ fontSize: 9, color: '#a78bfa', background: 'rgba(124,58,237,0.15)', padding: '2px 5px', borderRadius: 4, flexShrink: 0, alignSelf: 'flex-start' }}>
            {data.systemName}
          </span>
        )}
      </div>

      {/* ── L7 상태 바 (하단) ── */}
      {status.text && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 10px 4px 12px',
          borderTop: `1px solid ${status.color}22`,
          background: `${status.color}0d`,
        }}>
          <span style={{ fontSize: 9, color: status.color, fontWeight: 600 }}>
            {data.l7Status === 'checking' ? '⟳' : data.l7Status === 'pass' ? '✓' : data.l7Status === 'warning' ? '💡' : '✏'} {status.text}
          </span>
          {data.inputLabel && (
            <span style={{ fontSize: 9, color: '#64748b', marginLeft: 'auto' }}>IN: {data.inputLabel}</span>
          )}
        </div>
      )}

      {/* IN/OUT 라벨 (L7 바 없을 때) */}
      {!status.text && data.inputLabel && (
        <div className="absolute -top-5 left-2 text-[9px] text-cyan-400 bg-cyan-900/30 px-1.5 py-0.5 rounded border border-cyan-800/40">IN: {data.inputLabel}</div>
      )}
      {data.outputLabel && (
        <div className="absolute -bottom-5 right-2 text-[9px] text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-800/40">OUT: {data.outputLabel}</div>
      )}
      {data.duration && (
        <div className="absolute -bottom-5 left-2 text-[9px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded border border-green-800/40">⏱ {data.duration}</div>
      )}
    </div>
  );
});
ProcessNode.displayName = 'ProcessNode';

// ─── DecisionNode — 판단 분기 시각화 강화 ─────────────────────────────────
export const DecisionNode = memo(({ id, data, selected }: NodeProps<FlowNodeData>) => {
  const catKey  = data.category || 'as_is';
  const catMeta = CATEGORY_META[catKey] ?? CATEGORY_META['as_is'];
  const status  = statusMap[data.l7Status || 'none'];
  const ie      = useInlineEdit(id, data.label, true);

  const diamondBg = selected
    ? 'linear-gradient(135deg,#f59e0b,#d97706)'
    : (catKey !== 'as_is' ? CATEGORY_COLORS[catKey]?.gradient : 'linear-gradient(135deg,#92400e,#78350f)');
  const glowColor = selected ? 'rgba(245,158,11,0.4)' : 'rgba(245,158,11,0.15)';

  return (
    <div className="relative" style={{ width: 170, height: 185 }}>
      <AllHandles color={selected ? '#fbbf24' : '#f59e0b'} />

      {/* 상단 라벨: "판단 조건" */}
      <div style={{
        position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
        whiteSpace: 'nowrap', fontSize: 9, fontWeight: 700,
        color: '#fbbf24', letterSpacing: '0.05em',
        background: 'rgba(120,53,15,0.6)', padding: '2px 8px',
        borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)',
      }}>
        ⬦ 판단 조건
      </div>

      {/* 카테고리 배지 */}
      {catKey !== 'as_is' && (
        <div style={{
          position: 'absolute', top: -2, right: -2, zIndex: 20,
          background: `${catMeta.leftBar}22`, color: catMeta.leftBar,
          border: `1px solid ${catMeta.leftBar}55`,
          borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700,
        }}>
          {catMeta.badge} {catMeta.label}
        </div>
      )}

      {/* 다이아몬드 */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
          background: diamondBg,
          filter: `drop-shadow(0 0 10px ${glowColor})`,
        }}
        onDoubleClick={ie.startEdit}
      >
        {ie.editing
          ? <textarea
              id={`decision-label-${id}`} name={`decision_label_${id}`} aria-label="판단 조건 편집"
              ref={ie.textRef} value={ie.editText}
              onChange={e => ie.setEditText(e.target.value)}
              onBlur={ie.commitEdit} onKeyDown={ie.handleKeyDown}
              className="bg-transparent text-amber-100 text-xs font-semibold text-center leading-tight outline-none resize-none"
              style={{ width: 108, maxHeight: 80 }} rows={3}
            />
          : <span className="text-amber-100 text-xs font-semibold text-center leading-tight" style={{ maxWidth: 110, wordBreak: 'break-all' }}>
              {data.label}
            </span>
        }
      </div>

      {/* 분기 방향 힌트: 좌(아니오) / 하(예) */}
      <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: '#fcd34d', opacity: 0.6, whiteSpace: 'nowrap' }}>
        ↓ 예 &nbsp;·&nbsp; → 아니오
      </div>

      {/* L7 상태 */}
      {status.text && (
        <div style={{
          position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)',
          whiteSpace: 'nowrap', fontSize: 9, color: status.color, fontWeight: 600,
          background: `${status.color}15`, padding: '2px 6px', borderRadius: 8,
          border: `1px solid ${status.color}33`,
        }}>
          {status.text}
        </div>
      )}
    </div>
  );
});
DecisionNode.displayName = 'DecisionNode';

// ─── SubprocessNode ────────────────────────────────────────────────────────
export const SubprocessNode = memo(({ id, data, selected }: NodeProps<FlowNodeData>) => {
  const catKey  = data.category || 'as_is';
  const catMeta = CATEGORY_META[catKey] ?? CATEGORY_META['as_is'];
  const status  = statusMap[data.l7Status || 'none'];
  const ie      = useInlineEdit(id, data.label, true);

  const leftBarColor = status.bar !== 'transparent' && status.bar !== '' ? status.bar : '#14b8a6';
  const borderColor  = selected ? '#2dd4bf' : '#14b8a6';
  const shadow       = selected
    ? '0 0 0 2px rgba(45,212,191,0.4), 0 4px 16px rgba(45,212,191,0.1)'
    : '0 2px 8px rgba(0,0,0,0.3)';

  return (
    <div
      className="relative flex flex-col rounded-xl transition-all overflow-hidden"
      style={{ minWidth: 220, maxWidth: 320, minHeight: 64, background: 'linear-gradient(135deg, #0f2a2a, #0c1f1f)', border: `1.5px solid ${borderColor}`, boxShadow: shadow }}
    >
      <AllHandles color={selected ? '#2dd4bf' : '#5eead4'} />

      {/* 좌측 이중 줄 (서브프로세스 구분자) */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: leftBarColor, borderRadius: '12px 0 0 12px' }} />
      <div style={{ position: 'absolute', left: 6, top: 8, bottom: 8, width: 2, background: leftBarColor, opacity: 0.4, borderRadius: 1 }} />

      {/* 상단 "하위 절차" 라벨 */}
      <div style={{
        position: 'absolute', top: -18, left: 10,
        fontSize: 9, fontWeight: 700, color: '#5eead4',
        background: 'rgba(20,184,166,0.12)', padding: '1px 6px',
        borderRadius: 6, border: '1px solid rgba(20,184,166,0.25)',
      }}>
        ⊞ 하위 절차
      </div>

      {/* 카테고리 배지 */}
      {catKey !== 'as_is' && (
        <div style={{
          position: 'absolute', top: 6, right: 8,
          background: `${catMeta.leftBar}22`, color: catMeta.leftBar,
          border: `1px solid ${catMeta.leftBar}55`,
          borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700,
        }}>
          {catMeta.badge} {catMeta.label}
        </div>
      )}

      {/* 메인 본문 */}
      <div className="flex items-start gap-2.5 pl-5 pr-3 py-3" onDoubleClick={ie.startEdit}>
        {data.stepNumber != null && (
          <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#0f2e2e', border: '1.5px solid #14b8a6', color: '#5eead4', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {data.stepNumber}
          </div>
        )}
        {ie.editing
          ? <textarea id={`subprocess-label-${id}`} name={`subprocess_label_${id}`} aria-label="하위 절차 라벨 편집"
              ref={ie.textRef} value={ie.editText} onChange={e => ie.setEditText(e.target.value)}
              onBlur={ie.commitEdit} onKeyDown={ie.handleKeyDown}
              className="flex-1 bg-transparent text-teal-100 text-sm font-medium leading-snug outline-none resize-none border-b border-teal-500/50"
              style={{ minHeight: '20px' }} rows={Math.max(1, Math.ceil(ie.editText.length / 25))} />
          : <span className="flex-1 text-teal-100 text-sm font-medium leading-snug" style={{ wordBreak: 'break-all' }}>{data.label}</span>
        }
      </div>

      {/* L7 상태 하단 바 */}
      {status.text && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px 4px 14px', borderTop: `1px solid ${status.color}22`, background: `${status.color}0d` }}>
          <span style={{ fontSize: 9, color: status.color, fontWeight: 600 }}>
            {data.l7Status === 'pass' ? '✓' : data.l7Status === 'warning' ? '💡' : '✏'} {status.text}
          </span>
        </div>
      )}
    </div>
  );
});
SubprocessNode.displayName = 'SubprocessNode';

// ─── SelfLoopEdge ──────────────────────────────────────────────────────────
export function SelfLoopEdge({ id, sourceX, sourceY, targetX, targetY, sourceHandleId, targetHandleId, style, markerEnd, label }: EdgeProps) {
  const M = 40;
  const getDir = (hid: string | undefined | null) => {
    if (!hid) return { x: 1, y: 0, isVert: false };
    if (hid.includes('top'))    return { x: 0,  y: -1, isVert: true };
    if (hid.includes('bottom')) return { x: 0,  y: 1,  isVert: true };
    if (hid.includes('left'))   return { x: -1, y: 0,  isVert: false };
    if (hid.includes('right'))  return { x: 1,  y: 0,  isVert: false };
    return { x: 1, y: 0, isVert: false };
  };
  const sDir = getDir(sourceHandleId);
  const tDir = getDir(targetHandleId);
  const p2x = sourceX + sDir.x * M, p2y = sourceY + sDir.y * M;
  const pPreEndx = targetX + tDir.x * M, pPreEndy = targetY + tDir.y * M;
  let p3x, p3y;
  if (sDir.isVert) { p3x = pPreEndx; p3y = p2y; } else { p3x = p2x; p3y = pPreEndy; }
  const path = `M ${sourceX} ${sourceY} L ${p2x} ${p2y} L ${p3x} ${p3y} L ${pPreEndx} ${pPreEndy} L ${targetX} ${targetY}`;
  const labelX = (p2x + p3x + pPreEndx) / 3, labelY = (p2y + p3y + pPreEndy) / 3;
  return (<>
    <path id={id} d={path} style={{ ...style, fill: 'none' }} className="react-flow__edge-path" markerEnd={markerEnd as string} />
    {label && <foreignObject x={p3x - 40} y={p3y - 12} width={80} height={24}><div style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4, fontSize: 11, textAlign: 'center', color: '#e2e8f0', whiteSpace: 'nowrap' }}>{label as string}</div></foreignObject>}
  </>);
}

// ─── SpreadEdge — 일반/조건 분기 스타일 구분 ──────────────────────────────
export function SpreadEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, markerEnd, label }: EdgeProps) {
  const SPREAD = 18;
  const srcCount: number = (data?.sourceSiblingCount as number) || 1;
  const srcIdx:   number = (data?.sourceSiblingIndex as number) || 0;
  const tgtCount: number = (data?.targetSiblingCount as number) || 1;
  const tgtIdx:   number = (data?.targetSiblingIndex as number) || 0;
  // 판단 노드에서 출발하는 엣지인지 여부 (조건 분기)
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
    ? { ...style, strokeDasharray: '6 3', stroke: '#f59e0b', strokeWidth: 1.8 }
    : { ...style };

  return (<>
    <path id={id} d={edgePath} style={{ ...edgeStyle, fill: 'none' }} className="react-flow__edge-path" markerEnd={markerEnd as string} />
    {label && (
      <foreignObject x={labelX - 44} y={labelY - 13} width={88} height={26}>
        <div style={{
          background: isDecision ? '#78350f' : '#1e293b',
          border: isDecision ? '1px solid #f59e0b55' : '1px solid #334155',
          padding: '2px 6px', borderRadius: 4, fontSize: 11,
          textAlign: 'center',
          color: isDecision ? '#fcd34d' : '#e2e8f0',
          whiteSpace: 'nowrap',
        }}>
          {label as string}
        </div>
      </foreignObject>
    )}
  </>);
}

export const nodeTypes = { start: StartNode, end: EndNode, process: ProcessNode, decision: DecisionNode, subprocess: SubprocessNode };
export const edgeTypes = { selfLoop: SelfLoopEdge, spread: SpreadEdge };
