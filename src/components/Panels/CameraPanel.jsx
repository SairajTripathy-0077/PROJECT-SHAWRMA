import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Camera, Eye, Zap, Shield } from 'lucide-react';

export default function CameraPanel() {
  const { 
    zoomFov, setZoomFov, 
    gimbalMaxVel, setGimbalMaxVel, 
    sensorMode, setSensorMode 
  } = useAppStore();

  return (
    <div
      className="space-y-3 font-mono text-xs select-auto pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center space-x-2 text-cyan-400 font-bold border-b border-slate-800 pb-1.5">
        <Camera className="w-4 h-4" />
        <span>02. CAMERA & SENSOR OPTICAL CONTROLS</span>
      </div>

      {/* Sensor Mode Switcher */}
      <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1.5">
        <label className="text-slate-400 font-bold text-[10px]">MULTI-SPECTRAL SENSOR FEED</label>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => setSensorMode(0)}
            className={`py-1.5 rounded text-[10px] font-bold border ${
              sensorMode === 0 ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            VIS RGB
          </button>
          <button
            onClick={() => setSensorMode(1)}
            className={`py-1.5 rounded text-[10px] font-bold border ${
              sensorMode === 1 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            SWIR THERMAL
          </button>
          <button
            onClick={() => setSensorMode(2)}
            className={`py-1.5 rounded text-[10px] font-bold border ${
              sensorMode === 2 ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            WHITE-HOT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Optical Zoom FOV Slider */}
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
            <span>OPTICAL FOV ZOOM</span>
            <span className="text-cyan-400">{zoomFov}°</span>
          </div>
          <input
            type="range"
            min="5"
            max="60"
            step="1"
            value={zoomFov}
            onChange={(e) => setZoomFov(parseInt(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Gimbal Max Velocity Slider */}
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
            <span>MAX VELOCITY</span>
            <span className="text-emerald-400">{gimbalMaxVel} °/s</span>
          </div>
          <input
            type="range"
            min="30"
            max="300"
            step="10"
            value={gimbalMaxVel}
            onChange={(e) => setGimbalMaxVel(parseInt(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
