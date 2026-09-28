import React, { useEffect, useRef, useState } from 'react';
import { telemetryStore } from '../stores/telemetryStore';
import { computeFSOCLinkBudget } from '../utils/linkBudget';
import { Activity, Target, Shield, Radio, Eye, Camera, CheckCircle2, Zap } from 'lucide-react';

export default function TacticalHUD({ sensorMode = 0, onChangeSensorMode, zoomFov = 45, onChangeZoomFov }) {
  const errXRef = useRef(null);
  const errYRef = useRef(null);
  const rmseRef = useRef(null);
  const lrrRef = useRef(null);
  const prxRef = useRef(null);
  const marginRef = useRef(null);
  const berRef = useRef(null);
  const stateBadgeRef = useRef(null);
  const canvasPlotRef = useRef(null);

  const [linkData, setLinkData] = useState({
    pRxdBm: -22.4,
    linkMargindB: 7.6,
    berScientific: '1.20e-9',
    isLinkFeasible: true
  });

  // Transient Pub-Sub Subscription for zero-rerender high-frequency updates
  useEffect(() => {
    const unsubscribe = telemetryStore.subscribe((state) => {
      if (errXRef.current) errXRef.current.innerText = `${state.errorX.toFixed(1)}px`;
      if (errYRef.current) errYRef.current.innerText = `${state.errorY.toFixed(1)}px`;
      if (rmseRef.current) rmseRef.current.innerText = `${state.rmse.toFixed(2)}px`;
      if (lrrRef.current) lrrRef.current.innerText = `${state.lockRetentionRate.toFixed(1)}%`;
      if (stateBadgeRef.current) stateBadgeRef.current.innerText = `FSM: ${state.trackingState}`;

      // Compute physical link budget dynamically
      const budget = computeFSOCLinkBudget({
        distanceMeters: 2000,
        transmitPowerWatts: 0.5,
        fogDensity: state.errorX > 20 ? 10 : 0
      });

      if (prxRef.current) prxRef.current.innerText = `${budget.pRxdBm} dBm`;
      if (marginRef.current) marginRef.current.innerText = `${budget.linkMargindB} dB`;
      if (berRef.current) berRef.current.innerText = budget.berScientific;

      // Draw HTML5 Canvas2D High-Speed 200-Frame Line Plotter
      drawCanvasPlot(canvasPlotRef.current, state.errorHistory);
    });

    return () => unsubscribe();
  }, []);

  const drawCanvasPlot = (canvas, history) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (!history || history.length < 2) return;

    // Draw Error X line (Cyan)
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = h / 2 - (pt.errX / 60) * (h / 2);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Error Y line (Emerald)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = h / 2 - (pt.errY / 60) * (h / 2);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  return (
    <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3 font-mono text-xs select-none">
      {/* Header & Multi-Spectral Controls */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2 text-cyan-400 font-bold">
          <Radio className="w-4 h-4 animate-pulse" />
          <span>ZERO-JANK HUD & OPTICAL LINK BUDGET</span>
        </div>

        {/* Camera Sensor Mode Buttons */}
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-slate-400">SENSOR:</span>
          <button
            onClick={() => onChangeSensorMode(0)}
            className={`px-2.5 py-1 rounded text-[10px] font-bold border ${
              sensorMode === 0 ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            VIS RGB
          </button>
          <button
            onClick={() => onChangeSensorMode(1)}
            className={`px-2.5 py-1 rounded text-[10px] font-bold border ${
              sensorMode === 1 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            SWIR THERMAL
          </button>
          <button
            onClick={() => onChangeSensorMode(2)}
            className={`px-2.5 py-1 rounded text-[10px] font-bold border ${
              sensorMode === 2 ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            WHITE-HOT
          </button>
        </div>
      </div>

      {/* Numerical Metrics Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400">ERR X / Y</span>
          <div className="text-[11px] font-bold text-emerald-400 mt-1">
            <span ref={errXRef}>0.0px</span> / <span ref={errYRef}>0.0px</span>
          </div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400">RMS ERROR</span>
          <div className="text-[11px] font-bold text-amber-400 mt-1" ref={rmseRef}>
            0.00px
          </div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400">LOCK RETENTION</span>
          <div className="text-[11px] font-bold text-indigo-400 mt-1" ref={lrrRef}>
            100.0%
          </div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400">FSM STATE</span>
          <div className="text-[10px] font-bold text-cyan-300 mt-1" ref={stateBadgeRef}>
            FSM: SEARCHING
          </div>
        </div>
      </div>

      {/* FSOC Physical Link Budget Panel */}
      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
        <div className="flex justify-between items-center text-[10px] text-slate-300 font-bold border-b border-slate-800 pb-1">
          <span>OPTICAL LINK DIAGNOSTICS (1550 nm / 2.0 km RANGE)</span>
          <span className="text-emerald-400">LINK MARGIN ACTIVE</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <span className="text-slate-400">RX Power: </span>
            <span ref={prxRef} className="font-bold text-cyan-300">-22.4 dBm</span>
          </div>
          <div>
            <span className="text-slate-400">Link Margin: </span>
            <span ref={marginRef} className="font-bold text-emerald-400">+7.6 dB</span>
          </div>
          <div>
            <span className="text-slate-400">BER: </span>
            <span ref={berRef} className="font-bold text-amber-400">1.20e-9</span>
          </div>
        </div>
      </div>

      {/* HTML5 Canvas2D Accelerated High-Speed 200-Frame Error Plot */}
      <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
        <div className="flex justify-between items-center mb-1 text-[9px] text-slate-400 font-bold">
          <span>CANVAS2D HIGH-SPEED 200-FRAME LINE PLOTTER</span>
          <span className="text-cyan-400">60-120 FPS ZERO-JANK</span>
        </div>

        <canvas
          ref={canvasPlotRef}
          width={450}
          height={80}
          className="w-full h-20 rounded bg-slate-950/80"
        />
      </div>
    </div>
  );
}
