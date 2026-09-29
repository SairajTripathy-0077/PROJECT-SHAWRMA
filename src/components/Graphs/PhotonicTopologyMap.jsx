import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../../store/useAppStore';

function PhotonicTopologyMesh() {
  const meshRef = useRef();
  const geometryRef = useRef();
  const isDualSatMode = useAppStore((s) => s.isDualSatMode);

  // Generate 32x32 height grid mesh representation of merged ROI intensity
  useEffect(() => {
    if (!geometryRef.current) return;
    const geo = geometryRef.current;
    const posAttr = geo.attributes.position;
    const count = posAttr.count;

    for (let i = 0; i < count; i++) {
      const u = (i % 32) / 32;
      const v = Math.floor(i / 32) / 32;
      posAttr.setZ(i, 0);
    }
    posAttr.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!geometryRef.current) return;
    const posAttr = geometryRef.current.attributes.position;

    // Center 1 (Sat 1) Gaussian Peak
    const c1x = -1.2 + Math.sin(t * 1.2) * 0.8;
    const c1y = Math.cos(t * 0.9) * 0.6;

    // Center 2 (Sat 2) Gaussian Peak
    const c2x = isDualSatMode ? 1.2 + Math.sin(t * 1.2 + 2.0) * 0.8 : c1x;
    const c2y = isDualSatMode ? -Math.cos(t * 0.9 + 2.0) * 0.6 : c1y;

    const count = posAttr.count;
    for (let i = 0; i < count; i++) {
      const x = (i % 32) / 4 - 4;
      const y = Math.floor(i / 32) / 4 - 4;

      const d1_sq = (x - c1x) ** 2 + (y - c1y) ** 2;
      const peak1 = Math.exp(-d1_sq / 1.2) * 2.8;

      let peak2 = 0;
      if (isDualSatMode) {
        const d2_sq = (x - c2x) ** 2 + (y - c2y) ** 2;
        peak2 = Math.exp(-d2_sq / 1.2) * 2.4;
      }

      posAttr.setZ(i, peak1 + peak2);
    }
    posAttr.needsUpdate = true;

    if (meshRef.current) {
      meshRef.current.rotation.x = -Math.PI / 3;
      meshRef.current.rotation.z = t * 0.15;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry ref={geometryRef} args={[8, 8, 31, 31]} />
      <meshBasicMaterial wireframe color="#00ffcc" transparent opacity={0.7} />
    </mesh>
  );
}

export default function PhotonicTopologyMap({ isMaximized = false }) {
  return (
    <div className="flex flex-col space-y-1 w-full h-full">
      {!isMaximized && (
        <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 pr-6">
          <span className="font-bold text-cyan-400 truncate">3D PHOTONIC TOPOLOGY</span>
          <span className="text-cyan-300 text-[8px] shrink-0">SOFT-MASK</span>
        </div>
      )}
      <div className={`relative w-full bg-[#04060a] rounded border border-slate-800 overflow-hidden ${isMaximized ? 'h-full flex-1' : 'h-28'}`}>
        <Canvas camera={{ position: [0, 6, isMaximized ? 10 : 8], fov: isMaximized ? 50 : 40 }}>
          <ambientLight intensity={0.5} />
          <PhotonicTopologyMesh />
        </Canvas>
        <div className={`absolute bottom-2 left-2 font-mono text-cyan-400 pointer-events-none ${isMaximized ? 'text-xs font-bold' : 'text-[8px]'}`}>
          Z: Photon Intensity (Voronoi Soft-Masked TCoG Surface)
        </div>
      </div>
    </div>
  );
}
