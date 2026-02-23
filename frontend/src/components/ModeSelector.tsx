import React, { useState } from 'react';
import { useStore } from '../store';
import { Mode } from '../types';

interface ModeSelectorProps {
  onSelect: (mode: Mode) => void;
}

export default function ModeSelector({ onSelect }: ModeSelectorProps) {
  const [loadingExample, setLoadingExample] = useState<Mode | null>(null);

  const handleSelect = (mode: Mode) => {
    useStore.getState().setMode(mode);
    onSelect(mode);
  };

  const handleLoadExample = async (mode: Mode, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingExample(mode);
    const filename = mode === 'AS-IS' ? 'AS-IS_example.json' : 'TO-BE_example.json';
    try {
      const res = await fetch(`/flowchart/examples/${filename}`);
      if (!res.ok) throw new Error('not found');
      const json = await res.text();
      useStore.getState().setMode(mode);
      useStore.getState().importFlow(json);
      onSelect(mode);
    } catch {
      alert(`예시 파일(${filename})을 찾을 수 없습니다.\nfrontend/public/examples/ 폴더에 파일을 넣어주세요.`);
    } finally {
      setLoadingExample(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-w-4xl mx-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-3">작업 모드를 선택해주세요</h2>
          <p className="text-slate-400 text-lg">프로세스를 분석하시나요, 설계하시나요?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* AS-IS Card */}
          <div
            onClick={() => handleSelect('AS-IS')}
            className="group bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border-2 border-slate-700 hover:border-blue-500 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <span className="text-2xl">🔍</span>
              </div>
              <h3 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">AS-IS 분석</h3>
            </div>

            <p className="text-slate-300 mb-6 leading-relaxed">
              현재 운영 중인 프로세스를 있는 그대로 문서화하고 분석합니다.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-slate-300 text-sm">현행 프로세스 정확한 기록</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-slate-300 text-sm">문제점 및 개선 기회 발견</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-slate-300 text-sm">시스템명, 소요시간 등 메타데이터 수집</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700 flex items-center justify-between">
              <span className="text-sm text-slate-400">추천 대상: 현황 파악, 문서화, 개선점 분석</span>
              <button
                onClick={(e) => handleLoadExample('AS-IS', e)}
                disabled={loadingExample !== null}
                className="flex-shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 disabled:opacity-40 transition-colors"
              >
                {loadingExample === 'AS-IS' ? '불러오는 중...' : '📂 예시 확인하기'}
              </button>
            </div>
          </div>

          {/* TO-BE Card */}
          <div
            onClick={() => handleSelect('TO-BE')}
            className="group bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border-2 border-slate-700 hover:border-purple-500 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors">TO-BE 설계</h3>
            </div>

            <p className="text-slate-300 mb-6 leading-relaxed">
              이상적인 미래 프로세스를 설계하고 개선 방향을 제시합니다.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">✓</span>
                <span className="text-slate-300 text-sm">개선된 프로세스 설계</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">✓</span>
                <span className="text-slate-300 text-sm">자동화·디지털 전환 영역 표시</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">✓</span>
                <span className="text-slate-300 text-sm">PDD(Process Definition Document) 생성</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700 flex items-center justify-between">
              <span className="text-sm text-slate-400">추천 대상: 프로세스 혁신, 디지털 전환, 자동화</span>
              <button
                onClick={(e) => handleLoadExample('TO-BE', e)}
                disabled={loadingExample !== null}
                className="flex-shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 disabled:opacity-40 transition-colors"
              >
                {loadingExample === 'TO-BE' ? '불러오는 중...' : '📂 예시 확인하기'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            💡 선택 후에도 언제든 모드를 전환할 수 있습니다
          </p>
        </div>
      </div>
    </div>
  );
}
