import React from 'react';

interface Props { issues: string[]; onClose: () => void; onForceSubmit: () => void; }

export default function SubmitModal({ issues, onClose, onForceSubmit }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-[440px] rounded-2xl p-6 animate-fade-in" style={{ background: '#1a2744', border: '1px solid #2a3a52' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-100 mb-3">⚠️ 완료 전 확인사항</h3>
        <div className="space-y-2 mb-4">
          {issues.map((iss, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-300 px-3 py-2 rounded" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <span>⚠</span><span>{iss}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm text-slate-400 border border-slate-600 hover:bg-slate-700/30">돌아가기</button>
          <button onClick={onForceSubmit} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-500">그래도 완료</button>
        </div>
      </div>
    </div>
  );
}
