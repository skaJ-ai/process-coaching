import React, { useState } from 'react';

interface Props {
  nodeId: string;
  initial: { inputLabel?: string; outputLabel?: string; systemName?: string; duration?: string };
  onSave: (nodeId: string, meta: { inputLabel?: string; outputLabel?: string; systemName?: string; duration?: string }) => void;
  onClose: () => void;
}

export default function MetaEditModal({ nodeId, initial, onSave, onClose }: Props) {
  const [input, setInput] = useState(initial.inputLabel || '');
  const [output, setOutput] = useState(initial.outputLabel || '');
  const [system, setSystem] = useState(initial.systemName || '');
  const [duration, setDuration] = useState(initial.duration || '');

  const handleSave = () => {
    onSave(nodeId, {
      inputLabel: input.trim() || undefined,
      outputLabel: output.trim() || undefined,
      systemName: system.trim() || undefined,
      duration: duration.trim() || undefined,
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-[420px] rounded-xl p-6 animate-fade-in"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          <span>📋</span> 메타데이터 편집
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-cyan-400 mb-1 font-medium">인풋 (Input)</label>
            <input value={input} onChange={e => setInput(e.target.value)} autoFocus
              placeholder="예: 면접 일정표, 지원자 이력서"
              className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-cyan-800/40 focus:outline-none focus:border-cyan-500/50 placeholder-slate-600" />
          </div>
          <div>
            <label className="block text-xs text-amber-400 mb-1 font-medium">아웃풋 (Output)</label>
            <input value={output} onChange={e => setOutput(e.target.value)}
              placeholder="예: 면접 결과 보고서, 합격 통보 메일"
              className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-amber-800/40 focus:outline-none focus:border-amber-500/50 placeholder-slate-600" />
          </div>
          <div>
            <label className="block text-xs text-purple-400 mb-1 font-medium">시스템</label>
            <input value={system} onChange={e => setSystem(e.target.value)}
              placeholder="예: SAP SuccessFactors, 채용관리시스템"
              className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-purple-800/40 focus:outline-none focus:border-purple-500/50 placeholder-slate-600" />
          </div>
          <div>
            <label className="block text-xs text-green-400 mb-1 font-medium">소요시간</label>
            <input value={duration} onChange={e => setDuration(e.target.value)}
              placeholder="예: 5분, 30분, 1시간"
              className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-green-800/40 focus:outline-none focus:border-green-500/50 placeholder-slate-600" />
          </div>
        </div>
        <div className="text-[10px] text-slate-600 mt-2 text-right">Ctrl+Enter로 저장 / Esc로 취소</div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm text-slate-400 border border-slate-600/30 hover:bg-slate-700/30 transition-colors">취소</button>
          <button onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors">저장</button>
        </div>
      </div>
    </div>
  );
}
