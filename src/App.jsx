import React, { useState, useEffect, useRef } from 'react';
import SidebarNav from './components/Sidebar/SidebarNav';
import ControlPanel from './components/Sidebar/ControlPanel';
import RheaHeader from './components/RheaHeader';
import RheaRightPanel from './components/RheaRightPanel';
import DualViewportScene from './components/DualViewportScene';
import { useAppStore } from './store/useAppStore';
import { videoBridge } from './services/videoBridge';
import { telemetryStore } from './stores/telemetryStore';
import { benchmarkRunner } from './services/benchmarkRunner';
import { Sliders, ChevronUp, ChevronDown } from 'lucide-react';

export default function App() {
  const { 
    activeTab, 
    trajectoryPreset, 
    zoomFov, 
    sensorMode, 
    gimbalMaxVel,
    jitterAmp, 
    jitterFreq, 
    turbulence, 
    dropLOS, 
    pidGains, 
    setTrackingState,
    setDropLOS
  } = useAppStore();

  const [isPaused, setIsPaused] = useState(false);
  const [viewDimension, setViewDimension] = useState('3D');
  const [showTuningDrawer, setShowTuningDrawer] = useState(false);

  const [pan, setPan] = useState(0.0);
  const [tilt, setTilt] = useState(0.0);
  const [isTrackingActive, setIsTrackingActive] = useState(true);

  const canvasRef = useRef(null);
  const pixelErrorRef = useRef({ x: 0, y: 0 });
  const errorBufferRef = useRef([]);
  const frameCountRef = useRef(0);

  // Automatically open the drawer when a tab is selected
  useEffect(() => {
    if (activeTab) {
      setShowTuningDrawer(true);
    }
  }, [activeTab]);

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

      // Smooth step integration with dynamic Max Velocity Slew Rate Clamping
      if (isTrackingActive && !isPaused) {
        const dt = 0.033;
        const maxDeltaDeg = (gimbalMaxVel || 120.0) * dt;
        const clampedPVel = Math.max(-maxDeltaDeg, Math.min(maxDeltaDeg, pVel));
        const clampedTVel = Math.max(-maxDeltaDeg, Math.min(maxDeltaDeg, tVel));
        setPan((prev) => prev + clampedPVel);
        setTilt((prev) => prev + clampedTVel);
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
  }, [isTrackingActive, isPaused, pan, tilt, gimbalMaxVel, setTrackingState]);

  // Main 30 FPS Frame Transmission Loop
  useEffect(() => {
    const frameInterval = setInterval(() => {
      if (canvasRef.current && !isPaused) {
        videoBridge.sendFrame(canvasRef.current, pixelErrorRef.current, dropLOS, { ...pidGains, max_vel: gimbalMaxVel });
      }
    }, 33);

    return () => clearInterval(frameInterval);
  }, [dropLOS, pidGains, gimbalMaxVel, isPaused]);

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

  const trackingStateCurrent = useAppStore.getState().trackingState;

  return (
    <div className="w-screen h-screen flex flex-col bg-[#06080d] text-slate-200 overflow-hidden font-mono relative">
      {/* Non-blocking Scanline Visual Effect Overlay */}
      <div className="fixed inset-0 scanlines pointer-events-none z-50" />

      {/* Top Header Bar */}
      <RheaHeader
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
        {/* Left Navigation Sidebar with 8 Tabs */}
        <SidebarNav />

        {/* Center Main Viewport Container */}
        <main className="flex-1 h-full relative p-2 flex flex-col overflow-hidden bg-[#06080d]">
          <DualViewportScene
            pan={pan}
            tilt={tilt}
            zoomFov={zoomFov}
            sensorMode={sensorMode}
            jitterAmp={jitterAmp}
            jitterFreq={jitterFreq}
            turbulenceIntensity={turbulence}
            dropLOS={dropLOS}
            trajectoryPreset={trajectoryPreset}
            isLocked={trackingStateCurrent === 'TRACKING'}
            trackingState={trackingStateCurrent}
            binaryFrameB64={telemetryStore.getState().binaryFrameB64}
            onPixelErrorUpdate={handlePixelErrorUpdate}
            onCanvasReady={(c) => (canvasRef.current = c)}
          />

          {/* Floating Control Panel Drawer Trigger Bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
            <button
              onClick={() => setShowTuningDrawer(!showTuningDrawer)}
              className="px-4 py-1.5 rounded-full bg-[#080b11]/90 border border-slate-700 hover:border-amber-500 text-slate-200 text-xs font-mono font-bold flex items-center space-x-2 shadow-2xl backdrop-blur-md transition-all glow-amber cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>{showTuningDrawer ? `HIDE CONTROL PANEL (${activeTab})` : `OPEN CONTROL PANEL (${activeTab})`}</span>
              {showTuningDrawer ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>

          {/* Slide-Up Dynamic Control Panel Drawer */}
          {showTuningDrawer && (
            <div className="absolute bottom-0 left-0 right-0 z-40 p-2 max-h-[48%] overflow-y-auto pointer-events-auto select-auto">
              <ControlPanel />
            </div>
          )}
        </main>

        {/* Right Telemetry & Event Log Panel */}
        <RheaRightPanel trajectoryPreset={trajectoryPreset} />
      </div>
    </div>
  );
}
