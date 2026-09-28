import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  Globe, 
  Camera, 
  Scan, 
  Crosshair, 
  BarChart3, 
  Activity, 
  FileText, 
  Settings, 
  User,
  Radio
} from 'lucide-react';

export default function SidebarNav() {
  const { activeTab, setActiveTab } = useAppStore();

  const tabs = [
    { id: 'ORBIT & BIOME', label: 'ORBIT & BIOME', icon: Globe },
    { id: 'OPTICAL SENSORS', label: 'OPTICAL SENSORS', icon: Camera },
    { id: 'CV MATRIX & MASK', label: 'CV MATRIX & MASK', icon: Scan },
    { id: 'KALMAN & PID DECK', label: 'KALMAN & PID DECK', icon: Crosshair },
    { id: 'OPTICAL LINK BUDGET', label: 'OPTICAL LINK BUDGET', icon: BarChart3 },
    { id: 'DISTURBANCE LAB', label: 'DISTURBANCE LAB', icon: Activity },
    { id: 'BENCHMARK LOGS', label: 'BENCHMARK LOGS', icon: FileText },
    { id: 'SYSTEM MATRIX', label: 'SYSTEM MATRIX', icon: Settings },
  ];

  return (
    <aside className="w-56 h-full bg-[#07090e] border-r border-slate-800 flex flex-col justify-between select-none z-20 text-slate-300 shadow-2xl">
      {/* Top Branding Section */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/50">
        <div className="flex items-center space-x-2.5">
          <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse glow-amber" />
          <h1 className="text-lg font-black tracking-widest text-slate-100 font-mono">
            RHEA
          </h1>
        </div>
        <p className="text-[9px] font-mono tracking-widest text-amber-500/80 mt-0.5 uppercase font-bold">
          FSOC MISSION CONTROL
        </p>

        {/* Live Pulse Indicator */}
        <div className="mt-3 flex items-center justify-between text-[9px] font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800">
          <div className="flex items-center space-x-1.5">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-bold">TELEMETRY LIVE</span>
          </div>
          <span className="text-[8px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-bold">419515M</span>
        </div>
      </div>

      {/* Navigation Menu List (Clean without numbers) */}
      <nav className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center space-x-3 text-xs font-mono font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-amber-300 border-l-4 border-amber-500 font-bold shadow-lg shadow-amber-500/10 glow-amber'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 border-l-4 border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="truncate tracking-wider font-bold">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom User/Operator Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded bg-slate-900 border border-slate-700 flex items-center justify-center shadow-inner">
            <User className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold text-slate-200">Demo Operator</span>
            <span className="text-[8px] font-mono text-emerald-400 font-bold">AUTH: LEVEL-4</span>
          </div>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse glow-emerald" />
      </div>
    </aside>
  );
}
