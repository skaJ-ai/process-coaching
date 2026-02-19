import React, { useState } from 'react';
import { Suggestion } from '../types';
import { useStore } from '../store';
import { detectCompoundAction } from '../utils/labelUtils';

export default function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const applySuggestion = useStore(s => s.applySuggestion);
  const applySuggestionWithEdit = useStore(s => s.applySuggestionWithEdit);
  const setFocusNodeId = useStore(s => s.setFocusNodeId);
  const nodes = useStore(s => s.nodes);
  const [applied, setApplied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(suggestion.newLabel || suggestion.summary);

  const action = suggestion.action || 'ADD';
  const target = suggestion.targetNodeId ? nodes.find(n => n.id === suggestion.targetNodeId) : null;
  const focusRefId = suggestion.targetNodeId || suggestion.insertAfterNodeId || null;
  const focusRefNode = focusRefId ? nodes.find(n => n.id === focusRefId) : null;

  const cfg = {
    ADD: { icon: suggestion.type === 'DECISION' ? '◇' : '+', label: '추가', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#60a5fa' },
    MODIFY: { icon: '✏', label: '수정', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24' },
    DELETE: { icon: '✕', label: '삭제', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#f87171' },
  }[action];

  if (applied) return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
      <span className="text-green-400">✓</span>
      <span className="text-green-300 opacity-70">{cfg.label} 완료</span>
    </div>
  );

  const hasLabel = !!(suggestion.labelSuggestion || suggestion.newLabel);

  const handleApply = () => {
    if (suggestion.action === 'ADD' && !hasLabel) {
      setEditing(true);
      return;
    }
    if (suggestion.action === 'ADD' && hasLabel) {
      const label = suggestion.labelSuggestion || suggestion.newLabel!;
      const detection = detectCompoundAction(label);
      if (detection.isCompound) {
        const msg = `이 추천에는 2개의 동작이 포함되어 있어요:\n• ${detection.parts[0]}\n• ${detection.parts[1]}\n\n셰이프를 나누어 추가하는 것을 권장합니다.`;
        alert(msg);
      }
    }
    applySuggestion(suggestion);
    setApplied(true);
  };
  const handleApplyEdited = () => { applySuggestionWithEdit(suggestion, editText); setApplied(true); };

  return (
    <div className="rounded-lg transition-all" style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '10px 14px' }}>
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none mt-0.5 flex-shrink-0" style={{ color: cfg.text }}>{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          {action === 'MODIFY' && target ? (
            <>
              <div className="text-xs text-slate-500 line-through mb-1">{target.data.label}</div>
              {!editing ? (
                <div className="text-sm font-medium" style={{ color: cfg.text }}>{suggestion.newLabel || suggestion.summary}</div>
              ) : (
                <input name="suggestion_edit_modify" aria-label="수정 제안 편집" value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                  className="w-full text-sm bg-slate-800/60 border border-slate-600/50 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500/50"
                  onKeyDown={e => e.key === 'Enter' && handleApplyEdited()} />
              )}
            </>
          ) : action === 'DELETE' && target ? (
            <div className="text-sm font-medium" style={{ color: cfg.text }}>"{target.data.label}" 삭제</div>
          ) : !editing ? (
            <>
              <div className="text-sm font-medium" style={{ color: cfg.text }}>{suggestion.summary}</div>
              {suggestion.labelSuggestion && (
                <div className="text-xs text-slate-500 mt-1">셰이프 라벨: <span className="text-slate-300 font-medium">{suggestion.labelSuggestion}</span></div>
              )}
            </>
          ) : (
            <input name="suggestion_edit_add" aria-label="추가 제안 편집" value={editText} onChange={e => setEditText(e.target.value)} autoFocus
              className="w-full text-sm bg-slate-800/60 border border-slate-600/50 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500/50"
              onKeyDown={e => e.key === 'Enter' && handleApplyEdited()} />
          )}
          {suggestion.confidence && suggestion.confidence !== 'high' && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                suggestion.confidence === 'medium' ? 'bg-blue-900/30 text-blue-300 border border-blue-700/40' :
                'bg-slate-800/50 text-slate-400 border border-slate-700/40'
              }`}>
                {suggestion.confidence === 'medium' ? '검토 후 적용' : '참고용'}
              </span>
            </div>
          )}
          {suggestion.reason && <div className="text-xs text-slate-400 mt-1">{suggestion.reason}</div>}
          {suggestion.reasoning && suggestion.reasoning !== suggestion.reason && <div className="text-xs text-slate-500 mt-1 italic">{suggestion.reasoning}</div>}
          {suggestion.branches && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {suggestion.branches.yes && <span className="text-xs px-2 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-800/40">Yes → {suggestion.branches.yes.summary}</span>}
              {suggestion.branches.no && <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/40">No → {suggestion.branches.no.summary}</span>}
            </div>
          )}
        </div>
      </div>
      {/* Action buttons */}
      <div className="flex gap-1.5 mt-2 ml-7 flex-wrap">
        {focusRefNode && !applied && (
          <button
            onClick={() => setFocusNodeId(focusRefId)}
            title={`"${focusRefNode.data.label}" 위치로 이동`}
            className="px-2.5 py-1 rounded text-[11px] text-slate-400 border border-slate-600/40 hover:bg-slate-700/30 hover:text-slate-200"
          >
            ⌖ 위치 보기
          </button>
        )}
        {!editing ? (
          <>
            <button onClick={handleApply} className="px-2.5 py-1 rounded text-[11px] font-medium transition-all" style={{ background: `${cfg.text}20`, color: cfg.text, border: `1px solid ${cfg.border}` }}>
              {action === 'MODIFY' ? 'AI 추천 적용' : action === 'DELETE' ? '삭제' : '추가'}
            </button>
            {action !== 'DELETE' && (
              <button onClick={() => setEditing(true)} className="px-2.5 py-1 rounded text-[11px] text-slate-400 border border-slate-600/40 hover:bg-slate-700/30">
                ✏ 직접 수정
              </button>
            )}
          </>
        ) : (
          <>
            <button onClick={handleApplyEdited} className="px-2.5 py-1 rounded text-[11px] font-medium bg-green-600/20 border border-green-500/40 text-green-300 hover:bg-green-600/40">적용</button>
            <button onClick={() => setEditing(false)} className="px-2.5 py-1 rounded text-[11px] text-slate-400 border border-slate-600/40">취소</button>
          </>
        )}
      </div>
    </div>
  );
}
