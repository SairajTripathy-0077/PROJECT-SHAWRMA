import sys
import json
import base64
import time
import numpy as np

try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False


class KalmanFilter2D:
    """
    2D Constant Velocity Kalman Filter for tracking optical beacon position [x, y, dx, dy]
    Handles coasting when target is obscured by atmospheric turbulence for >2 frames.
    """
    def __init__(self, dt=0.033):
        self.dt = dt
        self.x = np.zeros((4, 1), dtype=np.float32)

        self.F = np.array([
            [1, 0, dt, 0],
            [0, 1, 0, dt],
            [0, 0, 1,  0],
            [0, 0, 0,  1]
        ], dtype=np.float32)

        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ], dtype=np.float32)

        self.Q = np.eye(4, dtype=np.float32) * 0.1
        self.Q[2, 2] = 1.0
        self.Q[3, 3] = 1.0

        self.R = np.eye(2, dtype=np.float32) * 2.0
        self.P = np.eye(4, dtype=np.float32) * 100.0

        self.frames_lost = 0
        self.initialized = False

    def predict(self):
        self.x = np.dot(self.F, self.x)
        self.P = np.dot(np.dot(self.F, self.P), self.F.T) + self.Q
        return float(self.x[0, 0]), float(self.x[1, 0])

    def update(self, z_x, z_y):
        if not self.initialized:
            self.x[0, 0] = z_x
            self.x[1, 0] = z_y
            self.initialized = True
            self.frames_lost = 0
            return z_x, z_y

        z = np.array([[z_x], [z_y]], dtype=np.float32)
        y = z - np.dot(self.H, self.x)
        S = np.dot(np.dot(self.H, self.P), self.H.T) + self.R
        K = np.dot(np.dot(self.P, self.H.T), np.linalg.inv(S))

        self.x = self.x + np.dot(K, y)
        I = np.eye(4, dtype=np.float32)
        self.P = np.dot((I - np.dot(K, self.H)), self.P)

        self.frames_lost = 0
        return float(self.x[0, 0]), float(self.x[1, 0])

    def coast(self):
        self.frames_lost += 1
        return self.predict()


class DualAxisPIDController:
    """
    Dual-Axis PID Controller for Pan & Tilt Angular Velocity Corrections
    """
    def __init__(self, kp=0.08, ki=0.005, kd=0.015, max_vel=15.0):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.max_vel = max_vel

        self.prev_e_x = 0.0
        self.prev_e_y = 0.0
        self.int_x = 0.0
        self.int_y = 0.0

    def compute(self, e_x, e_y, dt=0.033):
        self.int_x = np.clip(self.int_x + e_x * dt, -100.0, 100.0)
        self.int_y = np.clip(self.int_y + e_y * dt, -100.0, 100.0)

        d_x = (e_x - self.prev_e_x) / dt if dt > 0 else 0.0
        d_y = (e_y - self.prev_e_y) / dt if dt > 0 else 0.0

        u_pan = (self.kp * e_x) + (self.ki * self.int_x) + (self.kd * d_x)
        u_tilt = -(self.kp * e_y + self.ki * self.int_y + self.kd * d_y)

        u_pan = np.clip(u_pan, -self.max_vel, self.max_vel)
        u_tilt = np.clip(u_tilt, -self.max_vel, self.max_vel)

        self.prev_e_x = e_x
        self.prev_e_y = e_y

        return float(u_pan), float(u_tilt)


def process_image_frame(frame_b64, width=640, height=480):
    if not HAS_OPENCV or not frame_b64:
        return None

    try:
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return None

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 220, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if contours:
            c = max(contours, key=cv2.contourArea)
            M = cv2.moments(c)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                return cx, cy

        return None
    except Exception:
        return None


def main():
    kalman = KalmanFilter2D(dt=0.033)
    pid = DualAxisPIDController(kp=0.08, ki=0.004, kd=0.012, max_vel=15.0)
    
    last_time = time.time()
    width, height = 640, 480
    center_x, center_y = width / 2.0, height / 2.0

    print(json.dumps({"status": "READY", "message": "FSOC PAT Vision Tracker + Kalman Filter sidecar ready"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            now = time.time()
            dt = max(now - last_time, 0.001)
            last_time = now

            data = json.loads(line)
            frame_b64 = data.get("frame", "")
            
            input_err_x = data.get("error_x", None)
            input_err_y = data.get("error_y", None)

            detected_centroid = process_image_frame(frame_b64, width, height)

            if detected_centroid is not None:
                cx, cy = detected_centroid
                kalman.predict()
                est_x, est_y = kalman.update(cx, cy)
                e_x = est_x - center_x
                e_y = est_y - center_y
                beacon_detected = True
            elif input_err_x is not None and input_err_y is not None:
                cx = center_x + input_err_x
                cy = center_y + input_err_y
                kalman.predict()
                est_x, est_y = kalman.update(cx, cy)
                e_x = est_x - center_x
                e_y = est_y - center_y
                beacon_detected = True
            else:
                est_x, est_y = kalman.coast()
                e_x = est_x - center_x
                e_y = est_y - center_y
                beacon_detected = kalman.frames_lost <= 2

            pan_vel, tilt_vel = pid.compute(e_x, e_y, dt=dt)
            is_locked = beacon_detected and (abs(e_x) < 15.0) and (abs(e_y) < 15.0)
            current_fps = round(1.0 / dt, 1) if dt > 0 else 60.0

            response = {
                "pan_velocity": round(pan_vel, 4),
                "tilt_velocity": round(tilt_vel, 4),
                "error_px": [round(e_x, 2), round(e_y, 2)],
                "locked": bool(is_locked),
                "fps": current_fps
            }
            print(json.dumps(response), flush=True)

        except Exception as e:
            err_resp = {
                "pan_velocity": 0.0,
                "tilt_velocity": 0.0,
                "error_px": [0.0, 0.0],
                "locked": False,
                "fps": 0.0,
                "error": str(e)
            }
            print(json.dumps(err_resp), flush=True)

if __name__ == "__main__":
    main()
