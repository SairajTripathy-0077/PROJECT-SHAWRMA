/**
 * VideoBridge Service for FSOC PAT Virtual Simulator
 * Handles frame extraction from R3F WebGL canvas and manages communication
 * with the Python OpenCV + Kalman Filter + PID Vision Backend via Tauri IPC or WebSocket/Local bridge.
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

  /**
   * Initialize bridge connection (WebSocket fallback or Tauri IPC listener)
   * @param {string} wsUrl Optional WebSocket URL if running over network/socket
   * @param {Function} onTelemetry Callback function to receive tracking feedback
   */
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

      this.ws.onerror = (err) => {
        console.warn('[VideoBridge] WebSocket connection error. Falling back to internal PID simulation loop.', err);
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        console.log('[VideoBridge] WebSocket connection closed.');
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

  /**
   * Captures WebGL canvas frame and sends to backend
   * @param {HTMLCanvasElement} canvas R3F WebGL DOM Canvas Element
   * @param {Object} currentError Optional simulated pixel error if in fallback mode
   */
  async sendFrame(canvas, currentError = { x: 0, y: 0 }) {
    if (!canvas) return;

    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFrameTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime));
      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    // Prevent frame stacking if backend is still processing
    if (this.isProcessingFrame && this.isConnected) {
      return;
    }

    this.isProcessingFrame = true;

    try {
      // Compress canvas frame to low-res JPEG base64 buffer (640x480 resolution target)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      const base64Data = dataUrl.split(',')[1];

      const payload = {
        frame: base64Data,
        error_x: currentError.x,
        error_y: currentError.y,
        timestamp: now
      };

      if (this.isConnected) {
        if (this.isTauriAvailable) {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('process_frame', { payload });
        } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(payload));
        }
      } else {
        // Fallback calculation if backend script is offline during browser standalone mode
        this.simulateFallbackTracking(currentError.x, currentError.y);
        this.isProcessingFrame = false;
      }
    } catch (err) {
      console.error('[VideoBridge] Error encoding/transmitting canvas frame:', err);
      this.isProcessingFrame = false;
    }
  }

  simulateFallbackTracking(errX, errY) {
    const kP = 0.08;
    const kD = 0.01;
    
    // Calculate angular velocities with proper sign alignment
    // Negative feedback loop: if target is right (+errX), pan left (-velPan) to re-center
    const panVel = -errX * kP;
    const tiltVel = errY * kP;
    const isLocked = Math.abs(errX) < 15 && Math.abs(errY) < 15;

    this.handleBackendResponse({
      pan_velocity: panVel,
      tilt_velocity: tiltVel,
      error_px: [errX, errY],
      locked: isLocked,
      fps: this.fps
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
