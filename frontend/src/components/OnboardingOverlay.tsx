import React from 'react';
import { useStore } from '../store';

export default function OnboardingOverlay() {
  const show = useStore(s => s.showOnboarding);
  const dismiss = useStore(s => s.dismissOnboarding);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={dismiss}>
      <div className="w-[480px] rounded-2xl p-8 animate-fade-in" style={{ background: '#1a2744', border: '1px solid #2a3a52' }} onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-100 mb-4 text-center">🎯 사용 가이드</h2>
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex gap-3"><span className="text-lg">🖱️</span><div><b className="text-slate-100">우클릭</b> — 캔버스에서 셰이프 추가, 노드/엣지 편집 메뉴</div></div>
          <div className="flex gap-3"><span className="text-lg">🔗</span><div><b className="text-slate-100">핸들 드래그</b> — 노드의 파란 점에서 다른 노드로 드래그하여 연결</div></div>
          <div className="flex gap-3"><span className="text-lg">✏️</span><div><b className="text-slate-100">더블클릭</b> — 노드 이름 변경, 엣지 라벨 편집</div></div>
          <div className="flex gap-3"><span className="text-lg">💬</span><div><b className="text-slate-100">좌측 챗봇</b> — "빠진 단계 있을까?" 질문, L7 검증, 플로우 분석</div></div>
          <div className="flex gap-3"><span className="text-lg">✅</span><div><b className="text-slate-100">완료하기</b> — 작업 끝나면 챗봇 하단의 "완료하기" 버튼</div></div>
        </div>
        <button onClick={dismiss} className="w-full mt-6 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500">시작하기</button>
      </div>
    </div>
  );
}
