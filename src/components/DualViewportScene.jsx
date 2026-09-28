import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, OrbitControls, PerspectiveCamera, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, Zap, EyeOff } from 'lucide-react';

/**
 * Platform Jitter procedural noise helper
 */
function getPlatformJitter(time, amplitude = 0.05, frequency = 25.0) {
  const ampRad = (amplitude * Math.PI) / 180.0;
  const jx = (Math.sin(time * frequency) * 0.5 + Math.cos(time * frequency * 1.3) * 0.5) * ampRad;
  const jy = (Math.cos(time * frequency * 1.1) * 0.5 + Math.sin(time * frequency * 0.9) * 0.5) * ampRad;
  return { jx, jy };
}

/**
 * Dynamic 3D Camera FOV Frustum Wireframe Pyramid
 */
function CameraFrustumPyramid({ fov = 45, far = 20 }) {
  const points = useMemo(() => {
    const fovRad = (fov * Math.PI) / 180;
    const h = 2 * Math.tan(fovRad / 2) * far;
    const w = h * (4 / 3);
    const x = w / 2;
    const y = h / 2;
    const z = -far;

    return [
      [0, 0, 0], [x, y, z],
      [0, 0, 0], [-x, y, z],
      [0, 0, 0], [-x, -y, z],
      [0, 0, 0], [x, -y, z],
      [x, y, z], [-x, y, z],
      [-x, y, z], [-x, -y, z],
      [-x, -y, z], [x, -y, z],
      [x, -y, z], [x, y, z]
    ];
  }, [fov, far]);

  return <Line points={points} color="#00f3ff" lineWidth={1.5} transparent opacity={0.5} />;
}

/**
 * Airborne Target Beacon with Trajectory Trail & Presets
 */
function AirborneTarget({ trajectoryPreset = 'SINUSOIDAL', beaconRef, onPosUpdate, dropLOS = false }) {
  const meshRef = useRef();
  const trailPointsRef = useRef([]);
  const [trailPath, setTrailPath] = useState([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    let x = 0, y = 3, z = -20;

    if (trajectoryPreset === 'LINEAR_FLYBY') {
      x = ((t * 4) % 30) - 15;
      y = 4 + Math.sin(t * 0.5) * 1.5;
      z = -20 + Math.cos(t * 0.3) * 3;
    } else if (trajectoryPreset === 'FIGURE_8') {
      x = Math.sin(t * 0.8) * 8;
      y = Math.sin(t * 1.6) * 3 + 4;
      z = -20 + Math.cos(t * 0.8) * 5;
    } else if (trajectoryPreset === 'HIGH_G_EVASIVE') {
      x = Math.sin(t * 1.5) * 6 + Math.cos(t * 3.5) * 2;
      y = Math.cos(t * 1.2) * 3 + 4 + Math.sin(t * 4.0) * 1.5;
      z = -20 + Math.sin(t * 1.0) * 4;
    } else if (trajectoryPreset === 'ERRATIC') {
      const step = Math.floor(t * 0.6);
      x = Math.sin(t * 1.2) * 5 + Math.sin(step * 88) * 4;
      y = Math.cos(t * 0.9) * 3 + 3 + Math.cos(step * 66) * 2.5;
      z = -20 + Math.sin(t * 0.5) * 4;
    } else {
      // Default Sinusoidal
      x = Math.sin(t * 0.8) * 6;
      y = Math.cos(t * 0.5) * 3 + 3;
      z = -20 + Math.sin(t * 0.4) * 4;
    }

    if (meshRef.current) {
      meshRef.current.position.set(x, y, z);
      if (beaconRef) beaconRef.current = meshRef.current;
      if (onPosUpdate) onPosUpdate(meshRef.current.position);

      const currentPos = [x, y, z];
      trailPointsRef.current.push(currentPos);
      if (trailPointsRef.current.length > 80) {
        trailPointsRef.current.shift();
      }
      if (clock.getElapsedTime() % 0.1 < 0.033) {
        setTrailPath([...trailPointsRef.current]);
      }
    }
  });

  return (
    <>
      <group ref={meshRef} position={[0, 3, -20]}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 0.15, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>

        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.35, 32, 32]} />
          <meshStandardMaterial
            color="#00ffcc"
            emissive="#00ffcc"
            emissiveIntensity={dropLOS ? 0.2 : 3.5}
            roughness={0.1}
          />
        </mesh>

        <mesh scale={[1.4, 1.4, 1.4]}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshBasicMaterial color={dropLOS ? "#f59e0b" : "#38bdf8"} transparent opacity={0.35} wireframe />
        </mesh>

        {!dropLOS && <pointLight color="#00ffcc" intensity={10} distance={35} decay={1} />}
      </group>

      {trailPath.length > 2 && (
        <Line points={trailPath} color="#00ffcc" lineWidth={2} transparent opacity={0.6} />
      )}
    </>
  );
}

/**
 * Optical Laser Transmission Beam Line
 */
function OpticalLaserBeam({ isLocked, beaconPos }) {
  if (!isLocked || !beaconPos) return null;

  const terminalPos = [0, -4, 0];
  const targetPos = [beaconPos.x, beaconPos.y, beaconPos.z];

  return (
    <Line
      points={[terminalPos, targetPos]}
      color="#00ffcc"
      lineWidth={3.5}
      transparent
      opacity={0.9}
    />
  );
}

/**
 * Ground Station Optical Terminal Mount
 */
function GroundStationTerminal() {
  return (
    <group position={[0, -4, 0]}>
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[2.0, 2.5, 1.0, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>

      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
      </mesh>

      <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 4, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.5, 1.6, 24]} />
        <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

/**
 * Simulated Atmospheric Turbulence Fog Mesh
 */
function EnvironmentalDisturbances({ turbulenceIntensity = 0, dropLOS = false }) {
  const fogRef = useRef();

  useFrame(({ clock }) => {
    if (fogRef.current) {
      fogRef.current.position.x = Math.sin(clock.getElapsedTime() * 0.5) * 3;
    }
  });

  if (!dropLOS && turbulenceIntensity <= 0) return null;

  return (
    <group ref={fogRef} position={[0, 2, -10]}>
      <mesh>
        <boxGeometry args={[22, 12, 8]} />
        <meshStandardMaterial
          color={dropLOS ? "#334155" : "#0284c7"}
          transparent
          opacity={dropLOS ? 0.75 : (turbulenceIntensity / 100) * 0.35}
          roughness={1.0}
        />
      </mesh>
    </group>
  );
}

/**
 * Gimbal Boresight Camera Rig
 */
function BoresightGimbalRig({
  pan,
  tilt,
  jitterAmp,
  jitterFreq,
  boresightCamRef,
  beaconRef,
  zoomFov = 45,
  onPixelErrorUpdate
}) {
  const panRef = useRef();
  const tiltRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const { jx, jy } = getPlatformJitter(t, jitterAmp, jitterFreq);

    // Tight 0.35 lerp interpolation preventing phase lag overshooting
    if (panRef.current) {
      panRef.current.rotation.y = THREE.MathUtils.lerp(
        panRef.current.rotation.y,
        (-pan * Math.PI) / 180 + jx,
        0.35
      );
    }

    if (tiltRef.current) {
      tiltRef.current.rotation.x = THREE.MathUtils.lerp(
        tiltRef.current.rotation.x,
        (-tilt * Math.PI) / 180 + jy,
        0.35
      );
    }

    if (beaconRef.current && boresightCamRef.current && onPixelErrorUpdate) {
      const beaconPos = beaconRef.current.position.clone();
      const proj = beaconPos.project(boresightCamRef.current);

      const targetWidth = 640;
      const targetHeight = 480;

      const screenX = ((proj.x + 1) * targetWidth) / 2;
      const screenY = ((-proj.y + 1) * targetHeight) / 2;

      const errX = screenX - targetWidth / 2;
      const errY = screenY - targetHeight / 2;

      onPixelErrorUpdate({ x: errX, y: errY, screenX, screenY });
    }
  });

  return (
    <group ref={panRef} position={[0, -4, 0]}>
      <group ref={tiltRef}>
        <PerspectiveCamera
          ref={boresightCamRef}
          makeDefault
          fov={zoomFov}
          aspect={4 / 3}
          position={[0, 1.2, 0]}
          near={0.1}
          far={1000}
        />
        <CameraFrustumPyramid fov={zoomFov} />
      </group>
    </group>
  );
}

export default function DualViewportScene({
  pan = 0,
  tilt = 0,
  zoomFov = 45,
  jitterAmp = 0.05,
  jitterFreq = 25.0,
  turbulenceIntensity = 0,
  dropLOS = false,
  trajectoryPreset = 'SINUSOIDAL',
  isLocked = false,
  trackingState = 'SEARCHING',
  binaryFrameB64 = null,
  onPixelErrorUpdate,
  onCanvasReady
}) {
  const beaconRef = useRef();
  const boresightCamRef = useRef();
  const [beaconPos, setBeaconPos] = useState(null);
  const [showPIP, setShowPIP] = useState(true);

  return (
    <div className="w-full h-full relative bg-slate-950 grid grid-cols-12 gap-2 p-2 select-none">
      {/* VIEWPORT A: Global Tactical 3D Observer */}
      <div className="col-span-7 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
        <div className="absolute top-3 left-3 z-10 glass-panel px-3 py-1.5 rounded-lg flex items-center space-x-2 border border-slate-700">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold text-slate-200">
            VIEWPORT A: GLOBAL TACTICAL OBSERVER
          </span>
        </div>

        <Canvas gl={{ antialias: true }}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[15, 25, 20]} intensity={1.5} color="#ffffff" />
          <Stars radius={120} depth={50} count={6000} factor={4} saturation={0} fade speed={1} />
          <OrbitControls makeDefault enablePan={true} maxPolarAngle={Math.PI / 2 + 0.1} />

          <PerspectiveCamera makeDefault fov={50} position={[22, 16, 25]} />
          <GroundStationTerminal />

          <AirborneTarget
            trajectoryPreset={trajectoryPreset}
            beaconRef={beaconRef}
            onPosUpdate={(pos) => setBeaconPos(pos)}
            dropLOS={dropLOS}
          />

          <OpticalLaserBeam isLocked={isLocked} beaconPos={beaconPos} />
          <EnvironmentalDisturbances turbulenceIntensity={turbulenceIntensity} dropLOS={dropLOS} />

          <gridHelper args={[100, 100, '#1e293b', '#0f172a']} position={[0, -4.5, 0]} />
        </Canvas>
      </div>

      {/* VIEWPORT B: Gimbal Sensor Boresight Feed */}
      <div className="col-span-5 relative rounded-xl overflow-hidden border border-cyan-500/30 bg-slate-950">
        <div className="absolute top-3 left-3 z-10 glass-panel px-3 py-1.5 rounded-lg flex items-center space-x-2 border border-cyan-500/40">
          <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-cyan-300">
            VIEWPORT B: SENSOR BORESIGHT (FOV {zoomFov}°)
          </span>
        </div>

        <button
          onClick={() => setShowPIP(!showPIP)}
          className="absolute top-3 right-3 z-20 glass-panel px-2 py-1 rounded text-[11px] font-mono text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/20"
        >
          {showPIP ? <Eye className="w-3.5 h-3.5 inline mr-1" /> : <EyeOff className="w-3.5 h-3.5 inline mr-1" />}
          {showPIP ? 'HIDE PIP' : 'SHOW PIP'}
        </button>

        <Canvas
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          onCreated={({ gl }) => {
            if (onCanvasReady) onCanvasReady(gl.domElement);
          }}
        >
          <ambientLight intensity={0.2} />
          <directionalLight position={[10, 20, 15]} intensity={1} color="#ffffff" />
          <Stars radius={100} depth={50} count={4000} factor={3} fade />

          <BoresightGimbalRig
            pan={pan}
            tilt={tilt}
            jitterAmp={jitterAmp}
            jitterFreq={jitterFreq}
            boresightCamRef={boresightCamRef}
            beaconRef={beaconRef}
            zoomFov={zoomFov}
            onPixelErrorUpdate={onPixelErrorUpdate}
          />

          <AirborneTarget trajectoryPreset={trajectoryPreset} beaconRef={beaconRef} dropLOS={dropLOS} />
          <EnvironmentalDisturbances turbulenceIntensity={turbulenceIntensity} dropLOS={dropLOS} />
        </Canvas>

        {/* Reticle Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-64 h-64 border border-cyan-500/30 rounded-full flex items-center justify-center">
            <div className="absolute w-full h-[1px] bg-cyan-500/40" />
            <div className="absolute h-full w-[1px] bg-cyan-500/40" />
            <div className="w-4 h-4 border border-emerald-400 rounded-full animate-ping" />
            <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-400">
              STATE: {trackingState}
            </div>
          </div>
        </div>

        {/* OpenCV Binary PIP Feed */}
        {showPIP && binaryFrameB64 && (
          <div className="absolute bottom-4 right-4 z-20 w-36 h-28 glass-panel p-1 rounded-lg border border-emerald-500/40 flex flex-col justify-between">
            <div className="text-[9px] font-mono text-emerald-400 font-bold px-1">
              OPENCV THRESHOLD PIP
            </div>
            <img
              src={`data:image/jpeg;base64,${binaryFrameB64}`}
              alt="OpenCV Binary PIP Feed"
              className="w-full h-20 object-cover rounded bg-black"
            />
          </div>
        )}
      </div>
    </div>
  );
}
