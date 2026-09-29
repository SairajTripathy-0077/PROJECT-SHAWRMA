import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { BarChart3, Radio, ShieldCheck, Activity } from 'lucide-react';

export default function AnalyticsPanel() {
  const { linkBudget } = useAppStore();

  return (
    <div className="space-y-2 font-mono text-[10px] select-none">
      <div className="flex items-center space-x-1.5 text-indigo-400 font-bold border-b border-slate-800 pb-1">
        <BarChart3 className="w-3.5 h-3.5" />
        <span>LINK BUDGET</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[8px] text-slate-400">RX POWER</span>
          <div className="text-[11px] font-bold text-cyan-300 mt-0.5">{linkBudget.pRxdBm} dBm</div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[8px] text-slate-400">MARGIN</span>
          <div className="text-[11px] font-bold text-emerald-400 mt-0.5">+{linkBudget.linkMargindB} dB</div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[8px] text-slate-400">BER</span>
          <div className="text-[11px] font-bold text-amber-400 mt-0.5">{linkBudget.berScientific}</div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
          <span className="text-[8px] text-slate-400">PATH LOSS</span>
          <div className="text-[11px] font-bold text-indigo-400 mt-0.5">{linkBudget.pathLossdB} dB</div>
        </div>
      </div>

      {/* Link Specs */}
      <div className="bg-slate-900/60 p-2 rounded border border-slate-800 space-y-1 text-[9px]">
        <div className="flex justify-between items-center text-slate-300 font-bold border-b border-slate-800 pb-0.5">
          <span>PHY LAYER (1550nm)</span>
          <span className="text-emerald-400 flex items-center space-x-0.5">
            <ShieldCheck className="w-2.5 h-2.5 inline" />
            <span>FEASIBLE</span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-slate-400">
          <div>λ: <span className="text-slate-200 font-bold">1550nm</span></div>
          <div>Range: <span className="text-slate-200 font-bold">2000m</span></div>
          <div>Tx: <span className="text-slate-200 font-bold">500mW</span></div>
          <div>Rx Ø: <span className="text-slate-200 font-bold">200mm</span></div>
          <div>Atm: <span className="text-slate-200 font-bold">0.45dB/km</span></div>
          <div>Ptg: <span className="text-slate-200 font-bold">1.20dB</span></div>
        </div>
      </div>
    </div>
  );
}
