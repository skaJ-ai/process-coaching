import React, { useState } from 'react';
import { useStore } from '../store';

export default function NodeDetailPanel() {
  const sel = useStore(s => s.selectedNodeId);
  const nodes = useStore(s => s.nodes);
  const setSel = useStore(s => s.setSelectedNodeId);
  const updateLabel = useStore(s => s.updateNodeLabel);
  const applyRewrite = useStore(s => s.applyL7Rewrite);
  const validate = useStore(s => s.validateNode);
  const del = useStore(s => s.deleteNode);
  const [editingRewrite, setEditingRewrite] = useState(false);
  const [editRewriteText, setEditRewriteText] = useState('');
  const node = nodes.find(n => n.id === sel);
  if (!node || node.data.nodeType === 'start' || node.data.nodeType === 'end') return null;
  const { l7Status, l7Issues, l7Rewrite, changeHistory } = node.data;
  const sc = { none: { c: '#64748b', l: '미검증' }, checking: { c: '#a855f7', l: '검증 중...' }, pass: { c: '#22c55e', l: '표준 준수' }, warning: { c: '#f59e0b', l: '개선 가능' }, reject: { c: '#f59e0b', l: 'AI 추천 있음' } }[l7Status || 'none']!;
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 animate-slide-up" style={{ background: 'linear-gradient(180deg, #1a2744, #0f1729)', borderTop: '1px solid #2a3a52', maxHeight: '40vh', overflow: 'auto' }}>
      <div className="flex items-center justify-between px-4 py-3 sticky top-0" style={{ background: '#1a2744', borderBottom: '1px solid #2a3a52' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full" style={{ background: sc.c }} />
          <span className="text-sm font-semibold text-slate-200 truncate max-w-[300px]">{node.data.label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: sc.c, border: `1px solid ${sc.c}40` }}>{sc.l}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => validate(node.id)} className="px-2 py-1 rounded text-[11px] text-purple-300 border border-purple-500/30 hover:bg-purple-600/20">L7 검증</button>
          <button onClick={() => { const l = prompt('수정:', node.data.label); if (l) updateLabel(node.id, l); }} className="px-2 py-1 rounded text-[11px] text-slate-400 border border-slate-600/30 hover:bg-slate-600/20">수정</button>
          <button onClick={() => { del(node.id); setSel(null); }} className="px-2 py-1 rounded text-[11px] text-red-400 border border-red-500/30 hover:bg-red-600/20">삭제</button>
          <button onClick={() => setSel(null)} className="px-2 py-1 rounded text-[11px] text-slate-500 hover:text-slate-300">✕</button>
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">
        {l7Issues && l7Issues.length > 0 && <div>
          <div className="text-xs text-slate-500 font-medium mb-2">검증 결과</div>
          {l7Issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-xs px-3 py-2 rounded mb-1" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <span className="flex-shrink-0 px-1 py-0.5 rounded text-[9px] font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>{issue.friendlyTag || issue.ruleId}</span>
              <div className="flex-1"><div className="text-slate-300">{issue.message}</div>{issue.suggestion && <div className="text-slate-500 mt-0.5">→ {issue.suggestion}</div>}</div>
            </div>
          ))}
        </div>}
        {l7Rewrite && <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          {!editingRewrite ? (
            <>
              <div className="flex-1"><div className="text-[10px] text-green-500 font-medium mb-1">💡 AI 추천</div><div className="text-xs text-slate-300 mb-0.5 line-through opacity-50">{node.data.label}</div><div className="text-sm text-green-300 font-medium">{l7Rewrite}</div></div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button onClick={() => applyRewrite(node.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600/20 border border-green-500/40 text-green-300 hover:bg-green-600/40">적용</button>
                <button onClick={() => { setEditRewriteText(l7Rewrite || ''); setEditingRewrite(true); }} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-600/40 hover:bg-slate-700/30">수정</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1">
                <input id={`node-rewrite-${node.id}`} name={`node_rewrite_${node.id}`} aria-label="노드 추천 문구 수정" value={editRewriteText} onChange={e => setEditRewriteText(e.target.value)} className="w-full text-xs bg-slate-800/60 border border-slate-600/50 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-green-500/50 mb-2" />
                <div className="flex gap-1">
                  <button onClick={() => { updateLabel(node.id, editRewriteText, 'user'); applyRewrite(node.id); setEditingRewrite(false); }} className="px-2 py-1 rounded text-[10px] font-semibold bg-green-600/20 border border-green-500/40 text-green-300 hover:bg-green-600/40">적용</button>
                  <button onClick={() => setEditingRewrite(false)} className="px-2 py-1 rounded text-[10px] text-slate-400 border border-slate-600/40 hover:bg-slate-700/30">취소</button>
                </div>
              </div>
            </>
          )}
        </div>}
        {/* Change History */}
        {changeHistory && changeHistory.length > 0 && <div>
          <div className="text-xs text-slate-500 font-medium mb-2">변경 이력</div>
          {changeHistory.slice().reverse().slice(0, 5).map((h, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] mb-1">
              <span className="text-slate-600">{new Date(h.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="px-1 py-0.5 rounded text-[9px]" style={{ background: h.source === 'ai' ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)', color: h.source === 'ai' ? '#c084fc' : '#60a5fa' }}>{h.source === 'ai' ? 'AI' : '사용자'}</span>
              <span className="text-slate-500 line-through truncate max-w-[120px]">{h.before}</span>
              <span className="text-slate-500">→</span>
              <span className="text-slate-300 truncate max-w-[120px]">{h.after}</span>
            </div>
          ))}
        </div>}
        {l7Status === 'none' && !changeHistory?.length && <div className="text-xs text-slate-500 text-center py-4">L7 검증을 실행하면 결과가 여기에 표시됩니다.</div>}
      </div>
    </div>
  );
}
