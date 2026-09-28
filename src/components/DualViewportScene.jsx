import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls, PerspectiveCamera, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, Zap, EyeOff, Radio, Target, Maximize2, Minimize2, Monitor, Move } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

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
 * Viewport A Observer Camera Dynamic Zoom & Object Tracking Controller
 */
function ObserverCameraControl({ focusTarget, beaconPos, orbitControlsRef }) {
  const lastTargetRef = useRef(focusTarget);
  const transitioningRef = useRef(false);

  React.useEffect(() => {
    if (lastTargetRef.current !== focusTarget) {
      lastTargetRef.current = focusTarget;
      if (focusTarget === 'FREE_ORBIT') {
        transitioningRef.current = true;
        const timer = setTimeout(() => { transitioningRef.current = false; }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [focusTarget]);

  useFrame(({ camera }) => {
    if (!orbitControlsRef.current) return;

    if (focusTarget === 'TRACK_SATELLITE' && beaconPos) {
      const targetVec = new THREE.Vector3(beaconPos.x, beaconPos.y, beaconPos.z);
      const camPosGoal = new THREE.Vector3(beaconPos.x + 2, beaconPos.y + 2, beaconPos.z + 7);

      camera.position.lerp(camPosGoal, 0.08);
      orbitControlsRef.current.target.lerp(targetVec, 0.08);
      orbitControlsRef.current.update();
    } else if (focusTarget === 'FOCUS_GROUND_STATION') {
      const targetVec = new THREE.Vector3(0, -2, 0);
      const camPosGoal = new THREE.Vector3(0, 0, 8);

      camera.position.lerp(camPosGoal, 0.08);
      orbitControlsRef.current.target.lerp(targetVec, 0.08);
      orbitControlsRef.current.update();
    } else if (focusTarget === 'BEAM_PATH_VIEW' && beaconPos) {
      const midVec = new THREE.Vector3(beaconPos.x * 0.5, (beaconPos.y - 4) * 0.5, beaconPos.z * 0.5);
      const camPosGoal = new THREE.Vector3(15, 2, -10);

      camera.position.lerp(camPosGoal, 0.08);
      orbitControlsRef.current.target.lerp(midVec, 0.08);
      orbitControlsRef.current.update();
    } else if (focusTarget === 'FREE_ORBIT' && transitioningRef.current) {
      const defaultTarget = new THREE.Vector3(0, 0, -10);
      const defaultCamPos = new THREE.Vector3(22, 16, 25);

      camera.position.lerp(defaultCamPos, 0.08);
      orbitControlsRef.current.target.lerp(defaultTarget, 0.08);
      orbitControlsRef.current.update();
    }
  });

  return null;
}

/**
 * High-Detail Orbital Satellite Model with 3D Drag Capability
 */
function OrbitalSatelliteTarget({
  trajectoryPreset = 'STATIONARY_HOVER',
  beaconRef,
  onPosUpdate,
  dropLOS = false,
  showTrail = true,
  targetVelocity = 0.0,
  isDraggable = false,
  orbitControlsRef
}) {
  const { targetManualPos, setTargetManualPos } = useAppStore();
  const groupRef = useRef();
  const satelliteBusRef = useRef();
  const trailPointsRef = useRef([]);
  const simTimeRef = useRef(0);
  const [trailPath, setTrailPath] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { camera, raycaster } = useThree();
  const dragPlaneRef = useRef(new THREE.Plane());
  const planeIntersectRef = useRef(new THREE.Vector3());

  // Handle Drag Events on Satellite Mesh
  const handlePointerDown = (e) => {
    if (!isDraggable) return;
    e.stopPropagation();
    setIsDragging(true);

    if (orbitControlsRef && orbitControlsRef.current) {
      orbitControlsRef.current.enabled = false;
    }

    const currentPos = groupRef.current
      ? groupRef.current.position.clone()
      : new THREE.Vector3(targetManualPos.x, targetManualPos.y, targetManualPos.z);
    const camDir = camera.getWorldDirection(new THREE.Vector3()).negate();
    dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, currentPos);

    if (e.target.setPointerCapture) {
      try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !isDraggable) return;
    e.stopPropagation();

    raycaster.setFromCamera(e.pointer, camera);
    if (raycaster.ray.intersectPlane(dragPlaneRef.current, planeIntersectRef.current)) {
      setTargetManualPos({
        x: planeIntersectRef.current.x,
        y: planeIntersectRef.current.y,
        z: planeIntersectRef.current.z
      });
    }
  };

  const handlePointerUp = (e) => {
    if (!isDraggable) return;
    e.stopPropagation();
    setIsDragging(false);

    if (orbitControlsRef && orbitControlsRef.current) {
      orbitControlsRef.current.enabled = true;
    }

    if (e.target.releasePointerCapture) {
      try { e.target.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };

  useFrame((_, delta) => {
    simTimeRef.current += delta * targetVelocity;
    const t = simTimeRef.current;

    let x = targetManualPos.x;
    let y = targetManualPos.y;
    let z = targetManualPos.z;

    if (trajectoryPreset === 'STATIONARY_HOVER') {
      x = targetManualPos.x;
      y = targetManualPos.y;
      z = targetManualPos.z;
    } else if (trajectoryPreset === 'LINEAR_FLYBY') {
      x = targetManualPos.x + (((t * 4) % 30) - 15);
      y = targetManualPos.y + Math.sin(t * 0.5) * 1.5;
      z = targetManualPos.z + Math.cos(t * 0.3) * 3;
    } else if (trajectoryPreset === 'FIGURE_8') {
      x = targetManualPos.x + Math.sin(t * 0.8) * 8;
      y = targetManualPos.y + Math.sin(t * 1.6) * 3;
      z = targetManualPos.z + Math.cos(t * 0.8) * 5;
    } else if (trajectoryPreset === 'HIGH_G_EVASIVE') {
      x = targetManualPos.x + Math.sin(t * 1.5) * 6 + Math.cos(t * 3.5) * 2;
      y = targetManualPos.y + Math.cos(t * 1.2) * 3 + Math.sin(t * 4.0) * 1.5;
      z = targetManualPos.z + Math.sin(t * 1.0) * 4;
    } else if (trajectoryPreset === 'ERRATIC') {
      const step = Math.floor(t * 0.6);
      x = targetManualPos.x + Math.sin(t * 1.2) * 5 + Math.sin(step * 88) * 4;
      y = targetManualPos.y + Math.cos(t * 0.9) * 3 + Math.cos(step * 66) * 2.5;
      z = targetManualPos.z + Math.sin(t * 0.5) * 4;
    } else {
      // Default Sinusoidal
      x = targetManualPos.x + Math.sin(t * 0.8) * 6;
      y = targetManualPos.y + Math.cos(t * 0.5) * 3;
      z = targetManualPos.z + Math.sin(t * 0.4) * 4;
    }

    if (groupRef.current) {
      groupRef.current.position.set(x, y, z);
      if (beaconRef) beaconRef.current = groupRef.current;
      if (onPosUpdate) onPosUpdate(groupRef.current.position);

      if (satelliteBusRef.current) {
        satelliteBusRef.current.rotation.y = t * 0.3;
        satelliteBusRef.current.rotation.z = Math.sin(t * 0.2) * 0.15;
      }

      const currentPos = [x, y, z];
      trailPointsRef.current.push(currentPos);
      if (trailPointsRef.current.length > 80) {
        trailPointsRef.current.shift();
      }
      if (t % 0.1 < 0.033) {
        setTrailPath([...trailPointsRef.current]);
      }
    }
  });

  return (
    <>
      <group
        ref={groupRef}
        position={[targetManualPos.x, targetManualPos.y, targetManualPos.z]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOver={() => isDraggable && setIsHovered(true)}
        onPointerOut={() => setIsHovered(false)}
      >
        <group ref={satelliteBusRef}>
          {/* Main Bus Body */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.2, 1.2, 1.6]} />
            <meshStandardMaterial
              color={isDragging ? "#00ffcc" : isHovered ? "#f59e0b" : "#f59e0b"}
              metalness={0.9}
              roughness={0.2}
              emissive={isDragging ? "#00ffcc" : isHovered ? "#f59e0b" : "#b45309"}
              emissiveIntensity={isDragging ? 1.5 : isHovered ? 0.9 : 0.2}
            />
          </mesh>

          {/* Instrument Bevel Trim */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.25, 0.4, 0.4]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Left Solar Panel Wing */}
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
              <meshBasicMaterial
                color={isDragging ? "#00ffcc" : isHovered ? "#f59e0b" : "#38bdf8"}
                wireframe
                transparent
                opacity={isDragging ? 0.8 : isHovered ? 0.6 : 0.3}
              />
            </mesh>
          </group>

          {/* Right Solar Panel Wing */}
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
              <meshBasicMaterial
                color={isDragging ? "#00ffcc" : isHovered ? "#f59e0b" : "#38bdf8"}
                wireframe
                transparent
                opacity={isDragging ? 0.8 : isHovered ? 0.6 : 0.3}
              />
            </mesh>
          </group>

          {/* Parabolic Antenna Dish */}
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

          {/* FSOC Optical Laser Transceiver Payload */}
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

            {!dropLOS && <pointLight color="#00ffcc" intensity={12} distance={40} decay={1} />}
          </group>
        </group>
      </group>

      {showTrail && trailPath.length > 2 && (
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
 * High-Detail Kinematic Ground Station Observatory Telescope Complex
 */
function KinematicGroundStationObservatory({ pan = 0, tilt = 0 }) {
  const panMountRef = useRef();
  const tiltMountRef = useRef();

  useFrame(() => {
    if (panMountRef.current) {
      panMountRef.current.rotation.y = THREE.MathUtils.lerp(
        panMountRef.current.rotation.y,
        (-pan * Math.PI) / 180,
        0.35
      );
    }
    if (tiltMountRef.current) {
      tiltMountRef.current.rotation.x = THREE.MathUtils.lerp(
        tiltMountRef.current.rotation.x,
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
      <group ref={panMountRef} position={[0, 0.4, 0]}>
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

        <mesh position={[-1.1, 0.8, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.3, 16]} />
          <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={1.5} />
        </mesh>
        <mesh position={[1.1, 0.8, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.3, 16]} />
          <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={1.5} />
        </mesh>

        {/* Kinematic Tilt Mount Node (X-axis Elevation) */}
        <group ref={tiltMountRef} position={[0, 1.0, 0]}>
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

            {[...Array(6)].map((_, i) => (
              <mesh key={i} position={[0, -0.3 + i * 0.12, 0]}>
                <torusGeometry args={[0.62, 0.02, 12, 24]} />
                <meshStandardMaterial color="#475569" metalness={0.9} />
              </mesh>
            ))}

            <group position={[0, 1.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.62, 0.62, 0.15, 32]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh position={[0, 0, 0.08]}>
                <circleGeometry args={[0.55, 32]} />
                <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={3.5} roughness={0.1} transparent opacity={0.9} />
              </mesh>
            </group>

            <mesh position={[0.48, 0.2, 0]}>
              <cylinderGeometry args={[0.14, 0.14, 2.0, 16]} />
              <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.5} />
            </mesh>
          </group>

          <mesh position={[0, -0.4, 0.8]}>
            <boxGeometry args={[0.8, 0.3, 0.5]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
        </group>
      </group>

      <group position={[-2.4, 0.4, 2.0]}>
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 2.4, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.9} />
        </mesh>
        <mesh position={[0, 2.0, 0]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.5} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Atmospheric Turbulence Fog Mesh
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

function CustomViewFocusDropdown({ focusTarget, setFocusTarget }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const options = [
    { value: 'FREE_ORBIT', label: 'Free Orbit' },
    { value: 'TRACK_SATELLITE', label: 'Satellite' },
    { value: 'FOCUS_GROUND_STATION', label: 'Ground Station' },
    { value: 'BEAM_PATH_VIEW', label: 'Laser Vector' },
  ];

  const currentLabel = options.find((o) => o.value === focusTarget)?.label || 'Free Orbit';

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative z-50 pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-slate-950/90 p-1 rounded border border-slate-700 flex items-center space-x-1 font-mono text-[10px]">
        <span className="text-slate-400 font-bold px-1 select-none">View:</span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-slate-900 border border-slate-700 text-slate-200 px-2 py-0.5 rounded flex items-center space-x-1 hover:border-amber-500 font-bold cursor-pointer transition-all"
        >
          <span>{currentLabel}</span>
          <span className="text-[8px] text-slate-400 ml-1">▼</span>
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-36 bg-slate-950/95 border border-slate-700 rounded shadow-2xl py-1 z-50 font-mono text-[10px] backdrop-blur-md">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setFocusTarget(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1 hover:bg-amber-500/20 hover:text-amber-300 font-semibold transition-all cursor-pointer ${
                focusTarget === option.value ? 'text-amber-400 bg-slate-900 font-bold border-l-2 border-amber-500' : 'text-slate-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
  trajectoryPreset = 'STATIONARY_HOVER',
  targetVelocity = 0.0,
  isLocked = false,
  trackingState = 'SEARCHING',
  binaryFrameB64 = null,
  onPixelErrorUpdate,
  onCanvasReady
}) {
  const beaconRef = useRef();
  const boresightCamRef = useRef();
  const orbitControlsRef = useRef();
  const [beaconPos, setBeaconPos] = useState(null);
  const [showPIP, setShowPIP] = useState(true);
  const [focusTarget, setFocusTarget] = useState('FREE_ORBIT');
  const [fullscreenMode, setFullscreenMode] = useState('SPLIT'); // 'SPLIT', 'VIEWPORT_A', 'VIEWPORT_B'
  const [isFullscreenApp, setIsFullscreenApp] = useState(false);

  const toggleAppFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => console.log(e));
      setIsFullscreenApp(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((e) => console.log(e));
      }
      setIsFullscreenApp(false);
    }
  };

  return (
    <div className="w-full h-full relative bg-[#080b11] border border-slate-800 flex flex-col justify-between select-none p-2 space-y-2">
      {/* Top Viewport Header Strip */}
      <div className="flex justify-between items-center px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded">
        <div>
          <h2 className="text-xs font-bold font-mono text-slate-100 tracking-wider">3D DIGITAL TWIN</h2>
          <p className="text-[9px] font-mono text-slate-500">Real-time FSOC Simulation</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFocusTarget('FREE_ORBIT')}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="px-2 py-1 bg-slate-900 border border-slate-700 text-slate-300 hover:text-amber-400 text-[10px] font-mono font-bold rounded cursor-pointer"
          >
            :: VIEW
          </button>
        </div>
      </div>

      {/* Main Viewport Stage Area */}
      <div className="flex-1 relative grid grid-cols-12 gap-2 overflow-hidden rounded border border-slate-800/80">
        {/* VIEWPORT A: Global Tactical 3D Observer */}
        <div
          className={`relative overflow-hidden bg-[#05070c] transition-all duration-300 ${
            fullscreenMode === 'VIEWPORT_A'
              ? 'col-span-12 h-full z-30'
              : fullscreenMode === 'VIEWPORT_B'
              ? 'hidden'
              : 'col-span-7'
          }`}
        >
          {/* Top-Left Locked Badge Pill & Drag Hint */}
          <div className="absolute top-3 left-3 z-20 flex items-center space-x-2">
            <div className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold flex items-center space-x-1.5 border ${
              isLocked
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50 glow-emerald'
                : 'bg-amber-950/80 text-amber-400 border-amber-500/50 glow-amber'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-sm ${isLocked ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              <span>{isLocked ? 'LOCKED' : 'SEARCHING'}</span>
            </div>

            <div className="px-2 py-1 rounded text-[9px] font-mono font-bold flex items-center space-x-1 border bg-slate-950/80 text-cyan-300 border-slate-700/80">
              <Move className="w-3 h-3 text-amber-400" />
              <span>DRAG TARGET IN VIEWPORT</span>
            </div>
          </div>

          {/* Top-Right Controls: Focus Selector & Fullscreen Toggle Buttons */}
          <div
            className="absolute top-3 right-3 z-50 flex items-center space-x-2 pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Custom Tactical View Target Selector Dropdown */}
            <CustomViewFocusDropdown focusTarget={focusTarget} setFocusTarget={setFocusTarget} />

            {/* Viewport A Maximize / Restore Button */}
            <button
              onClick={() => setFullscreenMode(fullscreenMode === 'VIEWPORT_A' ? 'SPLIT' : 'VIEWPORT_A')}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              title="Maximize Viewport A"
              className="bg-slate-950/90 p-1.5 rounded border border-slate-700 text-slate-300 hover:text-amber-400 cursor-pointer"
            >
              {fullscreenMode === 'VIEWPORT_A' ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>

            {/* App-Wide OS Fullscreen Button */}
            <button
              onClick={toggleAppFullscreen}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              title="Toggle OS Fullscreen"
              className="bg-slate-950/90 p-1.5 rounded border border-slate-700 text-slate-300 hover:text-amber-400 cursor-pointer"
            >
              <Monitor className="w-3 h-3" />
            </button>
          </div>

          <Canvas gl={{ antialias: true }}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[15, 25, 20]} intensity={1.8} color="#ffffff" />
            <Stars radius={120} depth={50} count={6000} factor={4} saturation={0} fade speed={1} />
            <OrbitControls ref={orbitControlsRef} makeDefault enablePan={true} maxPolarAngle={Math.PI / 2 + 0.1} />

            <PerspectiveCamera makeDefault fov={50} position={[22, 16, 25]} />
            
            <ObserverCameraControl
              focusTarget={focusTarget}
              beaconPos={beaconPos}
              orbitControlsRef={orbitControlsRef}
            />

            <KinematicGroundStationObservatory pan={pan} tilt={tilt} />

            <OrbitalSatelliteTarget
              trajectoryPreset={trajectoryPreset}
              beaconRef={beaconRef}
              onPosUpdate={(pos) => setBeaconPos(pos)}
              dropLOS={dropLOS}
              showTrail={showPIP}
              targetVelocity={targetVelocity}
              isDraggable={true}
              orbitControlsRef={orbitControlsRef}
            />

            <OpticalLaserBeam isLocked={isLocked} beaconPos={beaconPos} />
            <EnvironmentalDisturbances turbulenceIntensity={turbulenceIntensity} dropLOS={dropLOS} />

            <gridHelper args={[100, 100, '#1e293b', '#0f172a']} position={[0, -4.5, 0]} />
          </Canvas>


        </div>

        {/* VIEWPORT B: Gimbal Sensor Boresight Feed */}
        <div
          className={`relative overflow-hidden bg-[#05070c] border-l border-slate-800 transition-all duration-300 ${
            fullscreenMode === 'VIEWPORT_B'
              ? 'col-span-12 h-full z-30'
              : fullscreenMode === 'VIEWPORT_A'
              ? 'hidden'
              : 'col-span-5'
          }`}
        >
          <div className="absolute top-3 left-3 z-10 bg-slate-950/90 px-2.5 py-1 rounded border border-slate-700 flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-slate-200">
              BORESIGHT (FOV {zoomFov}°)
            </span>
          </div>

          {/* Viewport B Top Controls: PIP & Maximize */}
          <div
            className="absolute top-3 right-3 z-50 flex items-center space-x-1.5 pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPIP(!showPIP)}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-slate-950/90 px-2 py-1 rounded text-[10px] font-mono text-slate-300 border border-slate-700 hover:text-amber-400 flex items-center cursor-pointer"
            >
              {showPIP ? <Eye className="w-3 h-3 inline mr-1" /> : <EyeOff className="w-3 h-3 inline mr-1" />}
              {showPIP ? 'HIDE PIP' : 'SHOW PIP'}
            </button>

            <button
              onClick={() => setFullscreenMode(fullscreenMode === 'VIEWPORT_B' ? 'SPLIT' : 'VIEWPORT_B')}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              title="Maximize Viewport B"
              className="bg-slate-950/90 p-1.5 rounded border border-slate-700 text-slate-300 hover:text-amber-400 cursor-pointer"
            >
              {fullscreenMode === 'VIEWPORT_B' ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          </div>

          <Canvas
            gl={{ preserveDrawingBuffer: true, antialias: true }}
            onCreated={({ gl }) => {
              if (onCanvasReady) onCanvasReady(gl.domElement);
            }}
          >
            <ambientLight intensity={0.3} />
            <directionalLight position={[10, 20, 15]} intensity={1.2} color="#ffffff" />
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

            <OrbitalSatelliteTarget trajectoryPreset={trajectoryPreset} beaconRef={beaconRef} dropLOS={dropLOS} showTrail={showPIP} targetVelocity={targetVelocity} />
            <EnvironmentalDisturbances turbulenceIntensity={turbulenceIntensity} dropLOS={dropLOS} />
          </Canvas>

          {/* Reticle Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-52 h-52 border border-slate-700/60 rounded-full flex items-center justify-center">
              <div className="absolute w-full h-[1px] bg-slate-700/60" />
              <div className="absolute h-full w-[1px] bg-slate-700/60" />
              <div className="w-3.5 h-3.5 border border-emerald-400 rounded-full animate-ping" />
              <div className="absolute top-2 left-2 text-[9px] font-mono text-cyan-400">
                STATE: {trackingState}
              </div>
            </div>
          </div>

          {/* OpenCV Binary PIP Feed */}
          {showPIP && binaryFrameB64 && (
            <div className="absolute bottom-3 right-3 z-20 w-32 h-24 bg-slate-950 p-1 rounded border border-emerald-500/40 flex flex-col justify-between">
              <div className="text-[8px] font-mono text-emerald-400 font-bold px-1">
                OPENCV THRESHOLD PIP
              </div>
              <img
                src={`data:image/jpeg;base64,${binaryFrameB64}`}
                alt="OpenCV Binary PIP Feed"
                className="w-full h-16 object-cover rounded bg-black"
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Entities Status Bar (Matching Reference Screenshot) */}
      <div className="flex justify-between items-center px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded text-[10px] font-mono">
        <div className="flex items-center space-x-3 text-slate-400">
          <span className="text-slate-500 font-bold">ENTITIES</span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-sm" />
            <span className="text-slate-300">SAT-01</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-sm" />
            <span className="text-slate-300">FSOC-CAM-01</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-sm" />
            <span className="text-slate-300">TARGET-01</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 bg-rose-400 rounded-sm" />
            <span className="text-slate-300">BEACON-01</span>
          </span>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <button
            onClick={() => setFocusTarget(focusTarget === 'TRACK_SATELLITE' ? 'FREE_ORBIT' : 'TRACK_SATELLITE')}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-slate-300 hover:text-amber-400 rounded font-bold cursor-pointer"
          >
            - TARGET
          </button>
        </div>
      </div>
    </div>
  );
}
