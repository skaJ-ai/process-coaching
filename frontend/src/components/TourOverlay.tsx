import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';

interface TourStep {
  target: string;
  title: string;
  desc: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  { target: '[data-tour="canvas"]',   title: '셰이프 추가',     desc: '빈 캔버스를 우클릭하면 프로세스·판단·시작·종료 셰이프를 추가할 수 있어요.', position: 'right' },
  { target: '[data-tour="quality"]',  title: '품질 대시보드',   desc: 'L7 기준 준수 현황이 실시간으로 표시돼요. 노드 추가 후 잠시 기다리면 자동 검증됩니다.', position: 'left' },
  { target: '[data-tour="review"]',   title: '전체 흐름 검토',  desc: '다 그렸다면 AI에게 전체 흐름 분석을 요청해보세요.', position: 'left' },
  { target: '[data-tour="chat"]',     title: '챗봇 질문',       desc: '언제든 궁금한 것을 입력하세요. 예외 처리, 단계 추천 등 뭐든 질문하세요.', position: 'top' },
  { target: '[data-tour="complete"]', title: '완료하기',        desc: '프로세스 설계가 끝나면 완료하기로 마무리해요.', position: 'top' },
];

interface Rect { top: number; left: number; width: number; height: number; }

export default function TourOverlay() {
  const tourActive = useStore(s => s.tourActive);
  const tourStep = useStore(s => s.tourStep);
  const nextTourStep = useStore(s => s.nextTourStep);
  const skipTour = useStore(s => s.skipTour);
  const [rect, setRect] = useState<Rect | null>(null);

  const updateRect = useCallback(() => {
    if (!tourActive) return;
    const step = TOUR_STEPS[tourStep];
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null);
    }
  }, [tourActive, tourStep]);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [updateRect]);

  if (!tourActive || !rect) return null;

  const step = TOUR_STEPS[tourStep];
  const PAD = 6;
  const hl = { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };

  const TOOLTIP_W = 260;
  let tipStyle: React.CSSProperties = {};
  const MID_Y = hl.top + hl.height / 2 - 70;
  if (step.position === 'right')  tipStyle = { top: MID_Y, left: hl.left + hl.width + 12 };
  if (step.position === 'left')   tipStyle = { top: MID_Y, left: Math.max(8, hl.left - TOOLTIP_W - 12) };
  if (step.position === 'top')    tipStyle = { top: hl.top - 150, left: Math.max(8, hl.left + hl.width / 2 - TOOLTIP_W / 2) };
  if (step.position === 'bottom') tipStyle = { top: hl.top + hl.height + 12, left: Math.max(8, hl.left + hl.width / 2 - TOOLTIP_W / 2) };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, pointerEvents: 'none' }}>
      {/* 하이라이트 링만 표시 - 배경 어둡게 하지 않음 */}
      <div style={{
        position: 'absolute',
        top: hl.top, left: hl.left, width: hl.width, height: hl.height,
        border: '2px solid #6366f1',
        borderRadius: 8,
        boxShadow: '0 0 0 4px rgba(99,102,241,0.2), 0 0 16px rgba(99,102,241,0.3)',
        animation: 'tour-pulse 2s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      {/* 말풍선 */}
      <div style={{ position: 'absolute', width: TOOLTIP_W, pointerEvents: 'auto', ...tipStyle }}>
        <div style={{
          background: '#0f172a',
          border: '1px solid #6366f1',
          borderRadius: 12,
          padding: '14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc' }}>
              {tourStep + 1}/{TOUR_STEPS.length} &nbsp;{step.title}
            </span>
            <button onClick={skipTour} style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✕</button>
          </div>
          <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 12 }}>{step.desc}</p>
          <button
            onClick={nextTourStep}
            style={{ width: '100%', padding: '7px', borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            {tourStep < TOUR_STEPS.length - 1 ? '다음 →' : '완료'}
          </button>
        </div>
      </div>
      <style>{`@keyframes tour-pulse { 0%,100%{box-shadow:0 0 0 4px rgba(99,102,241,0.2),0 0 16px rgba(99,102,241,0.3)} 50%{box-shadow:0 0 0 6px rgba(99,102,241,0.35),0 0 24px rgba(99,102,241,0.5)} }`}</style>
    </div>
  );
}
