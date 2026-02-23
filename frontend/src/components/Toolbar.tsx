import React, { useState } from 'react';
import { useStore } from '../store';
import L7GuideModal from './L7GuideModal';
import GuideModal from './GuideModal';

export default function Toolbar() {
  const [showL7Guide, setShowL7Guide] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const categorizeNodesAI = useStore((s) => s.categorizeNodesAI);
  const hi = useStore((s) => s.historyIndex);
  const hl = useStore((s) => s.history.length);
  const mode = useStore((s) => s.mode);

  const saveStatus = useStore((s) => s.saveStatus);
  const lastSaved = useStore((s) => s.lastSaved);
  const nodes = useStore((s) => s.nodes);
  const dividerYs = useStore((s) => s.dividerYs);
  const setDividerYs = useStore((s) => s.setDividerYs);
  const addDividerY = useStore((s) => s.addDividerY);
  const toggleGuide = useStore((s) => s.toggleGuide);

  const laneActive = dividerYs.length > 0;
  const workNodes = nodes.filter((n) => !['start', 'end'].includes(n.data.nodeType));

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

  const pc = nodes.filter((n) => n.data.nodeType === 'process').length;
  const dc = nodes.filter((n) => n.data.nodeType === 'decision').length;
  const sc = nodes.filter((n) => n.data.nodeType === 'subprocess').length;
  const savedLabel = lastSaved
    ? `저장 ${new Date(lastSaved).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  const statusDot = { unsaved: '#ef4444', draft: '#f59e0b', complete: '#22c55e' }[saveStatus];

  return (
    <>
    {/* 메인 툴바 */}
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

      {mode === 'TO-BE' && (
        <>
          <div className="w-px h-5 bg-slate-700" />
          <button
            onClick={categorizeNodesAI}
            disabled={nodes.length === 0}
            title="AI 기반 TO-BE 카테고리 자동 분류"
            className="px-2 py-1.5 rounded-lg text-xs text-violet-400 hover:bg-violet-600/20 disabled:opacity-30"
          >
            🤖 AI 분류
          </button>
        </>
      )}

      <div className="w-px h-5 bg-slate-700" />

      <button
        onClick={handleToggleLane}
        title="역할 구분선 (스윔레인)"
        className={`px-2 py-1.5 rounded-lg text-xs flex items-center gap-1.5 hover:bg-slate-600/20 ${laneActive ? 'text-blue-400' : 'text-slate-400'}`}
      >
        <svg width="13" height="11" viewBox="0 0 13 11" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="1" x2="13" y2="1" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="0" y1="5.5" x2="13" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 1.5"/>
          <line x1="0" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        역할 구분선
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: laneActive ? '#60a5fa' : '#475569' }}
        />
      </button>
      {laneActive && dividerYs.length < 3 && (
        <button onClick={handleAddLane} className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-600/20">
          + 레인
        </button>
      )}

      <div className="w-px h-5 bg-slate-700" />

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
      {workNodes.length === 0 && (
        <button
          onClick={() => setShowGuide(true)}
          title="툴 소개 및 사용법"
          className="px-2 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 hover:bg-indigo-600/20 border border-indigo-500/30"
        >
          🎓 툴 소개
        </button>
      )}
    </div>

    {/* 저장 상태 뱃지 (우측 상단) */}
    <div
      className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 text-xs text-slate-400"
      style={{
        background: 'rgba(22,32,50,0.95)',
        border: '1px solid var(--border-primary)',
        borderRadius: 10,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
      }}
    >
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusDot }} />
        {savedLabel && <span className="text-slate-500">{savedLabel}</span>}
      </div>
      <div className="w-px h-4 bg-slate-700" />
      <span className="font-medium">{pc}P {dc}D {sc}S</span>
    </div>

    {showL7Guide && <L7GuideModal onClose={() => setShowL7Guide(false)} />}
    {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </>
  );
}
