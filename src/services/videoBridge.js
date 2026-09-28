/**
 * VideoBridge Service for FSOC PAT Virtual Simulator
 * Phase 5 Low-Latency Bridge Integration
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
      console.log('[VideoBridge] Initializing WebSocket/Local Bridge connection...');
      this.initWebSocket(wsUrl);
    } else {
      console.log('[VideoBridge] Tauri IPC environment active.');
      this.initTauriIPC();
    }
  }

  initWebSocket(wsUrl) {
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[VideoBridge] Connected to Python vision sidecar on port 8765.');
        this.isConnected = true;
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleBackendResponse(payload);
        } catch (err) {
          console.error('[VideoBridge] Telemetry parse error:', err);
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
      console.warn('[VideoBridge] WebSocket connection error:', e);
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
      console.error('[VideoBridge] Failed to set up Tauri listener:', e);
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
        pan_vel: 0.0,
        tilt_vel: 0.0,
        error_px: [errX, errY],
        rmse: Math.sqrt(errX * errX + errY * errY)
      });
      return;
    }

    const kpPan = pidGains ? pidGains.kp_pan : 0.08;
    const kpTilt = pidGains ? pidGains.kp_tilt : 0.08;

    // Closed-loop PID velocity scaling with correct negative feedback sign
    const panVel = Math.max(Math.min(errX * kpPan * 0.05, 2.0), -2.0);
    const tiltVel = Math.max(Math.min(errY * kpTilt * 0.05, 2.0), -2.0);

    const isLocked = Math.abs(errX) < 15 && Math.abs(errY) < 15;
    const rmse = Math.sqrt(errX * errX + errY * errY);

    this.handleBackendResponse({
      state: isLocked ? 'TRACKING' : 'ACQUIRE',
      pan_vel: roundVal(panVel, 5),
      tilt_vel: roundVal(tiltVel, 5),
      error_px: [roundVal(errX, 1), roundVal(errY, 1)],
      rmse: roundVal(rmse, 2)
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

function roundVal(val, decimals) {
  return Number(Math.round(val + 'e' + decimals) + 'e-' + decimals);
}

export const videoBridge = new VideoBridge();
