import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Settings, Radio, Eye, Server, RefreshCw } from 'lucide-react';

export default function SettingsPanel() {
  const { 
    ipcConnected, setIpcConnected, 
    showPIP, setShowPIP 
  } = useAppStore();

  return (
    <div className="space-y-2 font-mono text-[10px] select-none">
      <div className="flex items-center space-x-1.5 text-slate-300 font-bold border-b border-slate-800 pb-1">
        <Settings className="w-3.5 h-3.5" />
        <span>SETTINGS</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {/* IPC Status */}
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[9px]">
            <span className="text-slate-400 font-bold flex items-center space-x-1">
              <Server className="w-2.5 h-2.5 text-cyan-400" />
              <span>WS IPC</span>
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${ipcConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          </div>
          <div className="text-[9px] text-slate-300 font-bold">
            <span className={ipcConnected ? 'text-emerald-400' : 'text-rose-400'}>{ipcConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
          </div>
        </div>

        {/* PIP Toggle */}
        <div className="bg-slate-900/80 p-2 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[9px]">
            <span className="text-slate-400 font-bold flex items-center space-x-1">
              <Eye className="w-2.5 h-2.5 text-amber-400" />
              <span>CV PIP</span>
            </span>
          </div>
          <button
            onClick={() => setShowPIP(!showPIP)}
            className={`w-full py-0.5 rounded text-[9px] font-bold border cursor-pointer ${
              showPIP ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showPIP ? 'VISIBLE' : 'HIDDEN'}
          </button>
        </div>
      </div>
    </div>
  );
}
