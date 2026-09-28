import React from 'react';
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

export default function RheaSidebar({ activeTab = '01 ENVIRONMENT', onSelectTab }) {
  const tabs = [
    { id: '01 ENVIRONMENT', label: 'ENVIRONMENT', icon: Globe },
    { id: '02 CAMERA', label: 'CAMERA', icon: Camera },
    { id: '03 DETECTION', label: 'DETECTION', icon: Scan },
    { id: '04 TRACKING', label: 'TRACKING', icon: Crosshair },
    { id: '05 ANALYTICS', label: 'ANALYTICS', icon: BarChart3 },
    { id: '06 DISTURBANCE LAB', label: 'DISTURBANCE LAB', icon: Activity },
    { id: '07 REPORTS', label: 'REPORTS', icon: FileText },
    { id: '08 SETTINGS', label: 'SETTINGS', icon: Settings },
  ];

  return (
    <aside className="w-56 h-full bg-[#080b11] border-r border-slate-800 flex flex-col justify-between select-none z-20 text-slate-300">
      {/* Top Branding Section */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse glow-amber" />
          <h1 className="text-base font-extrabold tracking-wider text-slate-100 font-mono">
            RHEA
          </h1>
        </div>
        <p className="text-[9px] font-mono tracking-widest text-slate-400 mt-0.5 uppercase">
          FSOC MISSION CONTROL
        </p>

        {/* Live Pulse Indicator */}
        <div className="mt-3 flex items-center justify-between text-[9px] font-mono text-slate-400 bg-slate-900/60 px-2 py-1 rounded border border-slate-800">
          <div className="flex items-center space-x-1.5">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-bold">TELEMETRY LIVE</span>
          </div>
          <span className="text-[8px] bg-slate-800 px-1 py-0.2 rounded text-slate-400">419515M</span>
        </div>
      </div>

      {/* Navigation Menu List */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab && onSelectTab(tab.id)}
              className={`w-full text-left px-3 py-2 rounded flex items-center space-x-3 text-xs font-mono font-medium transition-all ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <span className="text-[10px] text-slate-500 w-4">{tab.id.split(' ')[0]}</span>
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              <span className="truncate tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom User/Operator Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold text-slate-200">Demo Operator</span>
            <span className="text-[8px] font-mono text-slate-500">AUTH: LEVEL-4</span>
          </div>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </div>
    </aside>
  );
}
