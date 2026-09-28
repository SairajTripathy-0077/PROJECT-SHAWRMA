<!-- eng-org:graphyfy generated 2026-09-28T22:33:00+05:30 -->
# Architecture Linking Graph

*How frontend WebGL components, transport services, and the Python GNC vision backend connect.*

```mermaid
flowchart TD
  subgraph UI_Layer["User Interface & Telemetry HUD"]
    App["App.jsx (Main Controller)"]
    HUD["TacticalHUD.jsx (Telemetry HUD)"]
    Deck["TuningDeck.jsx (GNC Gains)"]
  end

  subgraph 3D_Simulation["3D Kinematics & WebGL Scene"]
    DualView["DualViewportScene.jsx (R3F Viewports)"]
    Scene3D["3D Gimbal & Optical Beacon Model"]
  end

  subgraph Transport["Transport & Bridge Service"]
    VBridge["videoBridge.js (Frame Enc / IPC / Fallback)"]
    TauriRust["src-tauri (Rust Native Shell & Tokio Bridge)"]
  end

  subgraph Vision_Backend["Python GNC Vision & Control Engine"]
    TCoG["Dynamic Perimeter TCoG Detector (cv_pipeline.py)"]
    KF["State-Anchored Kalman Filter + 25ms Projection (tracker.py)"]
    Controller["Feedforward + Back-Calc PID & Slew Limiter (controller.py)"]
  end

  App --> DualView
  App --> HUD
  App --> Deck
  DualView --> Scene3D

  DualView -->|Canvas Base64 / Error Vector| VBridge
  VBridge -->|JPEG Buffer / Gains / Timestamp| TauriRust
  TauriRust -->|Stdin JSON IPC| TCoG
  VBridge -.->|WebSocket / Direct IPC| TCoG

  TCoG -->|Sub-pixel Centroid (cx, cy)| KF
  KF -->|Forward Projected Setpoint (x_proj, y_proj) & Velocity| Controller
  Controller -->|Velocity Cmds (v_x, -v_y) & FSM Telemetry| VBridge
  VBridge -->|Gimbal Velocity Feedback| App
```
