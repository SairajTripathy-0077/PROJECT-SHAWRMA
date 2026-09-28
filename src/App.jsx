import React, { useState, useEffect, useRef } from 'react';
import AsteriaSidebar from './components/AsteriaSidebar';
import AsteriaHeader from './components/AsteriaHeader';
import AsteriaRightPanel from './components/AsteriaRightPanel';
import DualViewportScene from './components/DualViewportScene';
import TuningDeck from './components/TuningDeck';
import TacticalHUD from './components/TacticalHUD';
import { videoBridge } from './services/videoBridge';
import { telemetryStore } from './stores/telemetryStore';
import { benchmarkRunner } from './services/benchmarkRunner';
import { Sliders, Activity, ChevronUp, ChevronDown, Radio, BarChart3, Settings } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('01 ENVIRONMENT');
  const [isPaused, setIsPaused] = useState(false);
  const [viewDimension, setViewDimension] = useState('3D');
  const [showTuningDrawer, setShowTuningDrawer] = useState(false);

  const [pan, setPan] = useState(0.0);
  const [tilt, setTilt] = useState(0.0);
  const [isTrackingActive, setIsTrackingActive] = useState(true);
  const [trackingState, setTrackingState] = useState('SEARCHING');

  // Multi-Spectral & Zoom Controls
  const [sensorMode, setSensorMode] = useState(0);
  const [zoomFov, setZoomFov] = useState(45);

  // Disturbance Deck State
  const [jitterAmp, setJitterAmp] = useState(0.05);
  const [jitterFreq, setJitterFreq] = useState(25);
  const [turbulence, setTurbulence] = useState(0);
  const [dropLOS, setDropLOS] = useState(false);
  const [trajectoryPreset, setTrajectoryPreset] = useState('SINUSOIDAL');

  // Critically Damped Dual-Axis PID Gains (Zero Overshooting)
  const [pidGains, setPidGains] = useState({
    kp_pan: 0.04,
    ki_pan: 0.001,
    kd_pan: 0.02,
    kp_tilt: 0.04,
    ki_tilt: 0.001,
    kd_tilt: 0.02
  });

  const canvasRef = useRef(null);
  const pixelErrorRef = useRef({ x: 0, y: 0 });
  const errorBufferRef = useRef([]);
  const frameCountRef = useRef(0);

  // Switch drawer open state automatically when clicking specific tabs
  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (tabId === '04 TRACKING' || tabId === '05 ANALYTICS' || tabId === '06 DISTURBANCE LAB' || tabId === '08 SETTINGS') {
      setShowTuningDrawer(true);
    } else if (tabId === '01 ENVIRONMENT') {
      setShowTuningDrawer(false);
    }
  };

  // Initialize Video Bridge with Telemetry Listener
  useEffect(() => {
    videoBridge.init('ws://localhost:8765', (feedback) => {
      if (!feedback) return;

      const {
        state = 'SEARCHING',
        pan_vel = 0,
        tilt_vel = 0,
        pan_velocity = 0,
        tilt_velocity = 0,
        error_px = [0, 0],
        rmse = 0.0,
        binary_frame_b64 = null
      } = feedback;

      const pVel = pan_vel !== undefined ? pan_vel : pan_velocity;
      const tVel = tilt_vel !== undefined ? tilt_vel : tilt_velocity;
      const [errX, errY] = error_px || [0, 0];

      // Smooth step integration without over-gain multiplier
      if (isTrackingActive && !isPaused) {
        setPan((prev) => prev + pVel * 1.0);
        setTilt((prev) => prev + tVel * 1.0);
      }

      setTrackingState(state);

      frameCountRef.current++;
      const isLocked = Math.abs(errX) < 15 && Math.abs(errY) < 15;
      errorBufferRef.current.push({ errX, errY, locked: isLocked });
      if (errorBufferRef.current.length > 200) {
        errorBufferRef.current.shift();
      }

      benchmarkRunner.recordFrame(
        frameCountRef.current,
        errX,
        errY,
        state,
        60,
        3.1
      );

      const lockedCount = errorBufferRef.current.filter((v) => Math.abs(v.errX) < 15 && Math.abs(v.errY) < 15).length;
      const retentionRate = (lockedCount / (errorBufferRef.current.length || 1)) * 100;

      telemetryStore.updateState({
        fps: 60,
        cvLatency: 3.1,
        errorX: errX,
        errorY: errY,
        rmse: rmse || Math.sqrt(errX * errX + errY * errY),
        lockRetentionRate: retentionRate,
        pan,
        tilt,
        trackingState: state,
        binaryFrameB64: binary_frame_b64,
        errorHistory: [...errorBufferRef.current]
      });
    });

    return () => {
      videoBridge.disconnect();
    };
  }, [isTrackingActive, isPaused, pan, tilt]);

  // Main 30 FPS Frame Transmission Loop
  useEffect(() => {
    const frameInterval = setInterval(() => {
      if (canvasRef.current && !isPaused) {
        videoBridge.sendFrame(canvasRef.current, pixelErrorRef.current, dropLOS, pidGains);
      }
    }, 33);

    return () => clearInterval(frameInterval);
  }, [dropLOS, pidGains, isPaused]);

  const handleUpdatePidGains = async (newGains) => {
    setPidGains(newGains);
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('update_pid_gains', { gains: newGains });
      } catch (err) {
        console.error('[App] Failed to update gains over Tauri IPC:', err);
      }
    }
  };

  const handlePixelErrorUpdate = (errObj) => {
    pixelErrorRef.current = { x: errObj.x, y: errObj.y };
  };

  const toggleAppFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => console.log(e));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((e) => console.log(e));
      }
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#06080d] text-slate-200 overflow-hidden font-mono scanlines">
      {/* Top Header Bar */}
      <AsteriaHeader
        isPaused={isPaused}
        onTogglePause={() => setIsPaused(!isPaused)}
        onEndDemo={() => {
          setPan(0);
          setTilt(0);
          setDropLOS(false);
        }}
        viewDimension={viewDimension}
        onChangeDimension={setViewDimension}
        onToggleFullscreen={toggleAppFullscreen}
      />

      {/* Main Mission Control Dashboard Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navigation Sidebar */}
        <AsteriaSidebar activeTab={activeTab} onSelectTab={handleSelectTab} />

        {/* Center Main Viewport Container */}
        <main className="flex-1 h-full relative p-2 flex flex-col overflow-hidden bg-[#06080d]">
          <DualViewportScene
            pan={pan}
            tilt={tilt}
            zoomFov={zoomFov}
            jitterAmp={jitterAmp}
            jitterFreq={jitterFreq}
            turbulenceIntensity={turbulence}
            dropLOS={dropLOS}
            trajectoryPreset={trajectoryPreset}
            isLocked={trackingState === 'TRACKING'}
            trackingState={trackingState}
            binaryFrameB64={telemetryStore.getState().binaryFrameB64}
            onPixelErrorUpdate={handlePixelErrorUpdate}
            onCanvasReady={(c) => (canvasRef.current = c)}
          />

          {/* Floating Drawer Trigger Bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
            <button
              onClick={() => setShowTuningDrawer(!showTuningDrawer)}
              className="px-4 py-1.5 rounded-full bg-[#080b11]/90 border border-slate-700 hover:border-amber-500 text-slate-200 text-xs font-mono font-bold flex items-center space-x-2 shadow-2xl backdrop-blur-md transition-all glow-amber"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>{showTuningDrawer ? 'HIDE CONTROL DECK' : 'OPEN TUNING & ANALYTICS DECK'}</span>
              {showTuningDrawer ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>

          {/* Slide-Up Collapsible Tuning & Analytics Drawer */}
          {showTuningDrawer && (
            <div className="absolute bottom-0 left-0 right-0 z-40 bg-[#080b11]/95 border-t border-slate-800 p-3 h-[42%] grid grid-cols-12 gap-3 backdrop-blur-xl shadow-2xl transition-all duration-300">
              {/* Left Column: Human Tuning & Disturbance Deck */}
              <div className="col-span-5 h-full overflow-y-auto pr-1">
                <TuningDeck
                  pidGains={pidGains}
                  onUpdatePidGains={handleUpdatePidGains}
                  jitterAmp={jitterAmp}
                  onChangeJitterAmp={setJitterAmp}
                  jitterFreq={jitterFreq}
                  onChangeJitterFreq={setJitterFreq}
                  turbulence={turbulence}
                  onChangeTurbulence={setTurbulence}
                  dropLOS={dropLOS}
                  onToggleDropLOS={() => setDropLOS(!dropLOS)}
                  trajectoryPreset={trajectoryPreset}
                  onChangeTrajectoryPreset={setTrajectoryPreset}
                />
              </div>

              {/* Right Column: Tactical HUD & Link Budget Analytics */}
              <div className="col-span-7 h-full overflow-y-auto pl-1">
                <TacticalHUD
                  sensorMode={sensorMode}
                  onChangeSensorMode={setSensorMode}
                  zoomFov={zoomFov}
                  onChangeZoomFov={setZoomFov}
                />
              </div>
            </div>
          )}
        </main>

        {/* Right Telemetry & Event Log Panel */}
        <AsteriaRightPanel trajectoryPreset={trajectoryPreset} />
      </div>
    </div>
  );
}
