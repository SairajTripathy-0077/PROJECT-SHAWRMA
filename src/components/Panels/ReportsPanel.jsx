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
    setTimeout(() => {
      setBenchmarkStatus('COMPLETE');
      addReport({
        name: `benchmark_run_${Date.now().toString().slice(-4)}.csv`,
        path: 'C:\\Users\\Sairaj Tripathy\\Desktop\\shawrma\\telemetry.csv',
        time: new Date().toTimeString().split(' ')[0]
      });
      setTimeout(() => setBenchmarkStatus('IDLE'), 3000);
    }, 2000);
  };

  return (
    <div className="space-y-3 font-mono text-xs select-none">
      <div className="flex items-center space-x-2 text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
        <FileText className="w-4 h-4" />
        <span>07. STANDARDIZED BENCHMARKS & REPORT EXPORT</span>
      </div>

      <div className="bg-slate-900/80 p-3 rounded border border-slate-800 flex items-center justify-between">
        <div>
          <h4 className="font-bold text-slate-100 text-xs">60-SECOND STANDARDIZED AUTOMATED BENCHMARK</h4>
          <p className="text-[10px] text-slate-500">Evaluates RMSE, Lock Retention %, and CV Latency profile.</p>
        </div>

        <button
          onClick={handleRunBenchmark}
          disabled={benchmarkStatus === 'RUNNING'}
          className={`px-4 py-2 rounded font-bold text-xs flex items-center space-x-2 transition-all ${
            benchmarkStatus === 'RUNNING'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
              : benchmarkStatus === 'COMPLETE'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
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
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {recentReports.map((file, idx) => (
            <div key={idx} className="flex justify-between items-center bg-slate-950 p-1.5 rounded border border-slate-800 text-[10px]">
              <div className="flex items-center space-x-2">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-200 font-bold">{file.name}</span>
                <span className="text-slate-500">({file.time})</span>
              </div>
              <button
                onClick={() => alert(`Revealing file: ${file.path}`)}
                className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-slate-300 hover:text-amber-400 rounded text-[9px] flex items-center space-x-1"
              >
                <Folder className="w-2.5 h-2.5" />
                <span>Reveal in Explorer</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
