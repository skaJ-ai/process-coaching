import React from 'react';
import { useStore } from '../store';
import { analyzeStructure } from '../utils/structRules';

export default function QualityDashboard() {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const addShape = useStore(s => s.addShape);
  const setFocusNodeId = useStore(s => s.setFocusNodeId);
  const validateAllNodes = useStore(s => s.validateAllNodes);

  const processNodes = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType));
  const total = processNodes.length || 0;
  if (total === 0) return null;

  const hasEnd = nodes.some(n => n.data.nodeType === 'end');
  const pass = processNodes.filter(n => n.data.l7Status === 'pass').length;
  const warn = processNodes.filter(n => n.data.l7Status === 'warning').length;
  const reject = processNodes.filter(n => n.data.l7Status === 'reject').length;
  const unchecked = processNodes.filter(n => !n.data.l7Status || n.data.l7Status === 'none').length;
  const struct = analyzeStructure(nodes, edges);
  // S-01: 종료 노드 없음 → 노드 3개 미만이면 억제
  // S-03(고아)·S-04(나가는 연결 없음) → 아직 종료 노드가 없는 작업 중엔 억제 (false positive 방지)
  const structIssues = struct.issues.filter(i => {
    if (i.ruleId === 'S-01' && total < 3) return false;
    if ((i.ruleId === 'S-03' || i.ruleId === 'S-04') && !hasEnd) return false;
    return true;
  });

  const pct = total > 0 ? Math.round(((pass + warn) / total) * 100) : 0;
  const barColor = reject > 0 ? '#f97316' : unchecked > 0 ? '#64748b' : '#22c55e';
  const addEndNode = () => {
    if (hasEnd) return;
    const maxY = nodes.reduce((acc, n) => Math.max(acc, n.position.y), 0);
    addShape('end', '종료', { x: 300, y: maxY + 180 });
  };

  return (
    <div className="px-4 py-3" style={{ background: 'rgba(15,23,41,0.5)', borderBottom: '1px solid var(--border-primary)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">품질 대시보드 (R/S)</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="flex gap-3 text-[10px] mb-2">
        {pass > 0 && <span className="text-green-400">✓ {pass} 준수</span>}
        {warn > 0 && <span className="text-amber-400">💡 {warn} 개선</span>}
        {reject > 0 && <span className="text-[#f97316]">✏ {reject} 추천</span>}
        {unchecked > 0 && (
          <button onClick={() => validateAllNodes()} className="text-slate-400 hover:text-violet-300 transition-colors">
            ○ {unchecked} 미검증 →검증
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {structIssues.length === 0 ? (
          <div className="text-[10px] text-green-400">구조(S): 주요 이상 없음</div>
        ) : (
          structIssues.map((issue) => {
            const focusFirst = () => {
              const id = issue.nodeIds?.[0];
              if (id) setFocusNodeId(id);
            };
            return (
              <div key={issue.ruleId} className="flex items-center gap-2 text-[10px]">
                <span className="text-amber-300">⚠ {issue.message}</span>
                {issue.ruleId === 'S-01' && (
                  <button onClick={addEndNode} className="px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/20">종료 노드 추가</button>
                )}
                {issue.ruleId !== 'S-01' && issue.nodeIds?.length ? (
                  <button onClick={focusFirst} className="px-2 py-0.5 rounded border border-blue-500/30 text-blue-300 hover:bg-blue-600/20">해당 노드 보기</button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
