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
    <div className="space-y-3 font-mono text-xs select-none">
      <div className="flex items-center space-x-2 text-rose-400 font-bold border-b border-slate-800 pb-1.5">
        <Activity className="w-4 h-4 text-rose-400" />
        <span>06. ENVIRONMENTAL DISTURBANCE & PHYSICS INJECTORS</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Jitter Amplitude */}
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
            <span>PLATFORM JITTER AMP</span>
            <span className="text-amber-400">{jitterAmp.toFixed(2)}°</span>
          </div>
          <input
            type="range"
            min="0.00"
            max="2.00"
            step="0.05"
            value={jitterAmp}
            onChange={(e) => setJitterAmp(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        {/* Jitter Frequency */}
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
            <span>JITTER FREQUENCY</span>
            <span className="text-amber-400">{jitterFreq} Hz</span>
          </div>
          <input
            type="range"
            min="5"
            max="50"
            step="1"
            value={jitterFreq}
            onChange={(e) => setJitterFreq(parseInt(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Turbulence Slider */}
      <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1.5">
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
          <span className="flex items-center space-x-1">
            <Flame className="w-3 h-3 text-orange-400" />
            <span>ATMOSPHERIC SCINTILLATION / HEAT SHIMMER (Cn²)</span>
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
          className="w-full accent-orange-400 cursor-pointer"
        />
      </div>

      {/* Drop LOS & Fog Injector Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={toggleDropLOS}
          className={`py-2 rounded font-bold text-[10px] flex items-center justify-center space-x-1.5 transition-all ${
            dropLOS
              ? 'bg-rose-500 text-white shadow-lg glow-red'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
          }`}
        >
          <CloudOff className="w-3.5 h-3.5" />
          <span>{dropLOS ? 'RECOVER LOS' : 'TRIGGER OCCLUSION (DROP LOS)'}</span>
        </button>

        <button
          onClick={injectHeavyFog}
          className="py-2 rounded font-bold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 flex items-center justify-center space-x-1.5"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>INJECT HEAVY FOG FADE</span>
        </button>
      </div>
    </div>
  );
}
