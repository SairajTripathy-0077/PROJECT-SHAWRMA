# Architecture Memory: FSOC PAT Simulator & Computer Vision Engine

## 1. System Overview
The FSOC PAT (Free-Space Optical Communications Pointing, Acquisition, and Tracking) Simulator is a high-performance, real-time closed-loop optical tracking simulation system. It integrates:
- **3D Kinematics & Optical Simulation (Frontend)**: React 18, React Three Fiber (Three.js), and Tailwind CSS for realistic 3D optical beacon generation, atmospheric turbulence, and mechanical gimbal jitter.
- **Computer Vision & Tracking Engine (Backend)**: Python 3 with OpenCV (5.x) for optical spot contour detection, Gaussian centroid estimation, 2D Kalman Filter state estimation, and Dual-Axis PID angular velocity control.
- **Inter-Process Transport (Bridge)**: Dual-mode transport via Tauri v2 IPC for desktop app mode and WebSocket (`ws://localhost:8765`) / internal mathematical fallback for web browser mode.

## 2. Module Boundaries & Data Flow

```mermaid
flowchart TD
  subgraph Frontend["React Three Fiber Simulation (UI & 3D WebGL)"]
    Canvas[SimulationCanvas / Three.js Beacon Scene]
    HUD[TelemetryOverlay & Dashboard]
    Bridge[videoBridge.js Transport Manager]
  end

  subgraph Sidecar["Python Computer Vision & Control Backend"]
    CV[OpenCV Spot / Centroid Extractor (cv_pipeline.py)]
    KF[Latency-Compensated 2D Kalman Filter with Dynamic Q-Scaling]
    PID[Feedforward PID + Derivative-on-Measurement + Slew Rate Limiter]
  end

  Canvas -->|Render Frame / Coordinates| Bridge
  Bridge -->|Base64 JPEG / Stdin IPC| CV
  CV -->|Pixel Centroid [cx, cy]| KF
  KF -->|Compensated State [x_pred, y_pred, vx, vy]| PID
  PID -->|Slew-Limited Pan/Tilt Commands & Lock Status| Bridge
  Bridge -->|Gimbal Velocity Feedback| Canvas
  Bridge -->|FPS, RMSE, State| HUD
```

## 3. Core Components
- `src/components/SimulationCanvas.jsx`: Manages Three.js rendering, beam trajectory generator (Sinusoidal, Lissajous, Spiral, Brownian), atmospheric turbulence flicker, and pixel error calculation.
- `src/services/videoBridge.js`: Extracts JPEG base64 frames from WebGL canvas at 30 FPS, coordinates IPC transmission, and provides real-time fallback tracking.
- `tracker.py` & `backend/cv_pipeline.py`: Production-grade OpenCV centroid extraction, Latency-Compensated Kalman forward prediction ($t + \Delta t_{latency}$), Feedforward velocity driving ($K_{ff} \cdot \hat{\dot{x}}$), and Kinematic Slew-Rate acceleration limiting ($\Delta V \le a_{max} \cdot \Delta t$).
- `backend/test_cv_tracker.py`: Comprehensive 5-stage automated verification suite for closed-loop stability, overshoot elimination, and latency benchmarking.
- `src-tauri/`: Rust backend managing the native application lifecycle and sidecar process spawning.
