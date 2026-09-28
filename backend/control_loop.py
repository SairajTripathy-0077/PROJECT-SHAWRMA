"""
FSOC PAT Dual-Axis PID Controller & Finite State Machine Loop
Smart India Hackathon Deliverable - Phase 5
"""

import math
import numpy as np


class DualAxisPID:
    """
    Dual-Axis Proportional-Integral-Derivative (PID) Controller
    Critically Damped Default Gains to eliminate overshooting (Kp=0.04, Ki=0.001, Kd=0.02)
    """
    def __init__(
        self,
        kp_pan=0.04,
        ki_pan=0.001,
        kd_pan=0.02,
        kp_tilt=0.04,
        ki_tilt=0.001,
        kd_tilt=0.02,
        max_velocity_rad_s=2.0
    ):
        self.kp_pan = kp_pan
        self.ki_pan = ki_pan
        self.kd_pan = kd_pan

        self.kp_tilt = kp_tilt
        self.ki_tilt = ki_tilt
        self.kd_tilt = kd_tilt

        self.max_vel = max_velocity_rad_s

        self.integral_x = 0.0
        self.integral_y = 0.0
        self.prev_e_x = 0.0
        self.prev_e_y = 0.0

    def set_gains(self, gains_dict):
        if not gains_dict:
            return
        self.kp_pan = gains_dict.get("kp_pan", self.kp_pan)
        self.ki_pan = gains_dict.get("ki_pan", self.ki_pan)
        self.kd_pan = gains_dict.get("kd_pan", self.kd_pan)

        self.kp_tilt = gains_dict.get("kp_tilt", self.kp_tilt)
        self.ki_tilt = gains_dict.get("ki_tilt", self.ki_tilt)
        self.kd_tilt = gains_dict.get("kd_tilt", self.kd_tilt)

    def compute(self, error_x, error_y, dt=0.033):
        dt = max(dt, 0.001)

        # 1. Anti-Windup Clamping on Integral Terms (-20.0 to +20.0)
        self.integral_x = float(np.clip(self.integral_x + error_x * dt, -20.0, 20.0))
        self.integral_y = float(np.clip(self.integral_y + error_y * dt, -20.0, 20.0))

        # 2. Derivative Calculation
        deriv_x = (error_x - self.prev_e_x) / dt
        deriv_y = (error_y - self.prev_e_y) / dt

        # 3. PID Output Equations with Derivative Damping
        u_pan = (self.kp_pan * error_x) + (self.ki_pan * self.integral_x) + (self.kd_pan * deriv_x)
        u_tilt = -(self.kp_tilt * error_y + self.ki_tilt * self.integral_y + self.kd_tilt * deriv_y)

        # Velocity scaling (1 px error approx 0.001 rad/s)
        pan_vel = u_pan * 0.001
        tilt_vel = u_tilt * 0.001

        # 4. Mechanical Velocity Saturation Clamping (+/- max_vel rad/s)
        pan_vel = float(np.clip(pan_vel, -self.max_vel, self.max_vel))
        tilt_vel = float(np.clip(tilt_vel, -self.max_vel, self.max_vel))

        self.prev_e_x = error_x
        self.prev_e_y = error_y

        return round(pan_vel, 5), round(tilt_vel, 5)

    def reset(self):
        self.integral_x = 0.0
        self.integral_y = 0.0
        self.prev_e_x = 0.0
        self.prev_e_y = 0.0


class ArchimedeanSpiralScanner:
    """
    Archimedean Spiral Scanning Engine for SEARCHING state: r(theta) = a + b * theta
    """
    def __init__(self, a=0.0, b=0.02, angular_speed=3.0, max_radius_rad=0.35):
        self.a = a
        self.b = b
        self.angular_speed = angular_speed
        self.max_radius = max_radius_rad
        self.theta = 0.0

    def step(self, dt=0.033):
        self.theta += self.angular_speed * dt
        r = self.a + self.b * self.theta

        if r > self.max_radius:
            self.theta = 0.0
            r = 0.0

        pan_vel = r * math.cos(self.theta)
        tilt_vel = r * math.sin(self.theta)
        return round(pan_vel, 5), round(tilt_vel, 5)

    def reset(self):
        self.theta = 0.0
