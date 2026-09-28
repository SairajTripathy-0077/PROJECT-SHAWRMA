/**
 * Zero-Jank High-Frequency Transient Telemetry Store
 * Uses lightweight reactive pub-sub for 60-120 FPS numerical HUD readouts without React DOM re-renders.
 */

class TelemetryStore {
  constructor() {
    this.listeners = new Set();
    this.state = {
      fps: 60,
      cvLatency: 3.1,
      gpuLatency: 4.2,
      errorX: 0.0,
      errorY: 0.0,
      rmse: 0.0,
      lockRetentionRate: 100.0,
      pan: 0.0,
      tilt: 0.0,
      trackingState: 'SEARCHING',
      linkBudget: {
        pRxdBm: -22.4,
        linkMargindB: 7.6,
        berScientific: '1.20e-9',
        isLinkFeasible: true
      },
      errorHistory: []
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  updateState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.listeners.forEach((listener) => listener(this.state));
  }

  getState() {
    return this.state;
  }
}

export const telemetryStore = new TelemetryStore();
