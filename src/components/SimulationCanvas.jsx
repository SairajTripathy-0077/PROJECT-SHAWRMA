import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Procedural Multi-Frequency Perlin/Simplex Noise helper for Platform Jitter
 */
function noise3D(x, y, z) {
  return (
    Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453 -
    Math.floor(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453)
  );
}

function getPlatformJitter(time) {
  const frequency1 = 25.0; // High-frequency rotor vibration
  const frequency2 = 8.0;  // Medium turbulence wobble

  const jx = (Math.sin(time * frequency1) * 0.5 + Math.cos(time * frequency2 * 1.3) * 0.5) * 0.008;
  const jy = (Math.cos(time * frequency1 * 1.1) * 0.5 + Math.sin(time * frequency2 * 0.9) * 0.5) * 0.008;
  const jz = (Math.sin(time * frequency1 * 0.7) * 0.5 + Math.cos(time * frequency2 * 1.5) * 0.5) * 0.004;

  return { jx, jy, jz };
}

/**
 * Moving Target Optical Beacon with Procedural Trajectories
 */
function TargetBeacon({ trajectoryMode, beaconRef, onTargetPosUpdate }) {
  const meshRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    let x = 0, y = 0, z = -20;

    if (trajectoryMode === 'SINUSOIDAL') {
      x = Math.sin(t * 0.8) * 6;
      y = Math.cos(t * 0.5) * 3 + 2;
      z = -20 + Math.sin(t * 0.3) * 4;
    } else if (trajectoryMode === 'ORBITAL') {
      const radius = 7;
      x = Math.cos(t * 0.7) * radius;
      y = Math.sin(t * 1.1) * 2.5 + 2;
      z = -20 + Math.sin(t * 0.7) * radius * 0.5;
    } else if (trajectoryMode === 'ERRATIC') {
      // Smooth trajectory with sudden step direction shifts
      const step = Math.floor(t * 0.5);
      const shiftX = (Math.sin(step * 99) * 3);
      const shiftY = (Math.cos(step * 77) * 2);
      x = Math.sin(t * 1.2) * 4 + shiftX;
      y = Math.cos(t * 0.9) * 3 + 2 + shiftY;
      z = -20 + Math.sin(t * 0.5) * 3;
    }

    if (meshRef.current) {
      meshRef.current.position.set(x, y, z);
      if (beaconRef) beaconRef.current = meshRef.current;
      if (onTargetPosUpdate) onTargetPosUpdate(meshRef.current.position);
    }
  });

  return (
    <group ref={meshRef} position={[0, 2, -20]}>
      {/* Target Sphere Mesh with Emissive Material */}
      <mesh>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial
          color="#00ffcc"
          emissive="#00ffcc"
          emissiveIntensity={3.0}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Halo Glow Shell */}
      <mesh scale={[1.4, 1.4, 1.4]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} wireframe />
      </mesh>

      {/* Point light representing optical laser emission */}
      <pointLight color="#00ffcc" intensity={8.0} distance={30} decay={1} />
    </group>
  );
}

/**
 * Atmospheric Heat Shimmer Shader Plane
 */
function AtmosphericTurbulencePlane({ active }) {
  const materialRef = useRef();

  useFrame(({ clock }) => {
    if (materialRef.current && active) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  const shader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uActive: { value: active ? 1.0 : 0.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uActive;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        if (uActive < 0.5) {
          gl_FragColor = vec4(0.0);
          return;
        }
        vec2 p = vUv * 8.0;
        float shimmer = noise(p + vec2(uTime * 1.5, uTime * 2.0)) * 0.04;
        float alpha = shimmer * 0.8;
        gl_FragColor = vec4(0.0, 0.95, 0.8, alpha);
      }
    `
  }), [active]);

  if (!active) return null;

  return (
    <mesh position={[0, 0, -4]}>
      <planeGeometry args={[25, 18]} />
      <shaderMaterial
        ref={materialRef}
        args={[shader]}
        transparent={true}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Kinematic Gimbal Rig Controller Component
 */
function GimbalRig({
  pan,
  tilt,
  enableJitter,
  enableTurbulence,
  trajectoryMode,
  onPixelErrorUpdate,
  cameraRef
}) {
  const panMountRef = useRef();
  const tiltMountRef = useRef();
  const beaconRef = useRef();
  const { size, camera } = useThree();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    let jitterPan = 0;
    let jitterTilt = 0;

    if (enableJitter) {
      const { jx, jy } = getPlatformJitter(t);
      jitterPan = jx;
      jitterTilt = jy;
    }

    // Kinematic rotation updates
    if (panMountRef.current) {
      // Y-axis azimuth rotation
      panMountRef.current.rotation.y = THREE.MathUtils.lerp(
        panMountRef.current.rotation.y,
        (pan * Math.PI) / 180 + jitterPan,
        0.15
      );
    }

    if (tiltMountRef.current) {
      // X-axis elevation rotation
      tiltMountRef.current.rotation.x = THREE.MathUtils.lerp(
        tiltMountRef.current.rotation.x,
        (tilt * Math.PI) / 180 + jitterTilt,
        0.15
      );
    }

    // Compute exact 2D pixel coordinate error on 640x480 resolution target
    if (beaconRef.current && cameraRef.current && onPixelErrorUpdate) {
      const beaconPos = beaconRef.current.position.clone();
      const projPos = beaconPos.clone().project(cameraRef.current);

      // Map NDC (-1 to 1) to 640x480 pixel plane
      const targetWidth = 640;
      const targetHeight = 480;

      const screenX = ((projPos.x + 1) * targetWidth) / 2;
      const screenY = ((-projPos.y + 1) * targetHeight) / 2;

      const centerX = targetWidth / 2;
      const centerY = targetHeight / 2;

      // Coordinate alignment: e_x positive if target is right of center
      const errX = screenX - centerX;
      const errY = screenY - centerY;

      onPixelErrorUpdate({ x: errX, y: errY, screenX, screenY });
    }
  });

  return (
    <>
      {/* Pan Mount Node (Y-axis Azimuth) */}
      <group ref={panMountRef} position={[0, 0, 0]}>
        {/* Tilt Mount Node (X-axis Elevation) */}
        <group ref={tiltMountRef} position={[0, 0, 0]}>
          {/* Mounted PerspectiveCamera (FOV 45 deg, 4:3 aspect ratio target) */}
          <PerspectiveCamera
            ref={cameraRef}
            makeDefault
            fov={45}
            aspect={4 / 3}
            position={[0, 0, 0]}
            near={0.1}
            far={1000}
          />
        </group>
      </group>

      {/* Target Optical Beacon */}
      <TargetBeacon trajectoryMode={trajectoryMode} beaconRef={beaconRef} />

      {/* Atmospheric Turbulence Layer */}
      <AtmosphericTurbulencePlane active={enableTurbulence} />
    </>
  );
}

export default function SimulationCanvas({
  pan = 0,
  tilt = 0,
  enableJitter = true,
  enableTurbulence = false,
  trajectoryMode = 'SINUSOIDAL',
  onPixelErrorUpdate,
  onCanvasReady
}) {
  const cameraRef = useRef();

  return (
    <div className="w-full h-full relative bg-slate-950">
      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => {
          if (onCanvasReady) {
            onCanvasReady(gl.domElement);
          }
        }}
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[10, 20, 15]} intensity={1.2} color="#ffffff" />

        {/* Skybox */}
        <Stars radius={100} depth={50} count={6000} factor={4} saturation={0} fade speed={1} />

        {/* Kinematic Gimbal Rig */}
        <GimbalRig
          pan={pan}
          tilt={tilt}
          enableJitter={enableJitter}
          enableTurbulence={enableTurbulence}
          trajectoryMode={trajectoryMode}
          onPixelErrorUpdate={onPixelErrorUpdate}
          cameraRef={cameraRef}
        />

        {/* Spatial Grid Floor Reference */}
        <gridHelper args={[80, 80, '#1e293b', '#0f172a']} position={[0, -6, -20]} />
      </Canvas>
    </div>
  );
}
