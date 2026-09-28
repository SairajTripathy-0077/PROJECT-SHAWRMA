"""
FSOC PAT State-Anchored Optical Tracker & Estimator Engine
Features:
- State-Anchored Kalman Filter with Forward Projection (Latency Compensation)
- Dynamic Innovation-Based Residual Q Adaptation (5x Scaling on Maneuvers)
- First-Frame Shock Prevention (Anchored Initial Position with Zero Initial Velocity)
- Covariance-Bounded Coasting during Dropouts
- Integration with Dynamic Perimeter TCoG and Feedforward Back-Calculation PID
- Dual-Mode Tokio TCP / Stdio IPC Streaming
- Zero-Regression Telemetry Schema Compatibility (snake_case and alias mappings)
"""

import sys
import json
import base64
import time
import math
from typing import Tuple, Optional, Dict, Any
import numpy as np

try:
    from backend.cv_pipeline import DynamicPerimeterTCoGTracker, VisionTracker, HAS_OPENCV
    from backend.controller import FeedforwardBackcalcPIDController, DEFAULT_CONTROLLER_CONFIG
except ImportError:
    try:
        from cv_pipeline import DynamicPerimeterTCoGTracker, VisionTracker, HAS_OPENCV
        from controller import FeedforwardBackcalcPIDController, DEFAULT_CONTROLLER_CONFIG
    except ImportError:
        HAS_OPENCV = False
        DEFAULT_CONTROLLER_CONFIG = {}

if HAS_OPENCV:
    import cv2


class StateAnchoredKalmanFilter2D:
    """
    2D Constant Velocity Kalman Filter anchored to true measurement time,
    with Extrapolated Forward Projection for Latency Compensation.
    
    State Vector: x = [pos_x, pos_y, vel_x, vel_y]^T
    where velocities are in pixels/second.
    """
    def __init__(
        self,
        dt_default: float = 0.033,
        latency_lag_s: float = 0.025,
        q_pos: float = 0.05,
        q_vel: float = 10.0,
        r_var: float = 1.0,
        maneuver_threshold_px: float = 5.0,
        maneuver_q_scale: float = 5.0,
        max_covariance_trace: float = 1000.0
    ):
        self.dt_default = dt_default
        self.latency_lag_s = latency_lag_s
        self.q_pos_base = q_pos
        self.q_vel_base = q_vel
        self.r_var = r_var
        self.maneuver_threshold_px = maneuver_threshold_px
        self.maneuver_q_scale = maneuver_q_scale
        self.max_covariance_trace = max_covariance_trace

        self.x = np.zeros((4, 1), dtype=np.float32)
        self.H = np.array([
            [1.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0]
        ], dtype=np.float32)

        self.R = np.eye(2, dtype=np.float32) * self.r_var
        self.P = np.diag([5.0, 5.0, 200.0, 200.0]).astype(np.float32)

        self.frames_lost = 0
        self.initialized = False
        self.last_innovation_mag = 0.0

    def _build_transition_matrix(self, dt: float) -> np.ndarray:
        return np.array([
            [1.0, 0.0, dt,  0.0],
            [0.0, 1.0, 0.0, dt ],
            [0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0]
        ], dtype=np.float32)

    def _build_q_matrix(self, dt: float, q_scale: float = 1.0) -> np.ndarray:
        dt2 = (dt ** 2) / 2.0
        q_p = self.q_pos_base
        q_v = self.q_vel_base * q_scale
        return np.array([
            [dt2 * dt2 * q_p, 0.0,             dt2 * dt * q_p, 0.0           ],
            [0.0,             dt2 * dt2 * q_p, 0.0,            dt2 * dt * q_p],
            [dt2 * dt * q_p,  0.0,             dt * dt * q_v,  0.0           ],
            [0.0,             dt2 * dt * q_p,  0.0,            dt * dt * q_v ]
        ], dtype=np.float32)

    def predict(self, dt: Optional[float] = None) -> Tuple[float, float]:
        step_dt = min(dt if dt is not None and dt > 0 else self.dt_default, 0.1)
        F = self._build_transition_matrix(step_dt)
        Q = self._build_q_matrix(step_dt)

        self.x = np.dot(F, self.x)
        self.P = np.dot(np.dot(F, self.P), F.T) + Q
        self.P = (self.P + self.P.T) * 0.5

        # Bound covariance growth during long dropouts
        tr = np.trace(self.P)
        if tr > self.max_covariance_trace:
            self.P *= (self.max_covariance_trace / tr)

        return float(self.x[0, 0]), float(self.x[1, 0])

    def update(self, z_x: float, z_y: float, dt: Optional[float] = None) -> Tuple[float, float, float, float]:
        step_dt = min(dt if dt is not None and dt > 0 else self.dt_default, 0.1)

        if not self.initialized:
            self.x[0, 0] = z_x
            self.x[1, 0] = z_y
            self.x[2, 0] = 0.0
            self.x[3, 0] = 0.0
            self.initialized = True
            self.frames_lost = 0
            return float(z_x), float(z_y), 0.0, 0.0

        z = np.array([[z_x], [z_y]], dtype=np.float32)
        y = z - np.dot(self.H, self.x)
        innovation_mag = float(np.hypot(y[0, 0], y[1, 0]))
        self.last_innovation_mag = innovation_mag

        if innovation_mag > self.maneuver_threshold_px:
            scale = min(self.maneuver_q_scale * (innovation_mag / self.maneuver_threshold_px), 20.0)
            self.P += self._build_q_matrix(step_dt, q_scale=scale)

        S = np.dot(np.dot(self.H, self.P), self.H.T) + self.R
        K = np.dot(np.dot(self.P, self.H.T), np.linalg.inv(S))

        self.x = self.x + np.dot(K, y)
        I = np.eye(4, dtype=np.float32)
        self.P = np.dot((I - np.dot(K, self.H)), self.P)
        self.P = (self.P + self.P.T) * 0.5
        self.frames_lost = 0

        return float(self.x[0, 0]), float(self.x[1, 0]), float(self.x[2, 0]), float(self.x[3, 0])

    def get_forward_projection(self, lag_s: Optional[float] = None) -> Tuple[float, float]:
        dt_lag = lag_s if lag_s is not None else self.latency_lag_s
        proj_x = float(self.x[0, 0] + self.x[2, 0] * dt_lag)
        proj_y = float(self.x[1, 0] + self.x[3, 0] * dt_lag)
        return proj_x, proj_y

    def coast(self, dt: Optional[float] = None) -> Tuple[float, float, float, float]:
        self.frames_lost += 1
        pos_x, pos_y = self.predict(dt=dt)
        return pos_x, pos_y, float(self.x[2, 0]), float(self.x[3, 0])

    def reset(self) -> None:
        self.x = np.zeros((4, 1), dtype=np.float32)
        self.P = np.diag([5.0, 5.0, 200.0, 200.0]).astype(np.float32)
        self.frames_lost = 0
        self.initialized = False
        self.last_innovation_mag = 0.0


# Backward compatibility aliases
LatencyCompensatedKalmanFilter2D = StateAnchoredKalmanFilter2D
KalmanFilter2D = StateAnchoredKalmanFilter2D


class AutonomousPATTrackingEngine:
    """
    Complete FSOC PAT Vision, Estimation, and Control Core Engine.
    """
    def __init__(self, cfg: Optional[Dict[str, Any]] = None):
        self.cfg = cfg or {
            "latency_ms": 25.0,
            "kp": 7.5,
            "ki": 1.5,
            "kd": 0.1,
            "k_ff": 1.0,
            "k_aw": 0.6,
            "max_vel": 180.0,
            "a_max": 3500.0,
            "integral_limit": 50.0,
            "boresight_x": 320.0,
            "boresight_y": 240.0
        }

        self.vision = VisionTracker()
        self.kalman = StateAnchoredKalmanFilter2D(
            dt_default=0.033,
            latency_lag_s=self.cfg.get("latency_ms", 25.0) / 1000.0
        )
        self.controller = FeedforwardBackcalcPIDController(
            kp=self.cfg.get("kp", 7.5),
            ki=self.cfg.get("ki", 1.5),
            kd=self.cfg.get("kd", 0.1),
            k_ff=self.cfg.get("k_ff", 1.0),
            k_aw=self.cfg.get("k_aw", 0.6),
            max_vel=self.cfg.get("max_vel", 180.0),
            a_max=self.cfg.get("a_max", 3500.0),
            integral_limit=self.cfg.get("integral_limit", 50.0)
        )

        self.last_timestamp = None

    def process_frame(
        self,
        frame_b64: str = "",
        input_err_x: Optional[float] = None,
        input_err_y: Optional[float] = None,
        timestamp_s: Optional[float] = None
    ) -> Dict[str, Any]:
        now = time.time() if timestamp_s is None else timestamp_s
        if self.last_timestamp is None:
            dt = 0.033
        else:
            dt = max(min(now - self.last_timestamp, 0.1), 0.001)
        self.last_timestamp = now

        # 1. Extrapolate projected beacon coordinate for ROI center
        proj_x, proj_y = self.kalman.get_forward_projection()
        if not self.kalman.initialized:
            proj_x, proj_y = self.cfg["boresight_x"], self.cfg["boresight_y"]

        # 2. Computer Vision Optical Detection (TCoG + Dynamic ROI)
        frame_np = self.vision.decode_b64(frame_b64) if frame_b64 else None
        centroid, fsm_state, cv_latency_ms = self.vision.process_frame_pipeline(
            frame_np, proj_x, proj_y
        )

        # 3. Handle coordinate inputs
        if centroid is not None:
            raw_x, raw_y = centroid
            self.kalman.predict(dt=dt)
            est_x, est_y, vx, vy = self.kalman.update(raw_x, raw_y, dt=dt)
            beacon_detected = True
        elif input_err_x is not None and input_err_y is not None:
            raw_x = self.cfg["boresight_x"] + float(input_err_x)
            raw_y = self.cfg["boresight_y"] + float(input_err_y)
            self.kalman.predict(dt=dt)
            est_x, est_y, vx, vy = self.kalman.update(raw_x, raw_y, dt=dt)
            beacon_detected = True
            fsm_state = "TRACKING"
        else:
            est_x, est_y, vx, vy = self.kalman.coast(dt=dt)
            beacon_detected = self.kalman.frames_lost <= 5

        # 4. Latency-Compensated Forward Projected Setpoint for Controller
        x_proj, y_proj = self.kalman.get_forward_projection()

        # 5. Feedforward + Back-Calculation PID Controller
        pan_vel, tilt_vel, err_x, err_y = self.controller.compute(
            x_proj=x_proj,
            y_proj=y_proj,
            vel_est_x=vx,
            vel_est_y=vy,
            boresight_x=self.cfg["boresight_x"],
            boresight_y=self.cfg["boresight_y"],
            dt=dt
        )

        is_locked = beacon_detected and (abs(err_x) < 15.0) and (abs(err_y) < 15.0)
        current_fps = round(1.0 / dt, 1) if dt > 0 else 60.0
        current_rmse = round(float(np.hypot(err_x, err_y)), 2)

        return {
            "state": fsm_state,
            "pan_velocity": round(pan_vel, 4),
            "tilt_velocity": round(tilt_vel, 4),
            "pan_vel": round(pan_vel, 4),
            "tilt_vel": round(tilt_vel, 4),
            "error_px": [round(err_x, 2), round(err_y, 2)],
            "predicted_px": [round(x_proj - self.cfg["boresight_x"], 2), round(y_proj - self.cfg["boresight_y"], 2)],
            "locked": bool(is_locked),
            "rmse": current_rmse,
            "fps": current_fps,
            "cv_latency_ms": round(cv_latency_ms, 2)
        }


class AutonomousTrackingFSM:
    """Backward-compatible FSM wrapper around AutonomousPATTrackingEngine for legacy servers."""
    def __init__(self):
        self.engine = AutonomousPATTrackingEngine()
        self.pid = self.engine.controller

    def update(
        self,
        centroid: Optional[Tuple[float, float]] = None,
        input_err_x: Optional[float] = None,
        input_err_y: Optional[float] = None,
        drop_los: bool = False,
        dt: float = 0.033
    ) -> Dict[str, Any]:
        if drop_los:
            est_x, est_y, vx, vy = self.engine.kalman.coast(dt=dt)
            x_proj, y_proj = self.engine.kalman.get_forward_projection()
            pan_vel, tilt_vel, err_x, err_y = self.engine.controller.compute(
                x_proj, y_proj, vx, vy, dt=dt
            )
            return {
                "state": "PREDICTIVE_HOLD",
                "pan_velocity": round(pan_vel, 4),
                "tilt_velocity": round(tilt_vel, 4),
                "error_px": [round(err_x, 2), round(err_y, 2)],
                "predicted_px": [round(x_proj - self.engine.cfg["boresight_x"], 2), round(y_proj - self.engine.cfg["boresight_y"], 2)],
                "locked": False
            }

        if centroid is not None:
            raw_x, raw_y = centroid
            self.engine.kalman.predict(dt=dt)
            est_x, est_y, vx, vy = self.engine.kalman.update(raw_x, raw_y, dt=dt)
            state = "TRACKING"
        elif input_err_x is not None and input_err_y is not None:
            raw_x = self.engine.cfg["boresight_x"] + float(input_err_x)
            raw_y = self.engine.cfg["boresight_y"] + float(input_err_y)
            self.engine.kalman.predict(dt=dt)
            est_x, est_y, vx, vy = self.engine.kalman.update(raw_x, raw_y, dt=dt)
            state = "TRACKING"
        else:
            est_x, est_y, vx, vy = self.engine.kalman.coast(dt=dt)
            state = "SEARCHING"

        x_proj, y_proj = self.engine.kalman.get_forward_projection()
        pan_vel, tilt_vel, err_x, err_y = self.engine.controller.compute(
            x_proj, y_proj, vx, vy, dt=dt
        )
        is_locked = (abs(err_x) < 15.0) and (abs(err_y) < 15.0)

        return {
            "state": state,
            "pan_velocity": round(pan_vel, 4),
            "tilt_velocity": round(tilt_vel, 4),
            "error_px": [round(err_x, 2), round(err_y, 2)],
            "predicted_px": [round(x_proj - self.engine.cfg["boresight_x"], 2), round(y_proj - self.engine.cfg["boresight_y"], 2)],
            "locked": bool(is_locked)
        }


def extract_centroid_and_binary_preview(frame_b64: str) -> Tuple[Optional[Tuple[float, float]], Optional[str]]:
    """Backward compatible centroid & binary preview extractor for legacy servers."""
    if not HAS_OPENCV or not frame_b64:
        return None, None
    try:
        if "," in frame_b64:
            frame_b64 = frame_b64.split(",", 1)[1]
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return None, None
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        tracker = DynamicPerimeterTCoGTracker()
        centroid, status, meta = tracker.extract_centroid_tcog(gray, 320.0, 240.0)
        
        # Binary preview thumbnail
        threshold = int(meta.get("threshold", 200))
        _, thresh = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)
        _, buf = cv2.imencode(".jpg", thresh)
        bin_b64 = base64.b64encode(buf).decode("utf-8")
        return centroid, bin_b64
    except Exception:
        return None, None


def main():
    engine = AutonomousPATTrackingEngine()
    print(json.dumps({
        "status": "READY",
        "opencv": HAS_OPENCV,
        "message": "FSOC PAT State-Anchored TCoG Feedforward Engine Initialized",
        "config": engine.cfg
    }), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            data = json.loads(line)
            frame_b64 = data.get("frame", "")
            input_err_x = data.get("error_x", None)
            input_err_y = data.get("error_y", None)
            timestamp_s = data.get("timestamp", None)

            res = engine.process_frame(
                frame_b64=frame_b64,
                input_err_x=input_err_x,
                input_err_y=input_err_y,
                timestamp_s=timestamp_s
            )
            print(json.dumps(res), flush=True)

        except Exception as e:
            err_resp = {
                "state": "SEARCHING",
                "pan_velocity": 0.0,
                "tilt_velocity": 0.0,
                "pan_vel": 0.0,
                "tilt_vel": 0.0,
                "error_px": [0.0, 0.0],
                "predicted_px": [0.0, 0.0],
                "locked": False,
                "rmse": 0.0,
                "fps": 0.0,
                "cv_latency_ms": 0.0,
                "error": str(e)
            }
            print(json.dumps(err_resp), flush=True)


if __name__ == "__main__":
    main()
