import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Scan, Eye, Target, Sparkles } from 'lucide-react';

export default function DetectionPanel() {
  const {
    binaryThreshold, setBinaryThreshold,
    blurKernelSize, setBlurKernelSize,
    morphologicalIter, setMorphologicalIter,
    showBoundingBox, setShowBoundingBox,
    showKalmanCentroid, setShowKalmanCentroid
  } = useAppStore();

  return (
    <div
      className="space-y-2 font-mono text-[10px] select-auto pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center space-x-1.5 text-emerald-400 font-bold border-b border-slate-800 pb-1">
        <Scan className="w-3.5 h-3.5" />
        <span>CV DETECTION</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {/* Binary Threshold */}
        <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
            <span>THRESHOLD</span>
            <span className="text-emerald-400">{binaryThreshold}</span>
          </div>
          <input
            type="range"
            min="50"
            max="255"
            step="1"
            value={binaryThreshold}
            onChange={(e) => setBinaryThreshold(parseInt(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer"
          />
        </div>

        {/* Blur Kernel */}
        <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
            <span>BLUR</span>
            <span className="text-cyan-400">{blurKernelSize}x{blurKernelSize}</span>
          </div>
          <input
            type="range"
            min="1"
            max="15"
            step="2"
            value={blurKernelSize}
            onChange={(e) => setBlurKernelSize(parseInt(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Morph Iterations */}
        <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
            <span>MORPH</span>
            <span className="text-amber-400">{morphologicalIter}</span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={morphologicalIter}
            onChange={(e) => setMorphologicalIter(parseInt(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Overlay Toggles */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setShowBoundingBox(!showBoundingBox)}
          className={`py-1 px-2 rounded font-bold text-[9px] flex items-center justify-between border ${
            showBoundingBox ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'
          }`}
        >
          <span>BBOX</span>
          <span className="font-mono">{showBoundingBox ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => setShowKalmanCentroid(!showKalmanCentroid)}
          className={`py-1 px-2 rounded font-bold text-[9px] flex items-center justify-between border ${
            showKalmanCentroid ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'
          }`}
        >
          <span>KALMAN</span>
          <span className="font-mono">{showKalmanCentroid ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
}
