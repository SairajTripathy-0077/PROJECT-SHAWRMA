import React, { useEffect, useRef, useState } from 'react';
import { telemetryStore } from '../stores/telemetryStore';
import GraphSection from './Graphs/GraphSection';

export default function RheaRightPanel({ trajectoryPreset = 'SINUSOIDAL' }) {
  const panRef = useRef(null);
  const tiltRef = useRef(null);
  const errorRef = useRef(null);
  const confidenceRef = useRef(null);
  const fpsRef = useRef(null);
  const latencyRef = useRef(null);
  const avgErrorRef = useRef(null);
  const lockRetentionRef = useRef(null);
  const statusRef = useRef(null);
  const logTerminalRef = useRef(null);

  const [logs, setLogs] = useState([
    { time: '17:39:06', text: 'TARGET ACQUIRING', type: 'info' },
    { time: '17:39:07', text: 'TRACKING STARTED', type: 'success' },
    { time: '17:39:07', text: 'ACQ COMPLETE', type: 'success' },
    { time: '17:39:07', text: 'TARGET ACQUIRING', type: 'info' },
    { time: '17:39:07', text: 'TRACKING STARTED', type: 'success' },
    { time: '17:39:07', text: 'ACQ COMPLETE', type: 'success' },
  ]);

  const [isLockedState, setIsLockedState] = useState(true);

  // Subscribe to Telemetry Store for Zero-Rerender high frequency updates
  useEffect(() => {
    let lastState = 'SEARCHING';

    const unsubscribe = telemetryStore.subscribe((state) => {
      if (panRef.current) panRef.current.innerText = `${state.pan.toFixed(2)}°`;
      if (tiltRef.current) tiltRef.current.innerText = `${state.tilt.toFixed(2)}°`;
      
      const errTotal = Math.sqrt(state.errorX * state.errorX + state.errorY * state.errorY);
      if (errorRef.current) errorRef.current.innerText = `${errTotal.toFixed(1)}px`;
      
      const isLocked = state.trackingState === 'TRACKING' || Math.abs(state.errorX) < 15;
      setIsLockedState(isLocked);

      if (confidenceRef.current) {
        confidenceRef.current.innerText = isLocked ? '98.0%' : '42.5%';
      }

      if (fpsRef.current) fpsRef.current.innerText = `${state.fps || 60}`;
      if (latencyRef.current) latencyRef.current.innerText = `${(state.cvLatency || 3.1).toFixed(1)}ms`;
      if (avgErrorRef.current) avgErrorRef.current.innerText = `${state.rmse.toFixed(1)}px`;
      if (lockRetentionRef.current) lockRetentionRef.current.innerText = `${state.lockRetentionRate.toFixed(1)}%`;

      if (statusRef.current) {
        statusRef.current.innerText = isLocked ? '■ LOCKED' : '■ SEARCH';
        statusRef.current.className = isLocked ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold animate-pulse';
      }

      // Add log entry on FSM state transition
      if (state.trackingState !== lastState) {
        lastState = state.trackingState;
        const timeStr = new Date().toTimeString().split(' ')[0];
        setLogs((prevLogs) => [
          ...prevLogs.slice(-40),
          {
            time: timeStr,
            text: state.trackingState === 'TRACKING' ? 'ACQ COMPLETE' : `${state.trackingState}`,
            type: state.trackingState === 'TRACKING' ? 'success' : 'info'
          }
        ]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Auto-scroll terminal log
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <aside className="w-56 h-full bg-[#080b11] border-l border-slate-800 flex flex-col justify-between p-2 space-y-1.5 text-[10px] font-mono select-none z-20 text-slate-300 overflow-y-auto">
      {/* MISSION */}
      <div className="bg-slate-950/60 rounded border border-slate-800/80 p-2 space-y-1">
        <div className="text-[10px] font-bold text-slate-100 tracking-wider border-b border-slate-800/80 pb-0.5">
          MISSION
        </div>
        <div className="space-y-0.5 text-[9px]">
          <div className="flex justify-between"><span className="text-slate-500">Scene</span><span className="text-slate-200 font-semibold">URBAN</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Target</span><span className="text-slate-200 font-semibold">TGT-01</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Traj</span><span className="text-slate-200 font-semibold truncate max-w-[90px]">{trajectoryPreset}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Status</span><span ref={statusRef} className="text-emerald-400 font-bold">■ LOCKED</span></div>
        </div>
      </div>

      {/* TRACKING */}
      <div className="bg-slate-950/60 rounded border border-slate-800/80 p-2 space-y-1">
        <div className="text-[10px] font-bold text-slate-100 tracking-wider border-b border-slate-800/80 pb-0.5">
          TRACKING
        </div>
        <div className="space-y-0.5 text-[9px]">
          <div className="flex justify-between"><span className="text-slate-500">Conf</span><span ref={confidenceRef} className="text-slate-100 font-bold">98.0%</span></div>
          <div className="flex justify-between"><span className="text-slate-500">PAN</span><span ref={panRef} className="text-slate-200 font-semibold">126.46°</span></div>
          <div className="flex justify-between"><span className="text-slate-500">TILT</span><span ref={tiltRef} className="text-slate-200 font-semibold">-0.42°</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Err</span><span ref={errorRef} className="text-amber-400 font-bold">0.7px</span></div>
        </div>
      </div>

      {/* PERFORMANCE */}
      <div className="bg-slate-950/60 rounded border border-slate-800/80 p-2 space-y-1">
        <div className="text-[10px] font-bold text-slate-100 tracking-wider border-b border-slate-800/80 pb-0.5">
          PERF
        </div>
        <div className="space-y-0.5 text-[9px]">
          <div className="flex justify-between"><span className="text-slate-500">FPS</span><span ref={fpsRef} className="text-slate-200 font-semibold">60</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Latency</span><span ref={latencyRef} className="text-slate-200 font-semibold">3.1ms</span></div>
          <div className="flex justify-between"><span className="text-slate-500">RMSE</span><span ref={avgErrorRef} className="text-slate-200 font-semibold">1.1px</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Retention</span><span ref={lockRetentionRef} className="text-slate-200 font-semibold">98.5%</span></div>
        </div>
      </div>

      {/* ADVANCED CONTROL & CV ANALYTICS GRAPH DECK */}
      <GraphSection />

      {/* EVENT LOG */}
      <div className="flex-1 bg-slate-950/80 rounded border border-slate-800/80 p-2 flex flex-col justify-between space-y-1 min-h-[120px]">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-0.5">
          <span className="text-[9px] font-bold text-slate-100 tracking-wider">LOG</span>
          <button
            onClick={handleClearLogs}
            className="text-[8px] text-slate-500 hover:text-slate-300"
          >
            Clear
          </button>
        </div>

        <div
          ref={logTerminalRef}
          className="flex-1 overflow-y-auto space-y-0.5 text-[8px] font-mono pr-0.5 select-text scrollbar-thin"
        >
          {logs.map((item, idx) => (
            <div key={idx} className="flex space-x-1.5 leading-tight">
              <span className="text-slate-500 shrink-0">{item.time}</span>
              <span
                className={
                  item.type === 'success'
                    ? 'text-emerald-400 font-semibold'
                    : item.type === 'warning'
                    ? 'text-amber-400'
                    : 'text-slate-300'
                }
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
