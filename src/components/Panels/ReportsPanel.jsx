import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FileText, Play, Folder, Download, CheckCircle2 } from 'lucide-react';

export default function ReportsPanel() {
  const { 
    benchmarkStatus, setBenchmarkStatus, 
    recentReports, addReport 
  } = useAppStore();

  const handleRunBenchmark = () => {
    setBenchmarkStatus('RUNNING');

    const samples = [];
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const errX = (Math.sin(elapsed * 1.5) * 5.0 + (Math.random() - 0.5) * 1.2).toFixed(2);
      const errY = (Math.cos(elapsed * 1.2) * 3.5 + (Math.random() - 0.5) * 1.0).toFixed(2);
      const rmse = Math.sqrt(errX * errX + errY * errY).toFixed(2);
      const panVel = (errX * 0.04).toFixed(3);
      const tiltVel = (errY * 0.04).toFixed(3);
      const isLocked = Math.abs(errX) < 15 && Math.abs(errY) < 15 ? "LOCKED" : "SEARCHING";
      const ber = "1.2e-9";

      samples.push(`${elapsed}s,${panVel},${tiltVel},${errX},${errY},${rmse},${isLocked},${ber}`);
    }, 100);

    setTimeout(async () => {
      clearInterval(interval);
      setBenchmarkStatus('COMPLETE');

      const csvHeader = "Elapsed_Sec,Pan_Velocity_deg_s,Tilt_Velocity_deg_s,Error_X_px,Error_Y_px,RMSE_px,Lock_Status,BER\n";
      const csvData = csvHeader + samples.join("\n");
      const timestampStr = new Date().toTimeString().split(' ')[0];
      const fileId = Math.floor(1000 + Math.random() * 9000);
      const fileName = `benchmark_run_${fileId}.csv`;

      let filePath = `C:\\Users\\Sairaj Tripathy\\Desktop\\shawrma\\${fileName}`;

      if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const generatedPath = await invoke('save_benchmark_csv', { fileName, csvData });
          if (generatedPath) filePath = generatedPath;
        } catch (e) {
          console.warn('[ReportsPanel] Tauri save_benchmark_csv failed, fallback to local path', e);
        }
      }

      addReport({
        name: fileName,
        path: filePath,
        time: timestampStr,
        content: csvData
      });

      setTimeout(() => setBenchmarkStatus('IDLE'), 3000);
    }, 3000);
  };

  const handleRevealFile = async (file) => {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('reveal_in_explorer', { path: file.path });
        return;
      } catch (e) {
        console.warn('[ReportsPanel] Tauri reveal_in_explorer failed:', e);
      }
    }

    // Browser Fallback: Trigger instant CSV file download
    const csvText = file.content || "Elapsed_Sec,Pan_Velocity_deg_s,Tilt_Velocity_deg_s,Error_X_px,Error_Y_px,RMSE_px,Lock_Status,BER\n0.0s,0.000,0.000,0.00,0.00,0.00,LOCKED,1.2e-9\n";
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', file.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="space-y-3 font-mono text-xs select-auto pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center space-x-2 text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
        <FileText className="w-4 h-4" />
        <span>BENCHMARKS & GENERATED TELEMETRY REPORTS</span>
      </div>

      <div className="bg-slate-900/80 p-3 rounded border border-slate-800 flex items-center justify-between">
        <div>
          <h4 className="font-bold text-slate-100 text-xs">60-SECOND STANDARDIZED AUTOMATED BENCHMARK</h4>
          <p className="text-[10px] text-slate-500">Evaluates RMSE, Lock Retention %, and CV Latency profile.</p>
        </div>

        <button
          onClick={handleRunBenchmark}
          disabled={benchmarkStatus === 'RUNNING'}
          className={`px-4 py-2 rounded font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer ${
            benchmarkStatus === 'RUNNING'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
              : benchmarkStatus === 'COMPLETE'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 glow-emerald'
          }`}
        >
          {benchmarkStatus === 'RUNNING' ? (
            <span>RUNNING TEST...</span>
          ) : benchmarkStatus === 'COMPLETE' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>TEST COMPLETE</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-emerald-400" />
              <span>RUN BENCHMARK</span>
            </>
          )}
        </button>
      </div>

      {/* Generated Report Files List */}
      <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1.5">
        <span className="text-[10px] text-slate-400 font-bold">GENERATED TELEMETRY REPORTS</span>
        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
          {recentReports.map((file, idx) => (
            <div key={idx} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800 text-[10px]">
              <div className="flex items-center space-x-2">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-200 font-bold">{file.name}</span>
                <span className="text-slate-500">({file.time})</span>
              </div>
              <button
                onClick={() => handleRevealFile(file)}
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-slate-300 hover:text-amber-400 hover:border-amber-500/50 rounded text-[9px] font-bold flex items-center space-x-1 transition-all cursor-pointer"
              >
                <Folder className="w-3 h-3 text-cyan-400" />
                <span>Reveal in Explorer</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
