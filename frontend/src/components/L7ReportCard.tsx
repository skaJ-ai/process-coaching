import React, { useState } from 'react';
import { L7ReportItem } from '../types';
import { useStore } from '../store';

export default function L7ReportCard({ item }: { item: L7ReportItem }) {
  const applyL7Rewrite = useStore(s => s.applyL7Rewrite);
  const updateNodeLabel = useStore(s => s.updateNodeLabel);
  const setFocusNodeId = useStore(s => s.setFocusNodeId);
  const [applied, setApplied] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.rewriteSuggestion || '');

  const sc = item.pass
    ? (item.issues.some(i => i.severity === 'warning')
      ? { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)', icon: '💬', label: '개선 제안' }
      : { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', icon: '✓', label: '표준 준수' })
    : { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)', icon: '💬', label: '개선 제안' };

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: sc.bg, border: `1px solid ${sc.border}`, cursor: 'pointer' }} onClick={() => setFocusNodeId(item.nodeId)}>
      {item.llm_failed && item.warning && (
        <div className="px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <div className="text-xs text-yellow-300">{item.warning}</div>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2" onClick={(e) => { e.stopPropagation(); setShowDetail(!showDetail); }}>
        <span style={{ color: sc.color, fontSize: 14 }}>{sc.icon}</span>
        <span className="text-xs font-medium text-slate-300 flex-1 truncate">{item.nodeLabel}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
        <span className="text-[10px] text-slate-500">{showDetail ? '▲' : '▼'}</span>
      </div>
      {showDetail && (item.issues.length > 0 || item.rewriteSuggestion || item.encouragement) && (
        <div className="px-3 pb-2 space-y-2">
          {item.issues.map((issue, i) => (
            <div key={i} className="text-xs">
              <div className="flex items-start gap-1.5 mb-1">
                <span className="flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
                  style={{ background: issue.severity === 'reject' ? 'rgba(96,165,250,0.15)' : 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>
                  {issue.friendlyTag || issue.ruleId}
                </span>
                <span className="text-slate-300">{issue.message}</span>
              </div>
              {issue.reasoning && <div className="ml-8 text-slate-400 text-[11px] italic">{issue.reasoning}</div>}
            </div>
          ))}
          {item.encouragement && (
            <div className="px-2 py-1.5 rounded text-xs text-green-300" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
              ✨ {item.encouragement}
            </div>
          )}
        </div>
      )}
      {item.rewriteSuggestion && !applied && (
        <div className="px-3 pb-2">
          <div className="p-2 rounded" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            {!editing ? (
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-[10px] text-green-500 font-medium mb-0.5">AI 추천</div>
                  <div className="text-xs text-green-300">{item.rewriteSuggestion}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => { updateNodeLabel(item.nodeId, item.rewriteSuggestion!, 'ai'); applyL7Rewrite(item.nodeId); setApplied(true); }}
                    className="px-2 py-1 rounded text-[10px] font-semibold bg-green-600/20 border border-green-500/40 text-green-300 hover:bg-green-600/40">적용</button>
                  <button onClick={() => setEditing(true)} className="px-2 py-1 rounded text-[10px] text-slate-400 border border-slate-600/40 hover:bg-slate-700/30">수정</button>
                </div>
              </div>
            ) : (
              <div>
                <input value={editText} onChange={e => setEditText(e.target.value)} className="w-full text-xs bg-slate-800/60 border border-slate-600/50 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-green-500/50 mb-1.5" />
                <div className="flex gap-1">
                  <button onClick={() => { updateNodeLabel(item.nodeId, editText, 'user'); setApplied(true); }} className="px-2 py-1 rounded text-[10px] font-semibold bg-green-600/20 border border-green-500/40 text-green-300">적용</button>
                  <button onClick={() => setEditing(false)} className="px-2 py-1 rounded text-[10px] text-slate-400 border border-slate-600/40">취소</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {applied && <div className="px-3 pb-2 text-xs text-green-400">✓ 적용 완료</div>}
    </div>
  );
}
