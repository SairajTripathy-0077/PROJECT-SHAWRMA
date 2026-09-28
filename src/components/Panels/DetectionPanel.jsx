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
      className="space-y-3 font-mono text-xs select-auto pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center space-x-2 text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
        <Scan className="w-4 h-4" />
        <span>03. OPENCV COMPUTER VISION & DETECTION TUNING</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Binary Threshold Slider */}
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
            <span>BINARY THRESHOLD</span>
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

        {/* Blur Kernel Size */}
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
            <span>BLUR KERNEL</span>
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

        {/* Morphological Iterations */}
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
            <span>MORPH ITERATIONS</span>
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
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowBoundingBox(!showBoundingBox)}
          className={`py-2 px-3 rounded font-bold text-[10px] flex items-center justify-between border ${
            showBoundingBox ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'
          }`}
        >
          <span>CV BOUNDING BOX</span>
          <span className="font-mono">{showBoundingBox ? '[ON]' : '[OFF]'}</span>
        </button>

        <button
          onClick={() => setShowKalmanCentroid(!showKalmanCentroid)}
          className={`py-2 px-3 rounded font-bold text-[10px] flex items-center justify-between border ${
            showKalmanCentroid ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'
          }`}
        >
          <span>KALMAN CENTROID RETICLE</span>
          <span className="font-mono">{showKalmanCentroid ? '[ON]' : '[OFF]'}</span>
        </button>
      </div>
    </div>
  );
}
