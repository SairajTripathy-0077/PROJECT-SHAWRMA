import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Globe, Sun, Moon, Compass, Gauge, Anchor, Play } from 'lucide-react';

export default function EnvironmentPanel() {
  const { 
    timeOfDay, setTimeOfDay, 
    trajectoryPreset, setTrajectoryPreset, 
    targetVelocity, setTargetVelocity 
  } = useAppStore();

  return (
    <div
      className="space-y-3 font-mono text-xs select-auto pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2 text-amber-400 font-bold">
          <Globe className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="tracking-wider">ORBITAL BIOME & TRAJECTORY MATRIX</span>
        </div>
        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
          PHYSICS ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Time of Day */}
        <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-2">
          <label className="text-slate-400 font-bold text-[10px] flex items-center space-x-1">
            {timeOfDay === 'NIGHT' ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
            <span>CELESTIAL LIGHTING</span>
          </label>
          <div className="flex space-x-1.5">
            <button
              onClick={() => setTimeOfDay('DAY')}
              className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                timeOfDay === 'DAY' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 glow-amber' : 'bg-slate-950 text-slate-500 border-slate-800'
              }`}
            >
              DAYLIGHT
            </button>
            <button
              onClick={() => setTimeOfDay('NIGHT')}
              className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                timeOfDay === 'NIGHT' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 glow-cyan' : 'bg-slate-950 text-slate-500 border-slate-800'
              }`}
            >
              DEEP NIGHT
            </button>
          </div>
        </div>

        {/* Target Velocity */}
        <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
            <span className="flex items-center space-x-1">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              <span>TARGET ORBIT SPEED</span>
            </span>
            <span className="text-amber-400 font-extrabold text-xs">{targetVelocity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="4.0"
            step="0.1"
            value={targetVelocity}
            onChange={(e) => setTargetVelocity(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Trajectory Dropdown & Hold Position Quick Action */}
      <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-slate-400 font-bold text-[10px] flex items-center space-x-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>KINEMATIC TRAJECTORY PATTERN</span>
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
            className={`px-2.5 py-1 rounded text-[10px] font-bold border flex items-center space-x-1 transition-all cursor-pointer ${
              trajectoryPreset === 'STATIONARY_HOVER' || targetVelocity === 0
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 glow-emerald'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            <Anchor className="w-3 h-3 text-cyan-400" />
            <span>{trajectoryPreset === 'STATIONARY_HOVER' || targetVelocity === 0 ? 'FIXED POSITION (STOPPED)' : 'HOLD POSITION (STOP TARGET)'}</span>
          </button>
        </div>

        <select
          value={trajectoryPreset}
          onChange={(e) => setTrajectoryPreset(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 text-cyan-400 text-xs font-mono rounded-md px-3 py-2 outline-none cursor-pointer hover:border-amber-500 transition-all font-bold"
        >
          <option value="STATIONARY_HOVER">Stationary / Hover Mode (Fixed Target Position)</option>
          <option value="SINUSOIDAL">Sinusoidal Path</option>
          <option value="LINEAR_FLYBY">Linear High-Speed Flyby</option>
          <option value="FIGURE_8">Figure-8 Lissajous Curve</option>
          <option value="HIGH_G_EVASIVE">High-G Evasive Maneuver</option>
          <option value="ERRATIC">Erratic Step Shift</option>
        </select>
      </div>
    </div>
  );
}
