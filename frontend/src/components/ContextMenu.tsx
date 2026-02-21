import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { ShapeType, NodeCategory } from '../types';
import { CATEGORY_COLORS } from '../constants';

export default function ContextMenu() {
  const cm = useStore(s => s.contextMenu);
  const hide = useStore(s => s.hideContextMenu);
  const addShape = useStore(s => s.addShape);
  const addShapeAfter = useStore(s => s.addShapeAfter);
  const delNode = useStore(s => s.deleteNode);
  const changeNodeType = useStore(s => s.changeNodeType);
  const openMetaEdit = useStore(s => s.openMetaEdit);
  const setNodeCategory = useStore(s => s.setNodeCategory);
  const validate = useStore(s => s.validateNode);
  const applyRewrite = useStore(s => s.applyL7Rewrite);
  const updateEdgeLabel = useStore(s => s.updateEdgeLabel);
  const deleteEdge = useStore(s => s.deleteEdge);

  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (cm.show && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      let x = cm.x, y = cm.y;
      if (cm.x + rect.width > vw - 10) x = vw - rect.width - 10;
      if (cm.y + rect.height > vh - 10) y = vh - rect.height - 10;
      if (x < 10) x = 10; if (y < 10) y = 10;
      setPos({ x, y });
    } else { setPos({ x: cm.x, y: cm.y }); }
  }, [cm.show, cm.x, cm.y]);

  useEffect(() => {
    if (!cm.show) return;
    const handler = (e: MouseEvent) => { if (menuRef.current?.contains(e.target as Node)) return; hide(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cm.show, hide]);

  if (!cm.show) return null;
  const isN = !!cm.nodeId, isE = !!cm.edgeId;
  const node = cm.nodeId ? useStore.getState().nodes.find(n => n.id === cm.nodeId) : null;

  const placeShape = (type: ShapeType) => {
    const defaults: Record<ShapeType, string> = { process: '새 태스크', decision: '분기 조건?', subprocess: 'L6 프로세스', start: '시작', end: '종료' };
    if (isN && cm.nodeId) addShapeAfter(type, defaults[type], cm.nodeId);
    else addShape(type, defaults[type], { x: cm.flowX ?? 300, y: cm.flowY ?? 300 });
    hide();
  };

  return (
    <div ref={menuRef} className="context-menu" style={{ left: pos.x, top: pos.y }} onClick={e => e.stopPropagation()}>
      {(!isE) && (<>
        <div className="context-menu-header">셰이프 추가</div>
        <div className="context-menu-item" onClick={() => placeShape('process')}><span style={{ color: '#60a5fa' }}>▢</span> 프로세스</div>
        <div className="context-menu-item" onClick={() => placeShape('decision')}><span style={{ color: '#fbbf24' }}>◇</span> 판단(분기)</div>
        <div className="context-menu-item" onClick={() => placeShape('subprocess')}><span style={{ color: '#2dd4bf' }}>▣</span> L6 프로세스</div>
        <div className="context-menu-item" onClick={() => placeShape('start')}><span style={{ color: '#22c55e' }}>●</span> 시작</div>
        <div className="context-menu-item" onClick={() => placeShape('end')}><span style={{ color: '#ef4444' }}>●</span> 끝</div>
      </>)}
      {isN && (<>
        <div className="context-menu-sep" />
        <div className="context-menu-header">노드 편집</div>
        <div className="context-menu-item" onClick={() => { openMetaEdit({ nodeId: cm.nodeId!, inputLabel: node?.data.inputLabel, outputLabel: node?.data.outputLabel, systemName: node?.data.systemName, duration: node?.data.duration }); hide(); }}>📋 메타데이터</div>
        <div className="context-menu-item" onClick={() => { validate(cm.nodeId!); hide(); }}><span style={{ color: '#a855f7' }}>✓</span> L7 검증</div>
        {node?.data.l7Rewrite && <div className="context-menu-item" onClick={() => { applyRewrite(cm.nodeId!); hide(); }}><span style={{ color: '#22c55e' }}>↻</span> AI 추천 적용</div>}

        {node && ['process', 'decision'].includes(node.data.nodeType) && (<>
          <div className="context-menu-sep" />
          <div className="context-menu-header">타입 변경</div>
          {node.data.nodeType !== 'process' && (
            <div className="context-menu-item" onClick={() => { changeNodeType(cm.nodeId!, 'process'); hide(); }}><span style={{ color: '#60a5fa' }}>▢</span> 프로세스로 변경</div>
          )}
          {node.data.nodeType !== 'decision' && (
            <div className="context-menu-item" onClick={() => { changeNodeType(cm.nodeId!, 'decision'); hide(); }}><span style={{ color: '#fbbf24' }}>◇</span> 판단으로 변경</div>
          )}
        </>)}

        <div className="context-menu-sep" />
        <div className="context-menu-header">분류 색상</div>
        {Object.entries(CATEGORY_COLORS).map(([key, val]) => (
          <div key={key} className={`context-menu-item ${node?.data.category === key ? 'active' : ''}`} onClick={() => { setNodeCategory(cm.nodeId!, key as NodeCategory); hide(); }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: val.border, flexShrink: 0 }} />
            {val.label}
            {(node?.data.category || 'as_is') === key && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#3b82f6' }}>✓</span>}
          </div>
        ))}
        <div className="context-menu-sep" />
        <div className="context-menu-item danger" onClick={() => { delNode(cm.nodeId!); hide(); }}>🗑️ 삭제</div>
      </>)}
      {isE && (<>
        <div className="context-menu-header">연결선 편집</div>
        <div className="context-menu-item" onClick={() => { const l = prompt('엣지 라벨:'); if (l !== null) updateEdgeLabel(cm.edgeId!, l); hide(); }}>✏️ 라벨 편집</div>
        <div className="context-menu-item danger" onClick={() => { deleteEdge(cm.edgeId!); hide(); }}>🗑️ 삭제</div>
      </>)}
    </div>
  );
}
