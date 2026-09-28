/**
 * VideoBridge Service for FSOC PAT Virtual Simulator
 * Handles frame extraction from R3F WebGL canvas and manages communication
 * with the Python OpenCV + EKF + PID Vision Backend via Tauri IPC or WebSocket/Local bridge.
 */

class VideoBridge {
  constructor() {
    this.isTauriAvailable = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
    this.ws = null;
    this.isConnected = false;
    this.onTelemetryCallback = null;
    this.isProcessingFrame = false;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fps = 60;
  }

  init(wsUrl = 'ws://localhost:8765', onTelemetry) {
    this.onTelemetryCallback = onTelemetry;

    if (!this.isTauriAvailable) {
      console.log('[VideoBridge] Tauri environment not detected. Initializing WebSocket/Local Bridge...');
      this.initWebSocket(wsUrl);
    } else {
      console.log('[VideoBridge] Tauri environment detected. Using Tauri IPC bridge.');
      this.initTauriIPC();
    }
  }

  initWebSocket(wsUrl) {
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[VideoBridge] Connected to Python vision sidecar via WebSocket.');
        this.isConnected = true;
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleBackendResponse(payload);
        } catch (err) {
          console.error('[VideoBridge] Error parsing backend telemetry:', err);
        }
        this.isProcessingFrame = false;
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        this.isConnected = false;
      };
    } catch (e) {
      console.warn('[VideoBridge] Could not initiate WebSocket:', e);
    }
  }

  async initTauriIPC() {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      await listen('tracker-response', (event) => {
        this.handleBackendResponse(event.payload);
        this.isProcessingFrame = false;
      });
      this.isConnected = true;
    } catch (e) {
      console.error('[VideoBridge] Failed to register Tauri IPC listeners:', e);
    }
  }

  async sendFrame(canvas, currentError = { x: 0, y: 0 }, dropLOS = false, pidGains = null) {
    if (!canvas) return;

    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFrameTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime));
      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    if (this.isProcessingFrame && this.isConnected) {
      return;
    }

    this.isProcessingFrame = true;

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
      const base64Data = dataUrl.split(',')[1];

      const payload = {
        frame: base64Data,
        error_x: currentError.x,
        error_y: currentError.y,
        drop_los: dropLOS,
        gains: pidGains,
        timestamp: now
      };

      if (this.isConnected) {
        if (this.isTauriAvailable) {
          const { invoke } = await import('@tauri-apps/api/core');
          const res = await invoke('process_frame', { payload });
          this.handleBackendResponse(res);
          this.isProcessingFrame = false;
        } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(payload));
        }
      } else {
        this.simulateFallbackTracking(currentError.x, currentError.y, dropLOS, pidGains);
        this.isProcessingFrame = false;
      }
    } catch (err) {
      this.isProcessingFrame = false;
    }
  }

  simulateFallbackTracking(errX, errY, dropLOS, pidGains) {
    if (dropLOS) {
      this.handleBackendResponse({
        state: 'PREDICTIVE_HOLD',
        pan_velocity: 0.0,
        tilt_velocity: 0.0,
        error_px: [errX, errY],
        predicted_px: [errX * 0.9, errY * 0.9],
        locked: false,
        fps: this.fps,
        cv_latency_ms: 3.2,
        binary_frame_b64: null
      });
      return;
    }

    const kpPan = pidGains ? pidGains.kp_pan : 0.08;
    const kpTilt = pidGains ? pidGains.kp_tilt : 0.08;

    const panVel = errX * kpPan;
    const tiltVel = -errY * kpTilt;
    const isLocked = Math.abs(errX) < 15 && Math.abs(errY) < 15;

    this.handleBackendResponse({
      state: isLocked ? 'TRACKING' : 'ACQUIRE',
      pan_velocity: Math.max(Math.min(panVel, 20.0), -20.0),
      tilt_velocity: Math.max(Math.min(tiltVel, 20.0), -20.0),
      error_px: [errX, errY],
      predicted_px: [errX * 0.95, errY * 0.95],
      locked: isLocked,
      fps: this.fps,
      cv_latency_ms: 3.2,
      binary_frame_b64: null
    });
  }

  handleBackendResponse(payload) {
    if (this.onTelemetryCallback) {
      this.onTelemetryCallback(payload);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export const videoBridge = new VideoBridge();
