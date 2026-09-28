import { create } from 'zustand';

// 1. Environment Slice
const createEnvironmentSlice = (set) => ({
  timeOfDay: 'NIGHT',
  trajectoryPreset: 'STATIONARY_HOVER',
  targetVelocity: 0.0,
  targetManualPos: { x: 0, y: 3, z: -20 },
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  setTrajectoryPreset: (trajectoryPreset) => set({ trajectoryPreset }),
  setTargetVelocity: (targetVelocity) => set({ targetVelocity }),
  setTargetManualPos: (targetManualPos) => set({ targetManualPos }),
});

// 2. Camera Slice
const createCameraSlice = (set) => ({
  zoomFov: 45,
  gimbalMaxVel: 120,
  sensorMode: 0, // 0: VIS RGB, 1: SWIR THERMAL, 2: WHITE-HOT
  setZoomFov: (zoomFov) => set({ zoomFov }),
  setGimbalMaxVel: (gimbalMaxVel) => set({ gimbalMaxVel }),
  setSensorMode: (sensorMode) => set({ sensorMode }),
});

// 3. Detection Slice
const createDetectionSlice = (set) => ({
  binaryThreshold: 180,
  blurKernelSize: 5,
  morphologicalIter: 2,
  showBoundingBox: true,
  showKalmanCentroid: true,
  setBinaryThreshold: (binaryThreshold) => set({ binaryThreshold }),
  setBlurKernelSize: (blurKernelSize) => set({ blurKernelSize }),
  setMorphologicalIter: (morphologicalIter) => set({ morphologicalIter }),
  setShowBoundingBox: (showBoundingBox) => set({ showBoundingBox }),
  setShowKalmanCentroid: (showKalmanCentroid) => set({ showKalmanCentroid }),
});

// 4. Tracking Slice
const DEFAULT_PID_GAINS = {
  kp_pan: 0.04,
  ki_pan: 0.001,
  kd_pan: 0.02,
  kp_tilt: 0.04,
  ki_tilt: 0.001,
  kd_tilt: 0.02
};

const createTrackingSlice = (set, get) => ({
  trackingState: 'SEARCHING',
  searchSpiralRadius: 15.0,
  pidGains: { ...DEFAULT_PID_GAINS },
  isDualSatMode: false,
  vspMode: 'BARYCENTER', // 'PRIMARY_ONLY' or 'BARYCENTER'
  setTrackingState: (trackingState) => set({ trackingState }),
  setSearchSpiralRadius: (searchSpiralRadius) => set({ searchSpiralRadius }),
  setIsDualSatMode: (isDualSatMode) => set({ isDualSatMode }),
  setVspMode: (vspMode) => set({ vspMode }),
  toggleDualSatMode: () => set((state) => ({ isDualSatMode: !state.isDualSatMode })),
  updatePidGains: async (newGains) => {
    set({ pidGains: newGains });
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('update_pid_gains', { gains: newGains });
      } catch (err) {
        console.error('[Store] Tauri update_pid_gains failed:', err);
      }
    }
  },
  resetGains: () => {
    get().updatePidGains({ ...DEFAULT_PID_GAINS });
  },
});

// 5. Analytics Slice
const createAnalyticsSlice = (set) => ({
  linkBudget: {
    pRxdBm: -22.4,
    linkMargindB: 7.6,
    berScientific: '1.20e-9',
    pathLossdB: 112.4
  },
  setLinkBudget: (linkBudget) => set({ linkBudget }),
});

// 6. Disturbance Slice
const createDisturbanceSlice = (set, get) => ({
  jitterAmp: 0.05,
  jitterFreq: 25,
  turbulence: 0,
  dropLOS: false,
  setJitterAmp: (jitterAmp) => set({ jitterAmp }),
  setJitterFreq: (jitterFreq) => set({ jitterFreq }),
  setTurbulence: (turbulence) => set({ turbulence }),
  setDropLOS: (dropLOS) => set({ dropLOS }),
  toggleDropLOS: () => set((state) => ({ dropLOS: !state.dropLOS })),
  injectHeavyFog: () => set({ turbulence: 85, dropLOS: true }),
});

// 7. Reports Slice
const createReportsSlice = (set) => ({
  benchmarkStatus: 'IDLE',
  recentReports: [
    { name: 'benchmark_telemetry_report.pdf', path: 'C:\\Users\\Sairaj Tripathy\\Desktop\\shawrma\\benchmark_telemetry_report.pdf', time: '23:49:09' },
    { name: 'evaluation_summary_report.pdf', path: 'C:\\Users\\Sairaj Tripathy\\Desktop\\shawrma\\evaluation_summary_report.pdf', time: '22:00:15' }
  ],
  setBenchmarkStatus: (benchmarkStatus) => set({ benchmarkStatus }),
  addReport: (report) => set((state) => ({ recentReports: [report, ...state.recentReports] })),
});

// 8. Settings Slice
const createSettingsSlice = (set) => ({
  activeTab: 'ORBIT & BIOME',
  ipcConnected: true,
  showPIP: true,
  setActiveTab: (activeTab) => set({ activeTab }),
  setIpcConnected: (ipcConnected) => set({ ipcConnected }),
  setShowPIP: (showPIP) => set({ showPIP }),
});

// Combined Store
export const useAppStore = create((set, get) => ({
  ...createEnvironmentSlice(set, get),
  ...createCameraSlice(set, get),
  ...createDetectionSlice(set, get),
  ...createTrackingSlice(set, get),
  ...createAnalyticsSlice(set, get),
  ...createDisturbanceSlice(set, get),
  ...createReportsSlice(set, get),
  ...createSettingsSlice(set, get),
}));
