import React, { useState } from 'react';
import { useStore } from '../store';
import L7GuideModal from './L7GuideModal';

export default function Toolbar() {
  const [showL7Guide, setShowL7Guide] = useState(false);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const hi = useStore((s) => s.historyIndex);
  const hl = useStore((s) => s.history.length);

  const saveStatus = useStore((s) => s.saveStatus);
  const lastSaved = useStore((s) => s.lastSaved);
  const nodes = useStore((s) => s.nodes);
  const dividerYs = useStore((s) => s.dividerYs);
  const setDividerYs = useStore((s) => s.setDividerYs);
  const addDividerY = useStore((s) => s.addDividerY);
  const toggleGuide = useStore((s) => s.toggleGuide);

  const pc = nodes.filter((n) => n.data.nodeType === 'process').length;
  const dc = nodes.filter((n) => n.data.nodeType === 'decision').length;
  const sc = nodes.filter((n) => n.data.nodeType === 'subprocess').length;
  const savedLabel = lastSaved
    ? `저장 ${new Date(lastSaved).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  const statusDot = { unsaved: '#ef4444', draft: '#f59e0b', complete: '#22c55e' }[saveStatus];
  const laneActive = dividerYs.length > 0;

  const handleToggleLane = () => {
    setDividerYs(laneActive ? [] : [400]);
  };

  const handleAddLane = () => {
    if (!laneActive) {
      setDividerYs([400]);
      return;
    }
    if (dividerYs.length >= 3) return;
    const lastY = Math.max(...dividerYs);
    addDividerY(lastY + 200);
  };

  return (
    <>
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5"
      style={{
        background: 'rgba(22,32,50,0.95)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: '6px 10px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}
    >
      <button
        onClick={undo}
        disabled={hi <= 0}
        title="Ctrl+Z"
        className="p-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-600/20 disabled:opacity-30"
      >
        ↶
      </button>
      <button
        onClick={redo}
        disabled={hi >= hl - 1}
        title="Ctrl+Shift+Z"
        className="p-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-600/20 disabled:opacity-30"
      >
        ↷
      </button>

      <div className="w-px h-5 bg-slate-700" />

      <button
        onClick={handleToggleLane}
        className={`px-2 py-1.5 rounded-lg text-xs hover:bg-slate-600/20 ${laneActive ? 'text-blue-400' : 'text-slate-400'}`}
      >
        역할 구분선 {laneActive ? 'ON' : 'OFF'}
      </button>
      {laneActive && dividerYs.length < 3 && (
        <button onClick={handleAddLane} className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-600/20">
          + 레인
        </button>
      )}

      <div className="w-px h-5 bg-slate-700" />

      <div className="flex items-center gap-2 px-2 text-xs text-slate-500">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusDot }} />
        {savedLabel && <span>{savedLabel}</span>}
        <span>{pc}P {dc}D {sc}S</span>
      </div>

      <div className="w-px h-5 bg-slate-700" />

      {/* 순서 변경: 드로잉 가이드 → 작성 가이드 */}
      <button
        onClick={toggleGuide}
        title="드로잉 가이드 (F1)"
        className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-600/20 border border-slate-600/30"
      >
        ✏️ 드로잉 가이드
      </button>
      <button
        onClick={() => setShowL7Guide(true)}
        title="L7 라벨 작성 가이드"
        className="px-2 py-1.5 rounded-lg text-xs font-semibold text-violet-300 hover:bg-violet-600/20 border border-violet-500/30"
      >
        📝 작성 가이드
      </button>
    </div>
    {showL7Guide && <L7GuideModal onClose={() => setShowL7Guide(false)} />}
    </>
  );
}
