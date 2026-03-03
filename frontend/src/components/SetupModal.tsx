import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { hrModules } from '../data/processData';
import GuideModal from './GuideModal';

export default function SetupModal() {
  const setCtx = useStore(s => s.setProcessContext);
  const importFlow = useStore(s => s.importFlow);
  const loadLS = useStore(s => s.loadFromLocalStorage);

  const [l3, setL3] = useState('');
  const [l4, setL4] = useState('');
  const [l5, setL5] = useState('');
  const [l6, setL6] = useState('');
  const [l3Custom, setL3Custom] = useState('');
  const [l4Custom, setL4Custom] = useState('');
  const [l5Custom, setL5Custom] = useState('');
  const [l6Custom, setL6Custom] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const modL3 = useMemo(() => hrModules.find(m => m.l3 === l3), [l3]);
  const modL4 = useMemo(() => modL3?.l4_list.find(t => t.l4 === l4), [modL3, l4]);
  const task = useMemo(() => modL4?.tasks.find(t => t.l5 === l5), [modL4, l5]);

  const effectiveL3 = l3 === '__custom__' ? l3Custom.trim() : l3;
  const effectiveL4 = l4 === '__custom__' ? l4Custom.trim() : l4;
  const effectiveL5 = l5 === '__custom__' ? l5Custom.trim() : l5;
  const effectiveL6 = l6 === '__custom__' ? l6Custom.trim() : l6;
  const ok = effectiveL3 && effectiveL4 && effectiveL5 && effectiveL6;

  useEffect(() => {
    const saved = localStorage.getItem('pm-v5-save');
    if (saved) setShowRecovery(true);
  }, []);

  const handleStart = () => {
    if (!ok) return;
    setCtx({ l3: effectiveL3, l4: effectiveL4, l5: effectiveL5, processName: effectiveL6 });
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
          if (!data.processContext && !data.nodes) {
            alert('유효하지 않은 파일입니다.\n\n노드 데이터를 찾을 수 없습니다.');
            return;
          }
          // 구버전 파일: processContext가 없거나 필드 일부 누락 → 빈 문자열로 대체
          const ctx = {
            l3: '', l4: '', l5: '', processName: '',
            ...(data.processContext || {}),
          };
          setCtx(ctx, () => importFlow(json));
        } catch (e) { alert(`파일을 읽을 수 없습니다.\n\n${e instanceof Error ? e.message : '알 수 없는 오류'}`); }
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
                <button onClick={() => { if (confirm('이전 작업 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) { setShowRecovery(false); localStorage.removeItem('pm-v5-save'); } }} className="px-3 py-1 rounded text-xs text-slate-400 border border-slate-600/40 hover:bg-slate-700/30">삭제</button>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleImport} className="w-full mb-6 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-700/30 border border-slate-600/40 text-slate-300 hover:bg-slate-700/50">📂 JSON 가져오기</button>

        <div className="flex items-center gap-3 mb-6"><div className="flex-1 h-px bg-slate-700" /><span className="text-xs text-slate-500">또는 새로 시작</span><div className="flex-1 h-px bg-slate-700" /></div>

        {(l3 || l4 || l5 || l6) && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs text-slate-400" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
            {l3 && <span className="text-blue-300">{l3}</span>}
            {l4 && <><span className="mx-1.5 text-slate-600">→</span><span className="text-blue-300">{l4}</span></>}
            {l5 && <><span className="mx-1.5 text-slate-600">→</span><span className="text-blue-300">{l5}</span></>}
            {l6 && <><span className="mx-1.5 text-slate-600">→</span><span className="text-blue-300">{l6}</span></>}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="setup-l3" className="block text-xs font-medium text-slate-400 mb-1.5">기능(L3)</label>
            <select id="setup-l3" name="l3" value={l3} onChange={e => { setL3(e.target.value); setL4(''); setL5(''); setL6(''); }} className="w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-slate-700/50 focus:outline-none focus:border-blue-500/50">
              <option value="">기능 선택...</option>
              {hrModules.map(m => <option key={m.l3} value={m.l3}>{m.l3}</option>)}
              <option value="__custom__">✏️ 직접 입력</option>
            </select>
            {l3 === '__custom__' && (
              <input type="text" value={l3Custom} onChange={e => setL3Custom(e.target.value)} placeholder="기능(L3)을 직접 입력하세요" className="mt-2 w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-blue-500/40 focus:outline-none focus:border-blue-500/70 placeholder:text-slate-600" />
            )}
          </div>
          {l3 && (modL3 || l3 === '__custom__') && <div className="animate-fade-in">
            <label htmlFor="setup-l4" className="block text-xs font-medium text-slate-400 mb-1.5">모듈(L4)</label>
            {l3 === '__custom__' ? (
              <input type="text" id="setup-l4" value={l4Custom} onChange={e => setL4Custom(e.target.value)} placeholder="모듈(L4)을 직접 입력하세요" className="w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-blue-500/40 focus:outline-none focus:border-blue-500/70 placeholder:text-slate-600" />
            ) : (
              <>
                <select id="setup-l4" name="l4" value={l4} onChange={e => { setL4(e.target.value); setL4Custom(''); setL5(''); setL6(''); }} className="w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-slate-700/50 focus:outline-none focus:border-blue-500/50">
                  <option value="">선택...</option>
                  {modL3!.l4_list.map(t => <option key={t.l4} value={t.l4}>{t.l4}</option>)}
                  <option value="__custom__">✏️ 직접 입력</option>
                </select>
                {l4 === '__custom__' && (
                  <input type="text" value={l4Custom} onChange={e => setL4Custom(e.target.value)} placeholder="모듈(L4)을 직접 입력하세요" className="mt-2 w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-blue-500/40 focus:outline-none focus:border-blue-500/70 placeholder:text-slate-600" />
                )}
              </>
            )}
          </div>}
          {l4 && (modL4 || l4 === '__custom__') && <div className="animate-fade-in">
            <label htmlFor="setup-l5" className="block text-xs font-medium text-slate-400 mb-1.5">단위업무(L5)</label>
            {l4 === '__custom__' ? (
              <input type="text" id="setup-l5" value={l5Custom} onChange={e => setL5Custom(e.target.value)} placeholder="단위업무(L5)를 직접 입력하세요" className="w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-blue-500/40 focus:outline-none focus:border-blue-500/70 placeholder:text-slate-600" />
            ) : (
              <>
                <select id="setup-l5" name="l5" value={l5} onChange={e => { setL5(e.target.value); setL5Custom(''); setL6(''); setL6Custom(''); }} className="w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-slate-700/50 focus:outline-none focus:border-blue-500/50">
                  <option value="">선택...</option>
                  {modL4!.tasks.map(t => <option key={t.l5} value={t.l5}>{t.l5}</option>)}
                  <option value="__custom__">✏️ 직접 입력</option>
                </select>
                {l5 === '__custom__' && (
                  <input type="text" value={l5Custom} onChange={e => setL5Custom(e.target.value)} placeholder="단위업무(L5)를 직접 입력하세요" className="mt-2 w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-blue-500/40 focus:outline-none focus:border-blue-500/70 placeholder:text-slate-600" />
                )}
              </>
            )}
          </div>}
          {l5 && (task || l5 === '__custom__') && <div className="animate-fade-in">
            <label htmlFor="setup-l6" className="block text-xs font-medium text-slate-400 mb-1.5">Activity(L6)</label>
            {l5 === '__custom__' ? (
              <input type="text" id="setup-l6" value={l6Custom} onChange={e => setL6Custom(e.target.value)} placeholder="Activity(L6)를 직접 입력하세요" className="w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-blue-500/40 focus:outline-none focus:border-blue-500/70 placeholder:text-slate-600" />
            ) : (
              <>
                <select id="setup-l6" name="l6" value={l6} onChange={e => { setL6(e.target.value); setL6Custom(''); }} className="w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-slate-700/50 focus:outline-none focus:border-blue-500/50">
                  <option value="">선택...</option>
                  {task!.l6_activities.map(a => <option key={a} value={a}>{a}</option>)}
                  <option value="__custom__">✏️ 직접 입력</option>
                </select>
                {l6 === '__custom__' && (
                  <input type="text" value={l6Custom} onChange={e => setL6Custom(e.target.value)} placeholder="Activity(L6)를 직접 입력하세요" className="mt-2 w-full px-4 py-2.5 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-blue-500/40 focus:outline-none focus:border-blue-500/70 placeholder:text-slate-600" />
                )}
              </>
            )}
          </div>}
        </div>
        <div>
          <button onClick={handleStart} disabled={!ok} className="w-full mt-6 px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed">
            프로세스 드로잉 시작 →
          </button>
          {!ok && <p className="text-xs text-slate-500 mt-2 text-center">4개 항목을 모두 선택해주세요</p>}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-700/50">
          <button onClick={() => setShowGuide(true)} className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30">
            🎓 툴 소개 및 사용법
          </button>
        </div>
      </div>
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
