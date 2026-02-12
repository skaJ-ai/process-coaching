import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import SuggestionCard from './SuggestionCard';
import L7ReportCard from './L7ReportCard';
import LoadingIndicator from './LoadingIndicator';
import SubmitModal from './SubmitModal';
import QualityDashboard from './QualityDashboard';
import PDDGenerator from './PDDGenerator';

export default function ChatPanel() {
  const messages = useStore(s => s.messages);
  const ls = useStore(s => s.loadingState);
  const sendChat = useStore(s => s.sendChat);
  const requestReview = useStore(s => s.requestReview);
  const validateAll = useStore(s => s.validateAllNodes);
  const ctx = useStore(s => s.processContext);
  const exportFlow = useStore(s => s.exportFlow);
  const submitComplete = useStore(s => s.submitComplete);
  const forceComplete = useStore(s => s.forceComplete);
  const saveStatus = useStore(s => s.saveStatus);

  const adminMode = useStore(s => s.adminMode);

  const [input, setInput] = useState('');
  const [submitIssues, setSubmitIssues] = useState<string[] | null>(null);
  const [showPDD, setShowPDD] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, ls.active]);

  const handleSaveIntermediate = () => {
    const json = exportFlow();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `process-${ctx?.processName || 'flow'}-중간저장-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  const handleSubmit = () => { const { ok, issues } = submitComplete(); if (!ok) setSubmitIssues(issues); };
  const handleSend = () => { if (!input.trim() || ls.active) return; sendChat(input.trim()); setInput(''); };
  // v5: auto-send on quick button click
  const quickSend = (q: string) => { if (ls.active) return; sendChat(q); };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-secondary)' }}>
      <div className="flex-shrink-0 px-5 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />Process Coaching AI</h2>
        {ctx && <p className="text-xs text-slate-500 mb-2">{ctx.l4} → {ctx.l5} → {ctx.processName}</p>}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={validateAll} disabled={ls.active} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 disabled:opacity-40">✓ L7 검증</button>
          <button onClick={requestReview} disabled={ls.active} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 disabled:opacity-40">🔍 플로우 분석</button>

          {adminMode && <button onClick={() => setShowPDD(true)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30">📄 PDD</button>}
        </div>
      </div>
      <QualityDashboard />
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {!messages.length && <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
          <div className="text-4xl mb-3">💬</div><p className="text-sm text-slate-400">우클릭으로 셰이프를 추가하고,<br />챗봇에 언제든 질문하세요.</p>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {['어떻게 시작하면 좋을까요?', '일반적인 단계는 뭐가 있나요?', '예외 처리는 어떻게 표현하나요?'].map(q => (
              <button key={q} onClick={() => quickSend(q)} className="px-3 py-1.5 rounded-full text-xs text-slate-400 border border-slate-700 hover:border-blue-500/50 hover:text-blue-300 transition-colors">{q}</button>
            ))}
          </div>
        </div>}
        {messages.map(msg => (
          <div key={msg.id} className={`animate-slide-up ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>{msg.text}</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2"><div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><span className="text-xs">🤖</span></div><div className="flex-1 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.text}</div></div>
                {msg.suggestions?.length ? <div className="ml-9 space-y-2">{msg.suggestions.map((s, i) => <SuggestionCard key={`${msg.id}-s${i}`} suggestion={s} />)}</div> : null}
                {msg.l7Report?.length ? <div className="ml-9 space-y-2"><div className="text-xs text-slate-500 font-medium">📋 L7 검증 결과:</div>{msg.l7Report.map((r, i) => <L7ReportCard key={`${msg.id}-l${i}`} item={r} />)}</div> : null}
                {msg.quickQueries?.length ? (
                  <div className="ml-9 flex flex-wrap gap-1.5">
                    {msg.quickQueries.map((q, i) => (
                      <button key={`${msg.id}-qq${i}`} onClick={() => quickSend(q)} className="px-3 py-1.5 rounded-full text-xs text-blue-300 border border-blue-500/30 hover:bg-blue-600/20 hover:border-blue-500/50 transition-colors">{q}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
        {ls.active && <LoadingIndicator />}
        <div ref={endRef} />
      </div>
      <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <div className="flex gap-2 mb-2">
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={'질문하거나 아이디어를 요청하세요...'}
            disabled={ls.active} rows={3}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder-slate-500 bg-slate-800/60 border border-slate-700/50 focus:outline-none focus:border-blue-500/50 disabled:opacity-50 resize-none"
            style={{ minHeight: '72px', maxHeight: '150px' }} />
          <button onClick={handleSend} disabled={ls.active || !input.trim()} className="px-4 self-end py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700 disabled:text-slate-500 h-10">전송</button>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSaveIntermediate} className="flex-1 px-4 py-2 rounded-xl text-sm font-medium border border-slate-600/40 text-slate-300 hover:bg-slate-700/30">💾 중간저장</button>
          <button onClick={handleSubmit} disabled={saveStatus === 'complete'}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 disabled:from-slate-600 disabled:to-slate-600 disabled:text-slate-400">
            {saveStatus === 'complete' ? '✅ 완료됨' : '✓ 완료하기'}
          </button>
        </div>
      </div>
      {submitIssues && <SubmitModal issues={submitIssues} onClose={() => setSubmitIssues(null)} onForceSubmit={() => { setSubmitIssues(null); forceComplete(); }} />}
      {showPDD && <PDDGenerator onClose={() => setShowPDD(false)} />}
    </div>
  );
}
