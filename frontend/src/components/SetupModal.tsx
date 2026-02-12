import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { hrModules } from '../data/processData';

export default function SetupModal() {
  const setCtx = useStore(s => s.setProcessContext);
  const importFlow = useStore(s => s.importFlow);
  const loadLS = useStore(s => s.loadFromLocalStorage);

  const [l4, setL4] = useState('');
  const [l5, setL5] = useState('');
  const [l6, setL6] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);

  const mod = useMemo(() => hrModules.find(m => m.l4 === l4), [l4]);
  const task = useMemo(() => mod?.tasks.find(t => t.l5 === l5), [mod, l5]);
  const ok = l4 && l5 && l6;

  useEffect(() => {
    const saved = localStorage.getItem('pm-v5-save');
    if (saved) setShowRecovery(true);
  }, []);

  const handleStart = () => {
    if (!ok) return;
    setCtx({ l4, l5, processName: l6 });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = ev.target?.result as string;
          const data = JSON.parse(json);
          if (data.processContext) { setCtx(data.processContext); setTimeout(() => importFlow(json), 100); }
          else alert('유효하지 않은 파일입니다.');
        } catch { alert('파일을 읽을 수 없습니다.'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleRecovery = () => {
    if (!loadLS()) alert('복구할 데이터가 없습니다.');
  };

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-[540px] rounded-2xl p-8 animate-fade-in" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🤖</div>
          <h1 className="text-2xl font-bold text-slate-100">Process Coaching AI</h1>
          <p className="text-sm text-slate-400 mt-1">아직 베타 버전인 관계로 AI 기능이 미흡할 수 있으니 양해 부탁드립니다!</p>
        </div>

        {showRecovery && (
          <div className="mb-5 px-4 py-3 rounded-lg animate-slide-up" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-300">💾 이전 작업이 발견되었습니다.</span>
              <div className="flex gap-2">
                <button onClick={handleRecovery} className="px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500">복구</button>
                <button onClick={() => { setShowRecovery(false); localStorage.removeItem('pm-v5-save'); }} className="px-3 py-1 rounded text-xs text-slate-400 border border-slate-600/40 hover:bg-slate-700/30">삭제</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button onClick={handleImport} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-700/30 border border-slate-600/40 text-slate-300 hover:bg-slate-700/50">📂 JSON 가져오기</button>
        </div>

        <div className="flex items-center gap-3 mb-6"><div className="flex-1 h-px bg-slate-700" /><span className="text-xs text-slate-500">또는 새로 시작</span><div className="flex-1 h-px bg-slate-700" /></div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">L4 모듈</label>
            <select value={l4} onChange={e => { setL4(e.target.value); setL5(''); setL6(''); }} className="w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-slate-700/50 focus:outline-none focus:border-blue-500/50">
              <option value="">모듈 선택...</option>
              {hrModules.map(m => <option key={m.l4} value={m.l4}>{m.l4}</option>)}
            </select>
          </div>
          {l4 && mod && <div className="animate-fade-in">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">L5 단위업무</label>
            <select value={l5} onChange={e => { setL5(e.target.value); setL6(''); }} className="w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-slate-700/50 focus:outline-none focus:border-blue-500/50">
              <option value="">선택...</option>
              {mod.tasks.map(t => <option key={t.l5} value={t.l5}>{t.l5}</option>)}
            </select>
          </div>}
          {l5 && task && <div className="animate-fade-in">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">L6 상세활동</label>
            <select value={l6} onChange={e => setL6(e.target.value)} className="w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-slate-700/50 focus:outline-none focus:border-blue-500/50">
              <option value="">선택...</option>
              {task.l6_activities.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>}
        </div>
        <button onClick={handleStart} disabled={!ok} className="w-full mt-6 px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed">
          프로세스 드로잉 시작 →
        </button>
      </div>
    </div>
  );
}
