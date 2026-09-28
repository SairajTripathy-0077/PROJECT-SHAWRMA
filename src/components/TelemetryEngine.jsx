import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Activity, Target, Shield, Download, Play, CheckCircle2, Clock, Sliders } from 'lucide-react';
import { BENCHMARK_SCENARIOS } from '../services/benchmarkRunner';

export default function TelemetryEngine({
  trackingState = 'SEARCHING',
  telemetry = {},
  isTrackingActive = false,
  onToggleTracking,
  onRunBenchmark
}) {
  const {
    fps = 60,
    gpuLatency = 4.2,
    cvLatency = 3.1,
    errorX = 0,
    errorY = 0,
    rmse = 0,
    lockRetentionRate = 100,
    errorHistory = []
  } = telemetry;

  const [selectedScenario, setSelectedScenario] = useState('BENCHMARK_A');
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [progress, setProgress] = useState(0);

  const getStateColor = () => {
    switch (trackingState) {
      case 'TRACKING':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'ACQUIRE':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'PREDICTIVE_HOLD':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'SEARCHING':
      default:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
  };

  const handleBenchmarkClick = () => {
    setIsBenchmarking(true);
    setProgress(0);

    if (onRunBenchmark) {
      onRunBenchmark(
        selectedScenario,
        (p) => setProgress(p.progress),
        (summary) => {
          setIsBenchmarking(false);
          setProgress(100);
        }
      );
    }
  };

  return (
    <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-4 font-mono text-xs select-none">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200">AUTOMATED BENCHMARK & EVALUATION ENGINE</span>
        </div>

        <div className="flex items-center space-x-2">
          <div className={`px-2.5 py-1 rounded border text-[11px] font-bold ${getStateColor()}`}>
            FSM: {trackingState}
          </div>

          <button
            onClick={onToggleTracking}
            className={`px-3 py-1 rounded font-bold transition-all ${
              isTrackingActive
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 glow-cyan'
            }`}
          >
            {isTrackingActive ? 'DISENGAGE PID' : 'ENGAGE PID'}
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400 flex items-center space-x-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>LATENCIES</span>
          </span>
          <div className="text-[11px] font-bold text-cyan-400 mt-1">
            GPU: {gpuLatency.toFixed(1)}ms | CV: {cvLatency.toFixed(1)}ms
          </div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400 flex items-center space-x-1">
            <Target className="w-3 h-3 text-emerald-400" />
            <span>INST. ERROR</span>
          </span>
          <div className="text-[11px] font-bold text-emerald-400 mt-1">
            eX: {errorX.toFixed(1)}px | eY: {errorY.toFixed(1)}px
          </div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400 flex items-center space-x-1">
            <Shield className="w-3 h-3 text-amber-400" />
            <span>RMS ERROR</span>
          </span>
          <div className="text-base font-bold text-amber-400 mt-0.5">
            {rmse.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">px</span>
          </div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-indigo-400" />
            <span>LOCK RETENTION</span>
          </span>
          <div className="text-base font-bold text-indigo-400 mt-0.5">
            {lockRetentionRate.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">%</span>
          </div>
        </div>
      </div>

      {/* 150-Frame Recharts Error Convergence */}
      <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] text-slate-300 font-bold">150-FRAME CONVERGENCE MONITOR (EKF + PID)</span>
          <span className="text-[9px] text-slate-500">SIH COMPLIANCE METRICS</span>
        </div>

        <div className="w-full h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={errorHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="frame" hide />
              <YAxis domain={[-70, 70]} stroke="#64748b" tick={{ fontSize: 9 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '10px', fontFamily: 'monospace' }}
              />
              <Line type="monotone" dataKey="errX" stroke="#00f3ff" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="errY" stroke="#10b981" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Benchmark Test Scenario Selector & Exporter Controls */}
      <div className="grid grid-cols-12 gap-2 pt-1 border-t border-slate-800 items-center">
        <div className="col-span-6 flex flex-col space-y-1">
          <label className="text-[10px] text-slate-400 font-bold">SIH TEST SCENARIO PRESET:</label>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            disabled={isBenchmarking}
            className="bg-slate-900 border border-slate-700 text-cyan-400 rounded px-2 py-1 text-xs outline-none cursor-pointer"
          >
            {Object.values(BENCHMARK_SCENARIOS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-6 flex flex-col justify-end">
          <button
            onClick={handleBenchmarkClick}
            disabled={isBenchmarking}
            className={`w-full py-2 rounded font-bold flex items-center justify-center space-x-2 transition-all ${
              isBenchmarking
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 glow-emerald'
            }`}
          >
            {isBenchmarking ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>
              {isBenchmarking ? `RUNNING BENCHMARK (${progress.toFixed(0)}%)...` : 'EXECUTE 60s BENCHMARK & EXPORT'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
