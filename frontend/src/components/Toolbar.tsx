import React, { useState } from 'react';
import { useStore } from '../store';
import L7GuideModal from './L7GuideModal';

export default function Toolbar() {
  const [showL7Guide, setShowL7Guide] = useState(false);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const categorizeNodesAI = useStore((s) => s.categorizeNodesAI);
  const hi = useStore((s) => s.historyIndex);
  const hl = useStore((s) => s.history.length);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const addMessage = useStore((s) => s.addMessage);
  const resetToSetup = useStore((s) => s.resetToSetup);

  const saveStatus = useStore((s) => s.saveStatus);
  const lastSaved = useStore((s) => s.lastSaved);
  const saveDraft = useStore((s) => s.saveDraft);
  const nodes = useStore((s) => s.nodes);
  const dividerYs = useStore((s) => s.dividerYs);
  const setDividerYs = useStore((s) => s.setDividerYs);
  const addDividerY = useStore((s) => s.addDividerY);
  const toggleGuide = useStore((s) => s.toggleGuide);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const alignNodes = useStore((s) => s.alignNodes);

  const laneActive = dividerYs.length > 0;

  const workNodes = nodes.filter((n) => !['start', 'end'].includes(n.data.nodeType));
  const hasEnd = nodes.some((n) => n.data.nodeType === 'end');

  const handleGoHome = () => {
    if (!confirm('처음 화면으로 돌아가시겠습니까?\n현재 작업은 자동 저장되며, 복구 화면에서 불러올 수 있습니다.')) return;
    resetToSetup();
  };

  const handleSwitchToBe = () => {
    setMode('TO-BE');
    addMessage({
      id: `mode-switch-${Date.now()}`,
      role: 'bot',
      timestamp: Date.now(),
      text: '🎯 TO-BE 설계 모드로 전환되었습니다!\n\n이제 개선된 프로세스를 설계할 수 있어요. 노드를 선택하고 카테고리를 지정해보세요:\n• 🟢 현행 유지 (as_is)\n• 🔵 디지털 워커 (digital_worker)\n• 🟡 SSC 이관 (ssc_transfer)\n• 🔴 삭제 대상 (delete_target)\n• 🟣 신규 추가 (new_addition)',
      quickQueries: ['자동화 가능한 업무는?', 'PDD 생성하기', 'TO-BE 설계 팁을 알려줘']
    });
  };

  const handleSwitchToAsIs = () => {
    setMode('AS-IS');
    addMessage({
      id: `mode-switch-${Date.now()}`,
      role: 'bot',
      timestamp: Date.now(),
      text: '🔍 AS-IS 분석 모드로 전환되었습니다.',
    });
  };

  const handleToggleLane = () => {
    setDividerYs(laneActive ? [] : [1200]);
  };

  const handleAddLane = () => {
    if (!laneActive) {
      setDividerYs([600]);
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
        title="역할 구분선"
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
    </div>

    {/* 다중 선택 정렬 바 */}
    {selectedNodeIds.length >= 2 && (
      <div
        className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5"
        style={{
          background: 'rgba(22,32,50,0.95)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        <span className="text-xs text-slate-400">{selectedNodeIds.length}개 선택</span>
        <div className="w-px h-4 bg-slate-700" />
        <button
          onClick={() => alignNodes('horizontal')}
          title="수평 정렬 (같은 행)"
          className="px-2 py-1 rounded-lg text-xs text-sky-400 hover:bg-sky-600/20"
        >
          ↔ 수평
        </button>
        <button
          onClick={() => alignNodes('vertical')}
          title="수직 정렬 (같은 열)"
          className="px-2 py-1 rounded-lg text-xs text-sky-400 hover:bg-sky-600/20"
        >
          ↕ 수직
        </button>
      </div>
    )}

    {/* 우측 상단 컨트롤 패널 */}
    <div className="absolute top-4 right-4 z-10">
      <div className="flex flex-col gap-2">
        {/* 저장 버튼 — w-full로 아래 행 너비에 맞춤 */}
        <button
          onClick={saveDraft}
          title="임시저장 (Ctrl+S)"
          className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          style={{
            background: 'rgba(22,32,50,0.95)',
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
          }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusDot }} />
            {savedLabel && <span className="text-slate-500">{savedLabel}</span>}
          </div>
          <span className="font-medium">{pc}P {dc}D {sc}S</span>
        </button>
        {/* 처음으로 / 모드 전환 탭 */}
        <div className="flex gap-1.5 items-center">
          <button
            onClick={handleGoHome}
            title="처음 화면으로"
            className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
            style={{ background: 'rgba(22,32,50,0.9)', border: '1px solid var(--border-primary)', backdropFilter: 'blur(12px)' }}
          >
            ⌂ 처음으로
          </button>
          {/* AS-IS / TO-BE 탭 — 항상 노출 */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-primary)', backdropFilter: 'blur(12px)' }}>
            <button
              onClick={() => mode !== 'AS-IS' && handleSwitchToAsIs()}
              title="AS-IS 분석 모드"
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'AS-IS'
                  ? 'bg-blue-600/30 text-blue-300'
                  : 'bg-slate-800/80 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              AS-IS
            </button>
            <div className="w-px bg-slate-700" />
            <button
              onClick={() => mode !== 'TO-BE' && handleSwitchToBe()}
              title="TO-BE 설계 모드"
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'TO-BE'
                  ? 'bg-purple-600/30 text-purple-300'
                  : 'bg-slate-800/80 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              TO-BE
            </button>
          </div>
        </div>
      </div>
    </div>

    {showL7Guide && <L7GuideModal onClose={() => setShowL7Guide(false)} />}
    </>
  );
}
