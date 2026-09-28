"""
FSOC PAT Virtual Setpoint & Gimbal Controller Module
Aerospace-Grade Multi-Target Architecture Featuring:
- Virtual Setpoint (VSP) Modes: PRIMARY_ONLY (Sat 1) and BARYCENTER (Weighted Target Centroid)
- Alpha-Weighted Dynamic Seamless Transition (15-Frame Continuous Interpolation)
- Asymmetric Confidence Fallback & Cloud-Fade Mitigation (5-Frame Smooth Anchoring to Sat 1)
- Dynamic Sensor FOV Guard (85% Sensor Width Boundary Protection & TARGET_DIVERGENCE Alarm)
- Feedforward Velocity Assist + Kalman Damping (Zero Derivative Kick)
- Back-Calculation Anti-Windup Integrator & Kinematic Slew-Rate Limiter
"""

from typing import Tuple, Optional, Dict, Any, List
import numpy as np


DEFAULT_CONTROLLER_CONFIG: Dict[str, Any] = {
    "kp": 7.5,                     # Proportional gain (s^-1) for boresight error correction
    "ki": 1.5,                     # Integral gain (s^-2) for steady-state bias cancellation
    "kd": 0.1,                     # Derivative damping gain (from Kalman velocity)
    "k_ff": 1.0,                   # Feedforward velocity gain (1.0 = direct velocity tracking)
    "k_aw": 0.6,                   # Back-calculation anti-windup tracking gain
    "max_vel": 180.0,              # Maximum actuator velocity command (px/s or deg/s)
    "a_max": 3500.0,               # Maximum allowable angular acceleration (deg/s^2 or px/s^2)
    "integral_limit": 50.0,        # Symmetrical saturation bound for integral accumulator
    "sensor_width": 640.0,         # Camera sensor horizontal resolution (px)
    "fov_guard_fraction": 0.85,    # Maximum allowable target separation (85% of sensor width = 544px)
    "transition_frames": 15        # Number of frames for smooth alpha mode transition
}


class FeedforwardBackcalcPIDController:
    """
    Feedforward + PID Controller with Back-Calculation Anti-Windup
    and Kinematic Slew-Rate Limiting.
    """
    def __init__(
        self,
        kp: float = 7.5,
        ki: float = 1.5,
        kd: float = 0.1,
        k_ff: float = 1.0,
        k_aw: float = 0.6,
        max_vel: float = 180.0,
        a_max: float = 3500.0,
        integral_limit: float = 50.0
    ):
        self.kp: float = kp
        self.ki: float = ki
        self.kd: float = kd
        self.k_ff: float = k_ff
        self.k_aw: float = k_aw
        self.max_vel: float = max_vel
        self.a_max: float = a_max
        self.integral_limit: float = integral_limit

        self.int_x: float = 0.0
        self.int_y: float = 0.0
        self.prev_v_cmd_x: float = 0.0
        self.prev_v_cmd_y: float = 0.0
        self.prev_v_unclamped_x: float = 0.0
        self.prev_v_unclamped_y: float = 0.0

    def compute(
        self,
        x_proj: float,
        y_proj: float,
        vel_est_x: float,
        vel_est_y: float,
        boresight_x: float = 320.0,
        boresight_y: float = 240.0,
        dt: float = 0.033
    ) -> Tuple[float, float, float, float]:
        """Computes velocity commands for optical gimbal."""
        if dt <= 0:
            dt = 0.033

        # 1. Error Definition relative to Boresight Center
        e_x = x_proj - boresight_x
        e_y = y_proj - boresight_y

        # 2. Feedforward Term
        v_ff_x = self.k_ff * vel_est_x
        v_ff_y = self.k_ff * vel_est_y

        # 3. Proportional Term
        p_x = self.kp * e_x
        p_y = self.kp * e_y

        # 4. Derivative Damping Term (Derived directly from Kalman velocity)
        d_x = -self.kd * vel_est_x
        d_y = -self.kd * vel_est_y

        # 5. Raw Unclamped Control Velocity
        v_unclamped_x = v_ff_x + p_x + self.int_x + d_x
        v_unclamped_y = v_ff_y + p_y + self.int_y + d_y

        # 6. Kinematic Slew-Rate Limiting (Acceleration Emulation)
        delta_v_max = self.a_max * dt
        v_slew_x = float(np.clip(
            v_unclamped_x,
            self.prev_v_cmd_x - delta_v_max,
            self.prev_v_cmd_x + delta_v_max
        ))
        v_slew_y = float(np.clip(
            v_unclamped_y,
            self.prev_v_cmd_y - delta_v_max,
            self.prev_v_cmd_y + delta_v_max
        ))

        # 7. Actuator Saturation Clamping
        v_final_x = float(np.clip(v_slew_x, -self.max_vel, self.max_vel))
        v_final_y = float(np.clip(v_slew_y, -self.max_vel, self.max_vel))

        # 8. Back-Calculation Anti-Windup Integration
        e_sat_x = v_final_x - v_unclamped_x
        e_sat_y = v_final_y - v_unclamped_y

        self.int_x = float(np.clip(
            self.int_x + (self.ki * e_x + self.k_aw * e_sat_x) * dt,
            -self.integral_limit,
            self.integral_limit
        ))
        self.int_y = float(np.clip(
            self.int_y + (self.ki * e_y + self.k_aw * e_sat_y) * dt,
            -self.integral_limit,
            self.integral_limit
        ))

        self.prev_v_cmd_x = v_final_x
        self.prev_v_cmd_y = v_final_y
        self.prev_v_unclamped_x = v_unclamped_x
        self.prev_v_unclamped_y = v_unclamped_y

        # 9. Y-Axis Inversion for WebGL / Three.js
        v_cmd_x_threejs = v_final_x
        v_cmd_y_threejs = -v_final_y

        return v_cmd_x_threejs, v_cmd_y_threejs, e_x, e_y

    def set_gains(self, gains_dict: Optional[Dict[str, float]]) -> None:
        """Update controller gains dynamically."""
        if not gains_dict:
            return
        if "kp" in gains_dict:
            self.kp = float(gains_dict["kp"])
        elif "kp_pan" in gains_dict:
            self.kp = float(gains_dict["kp_pan"])

        if "ki" in gains_dict:
            self.ki = float(gains_dict["ki"])
        elif "ki_pan" in gains_dict:
            self.ki = float(gains_dict["ki_pan"])

        if "kd" in gains_dict:
            self.kd = float(gains_dict["kd"])
        elif "kd_pan" in gains_dict:
            self.kd = float(gains_dict["kd_pan"])

        if "k_ff" in gains_dict:
            self.k_ff = float(gains_dict["k_ff"])
        if "k_aw" in gains_dict:
            self.k_aw = float(gains_dict["k_aw"])
        if "max_vel" in gains_dict:
            self.max_vel = float(gains_dict["max_vel"])
        if "a_max" in gains_dict:
            self.a_max = float(gains_dict["a_max"])

    def reset(self) -> None:
        self.int_x = 0.0
        self.int_y = 0.0
        self.prev_v_cmd_x = 0.0
        self.prev_v_cmd_y = 0.0
        self.prev_v_unclamped_x = 0.0
        self.prev_v_unclamped_y = 0.0


class VirtualSetpointController(FeedforwardBackcalcPIDController):
    """
    Multi-Target Virtual Setpoint (VSP) Controller with:
    - Alpha-Blending Mode Transitions (15 frames)
    - Asymmetric Cloud-Fade Mitigation (Sat 2 influence decay over 5 frames)
    - Dynamic Sensor FOV Guard (85% width threshold)
    """
    def __init__(
        self,
        kp: float = 7.5,
        ki: float = 1.5,
        kd: float = 0.1,
        k_ff: float = 1.0,
        k_aw: float = 0.6,
        max_vel: float = 180.0,
        a_max: float = 3500.0,
        integral_limit: float = 50.0,
        mode: str = "PRIMARY_ONLY",
        sensor_width: float = 640.0,
        fov_guard_fraction: float = 0.85,
        transition_frames: int = 15
    ):
        super().__init__(
            kp=kp, ki=ki, kd=kd, k_ff=k_ff, k_aw=k_aw,
            max_vel=max_vel, a_max=a_max, integral_limit=integral_limit
        )
        self.current_mode: str = mode
        self.target_mode: str = mode
        self.old_mode: str = mode
        self.alpha: float = 1.0
        self.transition_frames: int = transition_frames
        self.sensor_width: float = sensor_width
        self.max_separation_px: float = sensor_width * fov_guard_fraction  # 544.0 px

        # Asymmetric fade tracking for Sat 2
        self.sat2_fade_weight: float = 1.0
        self.divergence_triggered: bool = False

    def set_mode(self, new_mode: str) -> None:
        """Triggers smooth alpha-blended transition to a new setpoint mode."""
        if new_mode in ["PRIMARY_ONLY", "BARYCENTER"] and new_mode != self.target_mode:
            self.old_mode = self.current_mode
            self.target_mode = new_mode
            self.alpha = 0.0  # Begin 15-frame continuous blend

    def compute_multi_target(
        self,
        sat1_proj: List[float],
        sat1_vel: List[float],
        sat1_fade: int,
        sat2_proj: List[float],
        sat2_vel: List[float],
        sat2_fade: int,
        boresight_x: float = 320.0,
        boresight_y: float = 240.0,
        dt: float = 0.033
    ) -> Tuple[float, float, float, float, Tuple[float, float], Dict[str, Any]]:
        """
        Computes multi-target virtual setpoint and commands optical gimbal.
        """
        p1 = np.array(sat1_proj, dtype=np.float32)
        p2 = np.array(sat2_proj, dtype=np.float32)
        v1 = np.array(sat1_vel, dtype=np.float32)
        v2 = np.array(sat2_vel, dtype=np.float32)

        # 1. Dynamic FOV Guard Check
        target_separation = float(np.linalg.norm(p1 - p2))
        forced_primary = False
        if target_separation > self.max_separation_px:
            forced_primary = True
            self.divergence_triggered = True
            self.target_mode = "PRIMARY_ONLY"
            self.current_mode = "PRIMARY_ONLY"
            self.alpha = 1.0
        else:
            self.divergence_triggered = False

        # 2. Asymmetric Cloud-Fade Mitigation (Sat 2 Fade Decay)
        # If Sat 2 is coasting for > 3 frames, smoothly decay weight to 0.0 over 5 frames
        if sat2_fade > 3:
            # Decay linearly: frame 4 -> 0.8, frame 5 -> 0.6, ..., frame 8 -> 0.0
            decay_step = (sat2_fade - 3) / 5.0
            self.sat2_fade_weight = float(np.clip(1.0 - decay_step, 0.0, 1.0))
        else:
            # Reacquisition recovery ramp
            self.sat2_fade_weight = float(np.clip(self.sat2_fade_weight + 0.33, 0.0, 1.0))

        # 3. Calculate Candidate Setpoints for Both Modes Live
        # A. PRIMARY_ONLY Setpoint
        vsp_primary = p1
        vel_primary = v1

        # B. BARYCENTER Setpoint (Weighted by active confidence)
        w1 = 1.0
        w2 = self.sat2_fade_weight
        w_sum = max(w1 + w2, 1e-4)

        vsp_barycenter = (w1 * p1 + w2 * p2) / w_sum
        vel_barycenter = (w1 * v1 + w2 * v2) / w_sum

        # 4. Alpha-Weighted Continuous Blending (Zero Step-Shock)
        if self.alpha < 1.0:
            self.alpha = min(1.0, self.alpha + (1.0 / self.transition_frames))
            if self.alpha >= 1.0:
                self.current_mode = self.target_mode

        # Map candidate modes
        old_vsp = vsp_primary if self.old_mode == "PRIMARY_ONLY" else vsp_barycenter
        old_vel = vel_primary if self.old_mode == "PRIMARY_ONLY" else vel_barycenter

        new_vsp = vsp_primary if self.target_mode == "PRIMARY_ONLY" else vsp_barycenter
        new_vel = vel_primary if self.target_mode == "PRIMARY_ONLY" else vel_barycenter

        # Interpolated Virtual Setpoint and Velocity
        vsp_blended = (1.0 - self.alpha) * old_vsp + self.alpha * new_vsp
        vel_blended = (1.0 - self.alpha) * old_vel + self.alpha * new_vel

        # 5. Compute PID Control on Virtual Setpoint
        pan_vel, tilt_vel, err_x, err_y = self.compute(
            x_proj=float(vsp_blended[0]),
            y_proj=float(vsp_blended[1]),
            vel_est_x=float(vel_blended[0]),
            vel_est_y=float(vel_blended[1]),
            boresight_x=boresight_x,
            boresight_y=boresight_y,
            dt=dt
        )

        state_str = "TARGET_DIVERGENCE" if forced_primary else ("TRACKING" if sat1_fade <= 5 else "LOST")

        meta = {
            "state": state_str,
            "active_mode": self.current_mode,
            "target_mode": self.target_mode,
            "alpha": round(self.alpha, 3),
            "target_separation_px": round(target_separation, 1),
            "sat2_weight": round(self.sat2_fade_weight, 3),
            "divergence_warning": self.divergence_triggered
        }

        return pan_vel, tilt_vel, err_x, err_y, (float(vsp_blended[0]), float(vsp_blended[1])), meta


# Backward compatibility aliases
DualAxisPIDController = FeedforwardBackcalcPIDController
FeedforwardPIDController = FeedforwardBackcalcPIDController
