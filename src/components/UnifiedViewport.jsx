import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls, PerspectiveCamera, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, Zap, Radio } from 'lucide-react';
import { LaserBeamMaterial } from '../shaders/LaserBeamMaterial';

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
 * Kinematic Ground Station Observatory Complex
 */
function KinematicGroundStationObservatory({ pan = 0, tilt = 0, zoomFov = 45, boresightCamRef, panRef, tiltRef }) {
  useFrame(() => {
    if (panRef.current) {
      panRef.current.rotation.y = THREE.MathUtils.lerp(
        panRef.current.rotation.y,
        (-pan * Math.PI) / 180,
        0.35
      );
    }
    if (tiltRef.current) {
      tiltRef.current.rotation.x = THREE.MathUtils.lerp(
        tiltRef.current.rotation.x,
        (-tilt * Math.PI) / 180,
        0.35
      );
    }
  });

  return (
    <group position={[0, -4, 0]}>
      {/* Foundation Base */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[3.2, 3.8, 1.2, 8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* LED Markers */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, idx) => {
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * 3.3;
        const z = Math.sin(rad) * 3.3;
        return (
          <mesh key={idx} position={[x, 0.0, z]}>
            <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
            <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={3.0} />
          </mesh>
        );
      })}

      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[2.0, 2.4, 0.4, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Kinematic Pan Mount Node (Y-axis Azimuth) */}
      <group ref={panRef} position={[0, 0.4, 0]}>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[1.5, 1.7, 0.6, 24]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>

        <mesh position={[-0.9, 0.8, 0]}>
          <boxGeometry args={[0.3, 1.2, 0.8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[0.9, 0.8, 0]}>
          <boxGeometry args={[0.3, 1.2, 0.8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.3} />
        </mesh>

        {/* Kinematic Tilt Mount Node (X-axis Elevation) */}
        <group ref={tiltRef} position={[0, 1.0, 0]}>
          {/* Mounted Viewport 2 Camera */}
          {boresightCamRef && (
            <PerspectiveCamera
              ref={boresightCamRef}
              fov={zoomFov}
              aspect={4 / 3}
              position={[0, 0, 0]}
              near={0.1}
              far={1000}
            />
          )}

          {/* Carbon Fiber Telescope Tube */}
          <group position={[0, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.55, 0.65, 2.2, 32]} />
              <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.15} />
            </mesh>

            <mesh position={[0, 0.7, 0]}>
              <torusGeometry args={[0.66, 0.04, 16, 32]} />
              <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={2.5} />
            </mesh>
            <mesh position={[0, -0.7, 0]}>
              <torusGeometry args={[0.66, 0.04, 16, 32]} />
              <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={2.5} />
            </mesh>

            <group position={[0, 1.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.62, 0.62, 0.15, 32]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh position={[0, 0, 0.08]}>
                <circleGeometry args={[0.55, 32]} />
                <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={3.5} transparent opacity={0.9} />
              </mesh>
            </group>
          </group>

          <CameraFrustumPyramid fov={zoomFov} />
        </group>
      </group>
    </group>
  );
}

/**
 * High-Detail Orbital Satellite Model
 */
function OrbitalSatelliteTarget({ trajectoryPreset = 'SINUSOIDAL', targetRef, setTargetPos, dropLOS = false }) {
  const satelliteBusRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    let x = Math.sin(t * 0.8) * 6;
    let y = Math.cos(t * 0.5) * 3 + 3;
    let z = -20 + Math.sin(t * 0.4) * 4;

    if (targetRef.current) {
      targetRef.current.position.set(x, y, z);
      if (setTargetPos) setTargetPos(targetRef.current.position);

      if (satelliteBusRef.current) {
        satelliteBusRef.current.rotation.y = t * 0.3;
        satelliteBusRef.current.rotation.z = Math.sin(t * 0.2) * 0.15;
      }
    }
  });

  return (
    <group ref={targetRef} position={[0, 3, -20]}>
      <group ref={satelliteBusRef}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.2, 1.2, 1.6]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.2} emissive="#b45309" emissiveIntensity={0.2} />
        </mesh>

        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.25, 0.4, 0.4]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>

        <group position={[-2.4, 0, 0]}>
          <mesh position={[1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 0.8, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} />
          </mesh>
          <mesh>
            <boxGeometry args={[1.8, 0.04, 2.2]} />
            <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.1} />
          </mesh>
          <mesh scale={[1.02, 1.02, 1.02]}>
            <boxGeometry args={[1.8, 0.04, 2.2]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.3} />
          </mesh>
        </group>

        <group position={[2.4, 0, 0]}>
          <mesh position={[-1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 0.8, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} />
          </mesh>
          <mesh>
            <boxGeometry args={[1.8, 0.04, 2.2]} />
            <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.1} />
          </mesh>
          <mesh scale={[1.02, 1.02, 1.02]}>
            <boxGeometry args={[1.8, 0.04, 2.2]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.3} />
          </mesh>
        </group>

        <group position={[0, 0.9, 0]} rotation={[-Math.PI / 4, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.7, 0.1, 0.3, 24, 1, true]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} />
          </mesh>
        </group>

        <group position={[0, -0.65, 0.4]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.4, 16]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <sphereGeometry args={[0.25, 32, 32]} />
            <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={dropLOS ? 0.2 : 4.0} roughness={0.1} />
          </mesh>
          <mesh position={[0, -0.2, 0]} scale={[1.4, 1.4, 1.4]}>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshBasicMaterial color={dropLOS ? "#f59e0b" : "#38bdf8"} transparent opacity={0.4} wireframe />
          </mesh>
        </group>
      </group>

      <UncertaintyEllipsoid isObscured={dropLOS} />
    </group>
  );
}

/**
 * Volumetric Laser Link Mesh
 */
function VolumetricLaserBeam({ isLocked, targetPos }) {
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
 * Single Canvas Viewport Pipeline
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
    if (targetRef.current && boresightCamRef.current && onPixelErrorUpdate) {
      const proj = targetRef.current.position.clone().project(boresightCamRef.current);
      const errX = ((proj.x + 1) * 640) / 2 - 320;
      const errY = ((-proj.y + 1) * 480) / 2 - 240;
      onPixelErrorUpdate({ x: errX, y: errY });
    }

    const leftWidth = Math.floor(size.width * 0.65);
    const rightWidth = size.width - leftWidth;
    const height = size.height;

    gl.setScissorTest(true);

    gl.setViewport(0, 0, leftWidth, height);
    gl.setScissor(0, 0, leftWidth, height);
    if (globalCamRef.current) {
      gl.render(gl.scene || globalCamRef.current.parent, globalCamRef.current);
    }

    gl.setViewport(leftWidth, 0, rightWidth, height);
    gl.setScissor(leftWidth, 0, rightWidth, height);
    if (boresightCamRef.current) {
      gl.render(gl.scene || boresightCamRef.current.parent, boresightCamRef.current);
    }

    gl.setScissorTest(false);
  }, 1);

  return (
    <>
      <PerspectiveCamera ref={globalCamRef} makeDefault fov={50} position={[22, 16, 25]} />

      <KinematicGroundStationObservatory
        pan={pan}
        tilt={tilt}
        zoomFov={zoomFov}
        boresightCamRef={boresightCamRef}
        panRef={panRef}
        tiltRef={tiltRef}
      />

      <OrbitalSatelliteTarget
        trajectoryPreset={trajectoryPreset}
        targetRef={targetRef}
        setTargetPos={setTargetPos}
        dropLOS={dropLOS}
      />

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
      <div className="absolute top-3 left-3 z-10 glass-panel px-3 py-1 rounded-lg border border-slate-700 flex items-center space-x-2">
        <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
        <span className="text-xs font-mono font-bold text-slate-200">
          VIEWPORT A: GLOBAL KINEMATIC GROUND OBSERVATORY (65%)
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
        <ambientLight intensity={0.4} />
        <directionalLight position={[15, 25, 20]} intensity={1.8} color="#ffffff" />
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
