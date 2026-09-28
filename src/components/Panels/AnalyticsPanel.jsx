import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { BarChart3, Radio, ShieldCheck, Activity } from 'lucide-react';

export default function AnalyticsPanel() {
  const { linkBudget } = useAppStore();

  return (
    <div className="space-y-3 font-mono text-xs select-none">
      <div className="flex items-center space-x-2 text-indigo-400 font-bold border-b border-slate-800 pb-1.5">
        <BarChart3 className="w-4 h-4" />
        <span>05. OPTICAL LINK BUDGET & ATMOSPHERIC DIAGNOSTICS</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400">RX POWER</span>
          <div className="text-sm font-bold text-cyan-300 mt-1">{linkBudget.pRxdBm} dBm</div>
        </div>

        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400">LINK MARGIN</span>
          <div className="text-sm font-bold text-emerald-400 mt-1">+{linkBudget.linkMargindB} dB</div>
        </div>

        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400">BIT ERROR RATE</span>
          <div className="text-sm font-bold text-amber-400 mt-1">{linkBudget.berScientific}</div>
        </div>

        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400">PATH LOSS</span>
          <div className="text-sm font-bold text-indigo-400 mt-1">{linkBudget.pathLossdB} dB</div>
        </div>
      </div>

      {/* Optical Link Specs Card */}
      <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800 space-y-1.5 text-[10px]">
        <div className="flex justify-between items-center text-slate-300 font-bold border-b border-slate-800 pb-1">
          <span>PHYSICAL LAYER PARAMETERS (1550 nm Wavelength)</span>
          <span className="text-emerald-400 flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3 inline mr-1" />
            <span>LINK FEASIBLE</span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-slate-400">
          <div>Laser Wavelength: <span className="text-slate-200 font-bold">1550 nm</span></div>
          <div>Link Range: <span className="text-slate-200 font-bold">2000.0 m</span></div>
          <div>Tx Laser Power: <span className="text-slate-200 font-bold">500 mW</span></div>
          <div>Rx Aperture Dia: <span className="text-slate-200 font-bold">200 mm</span></div>
          <div>Atmospheric Loss: <span className="text-slate-200 font-bold">0.45 dB/km</span></div>
          <div>Pointing Loss: <span className="text-slate-200 font-bold">1.20 dB</span></div>
        </div>
      </div>
    </div>
  );
}
