import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from './store';
import SetupModal from './components/SetupModal';
import ModeSelector from './components/ModeSelector';
import ChatPanel from './components/ChatPanel';
import FlowChart from './components/FlowChart';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.error(error); }
  render() {
    if (this.state.hasError) return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white gap-4">
        <h2 className="text-xl font-bold">오류가 발생했습니다</h2>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500">새로고침</button>
      </div>
    );
    return this.props.children;
  }
}

export default function App() {
  const ctx = useStore(s => s.processContext);
  const mode = useStore(s => s.mode);
  const [chatW, setChatW] = useState(380);
  const [drag, setDrag] = useState(false);

  const onDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); setDrag(true);
    const move = (e: MouseEvent) => setChatW(Math.max(300, Math.min(600, e.clientX)));
    const up = () => { setDrag(false); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  }, []);



  useEffect(() => {
    const h = () => { useStore.getState().updateUserActivity(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!ctx) return <ErrorBoundary><SetupModal /></ErrorBoundary>;
  if (!mode) return <ErrorBoundary><ModeSelector onSelect={() => {}} /></ErrorBoundary>;

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
        <div style={{ width: chatW, height: '100vh', flexShrink: 0 }}><ChatPanel /></div>
        <div style={{ width: 4, height: '100vh', flexShrink: 0, cursor: 'col-resize', background: drag ? '#3b82f6' : '#1e293b', transition: 'background 0.15s' }} onMouseDown={onDown} />
        <div style={{ flex: 1, height: '100vh', position: 'relative' }}><FlowChart /></div>
      </div>
    </ErrorBoundary>
  );
}
