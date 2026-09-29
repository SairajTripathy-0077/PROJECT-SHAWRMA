import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Globe, Sun, Moon, Compass, Gauge, Anchor } from 'lucide-react';

export default function EnvironmentPanel() {
  const { 
    timeOfDay, setTimeOfDay, 
    trajectoryPreset, setTrajectoryPreset, 
    targetVelocity, setTargetVelocity 
  } = useAppStore();

  return (
    <div
      className="space-y-2 font-mono text-[10px] select-auto pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
        <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
          <Globe className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span className="tracking-wider">ORBIT & TRAJECTORY</span>
        </div>
        <span className="text-[8px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
          PHYSICS ON
        </span>
      </div>

      {/* Target Velocity */}
      <div className="bg-slate-900/90 p-2 rounded border border-slate-800 space-y-1">
        <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
          <span className="flex items-center space-x-1">
            <Gauge className="w-3 h-3 text-amber-400" />
            <span>SPEED</span>
          </span>
          <span className="text-amber-400 font-extrabold text-[10px]">{targetVelocity.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.0"
          max="4.0"
          step="0.1"
          value={targetVelocity}
          onChange={(e) => setTargetVelocity(parseFloat(e.target.value))}
          className="w-full accent-amber-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
        />
      </div>

      {/* Trajectory Dropdown */}
      <div className="bg-slate-900/90 p-2 rounded border border-slate-800 space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-slate-400 font-bold text-[9px] flex items-center space-x-1">
            <Compass className="w-3 h-3 text-cyan-400" />
            <span>TRAJECTORY</span>
          </label>
          
          <button
            onClick={() => {
              if (trajectoryPreset === 'STATIONARY_HOVER') {
                setTrajectoryPreset('SINUSOIDAL');
                setTargetVelocity(1.0);
              } else {
                setTrajectoryPreset('STATIONARY_HOVER');
                setTargetVelocity(0.0);
              }
            }}
            className={`px-2 py-0.5 rounded text-[8px] font-bold border flex items-center space-x-1 transition-all cursor-pointer ${
              trajectoryPreset === 'STATIONARY_HOVER' || targetVelocity === 0
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 glow-emerald'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            <Anchor className="w-2.5 h-2.5 text-cyan-400" />
            <span>{trajectoryPreset === 'STATIONARY_HOVER' || targetVelocity === 0 ? 'HOLDING' : 'HOLD POS'}</span>
          </button>
        </div>

        <select
          value={trajectoryPreset}
          onChange={(e) => setTrajectoryPreset(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 text-cyan-400 text-[10px] font-mono rounded px-2 py-1 outline-none cursor-pointer hover:border-amber-500 transition-all font-bold"
        >
          <option value="STATIONARY_HOVER">Hover (Fixed)</option>
          <option value="SINUSOIDAL">Sinusoidal</option>
          <option value="LINEAR_FLYBY">Linear Flyby</option>
          <option value="FIGURE_8">Figure-8 Lissajous</option>
          <option value="HIGH_G_EVASIVE">High-G Evasive</option>
          <option value="ERRATIC">Erratic Step</option>
        </select>
      </div>
    </div>
  );
}
