import React, { useState, useEffect, useRef } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import TelemetryOverlay from './components/TelemetryOverlay';
import { videoBridge } from './services/videoBridge';

export default function App() {
  const [pan, setPan] = useState(0.0);
  const [tilt, setTilt] = useState(0.0);
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [enableJitter, setEnableJitter] = useState(true);
  const [enableTurbulence, setEnableTurbulence] = useState(false);
  const [trajectoryMode, setTrajectoryMode] = useState('SINUSOIDAL');
  const [trackingState, setTrackingState] = useState('SEARCHING');

  const [telemetry, setTelemetry] = useState({
    fps: 60,
    acquisitionTime: 12.5,
    errorX: 0.0,
    errorY: 0.0,
    rmse: 0.0,
    pan: 0.0,
    tilt: 0.0,
    errorHistory: []
  });

  const canvasRef = useRef(null);
  const pixelErrorRef = useRef({ x: 0, y: 0 });
  const errorBufferRef = useRef([]);
  const frameCountRef = useRef(0);

  // Initialize Video Bridge on mount
  useEffect(() => {
    videoBridge.init('ws://localhost:8765', (feedback) => {
      if (!feedback) return;

      const { pan_velocity = 0, tilt_velocity = 0, error_px = [0, 0], locked = false, fps = 60 } = feedback;
      const [errX, errY] = error_px;

      // Closed-loop PID gimbal angular position update
      if (isTrackingActive) {
        setPan((prev) => prev + pan_velocity * 0.033);
        setTilt((prev) => prev + tilt_velocity * 0.033);
      }

      // Determine state machine transition
      if (!isTrackingActive) {
        setTrackingState('SEARCHING');
      } else if (locked) {
        setTrackingState('TRACKING');
      } else if (Math.abs(errX) < 40 && Math.abs(errY) < 40) {
        setTrackingState('ACQUIRED');
      } else {
        setTrackingState('LOST');
      }

      // Calculate rolling RMSE over last 100 frames
      frameCountRef.current++;
      errorBufferRef.current.push(errX * errX + errY * errY);
      if (errorBufferRef.current.length > 100) {
        errorBufferRef.current.shift();
      }

      const meanSqErr =
        errorBufferRef.current.reduce((acc, val) => acc + val, 0) /
        (errorBufferRef.current.length || 1);
      const calculatedRmse = Math.sqrt(meanSqErr);

      setTelemetry((prev) => {
        const nextHistory = [
          ...prev.errorHistory.slice(-99),
          { frame: frameCountRef.current, errX, errY }
        ];

        return {
          ...prev,
          fps,
          errorX: errX,
          errorY: errY,
          rmse: calculatedRmse,
          pan,
          tilt,
          acquisitionTime: 8 + Math.random() * 6,
          errorHistory: nextHistory
        };
      });
    });

    return () => {
      videoBridge.disconnect();
    };
  }, [isTrackingActive, pan, tilt]);

  // Main 30 FPS Canvas Frame Capture & Bridge Trigger Loop
  useEffect(() => {
    const frameInterval = setInterval(() => {
      if (canvasRef.current) {
        videoBridge.sendFrame(canvasRef.current, pixelErrorRef.current);
      }
    }, 33); // ~30 FPS frame rate

    return () => clearInterval(frameInterval);
  }, []);

  const handlePixelErrorUpdate = (errObj) => {
    pixelErrorRef.current = { x: errObj.x, y: errObj.y };
  };

  const handleCanvasReady = (canvasElement) => {
    canvasRef.current = canvasElement;
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-slate-950">
      {/* 3D Kinematic Simulation Canvas */}
      <SimulationCanvas
        pan={pan}
        tilt={tilt}
        enableJitter={enableJitter}
        enableTurbulence={enableTurbulence}
        trajectoryMode={trajectoryMode}
        onPixelErrorUpdate={handlePixelErrorUpdate}
        onCanvasReady={handleCanvasReady}
      />

      {/* Telemetry Dashboard HUD */}
      <TelemetryOverlay
        trackingState={trackingState}
        telemetry={telemetry}
        isTrackingActive={isTrackingActive}
        onToggleTracking={() => setIsTrackingActive(!isTrackingActive)}
        enableJitter={enableJitter}
        onToggleJitter={() => setEnableJitter(!enableJitter)}
        enableTurbulence={enableTurbulence}
        onToggleTurbulence={() => setEnableTurbulence(!enableTurbulence)}
        trajectoryMode={trajectoryMode}
        onChangeTrajectoryMode={(mode) => setTrajectoryMode(mode)}
      />
    </div>
  );
}
