import React, { useEffect, useState } from 'react';
import { useStore } from '../store';

export default function LoadingIndicator() {
  const ls = useStore(s => s.loadingState);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!ls.active) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - ls.startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [ls.active, ls.startTime]);
  if (!ls.active) return null;
  const getPhaseMsg = () => {
    if (elapsed < 5) return '분석 중...';
    if (elapsed < 15) return '라벨 품질을 꼼꼼히 살펴보는 중...';
    if (elapsed < 30) return '거의 다 됐어요. 마지막 검토 중...';
    return '조금 더 걸릴 수 있어요. 복잡한 내용을 분석하고 있어요.';
  };
  const msg = ls.message + ' ' + getPhaseMsg();
  const pct = Math.min(95, (elapsed / 30) * 100);
  return (
    <div className="flex items-start gap-2 animate-fade-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><span className="text-xs">🤖</span></div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" /><span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} /></div>
          <span className="text-xs text-slate-400">{msg}</span>
        </div>
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(59,130,246,0.15)' }}><div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: '#3b82f6' }} /></div>
      </div>
    </div>
  );
}
