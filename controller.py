"""
FSOC PAT Gimbal Controller Module
High-Bandwidth Control Law Featuring:
- Feedforward Proactive Velocity Tracking
- Kalman-Derived Damping (Zero Derivative Kick)
- Back-Calculation Anti-Windup Integrator
- Kinematic Slew-Rate Acceleration Limiter (Actuator Emulation)
- Optical Boresight & Three.js Y-Axis Inversion Transformation
"""

from typing import Tuple, Optional, Dict, Any
import numpy as np


DEFAULT_CONTROLLER_CONFIG: Dict[str, Any] = {
    # Feedforward & Proportional Gains
    "kp": 7.5,                     # Proportional gain (s^-1) for boresight error correction
    "ki": 1.5,                     # Integral gain (s^-2) for steady-state bias cancellation
    "kd": 0.1,                     # Derivative damping gain (from Kalman velocity)
    "k_ff": 1.0,                   # Feedforward velocity gain (1.0 = direct velocity tracking)
    "k_aw": 0.6,                   # Back-calculation anti-windup tracking gain

    # Actuator Kinematic Constraints
    "max_vel": 180.0,              # Maximum actuator velocity command (px/s or deg/s)
    "a_max": 3500.0,               # Maximum allowable angular acceleration (deg/s^2 or px/s^2)
    "integral_limit": 50.0,        # Symmetrical saturation bound for integral accumulator
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

        # Integral accumulators [x, y]
        self.int_x: float = 0.0
        self.int_y: float = 0.0

        # Persistent previous commanded velocities for slew rate limiting
        self.prev_v_cmd_x: float = 0.0
        self.prev_v_cmd_y: float = 0.0

        # Previous unclamped velocity command for back-calculation
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
        """
        Computes velocity commands for optical gimbal.
        
        Parameters:
            x_proj, y_proj: Projected beacon coordinates (compensated for latency)
            vel_est_x, vel_est_y: Estimated target velocities from Kalman Filter
            boresight_x, boresight_y: Center of camera sensor (e.g. 320, 240)
            dt: Measured time step from frontend timestamps (s)
            
        Returns:
            Tuple of (v_cmd_x_threejs, v_cmd_y_threejs, err_x, err_y)
        """
        if dt <= 0:
            dt = 0.033

        # 1. Error Definition relative to Boresight Center
        e_x = x_proj - boresight_x
        e_y = y_proj - boresight_y

        # 2. Feedforward Term (Proactively drives gimbal at estimated target speed)
        v_ff_x = self.k_ff * vel_est_x
        v_ff_y = self.k_ff * vel_est_y

        # 3. Proportional Term (Boresight Error Correction)
        p_x = self.kp * e_x
        p_y = self.kp * e_y

        # 4. Derivative Term (Derived directly from Kalman velocity, eliminating measurement kick)
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

        # 7. Actuator Saturation Velocity Clamping ([-max_vel, +max_vel])
        v_final_x = float(np.clip(v_slew_x, -self.max_vel, self.max_vel))
        v_final_y = float(np.clip(v_slew_y, -self.max_vel, self.max_vel))

        # 8. Back-Calculation Anti-Windup Integration
        # e_sat = V_final - V_unclamped
        e_sat_x = v_final_x - v_unclamped_x
        e_sat_y = v_final_y - v_unclamped_y

        # Integral update with back-calculation discharge
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

        # Store persistent states for next iteration
        self.prev_v_cmd_x = v_final_x
        self.prev_v_cmd_y = v_final_y
        self.prev_v_unclamped_x = v_unclamped_x
        self.prev_v_unclamped_y = v_unclamped_y

        # 9. Y-Axis Inversion for WebGL / Three.js Coordinates
        # Three.js positive Y rotation vs OpenCV downwards Y image plane
        v_cmd_x_threejs = v_final_x
        v_cmd_y_threejs = -v_final_y

        return v_cmd_x_threejs, v_cmd_y_threejs, e_x, e_y

    def set_gains(self, gains_dict: Optional[Dict[str, float]]) -> None:
        """Update controller gains dynamically from configuration or tuning deck."""
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
        """Reset internal integrator and slew history."""
        self.int_x = 0.0
        self.int_y = 0.0
        self.prev_v_cmd_x = 0.0
        self.prev_v_cmd_y = 0.0
        self.prev_v_unclamped_x = 0.0
        self.prev_v_unclamped_y = 0.0


# Backward compatibility alias
DualAxisPIDController = FeedforwardBackcalcPIDController
FeedforwardPIDController = FeedforwardBackcalcPIDController
