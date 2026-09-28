"""
FSOC PAT State-Anchored Multi-Target Optical Tracker & Estimator Engine
Aerospace-Grade Architecture Featuring:
- MultiTracker with N=2 Tracks (Sat 1 Primary & Sat 2 Secondary)
- Momentum-Aware Data Association (Mahalanobis Distance + Velocity Alignment Cost)
- Chi-Square (9.21) Innovation Gating against False Associations / ID Swapping
- State-Anchored Kalman Filters with Decoupled Forward Latency Projection (+25ms)
- Asymmetric Dropout & Cloud-Fade Tracking
- Full Backward Compatibility with Single-Target AutonomousPATTrackingEngine & Stdio Streams
"""

import sys
import json
import base64
import time
import math
from typing import Tuple, Optional, Dict, Any, List
import numpy as np

try:
    from backend.cv_pipeline import DynamicPerimeterTCoGTracker, VisionTracker, HAS_OPENCV
    from backend.controller import FeedforwardBackcalcPIDController, VirtualSetpointController, DEFAULT_CONTROLLER_CONFIG
except ImportError:
    try:
        from cv_pipeline import DynamicPerimeterTCoGTracker, VisionTracker, HAS_OPENCV
        from controller import FeedforwardBackcalcPIDController, VirtualSetpointController, DEFAULT_CONTROLLER_CONFIG
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
        self.last_meas: Optional[Tuple[float, float]] = None

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

        tr = np.trace(self.P)
        if tr > self.max_covariance_trace:
            self.P *= (self.max_covariance_trace / tr)

        return float(self.x[0, 0]), float(self.x[1, 0])

    def compute_mahalanobis_distance(self, z_x: float, z_y: float) -> Tuple[float, np.ndarray]:
        """Computes Mahalanobis distance of candidate measurement from predicted track state."""
        z = np.array([[z_x], [z_y]], dtype=np.float32)
        y = z - np.dot(self.H, self.x)
        S = np.dot(np.dot(self.H, self.P), self.H.T) + self.R
        try:
            S_inv = np.linalg.inv(S)
            d_sq = float(np.dot(np.dot(y.T, S_inv), y)[0, 0])
            d_mahal = math.sqrt(max(0.0, d_sq))
        except np.linalg.LinAlgError:
            d_mahal = float(np.hypot(y[0, 0], y[1, 0]))
        return d_mahal, y

    def update(self, z_x: float, z_y: float, dt: Optional[float] = None) -> Tuple[float, float, float, float]:
        step_dt = min(dt if dt is not None and dt > 0 else self.dt_default, 0.1)

        if not self.initialized:
            self.x[0, 0] = z_x
            self.x[1, 0] = z_y
            self.x[2, 0] = 0.0
            self.x[3, 0] = 0.0
            self.initialized = True
            self.frames_lost = 0
            self.last_meas = (z_x, z_y)
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
        self.last_meas = (z_x, z_y)

        return float(self.x[0, 0]), float(self.x[1, 0]), float(self.x[2, 0]), float(self.x[3, 0])

    def get_forward_projection(self, lag_s: Optional[float] = None) -> Tuple[float, float]:
        dt_lag = lag_s if lag_s is not None else self.latency_lag_s
        proj_x = float(self.x[0, 0] + self.x[2, 0] * dt_lag)
        proj_y = float(self.x[1, 0] + self.x[3, 0] * dt_lag)
        return proj_x, proj_y

    def get_state(self) -> Tuple[float, float, float, float]:
        """Returns current state vector (x, y, vx, vy)."""
        return float(self.x[0, 0]), float(self.x[1, 0]), float(self.x[2, 0]), float(self.x[3, 0])

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
        self.last_meas = None


class MultiTracker:
    """
    Multi-Target State Estimator (N=2) with Momentum-Aware Data Association.
    Prevents ID swapping during path crossing/merges using Kinematic Momentum Consistency.
    """
    def __init__(
        self,
        num_tracks: int = 2,
        dt_default: float = 0.033,
        latency_lag_s: float = 0.025,
        lambda_momentum: float = 3.0,
        chi2_gate: float = 9.21  # Chi-squared gate for 2 DOF (p=0.01)
    ):
        self.num_tracks = num_tracks
        self.dt_default = dt_default
        self.latency_lag_s = latency_lag_s
        self.lambda_momentum = lambda_momentum
        self.chi2_gate = chi2_gate

        self.tracks = [
            StateAnchoredKalmanFilter2D(dt_default=dt_default, latency_lag_s=latency_lag_s)
            for _ in range(num_tracks)
        ]
        self.track_names = ["SAT_1", "SAT_2"]
        self.track_statuses = ["SEARCHING", "SEARCHING"]

    def predict_all(self, dt: float = 0.033) -> List[Tuple[float, float]]:
        """Predict forward step for all active tracks."""
        predictions = []
        for kf in self.tracks:
            if kf.initialized:
                px, py = kf.predict(dt=dt)
            else:
                px, py = 320.0, 240.0
            predictions.append((px, py))
        return predictions

    def get_projections_all(self) -> List[Tuple[float, float]]:
        """Get latency-compensated forward projected coordinates for all tracks."""
        projections = []
        for kf in self.tracks:
            if kf.initialized:
                projections.append(kf.get_forward_projection())
            else:
                projections.append((320.0, 240.0))
        return projections

    def update_with_measurements(
        self,
        measurements: List[Optional[Tuple[float, float]]],
        dt: float = 0.033
    ) -> List[Dict[str, Any]]:
        """
        Executes Momentum-Aware Data Association between M measurements and N tracks.
        """
        valid_meas = [m for m in measurements if m is not None]
        m_count = len(valid_meas)
        n_tracks = self.num_tracks

        # Step 1: Compute Cost Matrix with Spatial Mahalanobis + Momentum Penalty
        cost_matrix = np.full((n_tracks, max(1, m_count)), 1e6, dtype=np.float32)

        for i, kf in enumerate(self.tracks):
            if not kf.initialized:
                continue

            vx_est = float(kf.x[2, 0])
            vy_est = float(kf.x[3, 0])
            v_est_mag = float(np.hypot(vx_est, vy_est))

            for j, meas in enumerate(valid_meas):
                # 1. Spatial Cost (Mahalanobis Distance)
                d_mahal, residual = kf.compute_mahalanobis_distance(meas[0], meas[1])

                # Reject if outside Chi-square gate
                if (d_mahal ** 2) > self.chi2_gate and kf.frames_lost < 3:
                    continue

                # 2. Momentum Cost (Penalize velocity vector misalignment)
                momentum_cost = 0.0
                if v_est_mag > 2.0 and kf.last_meas is not None:
                    # Measured velocity vector from previous measurement
                    v_meas_x = (meas[0] - kf.last_meas[0]) / max(dt, 0.001)
                    v_meas_y = (meas[1] - kf.last_meas[1]) / max(dt, 0.001)
                    v_meas_mag = float(np.hypot(v_meas_x, v_meas_y))

                    if v_meas_mag > 1.0:
                        # Cosine similarity between established momentum and candidate
                        dot_prod = (v_meas_x * vx_est + v_meas_y * vy_est)
                        cos_sim = dot_prod / (v_meas_mag * v_est_mag + 1e-4)
                        # Range [0.0 (aligned) -> 2.0 (reversal)]
                        momentum_cost = float(np.clip(1.0 - cos_sim, 0.0, 2.0))

                # Total Combined Cost
                total_cost = d_mahal + self.lambda_momentum * momentum_cost
                cost_matrix[i, j] = total_cost

        # Step 2: Optimal Assignment via Minimum Cost Permutation
        assigned_track_to_meas: Dict[int, int] = {}
        assigned_meas: set = set()

        if m_count == 1:
            # 1 measurement available -> assign to track with lowest cost if gated
            best_i = int(np.argmin(cost_matrix[:, 0]))
            if cost_matrix[best_i, 0] < 1e5:
                assigned_track_to_meas[best_i] = 0
                assigned_meas.add(0)
            else:
                # If neither initialized track matched, initialize first uninitialized track
                for i, kf in enumerate(self.tracks):
                    if not kf.initialized:
                        assigned_track_to_meas[i] = 0
                        assigned_meas.add(0)
                        break

        elif m_count >= 2:
            # 2 measurements available -> Evaluate (0->0, 1->1) vs (0->1, 1->0)
            cost_direct = cost_matrix[0, 0] + cost_matrix[1, 1]
            cost_crossed = cost_matrix[0, 1] + cost_matrix[1, 0]

            if not self.tracks[0].initialized and not self.tracks[1].initialized:
                # First frame: deterministic assignment
                assigned_track_to_meas[0] = 0
                assigned_track_to_meas[1] = 1
            elif cost_direct <= cost_crossed and cost_direct < 1e5:
                assigned_track_to_meas[0] = 0
                assigned_track_to_meas[1] = 1
            elif cost_crossed < cost_direct and cost_crossed < 1e5:
                # Momentum strongly favors cross assignment (resolved crossover without ID swap)
                assigned_track_to_meas[0] = 1
                assigned_track_to_meas[1] = 0
            else:
                # Fallback matching
                for i in range(n_tracks):
                    for j in range(m_count):
                        if j not in assigned_meas and cost_matrix[i, j] < 1e5:
                            assigned_track_to_meas[i] = j
                            assigned_meas.add(j)
                            break

        # Step 3: Update matched tracks and coast unassigned tracks
        track_outputs = []
        for i, kf in enumerate(self.tracks):
            if i in assigned_track_to_meas:
                meas_idx = assigned_track_to_meas[i]
                meas = valid_meas[meas_idx]
                est_x, est_y, vx, vy = kf.update(meas[0], meas[1], dt=dt)
                status = "TRACKING"
            else:
                est_x, est_y, vx, vy = kf.coast(dt=dt)
                if kf.frames_lost <= 5:
                    status = "COASTING"
                else:
                    status = "LOST"

            self.track_statuses[i] = status
            proj_x, proj_y = kf.get_forward_projection()

            track_outputs.append({
                "id": i,
                "name": self.track_names[i],
                "status": status,
                "estimated_pos": [round(est_x, 2), round(est_y, 2)],
                "projected_pos": [round(proj_x, 2), round(proj_y, 2)],
                "velocity": [round(vx, 2), round(vy, 2)],
                "frames_lost": kf.frames_lost,
                "active": status in ["TRACKING", "COASTING"]
            })

        return track_outputs


# Backward compatibility aliases
LatencyCompensatedKalmanFilter2D = StateAnchoredKalmanFilter2D
KalmanFilter2D = StateAnchoredKalmanFilter2D


class AutonomousPATTrackingEngine:
    """
    Complete FSOC PAT Vision, Estimation, and Control Core Engine.
    Supports Dual-Target and Single-Target Modes seamlessly.
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
            "boresight_y": 240.0,
            "control_mode": "PRIMARY_ONLY"  # "PRIMARY_ONLY" | "BARYCENTER"
        }

        self.vision = VisionTracker()
        self.multi_tracker = MultiTracker(
            num_tracks=2,
            dt_default=0.033,
            latency_lag_s=self.cfg.get("latency_ms", 25.0) / 1000.0
        )
        self.controller = VirtualSetpointController(
            kp=self.cfg.get("kp", 7.5),
            ki=self.cfg.get("ki", 1.5),
            kd=self.cfg.get("kd", 0.1),
            k_ff=self.cfg.get("k_ff", 1.0),
            k_aw=self.cfg.get("k_aw", 0.6),
            max_vel=self.cfg.get("max_vel", 180.0),
            a_max=self.cfg.get("a_max", 3500.0),
            integral_limit=self.cfg.get("integral_limit", 50.0),
            mode=self.cfg.get("control_mode", "PRIMARY_ONLY")
        )

        # Single tracker backward-compatible pointer
        self.kalman = self.multi_tracker.tracks[0]
        self.last_timestamp = None

    def process_frame(
        self,
        frame_b64: str = "",
        input_err_x: Optional[float] = None,
        input_err_y: Optional[float] = None,
        timestamp_s: Optional[float] = None,
        control_mode: Optional[str] = None
    ) -> Dict[str, Any]:
        now = time.time() if timestamp_s is None else timestamp_s
        if self.last_timestamp is None:
            dt = 0.033
        else:
            dt = max(min(now - self.last_timestamp, 0.1), 0.001)
        self.last_timestamp = now

        if control_mode:
            self.controller.set_mode(control_mode)

        # 1. Forward Predictions for ROI Windows
        self.multi_tracker.predict_all(dt=dt)
        predicted_centers = self.multi_tracker.get_projections_all()

        # 2. Multi-Target Optical Extraction (Soft-Masked TCoG)
        frame_np = self.vision.decode_b64(frame_b64) if frame_b64 else None
        measurements, fsm_state, cv_latency_ms = self.vision.process_multi_targets(
            frame_np, predicted_centers
        )

        # Single target coordinate overrides from IPC fallback
        if input_err_x is not None and input_err_y is not None:
            raw_x = self.cfg["boresight_x"] + float(input_err_x)
            raw_y = self.cfg["boresight_y"] + float(input_err_y)
            measurements = [(raw_x, raw_y), None]

        # 3. Momentum-Aware Data Association & Estimation
        tracks_data = self.multi_tracker.update_with_measurements(measurements, dt=dt)

        # 4. Virtual Setpoint Calculation & Gimbal Control
        sat1_proj = tracks_data[0]["projected_pos"]
        sat1_vel = tracks_data[0]["velocity"]
        sat1_fade = tracks_data[0]["frames_lost"]

        sat2_proj = tracks_data[1]["projected_pos"]
        sat2_vel = tracks_data[1]["velocity"]
        sat2_fade = tracks_data[1]["frames_lost"]

        pan_vel, tilt_vel, err_x, err_y, vsp_out, telemetry_meta = self.controller.compute_multi_target(
            sat1_proj=sat1_proj,
            sat1_vel=sat1_vel,
            sat1_fade=sat1_fade,
            sat2_proj=sat2_proj,
            sat2_vel=sat2_vel,
            sat2_fade=sat2_fade,
            boresight_x=self.cfg["boresight_x"],
            boresight_y=self.cfg["boresight_y"],
            dt=dt
        )

        is_locked = (abs(err_x) < 15.0) and (abs(err_y) < 15.0)
        current_fps = round(1.0 / dt, 1) if dt > 0 else 60.0
        current_rmse = round(float(np.hypot(err_x, err_y)), 2)

        return {
            "state": telemetry_meta.get("state", fsm_state),
            "pan_velocity": round(pan_vel, 4),
            "tilt_velocity": round(tilt_vel, 4),
            "pan_vel": round(pan_vel, 4),
            "tilt_vel": round(tilt_vel, 4),
            "error_px": [round(err_x, 2), round(err_y, 2)],
            "predicted_px": [round(vsp_out[0] - self.cfg["boresight_x"], 2), round(vsp_out[1] - self.cfg["boresight_y"], 2)],
            "locked": bool(is_locked),
            "rmse": current_rmse,
            "fps": current_fps,
            "cv_latency_ms": round(cv_latency_ms, 2),
            "targets": tracks_data,
            "vsp": [round(vsp_out[0], 2), round(vsp_out[1], 2)],
            "divergence_warning": telemetry_meta.get("divergence_warning", False),
            "mode": telemetry_meta.get("active_mode", self.controller.current_mode)
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
        "message": "FSOC PAT Multi-Target State-Anchored TCoG Engine Initialized",
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
            control_mode = data.get("control_mode", None)

            res = engine.process_frame(
                frame_b64=frame_b64,
                input_err_x=input_err_x,
                input_err_y=input_err_y,
                timestamp_s=timestamp_s,
                control_mode=control_mode
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
