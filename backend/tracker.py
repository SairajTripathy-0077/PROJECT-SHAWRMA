import sys
import json
import base64
import time
import math
import numpy as np

try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False


class ArchimedeanSpiralSearch:
    """
    Executes an Archimedean Spiral Search Pattern r(theta) = a + b * theta
    when target optical beacon is outside the camera FOV.
    """
    def __init__(self, a=0.0, b=0.8, angular_speed=2.5, max_radius=35.0):
        self.a = a
        self.b = b
        self.angular_speed = angular_speed
        self.max_radius = max_radius
        self.theta = 0.0

    def step(self, dt=0.033):
        self.theta += self.angular_speed * dt
        r = self.a + self.b * self.theta

        if r > self.max_radius:
            self.theta = 0.0
            r = 0.0

        pan_search = r * math.cos(self.theta)
        tilt_search = r * math.sin(self.theta)
        return pan_search, tilt_search

    def reset(self):
        self.theta = 0.0


class EKFConstantAcceleration:
    """
    Extended Kalman Filter with Constant Acceleration Motion Model [x, y, vx, vy, ax, ay]
    Drives predictive hold during line-of-sight (LOS) occlusion up to 3.0s.
    """
    def __init__(self, dt=0.033):
        self.dt = dt
        # State vector: [x, y, vx, vy, ax, ay]
        self.x = np.zeros((6, 1), dtype=np.float32)

        # State transition matrix F
        dt2 = 0.5 * dt * dt
        self.F = np.array([
            [1, 0, dt, 0, dt2, 0],
            [0, 1, 0, dt, 0, dt2],
            [0, 0, 1, 0,  dt, 0],
            [0, 0, 0, 1,  0, dt],
            [0, 0, 0, 0,  1, 0],
            [0, 0, 0, 0,  0, 1]
        ], dtype=np.float32)

        # Measurement matrix H (measuring 2D position [x, y])
        self.H = np.array([
            [1, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0]
        ], dtype=np.float32)

        self.Q = np.eye(6, dtype=np.float32) * 0.05
        self.R = np.eye(2, dtype=np.float32) * 1.5
        self.P = np.eye(6, dtype=np.float32) * 10.0
        self.occlusion_timer = 0.0
        self.initialized = False

    def predict(self, dt=0.033):
        dt2 = 0.5 * dt * dt
        self.F[0, 2] = dt
        self.F[1, 3] = dt
        self.F[0, 4] = dt2
        self.F[1, 5] = dt2
        self.F[2, 4] = dt
        self.F[3, 5] = dt

        self.x = np.dot(self.F, self.x)
        self.P = np.dot(np.dot(self.F, self.P), self.F.T) + self.Q
        return float(self.x[0, 0]), float(self.x[1, 0])

    def update(self, z_x, z_y):
        if not self.initialized:
            self.x[0, 0] = z_x
            self.x[1, 0] = z_y
            self.initialized = True
            self.occlusion_timer = 0.0
            return z_x, z_y

        z = np.array([[z_x], [z_y]], dtype=np.float32)
        y = z - np.dot(self.H, self.x)
        S = np.dot(np.dot(self.H, self.P), self.H.T) + self.R
        K = np.dot(np.dot(self.P, self.H.T), np.linalg.inv(S))

        self.x = self.x + np.dot(K, y)
        I = np.eye(6, dtype=np.float32)
        self.P = np.dot((I - np.dot(K, self.H)), self.P)
        self.occlusion_timer = 0.0

        return float(self.x[0, 0]), float(self.x[1, 0])


class ConfigurableDualAxisPID:
    """
    Production Dual-Axis PID Controller with Anti-Windup Clamping and Dynamic Gain Updates
    """
    def __init__(self, kp_pan=0.08, ki_pan=0.005, kd_pan=0.015, kp_tilt=0.08, ki_tilt=0.005, kd_tilt=0.015, max_vel=20.0):
        self.kp_pan = kp_pan
        self.ki_pan = ki_pan
        self.kd_pan = kd_pan

        self.kp_tilt = kp_tilt
        self.ki_tilt = ki_tilt
        self.kd_tilt = kd_tilt

        self.max_vel = max_vel
        self.integral_x = 0.0
        self.integral_y = 0.0
        self.prev_e_x = 0.0
        self.prev_e_y = 0.0

    def set_gains(self, gains):
        self.kp_pan = gains.get('kp_pan', self.kp_pan)
        self.ki_pan = gains.get('ki_pan', self.ki_pan)
        self.kd_pan = gains.get('kd_pan', self.kd_pan)
        self.kp_tilt = gains.get('kp_tilt', self.kp_tilt)
        self.ki_tilt = gains.get('ki_tilt', self.ki_tilt)
        self.kd_tilt = gains.get('kd_tilt', self.kd_tilt)

    def compute(self, e_x, e_y, dt=0.033):
        # Anti-windup clamping
        self.integral_x = np.clip(self.integral_x + e_x * dt, -50.0, 50.0)
        self.integral_y = np.clip(self.integral_y + e_y * dt, -50.0, 50.0)

        deriv_x = (e_x - self.prev_e_x) / dt if dt > 0 else 0.0
        deriv_y = (e_y - self.prev_e_y) / dt if dt > 0 else 0.0

        u_pan = (self.kp_pan * e_x) + (self.ki_pan * self.integral_x) + (self.kd_pan * deriv_x)
        u_tilt = -(self.kp_tilt * e_y + self.ki_tilt * self.integral_y + self.kd_tilt * deriv_y)

        # Clamping to motor servo saturation limits
        u_pan = np.clip(u_pan, -self.max_vel, self.max_vel)
        u_tilt = np.clip(u_tilt, -self.max_vel, self.max_vel)

        self.prev_e_x = e_x
        self.prev_e_y = e_y

        return float(u_pan), float(u_tilt)


class AutonomousTrackingFSM:
    """
    4-State Finite State Machine: SEARCHING -> ACQUIRE -> TRACKING -> PREDICTIVE_HOLD
    """
    def __init__(self):
        self.state = "SEARCHING"
        self.acquire_counter = 0
        self.occlusion_timer = 0.0
        self.spiral = ArchimedeanSpiralSearch()
        self.ekf = EKFConstantAcceleration()
        self.pid = ConfigurableDualAxisPID()

    def update(self, detected_centroid, input_err_x, input_err_y, drop_los=False, dt=0.033):
        width, height = 640, 480
        center_x, center_y = width / 2.0, height / 2.0

        raw_x = None
        raw_y = None

        if not drop_los and detected_centroid is not None:
            raw_x, raw_y = detected_centroid
        elif not drop_los and input_err_x is not None and input_err_y is not None:
            raw_x = center_x + input_err_x
            raw_y = center_y + input_err_y

        # State machine transition logic
        if self.state == "SEARCHING":
            if raw_x is not None and raw_y is not None:
                self.state = "ACQUIRE"
                self.acquire_counter = 1
                est_x, est_y = self.ekf.update(raw_x, raw_y)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_v, tilt_v = self.pid.compute(e_x, e_y, dt)
            else:
                pan_v, tilt_v = self.spiral.step(dt)
                e_x, e_y = 0.0, 0.0
                est_x, est_y = center_x, center_y

        elif self.state == "ACQUIRE":
            if raw_x is not None and raw_y is not None:
                self.acquire_counter += 1
                est_x, est_y = self.ekf.update(raw_x, raw_y)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_v, tilt_v = self.pid.compute(e_x, e_y, dt)

                if self.acquire_counter >= 3:
                    self.state = "TRACKING"
            else:
                self.state = "SEARCHING"
                pan_v, tilt_v = self.spiral.step(dt)
                e_x, e_y = 0.0, 0.0
                est_x, est_y = center_x, center_y

        elif self.state == "TRACKING":
            if raw_x is not None and raw_y is not None:
                est_x, est_y = self.ekf.update(raw_x, raw_y)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_v, tilt_v = self.pid.compute(e_x, e_y, dt)
                self.occlusion_timer = 0.0
            else:
                # Transition to PREDICTIVE_HOLD upon LOS occlusion
                self.state = "PREDICTIVE_HOLD"
                self.occlusion_timer = 0.0
                est_x, est_y = self.ekf.predict(dt)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_v, tilt_v = self.pid.compute(e_x, e_y, dt)

        elif self.state == "PREDICTIVE_HOLD":
            self.occlusion_timer += dt
            if raw_x is not None and raw_y is not None and not drop_los:
                self.state = "TRACKING"
                est_x, est_y = self.ekf.update(raw_x, raw_y)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_v, tilt_v = self.pid.compute(e_x, e_y, dt)
            elif self.occlusion_timer <= 3.0:
                # EKF Cognitive Predictive Hold Vector
                est_x, est_y = self.ekf.predict(dt)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_v, tilt_v = self.pid.compute(e_x, e_y, dt)
            else:
                # Exceeded 3.0s predictive hold timeout -> fallback to SEARCHING
                self.state = "SEARCHING"
                self.spiral.reset()
                pan_v, tilt_v = self.spiral.step(dt)
                e_x, e_y = 0.0, 0.0
                est_x, est_y = center_x, center_y

        is_locked = self.state == "TRACKING" and abs(e_x) < 15.0 and abs(e_y) < 15.0

        return {
            "state": self.state,
            "pan_velocity": round(pan_v, 4),
            "tilt_velocity": round(tilt_v, 4),
            "error_px": [round(e_x, 2), round(e_y, 2)],
            "predicted_px": [round(est_x - center_x, 2), round(est_y - center_y, 2)],
            "locked": is_locked
        }


def extract_centroid_and_binary_preview(frame_b64, width=640, height=480):
    if not HAS_OPENCV or not frame_b64:
        return None, None

    try:
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return None, None

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 215, 255, cv2.THRESH_BINARY)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        centroid = None

        if contours:
            c = max(contours, key=cv2.contourArea)
            M = cv2.moments(c)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                centroid = (cx, cy)

        # Encode small binary preview image to JPEG base64
        _, buffer = cv2.imencode('.jpg', thresh)
        binary_b64 = base64.b64encode(buffer).decode('utf-8')

        return centroid, binary_b64
    except Exception:
        return None, None


def main():
    fsm = AutonomousTrackingFSM()
    last_time = time.time()
    print(json.dumps({"status": "READY", "message": "FSOC PAT Autonomous 4-State Vision Tracker Ready"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            start_cv = time.time()
            dt = max(start_cv - last_time, 0.001)
            last_time = start_cv

            data = json.loads(line)
            frame_b64 = data.get("frame", "")
            input_err_x = data.get("error_x", None)
            input_err_y = data.get("error_y", None)
            drop_los = data.get("drop_los", False)

            # Check for live PID gain updates
            if "gains" in data:
                fsm.pid.set_gains(data["gains"])

            centroid, binary_b64 = extract_centroid_and_binary_preview(frame_b64)
            res = fsm.update(centroid, input_err_x, input_err_y, drop_los=drop_los, dt=dt)
            cv_latency = (time.time() - start_cv) * 1000.0

            res["fps"] = round(1.0 / dt, 1) if dt > 0 else 60.0
            res["cv_latency_ms"] = round(cv_latency, 2)
            res["binary_frame_b64"] = binary_b64

            print(json.dumps(res), flush=True)

        except Exception as e:
            err_resp = {
                "state": "SEARCHING",
                "pan_velocity": 0.0,
                "tilt_velocity": 0.0,
                "error_px": [0.0, 0.0],
                "predicted_px": [0.0, 0.0],
                "locked": False,
                "fps": 0.0,
                "cv_latency_ms": 0.0,
                "error": str(e)
            }
            print(json.dumps(err_resp), flush=True)

if __name__ == "__main__":
    main()
