import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Activity, Target, Cpu, Zap, Crosshair } from 'lucide-react';

export default function TelemetryDashboard({ telemetryData, onToggleTracking, isTracking }) {
  const { fps = 60, acquisitionTime = 12.4, errorX = 0, errorY = 0, pan = 0, tilt = 0, errorHistory = [] } = telemetryData || {};

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
      {/* Top Bar Header Overlay */}
      <div className="flex justify-between items-start">
        <div className="glass-panel p-4 rounded-xl flex items-center space-x-3 pointer-events-auto border-l-4 border-cyan-400">
          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
            <Target className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-slate-100 uppercase font-mono">FSOC PAT SIMULATOR</h1>
            <p className="text-xs text-slate-400 font-mono">VIRTUAL CAMERA TRACKING ENGINE v1.0</p>
          </div>
        </div>

        {/* PID Controller Toggle & Status Indicator */}
        <div className="glass-panel p-4 rounded-xl flex items-center space-x-4 pointer-events-auto">
          <div className="flex items-center space-x-2">
            <span className={`w-3 h-3 rounded-full ${isTracking ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
            <span className="text-xs font-mono text-slate-300 font-semibold">
              {isTracking ? 'CLOSED-LOOP PID ACTIVE' : 'OPEN-LOOP MANUAL'}
            </span>
          </div>

          <button
            onClick={onToggleTracking}
            className={`px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all duration-200 shadow-lg ${
              isTracking
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 glow-cyan'
            }`}
          >
            {isTracking ? 'DISENGAGE TRACKING' : 'ENGAGE AUTOMATIC TRACKING'}
          </button>
        </div>
      </div>

      {/* Target Lock Center Reticle Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-48 h-48 border border-cyan-500/30 rounded-full flex items-center justify-center">
          <div className="absolute w-full h-[1px] bg-cyan-500/40" />
          <div className="absolute h-full w-[1px] bg-cyan-500/40" />
          <div className="w-4 h-4 border border-emerald-400 rounded-full animate-ping" />
          <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-400">FSOC-BEACON-LOCK</div>
        </div>
      </div>

      {/* Bottom Telemetry HUD & Live Chart */}
      <div className="grid grid-cols-12 gap-4 pointer-events-auto">
        {/* Metric Cards */}
        <div className="col-span-4 grid grid-cols-2 gap-3">
          <div className="glass-panel p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>FRAME RATE</span>
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">{fps} <span className="text-xs text-slate-400 font-normal">FPS</span></div>
          </div>

          <div className="glass-panel p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>ACQ. TIME</span>
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{acquisitionTime.toFixed(1)} <span className="text-xs text-slate-400 font-normal">ms</span></div>
          </div>

          <div className="glass-panel p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
              <Crosshair className="w-4 h-4 text-emerald-400" />
              <span>X / Y ERROR</span>
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              dx: {errorX.toFixed(1)} | dy: {errorY.toFixed(1)}
            </div>
          </div>

          <div className="glass-panel p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>PAN / TILT</span>
            </div>
            <div className="text-lg font-bold font-mono text-indigo-400 mt-1">
              {pan.toFixed(1)}° / {tilt.toFixed(1)}°
            </div>
          </div>
        </div>

        {/* Recharts Tracking Error Line Chart */}
        <div className="col-span-8 glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-mono text-slate-300 font-semibold flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>REAL-TIME TRACKING ERROR (PIXELS)</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">PID FEEDBACK LOOP</span>
          </div>

          <div className="w-full h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errorHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" hide />
                <YAxis domain={[-50, 50]} stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Line type="monotone" dataKey="errX" stroke="#00f3ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="errY" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
