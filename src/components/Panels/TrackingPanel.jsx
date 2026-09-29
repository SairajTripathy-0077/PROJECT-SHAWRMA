import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Crosshair, RefreshCw } from 'lucide-react';

export default function TrackingPanel() {
  const { 
    pidGains, 
    updatePidGains, 
    resetGains, 
    searchSpiralRadius, 
    setSearchSpiralRadius 
  } = useAppStore();

  const handleGainChange = (key, value) => {
    updatePidGains({ ...pidGains, [key]: parseFloat(value) });
  };

  return (
    <div className="space-y-2 font-mono text-[10px] select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
        <div className="flex items-center space-x-1.5 text-cyan-400 font-bold">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
          <span>PID GAINS & TRACKING</span>
        </div>
        <button
          onClick={resetGains}
          className="text-[9px] bg-slate-900 border border-slate-700 hover:border-amber-500 text-slate-300 hover:text-amber-400 px-1.5 py-0.5 rounded font-bold flex items-center space-x-1 cursor-pointer"
        >
          <RefreshCw className="w-2.5 h-2.5" />
          <span>RESET</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Pan Axis */}
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[9px]">
            <span className="text-cyan-300 font-bold">PAN AXIS (AZIMUTH)</span>
            <span className="text-slate-500 font-mono">CLOSED-LOOP</span>
          </div>

          <div className="space-y-1">
            <div>
              <div className="flex justify-between text-[9px] text-slate-400">
                <span>Kp (Proportional)</span>
                <span className="text-cyan-300 font-bold">{pidGains.kp_pan.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.30"
                step="0.005"
                value={pidGains.kp_pan}
                onChange={(e) => handleGainChange('kp_pan', e.target.value)}
                className="w-full accent-cyan-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
              />
            </div>

            <div>
              <div className="flex justify-between text-[9px] text-slate-400">
                <span>Ki (Integral)</span>
                <span className="text-cyan-300 font-bold">{pidGains.ki_pan.toFixed(4)}</span>
              </div>
              <input
                type="range"
                min="0.000"
                max="0.030"
                step="0.001"
                value={pidGains.ki_pan}
                onChange={(e) => handleGainChange('ki_pan', e.target.value)}
                className="w-full accent-cyan-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
              />
            </div>

            <div>
              <div className="flex justify-between text-[9px] text-slate-400">
                <span>Kd (Derivative)</span>
                <span className="text-cyan-300 font-bold">{pidGains.kd_pan.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.000"
                max="0.060"
                step="0.002"
                value={pidGains.kd_pan}
                onChange={(e) => handleGainChange('kd_pan', e.target.value)}
                className="w-full accent-cyan-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
              />
            </div>
          </div>
        </div>

        {/* Tilt Axis */}
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[9px]">
            <span className="text-emerald-300 font-bold">TILT AXIS (ELEVATION)</span>
            <span className="text-slate-500 font-mono">CLOSED-LOOP</span>
          </div>

          <div className="space-y-1">
            <div>
              <div className="flex justify-between text-[9px] text-slate-400">
                <span>Kp (Proportional)</span>
                <span className="text-emerald-300 font-bold">{pidGains.kp_tilt.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.30"
                step="0.005"
                value={pidGains.kp_tilt}
                onChange={(e) => handleGainChange('kp_tilt', e.target.value)}
                className="w-full accent-emerald-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
              />
            </div>

            <div>
              <div className="flex justify-between text-[9px] text-slate-400">
                <span>Ki (Integral)</span>
                <span className="text-emerald-300 font-bold">{pidGains.ki_tilt.toFixed(4)}</span>
              </div>
              <input
                type="range"
                min="0.000"
                max="0.030"
                step="0.001"
                value={pidGains.ki_tilt}
                onChange={(e) => handleGainChange('ki_tilt', e.target.value)}
                className="w-full accent-emerald-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
              />
            </div>

            <div>
              <div className="flex justify-between text-[9px] text-slate-400">
                <span>Kd (Derivative)</span>
                <span className="text-emerald-300 font-bold">{pidGains.kd_tilt.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.000"
                max="0.060"
                step="0.002"
                value={pidGains.kd_tilt}
                onChange={(e) => handleGainChange('kd_tilt', e.target.value)}
                className="w-full accent-emerald-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Spiral Radius */}
      <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 flex justify-between items-center text-[9px]">
        <span className="text-slate-400 font-bold">SEARCH SPIRAL RADIUS</span>
        <div className="flex items-center space-x-2 w-40">
          <input
            type="range"
            min="5"
            max="40"
            step="1"
            value={searchSpiralRadius}
            onChange={(e) => setSearchSpiralRadius(parseFloat(e.target.value))}
            className="w-full accent-indigo-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
          />
          <span className="text-indigo-400 font-bold w-10 text-right">{searchSpiralRadius}°</span>
        </div>
      </div>
    </div>
  );
}
