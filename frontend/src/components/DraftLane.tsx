import React from 'react';
import { useStore } from '../store';
import { analyzeStructure } from '../utils/structRules';

export default function DraftLane() {
  const draftItems = useStore((s) => s.draftItems);
  const removeFromDraft = useStore((s) => s.removeFromDraft);
  const applyDraftItem = useStore((s) => s.applyDraftItem);
  const clearDraft = useStore((s) => s.clearDraft);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const mode = useStore((s) => s.mode);

  if (draftItems.length === 0) return null;

  const structIssues = analyzeStructure(nodes, edges, mode).issues;
  const hasStructIssue = structIssues.length > 0;

  return (
    <div
      className="flex-shrink-0 px-4 py-3 border-t border-b"
      style={{ borderColor: 'var(--border-primary)', background: 'rgba(168,85,247,0.05)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
          📥 임시 보관 <span className="text-[10px] text-violet-400/70 bg-violet-900/30 px-1.5 py-0.5 rounded-full">{draftItems.length}</span>
        </span>
        <button
          onClick={clearDraft}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          전체 제거
        </button>
      </div>
      <div className="space-y-1.5">
        {draftItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)' }}
          >
            <span className="text-xs text-violet-200 flex-1 truncate">
              {item.suggestion.type === 'DECISION' ? '◇' : '+'} {item.suggestion.labelSuggestion || item.suggestion.summary}
            </span>
            <button
              onClick={() => applyDraftItem(item.id)}
              className="flex-shrink-0 px-2 py-0.5 rounded text-[11px] font-medium text-emerald-300 bg-emerald-900/20 border border-emerald-700/40 hover:bg-emerald-900/40 transition-colors"
            >
              끝에 추가
            </button>
            <button
              onClick={() => removeFromDraft(item.id)}
              className="flex-shrink-0 text-[10px] text-slate-500 hover:text-slate-300 px-1 transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {hasStructIssue && (
        <div className="mt-2 text-[10px] text-amber-400/80 flex items-center gap-1">
          ⚠ 적용 후 구조 이슈 {structIssues.length}개 — Quality 패널에서 확인하세요
        </div>
      )}
    </div>
  );
}
