import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { API_BASE_URL, DRAFT_LANE_ENABLED } from '../constants';
import SuggestionCard from './SuggestionCard';
import L7ReportCard from './L7ReportCard';
import LoadingIndicator from './LoadingIndicator';
import SubmitModal from './SubmitModal';
import QualityDashboard from './QualityDashboard';
import PDDGenerator from './PDDGenerator';
import DraftLane from './DraftLane';

export default function ChatPanel() {
  const messages = useStore(s => s.messages);
  const ls = useStore(s => s.loadingState);
  const sendChat = useStore(s => s.sendChat);
  const requestReview = useStore(s => s.requestReview);
  const ctx = useStore(s => s.processContext);
  const exportFlow = useStore(s => s.exportFlow);
  const submitComplete = useStore(s => s.submitComplete);
  const forceComplete = useStore(s => s.forceComplete);
  const saveStatus = useStore(s => s.saveStatus);
  const validateAllNodes = useStore(s => s.validateAllNodes);

  const mode = useStore(s => s.mode);
  const onboardingStep = useStore(s => s.onboardingStep);
  const isActiveOnboarding = onboardingStep !== 'idle' && onboardingStep !== 'done' && onboardingStep !== 'welcome' && onboardingStep !== 'skipped';
  const advanceOnboarding = useStore(s => s.advanceOnboarding);
  const skipOnboarding = useStore(s => s.skipOnboarding);

  const dismissMessage = (msgId: string) => {
    useStore.setState(s => ({ messages: s.messages.filter(m => m.id !== msgId) }));
  };

  const [input, setInput] = useState('');
  const [submitIssues, setSubmitIssues] = useState<string[] | null>(null);
  const [showPDD, setShowPDD] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, ls.active]);

  const handleSaveIntermediate = () => {
    const mode = useStore.getState().mode || 'AS-IS';
    const l6 = ctx?.processName || 'flow';
    const now = new Date();
    const dateTime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const json = exportFlow();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${mode}-${l6}-중간저장-${dateTime}.json`;
    a.click();
  };
  const handleSubmit = () => { const { ok, issues } = submitComplete(); if (!ok) setSubmitIssues(issues); };
  const handleSend = () => {
    if (!input.trim() || ls.active) return;
    sendChat(input.trim());
    setInput('');
  };
  const quickSend = (q: string) => { if (ls.active) return; sendChat(q); };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-secondary)' }}>
      <div className="flex-shrink-0 px-5 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />Process Coaching AI</h2>
        </div>
        {ctx && <p className="text-xs text-slate-500 mb-2">{ctx.l4} → {ctx.l5} → {ctx.processName}</p>}
        <div className="flex gap-1.5 flex-wrap">
          <button data-tour="review" onClick={() => requestReview()} disabled={ls.active} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 disabled:opacity-40">🔍 전체 흐름 검토</button>
          <button onClick={() => validateAllNodes()} disabled={ls.active} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 disabled:opacity-40">⚙ L7 전체 검증</button>
          {mode === 'TO-BE' && <button onClick={() => setShowPDD(true)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30">📄 PDD</button>}
        </div>
      </div>
      <div data-tour="quality" className="flex-shrink-0"><QualityDashboard /></div>
      {DRAFT_LANE_ENABLED && <DraftLane />}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {!messages.length && <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
          <div className="text-4xl mb-3">💬</div><p className="text-sm text-slate-400">우클릭으로 셰이프를 추가하고,<br />챗봇에 언제든 질문하세요.</p>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {['어떻게 시작하면 좋을까요?', '일반적인 단계는 뭐가 있나요?', '예외 처리는 어떻게 표현하나요?'].map(q => (
              <button key={q} onClick={() => quickSend(q)} className="px-3 py-1.5 rounded-full text-xs text-slate-400 border border-slate-700 hover:border-blue-500/50 hover:text-blue-300 transition-colors">{q}</button>
            ))}
          </div>
        </div>}
        {(() => {
          const lastBotMsg = isActiveOnboarding ? [...messages].reverse().find(m => m.role === 'bot') : null;
          return messages.map(msg => {
            const isGhosted = !!lastBotMsg && msg.id !== lastBotMsg.id;
            return (
          <div key={msg.id} className={`animate-slide-up transition-all duration-300 ${msg.role === 'user' ? 'flex justify-end' : ''} ${msg.actioned ? 'pointer-events-none' : ''}`}
            style={{ opacity: msg.actioned ? 0.25 : isGhosted ? 0.15 : 1, pointerEvents: isGhosted ? 'none' : undefined }}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>{msg.text}</div>
            ) : (
              <div className="space-y-3 relative">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><span className="text-xs">🤖</span></div>
                  <div className="flex-1 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words min-w-0">{msg.text}</div>
                  {msg.dismissible && <button onClick={() => dismissMessage(msg.id)} className="flex-shrink-0 text-xs text-slate-500 hover:text-slate-300 px-2">✕</button>}
                </div>
                {msg.suggestions?.length ? <div className="ml-9 space-y-2">{msg.suggestions.map((s, i) => <SuggestionCard key={`${msg.id}-s${i}`} suggestion={s} />)}</div> : null}
                {msg.l7Report?.length ? <div className="ml-9 space-y-2"><div className="text-xs text-slate-500 font-medium">📋 L7 검증 결과:</div>{msg.l7Report.map((r, i) => <L7ReportCard key={`${msg.id}-l${i}`} item={r} />)}</div> : null}
                {msg.quickQueries?.length ? (
                  <div className="ml-9 flex flex-wrap gap-1.5">
                    {msg.quickQueries.map((q, i) => (
                      <button key={`${msg.id}-qq${i}`} onClick={() => quickSend(q)} className="px-3 py-1.5 rounded-full text-xs text-blue-300 border border-blue-500/30 hover:bg-blue-600/20 hover:border-blue-500/50 transition-colors">{q}</button>
                    ))}
                  </div>
                ) : null}
                {msg.quickActions?.length ? (
                  <div className="ml-9 flex flex-wrap gap-1.5">
                    {msg.quickActions.map((a, i) => (
                      <button
                        key={`${msg.id}-qa${i}`}
                        onClick={() => {
                          if (!a.noActioned) {
                            useStore.setState(s => ({ messages: s.messages.map(m => m.id === msg.id ? { ...m, actioned: true } : m) }));
                          }
                          if (a.storeAction === 'toggleSwimLane') {
                            const { dividerYs, setDividerYs } = useStore.getState();
                            if (dividerYs.length === 0) setDividerYs([1200]);
                          } else if (a.storeAction === 'advanceOnboarding') {
                            advanceOnboarding();
                          } else if (a.storeAction === 'skipOnboarding') {
                            skipOnboarding();
                          } else if (a.storeAction === 'addSwimLaneAndAdvance') {
                            const { dividerYs: dys, setDividerYs: sdys } = useStore.getState();
                            if (dys.length === 0) sdys([1200]);
                            advanceOnboarding();
                          } else if (a.storeAction === 'focusStartNode') {
                            const { nodes, setFocusNodeId } = useStore.getState();
                            const start = nodes.find(n => n.data.nodeType === 'start');
                            if (start) setFocusNodeId(start.id);
                          } else if (a.storeAction === 'focusEndNode') {
                            const { nodes, setFocusNodeId } = useStore.getState();
                            const end = nodes.find(n => n.data.nodeType === 'end');
                            if (end) setFocusNodeId(end.id);
                          } else if (a.storeAction === 'startInterviewFlow') {
                            const { addMessage, processContext, loadingState } = useStore.getState();
                            const currentCount = (loadingState.requestCount || 0) + 1;
                            useStore.setState({ loadingState: { active: true, message: 'AI 인터뷰 시작 중...', startTime: Date.now(), elapsed: 0, requestCount: currentCount } });
                            (async () => {
                              const fallbackText =
                                `업무 흐름을 함께 그려봐요 🎙\n\n` +
                                `"${processContext?.processName || 'HR 프로세스'}" 프로세스를 시작해볼게요.\n\n` +
                                `첫 번째 질문: 이 업무에서 가장 먼저 하는 일이 무엇인가요? 주로 누가 담당하나요?`;
                              const fallbackQueries = [
                                `${processContext?.processName || '이 업무'}에서 일반적인 단계는 뭐가 있나요?`,
                                '어떤 분기점이나 예외 상황이 있나요?',
                                '이 프로세스에서 사용하는 시스템이나 도구가 있나요?',
                              ];
                              try {
                                const { nodes: storeNodes } = useStore.getState();
                                const serializedNodes = storeNodes.map(n => ({
                                  id: n.id,
                                  type: n.data.nodeType,
                                  label: n.data.label,
                                }));
                                const res = await fetch(`${API_BASE_URL}/interview-start`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    context: processContext || {},
                                    currentNodes: serializedNodes,
                                    currentEdges: [],
                                  }),
                                });
                                if (!res.ok) throw new Error('API error');
                                const data = await res.json();
                                addMessage({
                                  id: `msg-interview-${Date.now()}`,
                                  role: 'bot',
                                  timestamp: Date.now(),
                                  text: data.message || fallbackText,
                                  suggestions: [],
                                  quickQueries: data.quickQueries || fallbackQueries,
                                });
                              } catch {
                                addMessage({
                                  id: `msg-interview-${Date.now()}`,
                                  role: 'bot',
                                  timestamp: Date.now(),
                                  text: fallbackText,
                                  quickQueries: fallbackQueries,
                                });
                              } finally {
                                const ls = useStore.getState().loadingState;
                                const newCount = Math.max(0, (ls.requestCount || 0) - 1);
                                useStore.setState({ loadingState: { ...ls, active: newCount > 0, requestCount: newCount } });
                              }
                            })();
                          }
                        }}
                        className="px-3 py-1.5 rounded-full text-xs text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/20 hover:border-emerald-500/50 transition-colors"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
            );
          });
        })()}
        {ls.active && <LoadingIndicator />}
        <div ref={endRef} />
      </div>
      <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <div className="flex gap-2 mb-2">
          <label htmlFor="chat-input" className="sr-only">채팅 입력</label>
          <textarea data-tour="chat" id="chat-input" name="chat_input" aria-label="채팅 입력" ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isActiveOnboarding ? '온보딩 진행 중에는 채팅을 사용할 수 없어요.' : '질문하거나 아이디어를 요청하세요...'}
            disabled={ls.active || isActiveOnboarding} rows={3}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder-slate-500 bg-slate-800/60 border border-slate-700/50 focus:border-blue-500/50 focus:outline-none disabled:opacity-50 resize-none"
            style={{ minHeight: '72px', maxHeight: '150px' }} />
          <button onClick={handleSend} disabled={ls.active || isActiveOnboarding || !input.trim()} className="px-4 self-end py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 h-10">전송</button>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSaveIntermediate} className="flex-1 px-4 py-2 rounded-xl text-sm font-medium border border-slate-600/40 text-slate-300 hover:bg-slate-700/30">💾 중간저장</button>
          <button data-tour="complete" onClick={handleSubmit} disabled={saveStatus === 'complete'}
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
