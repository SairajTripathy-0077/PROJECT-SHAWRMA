import React, { useState, useEffect } from 'react';
import { Pause, Play, Square, Monitor, Cpu, Layers } from 'lucide-react';

export default function AsteriaHeader({
  isPaused = false,
  onTogglePause,
  onEndDemo,
  viewDimension = '3D',
  onChangeDimension,
  onToggleFullscreen
}) {
  const [utcTime, setUtcTime] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(81.3);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const iso = now.toISOString().replace('T', ' ').substring(0, 19);
      setUtcTime(`${iso} UTC`);
    };

    updateClock();
    const interval = setInterval(() => {
      updateClock();
      if (!isPaused) {
        setElapsedSeconds((prev) => prev + 0.1);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <header className="w-full h-11 bg-[#080b11] border-b border-slate-800 px-4 flex items-center justify-between text-xs font-mono select-none z-20">
      {/* Left: Clock & Simulation Indicator */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="text-amber-400 font-bold">{utcTime || '2026-09-28 21:59:56 UTC'}</span>
          <span className="text-slate-500 font-medium">- T+{elapsedSeconds.toFixed(1)}s</span>
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[10px]">
          <span className="w-1.5 h-1.5 rounded-sm bg-amber-400 animate-pulse" />
          <span className="text-amber-400 font-bold tracking-widest">SIMULATION</span>
        </div>
      </div>

      {/* Center: Control Buttons */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onTogglePause}
          className="px-3 py-1 rounded bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-slate-200 hover:text-amber-400 text-[11px] font-bold flex items-center space-x-1.5 transition-all"
        >
          {isPaused ? (
            <>
              <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
              <span>RESUME</span>
            </>
          ) : (
            <>
              <Pause className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>PAUSE</span>
            </>
          )}
        </button>

        <button
          onClick={onEndDemo}
          className="px-3 py-1 rounded bg-slate-900 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-400 text-[11px] font-bold flex items-center space-x-1.5 transition-all"
        >
          <Square className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
          <span>END DEMO</span>
        </button>
      </div>

      {/* Right: 3D / 2D View Switcher & Fullscreen */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-800 text-[10px]">
          <button
            onClick={() => onChangeDimension && onChangeDimension('3D')}
            className={`px-2 py-0.5 rounded font-bold transition-all ${
              viewDimension === '3D'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            3D
          </button>
          <button
            onClick={() => onChangeDimension && onChangeDimension('2D')}
            className={`px-2 py-0.5 rounded font-bold transition-all ${
              viewDimension === '2D'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            2D
          </button>
        </div>

        <button
          onClick={onToggleFullscreen}
          title="Toggle OS Fullscreen"
          className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
        >
          <Monitor className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
