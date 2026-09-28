import React, { useState, useEffect, useRef } from 'react';
import DualViewportScene from './components/DualViewportScene';
import TuningDeck from './components/TuningDeck';
import TelemetryEngine from './components/TelemetryEngine';
import { videoBridge } from './services/videoBridge';
import { benchmarkRunner, BENCHMARK_SCENARIOS } from './services/benchmarkRunner';

export default function App() {
  const [pan, setPan] = useState(0.0);
  const [tilt, setTilt] = useState(0.0);
  const [isTrackingActive, setIsTrackingActive] = useState(true);
  const [trackingState, setTrackingState] = useState('SEARCHING');

  // Disturbance Deck State
  const [jitterAmp, setJitterAmp] = useState(0.05);
  const [jitterFreq, setJitterFreq] = useState(25);
  const [turbulence, setTurbulence] = useState(0);
  const [dropLOS, setDropLOS] = useState(false);
  const [trajectoryPreset, setTrajectoryPreset] = useState('SINUSOIDAL');

  // Dual-Axis PID Live Gains
  const [pidGains, setPidGains] = useState({
    kp_pan: 0.08,
    ki_pan: 0.005,
    kd_pan: 0.015,
    kp_tilt: 0.08,
    ki_tilt: 0.005,
    kd_tilt: 0.015
  });

  // Telemetry Metrics State
  const [telemetry, setTelemetry] = useState({
    fps: 60,
    gpuLatency: 4.2,
    cvLatency: 3.1,
    ipcLatency: 1.2,
    errorX: 0.0,
    errorY: 0.0,
    rmse: 0.0,
    lockRetentionRate: 100.0,
    pan: 0.0,
    tilt: 0.0,
    binaryFrameB64: null,
    errorHistory: []
  });

  const canvasRef = useRef(null);
  const pixelErrorRef = useRef({ x: 0, y: 0 });
  const errorBufferRef = useRef([]);
  const frameCountRef = useRef(0);

  // Initialize Video Bridge with Telemetry Listener
  useEffect(() => {
    videoBridge.init('ws://localhost:8765', (feedback) => {
      if (!feedback) return;

      const {
        state = 'SEARCHING',
        pan_velocity = 0,
        tilt_velocity = 0,
        error_px = [0, 0],
        locked = false,
        fps = 60,
        cv_latency_ms = 3.1,
        binary_frame_b64 = null
      } = feedback;

      const [errX, errY] = error_px;

      if (isTrackingActive) {
        setPan((prev) => prev + pan_velocity * 0.033);
        setTilt((prev) => prev + tilt_velocity * 0.033);
      }

      setTrackingState(state);

      frameCountRef.current++;
      errorBufferRef.current.push({ errX, errY, locked });
      if (errorBufferRef.current.length > 150) {
        errorBufferRef.current.shift();
      }

      // Record to benchmark runner if active
      benchmarkRunner.recordFrame(
        frameCountRef.current,
        errX,
        errY,
        state,
        fps,
        cv_latency_ms
      );

      const meanSqErr =
        errorBufferRef.current.reduce((acc, v) => acc + (v.errX * v.errX + v.errY * v.errY), 0) /
        (errorBufferRef.current.length || 1);
      const calculatedRmse = Math.sqrt(meanSqErr);

      const lockedCount = errorBufferRef.current.filter((v) => Math.abs(v.errX) < 15 && Math.abs(v.errY) < 15).length;
      const retentionRate = (lockedCount / errorBufferRef.current.length) * 100;

      setTelemetry((prev) => {
        const nextHistory = [
          ...prev.errorHistory.slice(-149),
          { frame: frameCountRef.current, errX, errY }
        ];

        return {
          ...prev,
          fps,
          cvLatency: cv_latency_ms,
          errorX: errX,
          errorY: errY,
          rmse: calculatedRmse,
          lockRetentionRate: retentionRate,
          pan,
          tilt,
          binaryFrameB64: binary_frame_b64,
          errorHistory: nextHistory
        };
      });
    });

    return () => {
      videoBridge.disconnect();
    };
  }, [isTrackingActive, pan, tilt]);

  // Main 30 FPS Frame Transmission Loop
  useEffect(() => {
    const frameInterval = setInterval(() => {
      if (canvasRef.current) {
        videoBridge.sendFrame(canvasRef.current, pixelErrorRef.current, dropLOS, pidGains);
      }
    }, 33);

    return () => clearInterval(frameInterval);
  }, [dropLOS, pidGains]);

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

  const handleRunBenchmark = (scenarioKey, onProgress, onComplete) => {
    const scenario = BENCHMARK_SCENARIOS[scenarioKey];
    if (scenario) {
      setJitterAmp(scenario.jitterAmp);
      setJitterFreq(scenario.jitterFreq);
      setTurbulence(scenario.turbulence);
      setDropLOS(scenario.dropLOS);
    }

    benchmarkRunner.startBenchmark(scenarioKey, onProgress, onComplete);
  };

  return (
    <div className="w-screen h-screen relative flex flex-col bg-slate-950 overflow-hidden">
      {/* Top Split Viewports Workspace (62% Height) */}
      <div className="w-full h-[62%]">
        <DualViewportScene
          pan={pan}
          tilt={tilt}
          jitterAmp={jitterAmp}
          jitterFreq={jitterFreq}
          turbulenceIntensity={turbulence}
          dropLOS={dropLOS}
          trajectoryPreset={trajectoryPreset}
          isLocked={trackingState === 'TRACKING'}
          trackingState={trackingState}
          binaryFrameB64={telemetry.binaryFrameB64}
          onPixelErrorUpdate={handlePixelErrorUpdate}
          onCanvasReady={(c) => (canvasRef.current = c)}
        />
      </div>

      {/* Bottom Workstation Deck (38% Height) */}
      <div className="w-full h-[38%] grid grid-cols-12 gap-2 px-2 pb-2">
        {/* Left: Tuning & Disturbance Control Deck (5 Cols) */}
        <div className="col-span-5 h-full overflow-y-auto">
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

        {/* Right: Telemetry Engine & Evaluation Suite (7 Cols) */}
        <div className="col-span-7 h-full overflow-y-auto">
          <TelemetryEngine
            trackingState={trackingState}
            telemetry={telemetry}
            isTrackingActive={isTrackingActive}
            onToggleTracking={() => setIsTrackingActive(!isTrackingActive)}
            onRunBenchmark={handleRunBenchmark}
          />
        </div>
      </div>
    </div>
  );
}
