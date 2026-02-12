import React from 'react';
import { useStore } from '../store';

export default function QualityDashboard() {
  const nodes = useStore(s => s.nodes);
  const validateAll = useStore(s => s.validateAllNodes);
  const ls = useStore(s => s.loadingState);

  const processNodes = nodes.filter(n => ['process','decision','subprocess'].includes(n.data.nodeType));
  const total = processNodes.length;
  if (total === 0) return null;

  const pass = processNodes.filter(n => n.data.l7Status === 'pass').length;
  const warn = processNodes.filter(n => n.data.l7Status === 'warning').length;
  const reject = processNodes.filter(n => n.data.l7Status === 'reject').length;
  const unchecked = processNodes.filter(n => !n.data.l7Status || n.data.l7Status === 'none').length;
  const checking = processNodes.filter(n => n.data.l7Status === 'checking').length;

  const pct = total > 0 ? Math.round(((pass + warn) / total) * 100) : 0;
  const barColor = reject > 0 ? '#f59e0b' : unchecked > 0 ? '#64748b' : '#22c55e';

  return (
    <div className="px-4 py-3" style={{ background: 'rgba(15,23,41,0.5)', borderBottom: '1px solid var(--border-primary)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">L7 품질</span>
        <button onClick={validateAll} disabled={ls.active || total === 0}
          className="text-[10px] px-2 py-0.5 rounded text-purple-400 border border-purple-500/30 hover:bg-purple-600/20 disabled:opacity-30">
          {checking > 0 ? '검증 중...' : '전체 검증'}
        </button>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="flex gap-3 text-[10px]">
        {pass > 0 && <span className="text-green-400">✓ {pass} 준수</span>}
        {warn > 0 && <span className="text-amber-400">💡 {warn} 개선</span>}
        {reject > 0 && <span className="text-orange-400">✏ {reject} 추천</span>}
        {unchecked > 0 && <span className="text-slate-500">○ {unchecked} 미검증</span>}
        {checking > 0 && <span className="text-purple-400 animate-pulse">⟳ {checking}</span>}
      </div>
    </div>
  );
}
