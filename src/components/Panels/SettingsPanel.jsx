import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Settings, Radio, Eye, Server, RefreshCw } from 'lucide-react';

export default function SettingsPanel() {
  const { 
    ipcConnected, setIpcConnected, 
    showPIP, setShowPIP 
  } = useAppStore();

  return (
    <div className="space-y-3 font-mono text-xs select-none">
      <div className="flex items-center space-x-2 text-slate-300 font-bold border-b border-slate-800 pb-1.5">
        <Settings className="w-4 h-4" />
        <span>08. APPLICATION SETTINGS & IPC STATUS</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* IPC Connection Status */}
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-400 font-bold flex items-center space-x-1">
              <Server className="w-3 h-3 text-cyan-400" />
              <span>PYTHON WEBSOCKET IPC</span>
            </span>
            <span className={`w-2 h-2 rounded-full ${ipcConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          </div>
          <div className="text-[10px] text-slate-300 font-bold">
            STATUS: <span className={ipcConnected ? 'text-emerald-400' : 'text-rose-400'}>{ipcConnected ? 'CONNECTED (ws://localhost:8765)' : 'DISCONNECTED'}</span>
          </div>
        </div>

        {/* OpenCV PIP Feed Toggle */}
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-400 font-bold flex items-center space-x-1">
              <Eye className="w-3 h-3 text-amber-400" />
              <span>OPENCV PIP FEED OVERLAY</span>
            </span>
          </div>
          <button
            onClick={() => setShowPIP(!showPIP)}
            className={`w-full py-1 rounded text-[10px] font-bold border ${
              showPIP ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showPIP ? 'OPENCV PIP VISIBLE' : 'OPENCV PIP HIDDEN'}
          </button>
        </div>
      </div>
    </div>
  );
}
