import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls, PerspectiveCamera, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, Zap, Sliders, Shield, Camera } from 'lucide-react';
import { LaserBeamMaterial } from '../shaders/LaserBeamMaterial';
import { ThermalShader } from '../shaders/ThermalShader';

/**
 * Dynamic 3D Camera FOV Frustum Wireframe Pyramid
 */
function CameraFrustumPyramid({ fov = 45, aspect = 4 / 3, far = 25 }) {
  const lineRef = useRef();

  useFrame(() => {
    if (lineRef.current) {
      const fovRad = (fov * Math.PI) / 180;
      const h = 2 * Math.tan(fovRad / 2) * far;
      const w = h * aspect;

      const x = w / 2;
      const y = h / 2;
      const z = -far;

      // Frustum pyramid corners
      const points = [
        [0, 0, 0], [x, y, z],
        [0, 0, 0], [-x, y, z],
        [0, 0, 0], [-x, -y, z],
        [0, 0, 0], [x, -y, z],
        [x, y, z], [-x, y, z],
        [-x, y, z], [-x, -y, z],
        [-x, -y, z], [x, -y, z],
        [x, -y, z], [x, y, z]
      ];
      // Updated via R3F line points
    }
  });

  const points = useMemo(() => {
    const fovRad = (45 * Math.PI) / 180;
    const far = 20;
    const h = 2 * Math.tan(fovRad / 2) * far;
    const w = h * (4 / 3);
    const x = w / 2;
    const y = h / 2;
    const z = -far;

    return [
      [0, 0, 0], [x, y, z], [0, 0, 0], [-x, y, z],
      [0, 0, 0], [-x, -y, z], [0, 0, 0], [x, -y, z],
      [x, y, z], [-x, y, z], [-x, y, z], [-x, -y, z],
      [-x, -y, z], [x, -y, z], [x, -y, z], [x, y, z]
    ];
  }, []);

  return <Line ref={lineRef} points={points} color="#00f3ff" lineWidth={1.5} transparent opacity={0.5} />;
}

/**
 * Kalman Covariance Uncertainty Ellipsoid
 */
function UncertaintyEllipsoid({ isObscured }) {
  const meshRef = useRef();

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const scale = isObscured ? 1.5 + Math.sin(clock.getElapsedTime() * 4) * 0.5 : 0.8;
      meshRef.current.scale.set(scale, scale * 0.7, scale * 1.2);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial
        color={isObscured ? "#f59e0b" : "#10b981"}
        transparent
        opacity={isObscured ? 0.45 : 0.2}
        wireframe
      />
    </mesh>
  );
}

/**
 * Volumetric Mie-Scattering Laser Beam Cylinder Mesh
 */
function VolumetricLaserBeam({ isLocked, targetPos }) {
  const beamRef = useRef();

  useFrame(({ clock }) => {
    if (LaserBeamMaterial && LaserBeamMaterial.uniforms) {
      LaserBeamMaterial.uniforms.uTime.value = clock.getElapsedTime();
      LaserBeamMaterial.uniforms.uIsLocked.value = isLocked ? 1.0 : 0.0;
    }
  });

  if (!isLocked || !targetPos) return null;

  const origin = new THREE.Vector3(0, -4, 0);
  const target = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
  const distance = origin.distanceTo(target);

  const midPoint = origin.clone().add(target).multiplyScalar(0.5);

  return (
    <mesh position={midPoint} material={LaserBeamMaterial}>
      <cylinderGeometry args={[0.08, 0.2, distance, 16, 1, true]} />
    </mesh>
  );
}

/**
 * Single Canvas Viewport Scissor Render Controller
 */
function ScissorRenderPipeline({
  pan,
  tilt,
  zoomFov = 45,
  sensorMode = 0,
  trajectoryPreset,
  isLocked,
  dropLOS,
  onPixelErrorUpdate
}) {
  const { gl, size } = useThree();
  const globalCamRef = useRef();
  const boresightCamRef = useRef();
  const panRef = useRef();
  const tiltRef = useRef();
  const targetRef = useRef();
  const [targetPos, setTargetPos] = useState(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Gimbal Kinematics
    if (panRef.current) {
      panRef.current.rotation.y = THREE.MathUtils.lerp(
        panRef.current.rotation.y,
        (pan * Math.PI) / 180,
        0.18
      );
    }
    if (tiltRef.current) {
      tiltRef.current.rotation.x = THREE.MathUtils.lerp(
        tiltRef.current.rotation.x,
        (tilt * Math.PI) / 180,
        0.18
      );
    }

    // Target Trajectory
    let x = Math.sin(t * 0.8) * 6;
    let y = Math.cos(t * 0.5) * 3 + 3;
    let z = -20 + Math.sin(t * 0.4) * 4;

    if (targetRef.current) {
      targetRef.current.position.set(x, y, z);
      setTargetPos(targetRef.current.position);

      // Pixel error computation
      if (boresightCamRef.current && onPixelErrorUpdate) {
        const proj = targetRef.current.position.clone().project(boresightCamRef.current);
        const errX = ((proj.x + 1) * 640) / 2 - 320;
        const errY = ((-proj.y + 1) * 480) / 2 - 240;
        onPixelErrorUpdate({ x: errX, y: errY });
      }
    }

    // Single Canvas Three.js Scissor & Viewport Rendering
    const leftWidth = Math.floor(size.width * 0.65);
    const rightWidth = size.width - leftWidth;
    const height = size.height;

    gl.setScissorTest(true);

    // Viewport 1: Global Tactical Observer (Left 65%)
    gl.setViewport(0, 0, leftWidth, height);
    gl.setScissor(0, 0, leftWidth, height);
    if (globalCamRef.current) {
      gl.render(gl.scene || globalCamRef.current.parent, globalCamRef.current);
    }

    // Viewport 2: Sensor Boresight Feed (Right 35%)
    gl.setViewport(leftWidth, 0, rightWidth, height);
    gl.setScissor(leftWidth, 0, rightWidth, height);
    if (boresightCamRef.current) {
      gl.render(gl.scene || boresightCamRef.current.parent, boresightCamRef.current);
    }

    gl.setScissorTest(false);
  }, 1);

  return (
    <>
      {/* Viewport 1 Camera */}
      <PerspectiveCamera ref={globalCamRef} makeDefault fov={50} position={[22, 16, 25]} />

      {/* Ground Terminal */}
      <group position={[0, -4, 0]}>
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[2.0, 2.5, 1.0, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>

        {/* Gimbal Kinematic Mount */}
        <group ref={panRef}>
          <group ref={tiltRef}>
            {/* Viewport 2 Boresight Camera with Dynamic Zoom */}
            <PerspectiveCamera
              ref={boresightCamRef}
              fov={zoomFov}
              aspect={4 / 3}
              position={[0, 1.2, 0]}
              near={0.1}
              far={1000}
            />
            <CameraFrustumPyramid fov={zoomFov} />
          </group>
        </group>
      </group>

      {/* Target & Kalman Uncertainty Ellipsoid */}
      <group ref={targetRef} position={[0, 3, -20]}>
        <mesh>
          <sphereGeometry args={[0.35, 32, 32]} />
          <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={3.5} />
        </mesh>
        <UncertaintyEllipsoid isObscured={dropLOS} />
      </group>

      {/* Volumetric Laser Link */}
      <VolumetricLaserBeam isLocked={isLocked} targetPos={targetPos} />
    </>
  );
}

export default function UnifiedViewport({
  pan = 0,
  tilt = 0,
  zoomFov = 45,
  sensorMode = 0,
  trajectoryPreset = 'SINUSOIDAL',
  isLocked = false,
  dropLOS = false,
  onPixelErrorUpdate,
  onCanvasReady
}) {
  return (
    <div className="w-full h-full relative bg-slate-950 overflow-hidden border border-slate-800 rounded-xl">
      {/* Viewport Labels Overlay */}
      <div className="absolute top-3 left-3 z-10 glass-panel px-3 py-1 rounded-lg border border-slate-700 flex items-center space-x-2">
        <Eye className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-mono font-bold text-slate-200">
          VIEWPORT A: GLOBAL TACTICAL OBSERVER (65%)
        </span>
      </div>

      <div className="absolute top-3 right-3 z-10 glass-panel px-3 py-1 rounded-lg border border-cyan-500/40 flex items-center space-x-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-mono font-bold text-cyan-300">
          VIEWPORT B: SENSOR BORESIGHT (35% | FOV {zoomFov}°)
        </span>
      </div>

      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => {
          if (onCanvasReady) onCanvasReady(gl.domElement);
        }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[15, 25, 20]} intensity={1.5} color="#ffffff" />
        <Stars radius={120} depth={50} count={6000} factor={4} fade />
        <OrbitControls makeDefault />

        <ScissorRenderPipeline
          pan={pan}
          tilt={tilt}
          zoomFov={zoomFov}
          sensorMode={sensorMode}
          trajectoryPreset={trajectoryPreset}
          isLocked={isLocked}
          dropLOS={dropLOS}
          onPixelErrorUpdate={onPixelErrorUpdate}
        />

        <gridHelper args={[100, 100, '#1e293b', '#0f172a']} position={[0, -4.5, 0]} />
      </Canvas>
    </div>
  );
}
