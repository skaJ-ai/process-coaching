import React, { useState } from 'react';
import { useStore } from '../store';
import { analyzeStructure } from '../utils/structRules';
import type { LoadingState } from '../types';

export default function QualityDashboard() {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const setFocusNodeId = useStore(s => s.setFocusNodeId);
  const validateAllNodes = useStore(s => s.validateAllNodes);
  const ls = useStore(s => s.loadingState) as LoadingState;

  const [nodeNavIndex, setNodeNavIndex] = useState<Record<string, number>>({});
  const [dismissedRules, setDismissedRules] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const dismiss = (ruleId: string) =>
    setDismissedRules(prev => [...prev, ruleId]);

  const processNodes = nodes.filter(n => ['process', 'decision'].includes(n.data.nodeType));
  const total = processNodes.length || 0;

  if (total === 0) {
    return (
      <div className="px-4 py-2.5" style={{ background: 'rgba(15,23,41,0.5)', borderBottom: '1px solid var(--border-primary)' }}>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">품질 대시보드</span>
        <div className="mt-1 text-[10px] text-slate-500">셰이프를 추가하면 L7 품질을 확인할 수 있어요.</div>
      </div>
    );
  }

  const hasEnd = nodes.some(n => n.data.nodeType === 'end');
  const pass = processNodes.filter(n => n.data.l7Status === 'pass').length;
  const warn = processNodes.filter(n => n.data.l7Status === 'warning').length;
  const reject = processNodes.filter(n => n.data.l7Status === 'reject').length;
  const unchecked = processNodes.filter(n => !n.data.l7Status || n.data.l7Status === 'none').length;
  const struct = analyzeStructure(nodes, edges);
  const structIssues = struct.issues.filter(i => {
    if (i.ruleId === 'S-01') return false;
    if (i.ruleId === 'S-03' && !hasEnd) return false;
    if (i.ruleId === 'S-04') return false;
    if (dismissedRules.includes(i.ruleId)) return false;
    return true;
  });

  // 메타데이터 힌트: process 노드만 (subprocess 제외)
  const processOnlyNodes = nodes.filter(n => n.data.nodeType === 'process');
  const noSystemName = processOnlyNodes.filter(n => !n.data.systemName?.trim()).length;
  const noDuration = processOnlyNodes.filter(n => !n.data.duration?.trim()).length;
  const showMetaHint = processOnlyNodes.length >= 5 && (noSystemName > 0 || noDuration > 0);

  const pct = total > 0 ? Math.round(((pass + warn) / total) * 100) : 0;
  const barColor = reject > 0 ? '#f97316' : unchecked > 0 ? '#64748b' : '#22c55e';
  const hasIssues = structIssues.length > 0 || showMetaHint;
  const hasAlert = reject > 0 || structIssues.length > 0;

  return (
    <div style={{ background: 'rgba(15,23,41,0.5)', borderBottom: '1px solid var(--border-primary)', borderLeft: hasAlert && !isExpanded ? '3px solid #f97316' : '3px solid transparent' }}>
      {/* 항상 표시: 헤더 + 게이지 + 뱃지 */}
      <div className="px-4 pt-2.5 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">품질 대시보드</span>
            {hasAlert && !isExpanded && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
            )}
          </div>
          <button
            onClick={() => setIsExpanded(v => !v)}
            className={`text-[10px] transition-colors px-1 ${hasAlert && !isExpanded ? 'text-orange-400 hover:text-orange-300 font-semibold' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {isExpanded ? '▲ 접기' : `▼ 상세${hasIssues ? ' ⚠' : ''}`}
          </button>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-1.5">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <div className="flex gap-3 text-[10px]">
          {pass > 0 && <span className="text-green-400">✓ {pass} 준수</span>}
          {warn > 0 && <span className="text-amber-400">💡 {warn} 개선가능</span>}
          {reject > 0 && <span className="text-[#f97316]">✏ {reject} 추천</span>}
          {unchecked > 0 && (
            <>
              <span className="text-slate-500">○ {unchecked} 미검증</span>
              <button
                onClick={() => validateAllNodes()}
                disabled={ls.active}
                className="px-2 py-0.5 rounded border border-violet-500/40 text-violet-300 hover:bg-violet-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {ls.active ? '⚙ 검증 중...' : '검증하기'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 펼쳤을 때만 표시: 구조 이슈 + 메타데이터 힌트 */}
      {isExpanded && (
        <div className="px-4 pb-2.5 space-y-1.5 border-t border-slate-700/40 pt-2">
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
                <div key={issue.ruleId} className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-amber-300 flex-1">⚠ {issue.message}</span>
                  {ids.length > 0 && (
                    <button onClick={focusNode} className="px-1.5 py-0.5 rounded border border-blue-500/30 text-blue-300 hover:bg-blue-600/20 flex-shrink-0">
                      보기{ids.length > 1 ? ` (${(currentIdx % ids.length) + 1}/${ids.length})` : ''}
                    </button>
                  )}
                  <button
                    onClick={() => dismiss(issue.ruleId)}
                    title="이 경고 무시하기"
                    className="px-1.5 py-0.5 rounded border border-slate-600/40 text-slate-500 hover:text-slate-300 hover:bg-slate-700/30 flex-shrink-0"
                  >
                    무시
                  </button>
                </div>
              );
            })
          )}
          {showMetaHint && (
            <div className="pt-1.5 border-t border-slate-700/50 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">메타데이터</span>
              {noSystemName > 0 && (
                <button
                  onClick={() => {
                    const targets = processOnlyNodes.filter(n => !n.data.systemName?.trim());
                    const idx = ((nodeNavIndex['meta-sys'] ?? -1) + 1) % targets.length;
                    setNodeNavIndex(prev => ({ ...prev, 'meta-sys': idx }));
                    setFocusNodeId(targets[idx]?.id);
                  }}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-300 transition-colors w-full text-left"
                >
                  <span>📋 시스템명 미입력 {noSystemName}개</span>
                  <span className="text-slate-600">— 클릭하여 이동</span>
                </button>
              )}
              {noDuration > 0 && (
                <button
                  onClick={() => {
                    const targets = processOnlyNodes.filter(n => !n.data.duration?.trim());
                    const idx = ((nodeNavIndex['meta-dur'] ?? -1) + 1) % targets.length;
                    setNodeNavIndex(prev => ({ ...prev, 'meta-dur': idx }));
                    setFocusNodeId(targets[idx]?.id);
                  }}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-300 transition-colors w-full text-left"
                >
                  <span>⏱ 소요시간 미입력 {noDuration}개</span>
                  <span className="text-slate-600">— 클릭하여 이동</span>
                </button>
              )}
              <div className="text-[9px] text-slate-600 italic">채우면 PDD 분석이 더 정확해져요</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
