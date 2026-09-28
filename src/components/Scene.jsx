import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// Target Optical Beacon Component (Moving target with jitter)
function OpticalTarget({ position, jitterAmount = 0.05 }) {
  const meshRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      // Base trajectory path (figure-8 Lissajous curve)
      const baseX = Math.sin(t * 0.8) * 4;
      const baseY = Math.cos(t * 0.5) * 2 + 3;
      const baseZ = Math.sin(t * 0.4) * 3 - 15;

      // High-frequency procedural jitter (rotor vibration simulation)
      const jitterX = (Math.random() - 0.5) * jitterAmount;
      const jitterY = (Math.random() - 0.5) * jitterAmount;
      const jitterZ = (Math.random() - 0.5) * jitterAmount;

      meshRef.current.position.set(baseX + jitterX, baseY + jitterY, baseZ + jitterZ);
    }
  });

  return (
    <group ref={meshRef} position={position}>
      {/* Central Beacon Sphere */}
      <mesh>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial color="#00f3ff" />
      </mesh>

      {/* Outer Halo Flare Ring */}
      <mesh scale={[1.4, 1.4, 1.4]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.3} wireframe />
      </mesh>

      {/* Optical Beacon Emissive Point Light */}
      <pointLight color="#00f3ff" intensity={5} distance={20} />
    </group>
  );
}

// Pan-Tilt Camera Mount Rig
function PanTiltCamera({ pan, tilt, cameraRef }) {
  const gimbalPanRef = useRef();
  const gimbalTiltRef = useRef();

  useFrame(() => {
    if (gimbalPanRef.current) {
      gimbalPanRef.current.rotation.y = THREE.MathUtils.lerp(gimbalPanRef.current.rotation.y, (pan * Math.PI) / 180, 0.1);
    }
    if (gimbalTiltRef.current) {
      gimbalTiltRef.current.rotation.x = THREE.MathUtils.lerp(gimbalTiltRef.current.rotation.x, (tilt * Math.PI) / 180, 0.1);
    }
  });

  return (
    <group ref={gimbalPanRef} position={[0, 0, 0]}>
      <group ref={gimbalTiltRef}>
        <PerspectiveCamera ref={cameraRef} makeDefault fov={60} position={[0, 0, 0]} near={0.1} far={1000} />
      </group>
    </group>
  );
}

// Atmospheric Disturbance Shader (Heat Shimmer / Turbulance)
function AtmosphericTurbulence() {
  const materialRef = useRef();

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  const shader = {
    uniforms: {
      uTime: { value: 0 },
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
      varying vec2 vUv;
      
      float noise(vec2 p) {
        return sin(p.x * 10.0 + uTime * 2.0) * cos(p.y * 10.0 + uTime * 3.0) * 0.05;
      }

      void main() {
        vec2 distortedUv = vUv + vec2(noise(vUv), noise(vUv + 0.5));
        float alpha = sin(distortedUv.x * 20.0 + uTime) * 0.02 + 0.02;
        gl_FragColor = vec4(0.0, 0.95, 1.0, alpha);
      }
    `
  };

  return (
    <mesh position={[0, 0, -5]}>
      <planeGeometry args={[30, 20]} />
      <shaderMaterial
        ref={materialRef}
        args={[shader]}
        transparent={true}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function Scene({ pan = 0, tilt = 0, onCanvasReady }) {
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
        <ambientLight intensity={0.2} />
        <directionalLight position={[10, 20, 15]} intensity={1} color="#ffffff" />
        
        {/* Skybox Environment */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {/* Virtual Pan-Tilt Camera Mount */}
        <PanTiltCamera pan={pan} tilt={tilt} cameraRef={cameraRef} />

        {/* Optical Drone Target */}
        <OpticalTarget position={[0, 3, -15]} jitterAmount={0.08} />

        {/* Atmospheric Disturbance Layer */}
        <AtmosphericTurbulence />

        {/* Ground Alignment Grid */}
        <gridHelper args={[60, 60, '#1e293b', '#0f172a']} position={[0, -5, -15]} />
      </Canvas>
    </div>
  );
}
