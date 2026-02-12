import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from './store';
import SetupModal from './components/SetupModal';
import ChatPanel from './components/ChatPanel';
import FlowChart from './components/FlowChart';

export default function App() {
  const ctx = useStore(s => s.processContext);
  const theme = useStore(s => s.theme);
  const [chatW, setChatW] = useState(380);
  const [drag, setDrag] = useState(false);

  const onDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); setDrag(true);
    const move = (e: MouseEvent) => setChatW(Math.max(300, Math.min(600, e.clientX)));
    const up = () => { setDrag(false); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  }, []);



  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        const pw = prompt('관리자 비밀번호:');
        if (pw) {
          const ok = useStore.getState().toggleAdminMode(pw);
          if (ok) alert('관리자 모드 ' + (useStore.getState().adminMode ? '활성화' : '비활성화'));
          else alert('비밀번호가 틀렸습니다.');
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!ctx) return <SetupModal />;
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <div style={{ width: chatW, height: '100vh', flexShrink: 0 }}><ChatPanel /></div>
      <div style={{ width: 4, height: '100vh', flexShrink: 0, cursor: 'col-resize', background: drag ? '#3b82f6' : '#1e293b', transition: 'background 0.15s' }} onMouseDown={onDown} />
      <div style={{ flex: 1, height: '100vh', position: 'relative' }}><FlowChart /></div>
    </div>
  );
}
