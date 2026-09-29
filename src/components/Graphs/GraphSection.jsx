import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PhaseSpaceAttractorPlot from './PhaseSpaceAttractorPlot';
import ActuatorEffortDecomposition from './ActuatorEffortDecomposition';
import KinematicCovarianceVSPMap from './KinematicCovarianceVSPMap';
import PhotonicTopologyMap from './PhotonicTopologyMap';
import { Activity, Maximize2, Minimize2, X } from 'lucide-react';

/**
 * Advanced 200 IQ Control & CV Graph Section
 * Houses 4 world-class aerospace charts with Maximize Modal Viewer & Escape Key handlers.
 */
export default function GraphSection() {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'ATTRACTOR', 'EFFORT', 'COVARIANCE', 'PHOTONIC'
  const [modalGraph, setModalGraph] = useState(null); // null, 'ATTRACTOR', 'EFFORT', 'COVARIANCE', 'PHOTONIC'

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && modalGraph !== null) {
        setModalGraph(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalGraph]);

  const graphTitles = {
    ATTRACTOR: {
      title: 'PHASE-SPACE ATTRACTOR PLOT',
      subtitle: 'Position Error vs Velocity Error Trajectory (Proves Zero Overshoot Critically Damped Stability)',
      color: 'text-cyan-400',
      component: <PhaseSpaceAttractorPlot isMaximized={true} />,
    },
    EFFORT: {
      title: 'ACTUATOR EFFORT DECOMPOSITION',
      subtitle: 'Feedforward (Base 92%), Proportional, and Integral Mechanical Load Breakdown vs Slew Limit',
      color: 'text-amber-400',
      component: <ActuatorEffortDecomposition isMaximized={true} />,
    },
    COVARIANCE: {
      title: 'KINEMATIC COVARIANCE & VSP MAP',
      subtitle: 'Overhead 2D Radar View displaying Kalman P Matrix Ellipses & Mahalanobis Barycenter Crosshair',
      color: 'text-emerald-400',
      component: <KinematicCovarianceVSPMap isMaximized={true} />,
    },
    PHOTONIC: {
      title: '3D PHOTONIC TOPOLOGY MAP',
      subtitle: '128x64 Merged ROI Surface Wireframe showing Voronoi Soft-Masked TCoG Photon Intensity',
      color: 'text-purple-400',
      component: <PhotonicTopologyMap isMaximized={true} />,
    },
  };

  return (
    <>
      {/* High-Resolution Graph Modal Viewer */}
      {modalGraph &&
        createPortal(
          <div className="fixed inset-0 z-[999999] bg-[#05070c]/95 backdrop-blur-xl p-6 flex flex-col justify-between font-mono select-none text-slate-200 border border-slate-700 shadow-2xl overflow-hidden">
            {/* Modal Header Bar */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <div className={`text-base font-bold tracking-wider ${graphTitles[modalGraph].color}`}>
                  {graphTitles[modalGraph].title}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {graphTitles[modalGraph].subtitle}
                </div>
              </div>

              <div className="flex items-center space-x-3 pointer-events-auto">
                <button
                  onClick={() => setModalGraph(null)}
                  title="Minimize Graph back to Dashboard (ESC)"
                  className="bg-amber-950/90 hover:bg-amber-900 text-amber-300 border border-amber-500/80 px-4 py-2 rounded-lg flex items-center space-x-2 text-xs font-mono font-bold cursor-pointer shadow-2xl backdrop-blur-md transition-all glow-amber"
                >
                  <Minimize2 className="w-4 h-4 text-amber-400" />
                  <span>MINIMIZE [ESC]</span>
                </button>
              </div>
            </div>

            {/* Modal Graph Main Stage */}
            <div className="flex-1 w-full my-4 relative rounded-xl border border-slate-800 bg-[#04060a] p-4 flex flex-col justify-center items-center overflow-hidden">
              {graphTitles[modalGraph].component}
            </div>

            {/* Modal Footer Controls Info */}
            <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-800 pt-2">
              <span className="text-slate-500 font-bold">FSOC PAT SIMULATOR — ANALYTICS ENGINE</span>
              <span className="text-emerald-400 font-bold">REAL-TIME SAMPLING RATE: 60 FPS</span>
            </div>
          </div>,
          document.body
        )}

      {/* Main Panel Graphs Container */}
      <div className="bg-slate-950/80 rounded border border-slate-800/80 p-2 space-y-2 select-none">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <div className="flex items-center space-x-1.5 text-cyan-400 font-mono font-bold text-[10px]">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>CONTROL & CV ANALYTICS</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab(activeTab === 'ALL' ? 'ATTRACTOR' : 'ALL')}
              className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-300 cursor-pointer"
            >
              {activeTab === 'ALL' ? 'TABBED' : 'SHOW ALL'}
            </button>
          </div>
        </div>

        {/* Tab Navigation if in Tabbed Mode */}
        {activeTab !== 'ALL' && (
          <div className="grid grid-cols-4 gap-1 text-[8px] font-mono">
            <button
              onClick={() => setActiveTab('ATTRACTOR')}
              className={`p-1 rounded text-center border transition-all cursor-pointer ${
                activeTab === 'ATTRACTOR' ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              ATTRACTOR
            </button>
            <button
              onClick={() => setActiveTab('EFFORT')}
              className={`p-1 rounded text-center border transition-all cursor-pointer ${
                activeTab === 'EFFORT' ? 'bg-amber-950 border-amber-500 text-amber-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              EFFORT
            </button>
            <button
              onClick={() => setActiveTab('COVARIANCE')}
              className={`p-1 rounded text-center border transition-all cursor-pointer ${
                activeTab === 'COVARIANCE' ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              VSP RADAR
            </button>
            <button
              onClick={() => setActiveTab('PHOTONIC')}
              className={`p-1 rounded text-center border transition-all cursor-pointer ${
                activeTab === 'PHOTONIC' ? 'bg-purple-950 border-purple-500 text-purple-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              TOPOLOGY
            </button>
          </div>
        )}

        {/* Graph Cards Display Area */}
        <div className="space-y-2.5">
          {(activeTab === 'ALL' || activeTab === 'ATTRACTOR') && (
            <div className="relative group">
              <button
                onClick={() => setModalGraph('ATTRACTOR')}
                title="Maximize Phase-Space Attractor Graph"
                className="absolute top-1.5 right-1.5 z-20 p-1 rounded bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-400 cursor-pointer shadow transition-all"
              >
                <Maximize2 className="w-2.5 h-2.5" />
              </button>
              <PhaseSpaceAttractorPlot />
            </div>
          )}

          {(activeTab === 'ALL' || activeTab === 'EFFORT') && (
            <div className="relative group">
              <button
                onClick={() => setModalGraph('EFFORT')}
                title="Maximize Actuator Effort Graph"
                className="absolute top-1.5 right-1.5 z-20 p-1 rounded bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-400 cursor-pointer shadow transition-all"
              >
                <Maximize2 className="w-2.5 h-2.5" />
              </button>
              <ActuatorEffortDecomposition />
            </div>
          )}

          {(activeTab === 'ALL' || activeTab === 'COVARIANCE') && (
            <div className="relative group">
              <button
                onClick={() => setModalGraph('COVARIANCE')}
                title="Maximize Covariance & VSP Radar Map"
                className="absolute top-1.5 right-1.5 z-20 p-1 rounded bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-400 cursor-pointer shadow transition-all"
              >
                <Maximize2 className="w-2.5 h-2.5" />
              </button>
              <KinematicCovarianceVSPMap />
            </div>
          )}

          {(activeTab === 'ALL' || activeTab === 'PHOTONIC') && (
            <div className="relative group">
              <button
                onClick={() => setModalGraph('PHOTONIC')}
                title="Maximize 3D Photonic Topology Map"
                className="absolute top-1.5 right-1.5 z-20 p-1 rounded bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-400 cursor-pointer shadow transition-all"
              >
                <Maximize2 className="w-2.5 h-2.5" />
              </button>
              <PhotonicTopologyMap />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
