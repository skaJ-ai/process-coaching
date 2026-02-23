import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { CATEGORY_COLORS } from '../constants';
import { API_BASE_URL } from '../constants';

interface PddInsights {
  summary: string;
  inefficiencies: { step: string; issue: string; impact: string }[];
  digitalWorker: { step: string; reason: string; type: string }[];
  sscCandidates: { step: string; reason: string }[];
  redesign: { suggestion: string; benefit: string }[];
}

export default function PDDGenerator({ onClose }: { onClose: () => void }) {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const ctx = useStore(s => s.processContext);
  const swimLanes = useMemo(() => {
    const laneIds = [...new Set(nodes.map(n => n.data.swimLaneId).filter(Boolean))];
    return laneIds.map(id => ({ id: id!, label: id! }));
  }, [nodes]);
  const [pddContent, setPddContent] = useState('');
  const [insights, setInsights] = useState<PddInsights | null>(() => {
    // 이전 인사이트 복원
    try {
      const saved = sessionStorage.getItem('pdd-insights');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [insightsLoading, setInsightsLoading] = useState(false);

  const generatePDD = () => {
    const processNodes = nodes.filter(n => ['process','decision','subprocess'].includes(n.data.nodeType));
    const sorted = [...processNodes].sort((a, b) => (a.data.stepNumber || 0) - (b.data.stepNumber || 0));

    let md = `# 프로세스 정의서 (PDD)\n\n`;
    md += `## 기본 정보\n\n`;
    md += `| 항목 | 내용 |\n|------|------|\n`;
    md += `| L4 모듈 | ${ctx?.l4 || '-'} |\n`;
    md += `| L5 단위업무 | ${ctx?.l5 || '-'} |\n`;
    md += `| L6 상세활동 | ${ctx?.processName || '-'} |\n`;
    md += `| 시작 트리거 | ${nodes.find(n=>n.id==='start')?.data.label || '-'} |\n`;
    md += `| 종료 상태 | ${nodes.find(n=>n.id==='end')?.data.label || '-'} |\n`;
    md += `| 총 단계 수 | ${processNodes.length} |\n`;
    md += `| 생성일 | ${new Date().toLocaleDateString('ko-KR')} |\n\n`;

    if (swimLanes.length > 0) {
      md += `## 역할 분담\n\n| 역할 | 담당 태스크 수 |\n|------|----------------|\n`;
      for (const lane of swimLanes) {
        const count = processNodes.filter(n => n.data.swimLaneId === lane.id).length;
        md += `| ${lane.label} | ${count} |\n`;
      }
      const unassigned = processNodes.filter(n => !n.data.swimLaneId).length;
      if (unassigned > 0) md += `| (미지정) | ${unassigned} |\n`;
      md += `\n`;
    }

    const catLabels: Record<string, string> = { as_is: 'As-Is 유지', digital_worker: 'Digital Worker', ssc_transfer: 'SSC 이관', delete_target: '삭제 대상', new_addition: '신규 추가' };
    const catCounts: Record<string, number> = {};
    processNodes.forEach(n => { const c = n.data.category || 'as_is'; catCounts[c] = (catCounts[c] || 0) + 1; });
    if (Object.keys(catCounts).length > 1 || !catCounts['as_is']) {
      md += `## 분류 현황\n\n| 분류 | 태스크 수 |\n|------|----------|\n`;
      for (const [k, v] of Object.entries(catCounts)) md += `| ${catLabels[k] || k} | ${v} |\n`;
      md += `\n`;
    }

    md += `## 단계별 상세\n\n`;
    for (const node of sorted) {
      const num = node.data.stepNumber || '?';
      const typeLabel = ({ process: '태스크', decision: '판단', subprocess: 'L6 프로세스' } as any)[node.data.nodeType] || '';
      const lane = swimLanes.find(l => l.id === node.data.swimLaneId);
      const catLabel = catLabels[(node.data.category || 'as_is')];
      const outEdges = edges.filter(e => e.source === node.id);
      md += `### ${num}. ${node.data.label}\n\n`;
      md += `- **유형:** ${typeLabel}\n`;
      if (lane) md += `- **담당:** ${lane.label}\n`;
      if (node.data.category && node.data.category !== 'as_is') md += `- **분류:** ${catLabel}\n`;
      if (node.data.inputLabel) md += `- **인풋:** ${node.data.inputLabel}\n`;
      if (node.data.outputLabel) md += `- **아웃풋:** ${node.data.outputLabel}\n`;
      if (node.data.systemName) md += `- **시스템:** ${node.data.systemName}\n`;
      if (outEdges.length > 0) {
        md += `- **후속:** ` + outEdges.map(e => { const t = nodes.find(n => n.id === e.target); return `${e.label ? `[${e.label}] ` : ''}→ ${t?.data.label || e.target}`; }).join(', ') + `\n`;
      }
      if (node.data.l7Status === 'pass') md += `- **L7:** ✅ 표준 준수\n`;
      else if (node.data.l7Status === 'warning') md += `- **L7:** 💡 개선 가능\n`;
      else if (node.data.l7Status === 'reject') md += `- **L7:** ✏️ AI 추천 있음\n`;
      md += `\n`;
    }

    const systems = [...new Set(processNodes.map(n => n.data.systemName).filter(Boolean))];
    if (systems.length > 0) { md += `## 관련 시스템\n\n`; systems.forEach(s => { md += `- ${s}\n`; }); md += `\n`; }

    setPddContent(md);
  };

  const generateInsights = async () => {
    setInsightsLoading(true);
    try {
      const processNodes = nodes.filter(n => ['process', 'decision', 'subprocess'].includes(n.data.nodeType));
      const r = await fetch(`${API_BASE_URL}/pdd-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentNodes: processNodes.map(n => ({ id: n.id, type: n.data.nodeType, label: n.data.label, category: n.data.category, swimLaneId: n.data.swimLaneId })), currentEdges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label })), context: ctx || {} }),
      });
      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status}: ${errText.slice(0, 100)}`);
      }
      const data = await r.json();
      setInsights(data);
      // 인사이트 저장
      try {
        sessionStorage.setItem('pdd-insights', JSON.stringify(data));
      } catch (e) {
        console.warn('Failed to save insights:', e);
      }
    } catch (e) {
      console.error('PDD insights error:', e);
      alert(`⚠️ AI 인사이트 생성 실패\n\n${e instanceof Error ? e.message : '백엔드 서버가 실행 중인지 확인해주세요.'}`);
    }
    finally { setInsightsLoading(false); }
  };

  const impactColor = (impact: string) => impact === 'high' ? 'text-red-400' : impact === 'medium' ? 'text-amber-400' : 'text-slate-400';

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-[700px] max-h-[80vh] rounded-xl overflow-hidden flex flex-col animate-fade-in"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <h3 className="text-sm font-bold text-slate-200">📄 프로세스 정의서 (PDD) 생성</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
        {!pddContent ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-sm text-slate-400 mb-4 text-center">현재 플로우를 기반으로<br/>프로세스 정의서를 자동 생성합니다.</p>
            <button onClick={generatePDD} className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500">PDD 생성하기</button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{pddContent}</pre>
            </div>
            {insights && (
              <div className="px-6 py-4 space-y-3 max-h-[300px] overflow-y-auto" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <p className="text-xs font-semibold text-indigo-300 mb-1">🔍 AI 전략 인사이트</p>
                <p className="text-xs text-slate-400 leading-relaxed">{insights.summary}</p>
                {insights.inefficiencies.length > 0 && (
                  <div><p className="text-[11px] font-medium text-amber-400 mb-1">⚠ 비효율 구간</p>
                    {insights.inefficiencies.map((i, idx) => <p key={idx} className="text-xs text-slate-300">· <span className="font-medium">{i.step}</span> — {i.issue} <span className={`text-[10px] ${impactColor(i.impact)}`}>[{i.impact}]</span></p>)}
                  </div>
                )}
                {insights.digitalWorker.length > 0 && (
                  <div><p className="text-[11px] font-medium text-blue-400 mb-1">🤖 Digital Worker 전환 후보</p>
                    {insights.digitalWorker.map((i, idx) => <p key={idx} className="text-xs text-slate-300">· <span className="font-medium">{i.step}</span> ({i.type}) — {i.reason}</p>)}
                  </div>
                )}
                {insights.sscCandidates.length > 0 && (
                  <div><p className="text-[11px] font-medium text-emerald-400 mb-1">🏢 SSC 이관 후보</p>
                    {insights.sscCandidates.map((i, idx) => <p key={idx} className="text-xs text-slate-300">· <span className="font-medium">{i.step}</span> — {i.reason}</p>)}
                  </div>
                )}
                {insights.redesign.length > 0 && (
                  <div><p className="text-[11px] font-medium text-violet-400 mb-1">♻ Process Redesign</p>
                    {insights.redesign.map((i, idx) => <p key={idx} className="text-xs text-slate-300">· {i.suggestion} <span className="text-slate-500">→ {i.benefit}</span></p>)}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
              <button onClick={generateInsights} disabled={insightsLoading} className="px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 disabled:opacity-40 whitespace-nowrap">
                {insightsLoading ? '분석 중...' : '🔍 AI 인사이트'}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(pddContent); alert('클립보드에 복사되었습니다.'); }} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700/30 border border-slate-600/40 text-slate-300">📋 복사</button>
              <button onClick={() => { const b = new Blob([pddContent], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `PDD-${ctx?.processName || 'process'}.md`; a.click(); }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-green-600/20 border border-green-500/30 text-green-300">💾 MD 다운로드</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
