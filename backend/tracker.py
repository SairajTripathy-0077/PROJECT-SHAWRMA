"""
High-Speed OpenCV Beacon Detection, EKF State Estimator & FSM Controller
FSOC PAT Virtual Simulator - Phase 5
"""

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

try:
    from filterpy.kalman import KalmanFilter
    from filterpy.common import Q_discrete_white_noise
    HAS_FILTERPY = True
except ImportError:
    HAS_FILTERPY = False

from control_loop import DualAxisPID, ArchimedeanSpiralScanner


class EKFConstantAccelerationFilter:
    """
    Extended Kalman Filter with Constant Acceleration Motion Model [x, y, vx, vy, ax, ay]
    Dynamic Measurement Covariance R Matrix Scaling based on Turbulence / Occlusion.
    """
    def __init__(self, dt=0.033):
        self.dt = dt
        self.state_dim = 6
        self.meas_dim = 2

        if HAS_FILTERPY:
            self.kf = KalmanFilter(dim_x=6, dim_z=2)
            # State vector: [x, y, vx, vy, ax, ay]
            self.kf.x = np.zeros((6, 1))

            # State transition F
            dt2 = 0.5 * dt * dt
            self.kf.F = np.array([
                [1, 0, dt, 0, dt2, 0],
                [0, 1, 0, dt, 0, dt2],
                [0, 0, 1, 0,  dt, 0],
                [0, 0, 0, 1,  0, dt],
                [0, 0, 0, 0,  1, 0],
                [0, 0, 0, 0,  0, 1]
            ])

            # Measurement H
            self.kf.H = np.array([
                [1, 0, 0, 0, 0, 0],
                [0, 1, 0, 0, 0, 0]
            ])

            # Process noise Q
            self.kf.Q = np.eye(6) * 0.05
            # Measurement noise R (default clear sky)
            self.kf.R = np.eye(2) * 1.0
            self.kf.P *= 10.0
        else:
            # Native NumPy EKF Fallback
            self.x = np.zeros((6, 1), dtype=np.float32)
            dt2 = 0.5 * dt * dt
            self.F = np.array([
                [1, 0, dt, 0, dt2, 0],
                [0, 1, 0, dt, 0, dt2],
                [0, 0, 1, 0,  dt, 0],
                [0, 0, 0, 1,  0, dt],
                [0, 0, 0, 0,  1, 0],
                [0, 0, 0, 0,  0, 1]
            ], dtype=np.float32)
            self.H = np.array([
                [1, 0, 0, 0, 0, 0],
                [0, 1, 0, 0, 0, 0]
            ], dtype=np.float32)
            self.Q = np.eye(6, dtype=np.float32) * 0.05
            self.R = np.eye(2, dtype=np.float32) * 1.0
            self.P = np.eye(6, dtype=np.float32) * 10.0

        self.initialized = False
        self.occlusion_timer = 0.0

    def set_turbulence_level(self, turbulence_pct=0):
        """
        Dynamically adjusts measurement noise covariance R matrix based on turbulence intensity.
        High turbulence -> High R (trust physics prediction), Low turbulence -> Low R (trust vision).
        """
        r_val = 1.0 + (turbulence_pct * 0.15)
        if HAS_FILTERPY:
            self.kf.R = np.eye(2) * r_val
        else:
            self.R = np.eye(2, dtype=np.float32) * r_val

    def predict(self, dt=0.033):
        if HAS_FILTERPY:
            dt2 = 0.5 * dt * dt
            self.kf.F[0, 2] = dt
            self.kf.F[1, 3] = dt
            self.kf.F[0, 4] = dt2
            self.kf.F[1, 5] = dt2
            self.kf.F[2, 4] = dt
            self.kf.F[3, 5] = dt
            self.kf.predict()
            return float(self.kf.x[0]), float(self.kf.x[1])
        else:
            self.x = np.dot(self.F, self.x)
            self.P = np.dot(np.dot(self.F, self.P), self.F.T) + self.Q
            return float(self.x[0, 0]), float(self.x[1, 0])

    def update(self, z_x, z_y):
        if not self.initialized:
            if HAS_FILTERPY:
                self.kf.x[0] = z_x
                self.kf.x[1] = z_y
            else:
                self.x[0, 0] = z_x
                self.x[1, 0] = z_y
            self.initialized = True
            self.occlusion_timer = 0.0
            return z_x, z_y

        z = np.array([[z_x], [z_y]])
        if HAS_FILTERPY:
            self.kf.update(z)
            self.occlusion_timer = 0.0
            return float(self.kf.x[0]), float(self.kf.x[1])
        else:
            y = z - np.dot(self.H, self.x)
            S = np.dot(np.dot(self.H, self.P), self.H.T) + self.R
            K = np.dot(np.dot(self.P, self.H.T), np.linalg.inv(S))
            self.x = self.x + np.dot(K, y)
            I = np.eye(6, dtype=np.float32)
            self.P = np.dot((I - np.dot(K, self.H)), self.P)
            self.occlusion_timer = 0.0
            return float(self.x[0, 0]), float(self.x[1, 0])


def detect_beacon_centroid(frame_b64, width=640, height=480):
    """
    OpenCV Pipeline:
    Grayscale -> Gaussian Blur -> Binary Thresholding -> Morphological Erosion/Dilation -> Moments Centroid (cx, cy)
    """
    if not HAS_OPENCV or not frame_b64:
        return None

    try:
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return None

        # 1. Grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # 2. Gaussian Blur
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # 3. Dynamic Binary Thresholding
        _, thresh = cv2.threshold(blurred, 215, 255, cv2.THRESH_BINARY)

        # 4. Morphological Erosion and Dilation
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        eroded = cv2.erode(thresh, kernel, iterations=1)
        dilated = cv2.dilate(eroded, kernel, iterations=1)

        # 5. Contour Detection & Centroid Calculation via Moments
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if contours:
            c = max(contours, key=cv2.contourArea)
            M = cv2.moments(c)
            if M["m00"] != 0:
                cx = float(M["m10"] / M["m00"])
                cy = float(M["m01"] / M["m00"])
                return cx, cy

        return None
    except Exception:
        return None


class FSOCPATTrackerController:
    """
    Complete Autonomous Tracking Controller integrating OpenCV, EKF, and 4-State FSM.
    """
    def __init__(self):
        self.state = "SEARCHING"
        self.acquire_counter = 0
        self.occlusion_timer = 0.0
        self.ekf = EKFConstantAccelerationFilter()
        self.pid = DualAxisPID()
        self.scanner = ArchimedeanSpiralScanner()
        self.error_buffer = []

    def process_frame_data(self, data, dt=0.033):
        frame_b64 = data.get("frame", "")
        input_err_x = data.get("error_x", None)
        input_err_y = data.get("error_y", None)
        drop_los = data.get("drop_los", False)
        turbulence_pct = data.get("turbulence", 0)

        if "gains" in data and data["gains"]:
            self.pid.set_gains(data["gains"])

        self.ekf.set_turbulence_level(turbulence_pct)

        center_x, center_y = 320.0, 240.0
        detected_centroid = detect_beacon_centroid(frame_b64)

        raw_x, raw_y = None, None
        if not drop_los and detected_centroid is not None:
            raw_x, raw_y = detected_centroid
        elif not drop_los and input_err_x is not None and input_err_y is not None:
            raw_x = center_x + input_err_x
            raw_y = center_y + input_err_y

        # 4-State Finite State Machine (FSM)
        if self.state == "SEARCHING":
            if raw_x is not None and raw_y is not None:
                self.state = "ACQUIRE"
                self.acquire_counter = 1
                est_x, est_y = self.ekf.update(raw_x, raw_y)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_vel, tilt_vel = self.pid.compute(e_x, e_y, dt)
            else:
                pan_vel, tilt_vel = self.scanner.step(dt)
                e_x, e_y = 0.0, 0.0

        elif self.state == "ACQUIRE":
            if raw_x is not None and raw_y is not None:
                self.acquire_counter += 1
                est_x, est_y = self.ekf.update(raw_x, raw_y)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_vel, tilt_vel = self.pid.compute(e_x, e_y, dt)
                if self.acquire_counter >= 3:
                    self.state = "TRACKING"
            else:
                self.state = "SEARCHING"
                self.scanner.reset()
                pan_vel, tilt_vel = self.scanner.step(dt)
                e_x, e_y = 0.0, 0.0

        elif self.state == "TRACKING":
            if raw_x is not None and raw_y is not None:
                est_x, est_y = self.ekf.update(raw_x, raw_y)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_vel, tilt_vel = self.pid.compute(e_x, e_y, dt)
                self.occlusion_timer = 0.0
            else:
                self.state = "PREDICTIVE_HOLD"
                self.occlusion_timer = 0.0
                est_x, est_y = self.ekf.predict(dt)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_vel, tilt_vel = self.pid.compute(e_x, e_y, dt)

        elif self.state == "PREDICTIVE_HOLD":
            self.occlusion_timer += dt
            if raw_x is not None and raw_y is not None and not drop_los:
                self.state = "TRACKING"
                est_x, est_y = self.ekf.update(raw_x, raw_y)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_vel, tilt_vel = self.pid.compute(e_x, e_y, dt)
            elif self.occlusion_timer <= 3.0:
                est_x, est_y = self.ekf.predict(dt)
                e_x, e_y = est_x - center_x, est_y - center_y
                pan_vel, tilt_vel = self.pid.compute(e_x, e_y, dt)
            else:
                # 3.0s Timeout Exceeded -> Fallback to SEARCHING
                self.state = "SEARCHING"
                self.scanner.reset()
                pan_vel, tilt_vel = self.scanner.step(dt)
                e_x, e_y = 0.0, 0.0

        # Calculate RMSE
        e_sq = e_x * e_x + e_y * e_y
        self.error_buffer.append(e_sq)
        if len(self.error_buffer) > 100:
            self.error_buffer.pop(0)
        rmse = round(float(np.sqrt(np.mean(self.error_buffer))), 2)

        # Output JSON formatted strictly per Phase 5 spec:
        # {"state": "TRACKING", "pan_vel": 0.05, "tilt_vel": -0.012, "error_px": [15, -4], "rmse": 3.4}
        return {
            "state": self.state,
            "pan_vel": pan_vel,
            "tilt_vel": tilt_vel,
            "error_px": [round(e_x, 1), round(e_y, 1)],
            "rmse": rmse
        }


def main():
    controller = FSOCPATTrackerController()
    last_time = time.time()

    print(json.dumps({"status": "READY", "message": "FSOC PAT OpenCV + EKF + PID Tracker initialized"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            now = time.time()
            dt = max(now - last_time, 0.001)
            last_time = now

            data = json.loads(line)
            res = controller.process_frame_data(data, dt=dt)
            print(json.dumps(res), flush=True)

        except Exception as e:
            err_output = {
                "state": "SEARCHING",
                "pan_vel": 0.0,
                "tilt_vel": 0.0,
                "error_px": [0, 0],
                "rmse": 0.0,
                "error": str(e)
            }
            print(json.dumps(err_output), flush=True)


if __name__ == "__main__":
    main()
