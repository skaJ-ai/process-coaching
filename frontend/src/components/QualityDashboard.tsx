import React, { useState } from 'react';
import { useStore } from '../store';
import { analyzeStructure } from '../utils/structRules';

export default function QualityDashboard() {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const setFocusNodeId = useStore(s => s.setFocusNodeId);
  const validateAllNodes = useStore(s => s.validateAllNodes);

  const [nodeNavIndex, setNodeNavIndex] = useState<Record<string, number>>({});

  const processNodes = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType));
  const total = processNodes.length || 0;
  // T-06: 노드 0개일 때 null 대신 안내 메시지 표시
  if (total === 0) {
    return (
      <div className="px-4 py-3" style={{ background: 'rgba(15,23,41,0.5)', borderBottom: '1px solid var(--border-primary)' }}>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">품질 대시보드 (R/S)</span>
        <div className="mt-2 text-[10px] text-slate-500">셰이프를 추가하면 L7 품질을 확인할 수 있어요.</div>
      </div>
    );
  }

  const hasEnd = nodes.some(n => n.data.nodeType === 'end');
  const pass = processNodes.filter(n => n.data.l7Status === 'pass').length;
  const warn = processNodes.filter(n => n.data.l7Status === 'warning').length;
  const reject = processNodes.filter(n => n.data.l7Status === 'reject').length;
  const unchecked = processNodes.filter(n => !n.data.l7Status || n.data.l7Status === 'none').length;
  const struct = analyzeStructure(nodes, edges);
  // S-01(종료 노드 없음) → 완료하기/전체 흐름 검토 시점에만 안내, 대시보드에서는 억제
  // S-03(고아) → 종료 노드 없는 작업 중엔 억제
  // S-04(나가는 연결 없음) → 연결이 하나라도 있으면 OK 정책이므로 항상 억제
  const structIssues = struct.issues.filter(i => {
    if (i.ruleId === 'S-01') return false;
    if (i.ruleId === 'S-03' && !hasEnd) return false;
    if (i.ruleId === 'S-04') return false;
    return true;
  });

  const pct = total > 0 ? Math.round(((pass + warn) / total) * 100) : 0;
  const barColor = reject > 0 ? '#f97316' : unchecked > 0 ? '#64748b' : '#22c55e';

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
            const ids = issue.nodeIds || [];
            const currentIdx = nodeNavIndex[issue.ruleId] ?? 0;
            const focusNode = () => {
              if (!ids.length) return;
              const idx = currentIdx % ids.length;
              setFocusNodeId(ids[idx]);
              setNodeNavIndex((prev) => ({ ...prev, [issue.ruleId]: (idx + 1) % ids.length }));
            };
            return (
              <div key={issue.ruleId} className="flex items-center gap-2 text-[10px]">
                <span className="text-amber-300">⚠ {issue.message}</span>
                {ids.length > 0 && (
                  <button onClick={focusNode} className="px-2 py-0.5 rounded border border-blue-500/30 text-blue-300 hover:bg-blue-600/20">
                    해당 노드 보기{ids.length > 1 ? ` (${(currentIdx % ids.length) + 1}/${ids.length})` : ''}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
