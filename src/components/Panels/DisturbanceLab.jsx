import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Activity, CloudOff, AlertTriangle, Flame } from 'lucide-react';

export default function DisturbanceLab() {
  const { 
    jitterAmp, setJitterAmp, 
    jitterFreq, setJitterFreq, 
    turbulence, setTurbulence, 
    dropLOS, toggleDropLOS, 
    injectHeavyFog 
  } = useAppStore();

  return (
    <div className="space-y-2 font-mono text-[10px] select-none">
      <div className="flex items-center space-x-1.5 text-rose-400 font-bold border-b border-slate-800 pb-1">
        <Activity className="w-3.5 h-3.5 text-rose-400" />
        <span>DISTURBANCES</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Jitter Amp */}
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
            <span>JITTER AMP</span>
            <span className="text-amber-400">{jitterAmp.toFixed(2)}°</span>
          </div>
          <input
            type="range"
            min="0.00"
            max="2.00"
            step="0.05"
            value={jitterAmp}
            onChange={(e) => setJitterAmp(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
          />
        </div>

        {/* Jitter Freq */}
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
            <span>JITTER FREQ</span>
            <span className="text-amber-400">{jitterFreq} Hz</span>
          </div>
          <input
            type="range"
            min="5"
            max="50"
            step="1"
            value={jitterFreq}
            onChange={(e) => setJitterFreq(parseInt(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
          />
        </div>
      </div>

      {/* Turbulence */}
      <div className="bg-slate-900/80 p-2 rounded border border-slate-800 space-y-1">
        <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
          <span className="flex items-center space-x-1">
            <Flame className="w-3 h-3 text-orange-400" />
            <span>TURBULENCE (Cn²)</span>
          </span>
          <span className="text-orange-400 font-bold">{turbulence}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={turbulence}
          onChange={(e) => setTurbulence(parseInt(e.target.value))}
          className="w-full accent-orange-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={toggleDropLOS}
          className={`py-1.5 rounded font-bold text-[9px] flex items-center justify-center space-x-1 transition-all cursor-pointer ${
            dropLOS
              ? 'bg-rose-500 text-white shadow-lg glow-red'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
          }`}
        >
          <CloudOff className="w-3 h-3" />
          <span>{dropLOS ? 'RECOVER LOS' : 'DROP LOS'}</span>
        </button>

        <button
          onClick={injectHeavyFog}
          className="py-1.5 rounded font-bold text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 flex items-center justify-center space-x-1 cursor-pointer"
        >
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span>INJECT FOG</span>
        </button>
      </div>
    </div>
  );
}
