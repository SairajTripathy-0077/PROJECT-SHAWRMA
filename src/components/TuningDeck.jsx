import React, { useState } from 'react';
import { Sliders, Activity, CloudOff, ShieldAlert, Cpu, RefreshCw } from 'lucide-react';

export default function TuningDeck({
  pidGains,
  onUpdatePidGains,
  jitterAmp,
  onChangeJitterAmp,
  jitterFreq,
  onChangeJitterFreq,
  turbulence,
  onChangeTurbulence,
  dropLOS,
  onToggleDropLOS,
  trajectoryPreset,
  onChangeTrajectoryPreset
}) {
  const [localGains, setLocalGains] = useState(pidGains);

  const handleGainChange = (key, value) => {
    const updated = { ...localGains, [key]: parseFloat(value) };
    setLocalGains(updated);
    if (onUpdatePidGains) {
      onUpdatePidGains(updated);
    }
  };

  return (
    <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col space-y-4 font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2 text-cyan-400 font-bold">
          <Sliders className="w-4 h-4" />
          <span>HUMAN TUNING & DISTURBANCE DECK</span>
        </div>
        <span className="text-[10px] text-slate-500">LIVE IPC GAIN SYNCHRONIZATION</span>
      </div>

      {/* Section 1: Dual-Axis PID Live Tuner */}
      <div className="space-y-3">
        <div className="text-slate-300 font-bold flex items-center space-x-1">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span>DUAL-AXIS PID GAINS</span>
        </div>

        {/* Pan Axis Gains */}
        <div className="bg-slate-900/80 p-2.5 rounded-lg space-y-2 border border-slate-800">
          <span className="text-[11px] text-indigo-300 font-bold">PAN AXIS (AZIMUTH)</span>
          
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400">Kp: {localGains.kp_pan.toFixed(3)}</label>
              <input
                type="range"
                min="0.01"
                max="0.30"
                step="0.005"
                value={localGains.kp_pan}
                onChange={(e) => handleGainChange('kp_pan', e.target.value)}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400">Ki: {localGains.ki_pan.toFixed(4)}</label>
              <input
                type="range"
                min="0.000"
                max="0.030"
                step="0.001"
                value={localGains.ki_pan}
                onChange={(e) => handleGainChange('ki_pan', e.target.value)}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400">Kd: {localGains.kd_pan.toFixed(3)}</label>
              <input
                type="range"
                min="0.000"
                max="0.060"
                step="0.002"
                value={localGains.kd_pan}
                onChange={(e) => handleGainChange('kd_pan', e.target.value)}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Tilt Axis Gains */}
        <div className="bg-slate-900/80 p-2.5 rounded-lg space-y-2 border border-slate-800">
          <span className="text-[11px] text-emerald-300 font-bold">TILT AXIS (ELEVATION)</span>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400">Kp: {localGains.kp_tilt.toFixed(3)}</label>
              <input
                type="range"
                min="0.01"
                max="0.30"
                step="0.005"
                value={localGains.kp_tilt}
                onChange={(e) => handleGainChange('kp_tilt', e.target.value)}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400">Ki: {localGains.ki_tilt.toFixed(4)}</label>
              <input
                type="range"
                min="0.000"
                max="0.030"
                step="0.001"
                value={localGains.ki_tilt}
                onChange={(e) => handleGainChange('ki_tilt', e.target.value)}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400">Kd: {localGains.kd_tilt.toFixed(3)}</label>
              <input
                type="range"
                min="0.000"
                max="0.060"
                step="0.002"
                value={localGains.kd_tilt}
                onChange={(e) => handleGainChange('kd_tilt', e.target.value)}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Environmental Disturbance Injectors */}
      <div className="space-y-3 pt-1 border-t border-slate-800">
        <div className="text-slate-300 font-bold flex items-center space-x-1">
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span>ENVIRONMENTAL DISTURBANCE INJECTORS</span>
        </div>

        {/* Jitter Controls */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-400">Jitter Amp: {jitterAmp.toFixed(2)}°</label>
            <input
              type="range"
              min="0.00"
              max="2.00"
              step="0.05"
              value={jitterAmp}
              onChange={(e) => onChangeJitterAmp(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400">Jitter Freq: {jitterFreq} Hz</label>
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              value={jitterFreq}
              onChange={(e) => onChangeJitterFreq(parseInt(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Heat Shimmer Turbulence Slider */}
        <div>
          <label className="text-[10px] text-slate-400">Atmospheric Shimmer: {turbulence}%</label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={turbulence}
            onChange={(e) => onChangeTurbulence(parseInt(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        {/* Drop LOS Button */}
        <button
          onClick={onToggleDropLOS}
          className={`w-full py-2 rounded-lg font-bold flex items-center justify-center space-x-2 transition-all ${
            dropLOS
              ? 'bg-rose-500 text-white shadow-lg glow-red'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
          }`}
        >
          <CloudOff className="w-4 h-4" />
          <span>{dropLOS ? 'RECOVER LINE-OF-SIGHT (LOS)' : 'TRIGGER OCCLUSION (DROP LOS)'}</span>
        </button>
      </div>

      {/* Section 3: Trajectory Mode Preset */}
      <div className="space-y-1.5 pt-1 border-t border-slate-800">
        <label className="text-slate-400 font-bold">TARGET TRAJECTORY PRESET</label>
        <select
          value={trajectoryPreset}
          onChange={(e) => onChangeTrajectoryPreset(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 text-cyan-400 rounded px-2 py-1.5 outline-none cursor-pointer hover:border-cyan-500"
        >
          <option value="SINUSOIDAL">Sinusoidal Orbit</option>
          <option value="LINEAR_FLYBY">Linear High-Speed Flyby</option>
          <option value="FIGURE_8">Figure-8 Lissajous Curve</option>
          <option value="HIGH_G_EVASIVE">High-G Evasive Sine</option>
          <option value="ERRATIC">Erratic Step Shift</option>
        </select>
      </div>
    </div>
  );
}
