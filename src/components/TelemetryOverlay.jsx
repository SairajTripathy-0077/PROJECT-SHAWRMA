import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Activity, Target, Cpu, Zap, Crosshair, ShieldAlert, Sliders, Eye } from 'lucide-react';

export default function TelemetryOverlay({
  trackingState = 'SEARCHING',
  telemetry = {},
  isTrackingActive = false,
  onToggleTracking,
  enableJitter = true,
  onToggleJitter,
  enableTurbulence = false,
  onToggleTurbulence,
  trajectoryMode = 'SINUSOIDAL',
  onChangeTrajectoryMode
}) {
  const {
    fps = 60,
    acquisitionTime = 12.4,
    errorX = 0,
    errorY = 0,
    rmse = 0,
    pan = 0,
    tilt = 0,
    errorHistory = []
  } = telemetry;

  // Determine state badge styling
  const getStateBadge = () => {
    switch (trackingState) {
      case 'TRACKING':
      case 'ACQUIRED':
        return {
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400 animate-ping',
          label: 'LOCK ACQUIRED (TRACKING)'
        };
      case 'SEARCHING':
        return {
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400 animate-pulse',
          label: 'SEARCHING FOR BEACON'
        };
      case 'LOST':
      default:
        return {
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dot: 'bg-rose-500',
          label: 'LOCK LOST (COASTING)'
        };
    }
  };

  const statusBadge = getStateBadge();

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10 select-none">
      {/* Top Navigation HUD Bar */}
      <div className="flex justify-between items-start">
        {/* Title & Architecture Info */}
        <div className="glass-panel p-4 rounded-xl flex items-center space-x-3 pointer-events-auto border-l-4 border-cyan-400">
          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
            <Target className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wider text-slate-100 uppercase font-mono">
              FSOC PAT SIMULATOR
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              ASTERIA KINEMATIC GIMBAL ENGINE v2.0
            </p>
          </div>
        </div>

        {/* State Indicator & Engage Controls */}
        <div className="glass-panel p-4 rounded-xl flex items-center space-x-4 pointer-events-auto border border-slate-800">
          <div className={`px-3 py-1.5 rounded-lg border flex items-center space-x-2 font-mono text-xs font-semibold ${statusBadge.bg}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${statusBadge.dot}`} />
            <span>{statusBadge.label}</span>
          </div>

          <button
            onClick={onToggleTracking}
            className={`px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all duration-200 shadow-lg ${
              isTrackingActive
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 glow-cyan'
            }`}
          >
            {isTrackingActive ? 'DISENGAGE CLOSED-LOOP' : 'ENGAGE CLOSED-LOOP PID'}
          </button>
        </div>
      </div>

      {/* Reticle Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-56 h-56 border border-cyan-500/20 rounded-full flex items-center justify-center">
          <div className="absolute w-full h-[1px] bg-cyan-500/30" />
          <div className="absolute h-full w-[1px] bg-cyan-500/30" />
          
          {/* Active Error Target Box */}
          <div
            className="absolute w-6 h-6 border-2 border-emerald-400/80 rounded transition-all duration-75 flex items-center justify-center"
            style={{
              transform: `translate(${Math.min(Math.max(errorX, -80), 80)}px, ${Math.min(Math.max(errorY, -80), 80)}px)`
            }}
          >
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
          </div>

          <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-400">
            FOCAL-PLANE-RETICLE (640x480)
          </div>
        </div>
      </div>

      {/* Control Panel & Telemetry Charts Row */}
      <div className="grid grid-cols-12 gap-4 pointer-events-auto">
        {/* Left Side: Environment & Trajectory Controls */}
        <div className="col-span-3 glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="flex items-center space-x-2 text-xs text-slate-300 font-mono font-semibold border-b border-slate-800 pb-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>ENVIRONMENT CONTROLS</span>
          </div>

          {/* Jitter Toggle */}
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">Rotor Jitter:</span>
            <button
              onClick={onToggleJitter}
              className={`px-3 py-1 rounded text-[11px] font-bold border ${
                enableJitter
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
            >
              {enableJitter ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          {/* Turbulence Toggle */}
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">Atmosphere Shimmer:</span>
            <button
              onClick={onToggleTurbulence}
              className={`px-3 py-1 rounded text-[11px] font-bold border ${
                enableTurbulence
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
            >
              {enableTurbulence ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          {/* Trajectory Mode Selector */}
          <div className="flex flex-col space-y-1 font-mono text-xs">
            <span className="text-slate-400">Target Path Mode:</span>
            <select
              value={trajectoryMode}
              onChange={(e) => onChangeTrajectoryMode && onChangeTrajectoryMode(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-cyan-400 rounded px-2 py-1 text-xs outline-none cursor-pointer hover:border-cyan-500"
            >
              <option value="SINUSOIDAL">Sinusoidal Path</option>
              <option value="ORBITAL">Orbital Trajectory</option>
              <option value="ERRATIC">Erratic Step Shift</option>
            </select>
          </div>
        </div>

        {/* Center: Numeric Metric Cards */}
        <div className="col-span-4 grid grid-cols-2 gap-3">
          <div className="glass-panel p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>FRAME RATE</span>
            </div>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
              {fps} <span className="text-xs text-slate-400 font-normal">FPS</span>
            </div>
          </div>

          <div className="glass-panel p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>ACQ. TIME</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              {acquisitionTime.toFixed(1)} <span className="text-xs text-slate-400 font-normal">ms</span>
            </div>
          </div>

          <div className="glass-panel p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
              <Crosshair className="w-4 h-4 text-emerald-400" />
              <span>INST. ERROR</span>
            </div>
            <div className="text-sm font-bold font-mono text-emerald-400 mt-1">
              eX: {errorX.toFixed(1)}px | eY: {errorY.toFixed(1)}px
            </div>
          </div>

          <div className="glass-panel p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span>RMS ERROR</span>
            </div>
            <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
              {rmse.toFixed(2)} <span className="text-xs text-slate-400 font-normal">px</span>
            </div>
          </div>
        </div>

        {/* Right Side: Recharts 100-Frame Error History Chart */}
        <div className="col-span-5 glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-mono text-slate-300 font-semibold flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>REAL-TIME TRACKING ERROR (LAST 100 FRAMES)</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">KALMAN + PID</span>
          </div>

          <div className="w-full h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errorHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="frame" hide />
                <YAxis domain={[-60, 60]} stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Line type="monotone" dataKey="errX" stroke="#00f3ff" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="errY" stroke="#10b981" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
