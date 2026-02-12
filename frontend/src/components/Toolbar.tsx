import React from 'react';
import { useStore } from '../store';

export default function Toolbar() {
  const undo = useStore(s => s.undo);
  const redo = useStore(s => s.redo);
  const hi = useStore(s => s.historyIndex);
  const hl = useStore(s => s.history.length);
  const autoLayout = useStore(s => s.autoLayout);
  const saveDraft = useStore(s => s.saveDraft);
  const saveStatus = useStore(s => s.saveStatus);
  const lastSaved = useStore(s => s.lastSaved);
  const nodes = useStore(s => s.nodes);
  const swimLanes = useStore(s => s.swimLanes);
  const addSwimLane = useStore(s => s.addSwimLane);
  const removeSwimLane = useStore(s => s.removeSwimLane);
  const toggleGuide = useStore(s => s.toggleGuide);
  const theme = useStore(s => s.theme);
  const toggleTheme = useStore(s => s.toggleTheme);

  const pc = nodes.filter(n => n.data.nodeType === 'process').length;
  const dc = nodes.filter(n => n.data.nodeType === 'decision').length;
  const sc = nodes.filter(n => n.data.nodeType === 'subprocess').length;
  const savedLabel = lastSaved ? `저장: ${new Date(lastSaved).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '';
  const statusDot = { unsaved: '#ef4444', draft: '#f59e0b', complete: '#22c55e' }[saveStatus];
  const laneActive = swimLanes.length > 0;

  const handleToggleLane = () => {
    if (laneActive) { [...swimLanes].reverse().forEach(l => removeSwimLane(l.id)); }
    else { addSwimLane('A 주체'); addSwimLane('B 주체'); }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5"
      style={{ background: 'rgba(22,32,50,0.95)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '6px 10px', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
      <button onClick={undo} disabled={hi <= 0} title="Ctrl+Z" className="p-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-600/20 disabled:opacity-30">↩</button>
      <button onClick={redo} disabled={hi >= hl - 1} title="Ctrl+Shift+Z" className="p-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-600/20 disabled:opacity-30">↪</button>
      <div className="w-px h-5 bg-slate-700" />
      <button onClick={autoLayout} className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-600/20">⊞ 정렬</button>
      <div className="w-px h-5 bg-slate-700" />
      <button onClick={handleToggleLane} className={`px-2 py-1.5 rounded-lg text-xs hover:bg-slate-600/20 ${laneActive ? 'text-blue-400' : 'text-slate-400'}`}>
        🏊 레인{laneActive ? ` (${swimLanes.length})` : ''}
      </button>
      {laneActive && <button onClick={() => addSwimLane(`주체 ${swimLanes.length+1}`)} className="px-1.5 py-1 rounded text-[10px] text-blue-300 hover:bg-blue-600/20" title="레인 추가">+</button>}
      <div className="w-px h-5 bg-slate-700" />
      <button onClick={toggleTheme} className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-600/20" title="테마 전환">{theme==='dark'?'☀️':'🌙'}</button>
      <div className="w-px h-5 bg-slate-700" />
      <button onClick={saveDraft} className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-600/20">💾</button>
      <div className="w-px h-5 bg-slate-700" />
      <div className="flex items-center gap-2 px-2 text-xs text-slate-500">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusDot }} />
        {savedLabel && <span>{savedLabel}</span>}
        <span>{pc}P {dc}D {sc}S</span>
      </div>
      <div className="w-px h-5 bg-slate-700" />
      <button onClick={toggleGuide} title="도움말 (F1)" className="p-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-600/20">❓</button>
    </div>
  );
}
