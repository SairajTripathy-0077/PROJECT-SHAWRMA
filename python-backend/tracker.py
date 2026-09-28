import sys
import json
import base64
import time

class DualAxisPID:
    """
    Dual Axis PID Controller for FSOC Pan-Tilt Camera Stabilization
    """
    def __init__(self, kp=0.1, ki=0.01, kd=0.02):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.prev_err_x = 0
        self.prev_err_y = 0
        self.integral_x = 0
        self.integral_y = 0

    def compute(self, error_x, error_y, dt=0.033):
        self.integral_x += error_x * dt
        self.integral_y += error_y * dt

        derivative_x = (error_x - self.prev_err_x) / dt if dt > 0 else 0
        derivative_y = (error_y - self.prev_err_y) / dt if dt > 0 else 0

        out_x = (self.kp * error_x) + (self.ki * self.integral_x) + (self.kd * derivative_x)
        out_y = (self.kp * error_y) + (self.ki * self.integral_y) + (self.kd * derivative_y)

        self.prev_err_x = error_x
        self.prev_err_y = error_y

        return out_x, out_y

def main():
    pid = DualAxisPID(kp=0.08, ki=0.005, kd=0.01)
    print(json.dumps({"status": "READY", "message": "FSOC PAT Vision Tracker Sidecar initialized"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            data = json.loads(line)
            frame_b64 = data.get("frame", "")

            target_err_x = data.get("error_x", 0.0)
            target_err_y = data.get("error_y", 0.0)

            pan_delta, tilt_delta = pid.compute(target_err_x, target_err_y)

            response = {
                "status": "OK",
                "pan_delta": round(pan_delta, 4),
                "tilt_delta": round(tilt_delta, 4),
                "error_x": target_err_x,
                "error_y": target_err_y,
                "timestamp": time.time()
            }
            print(json.dumps(response), flush=True)

        except Exception as e:
            err_resp = {"status": "ERROR", "message": str(e)}
            print(json.dumps(err_resp), flush=True)

if __name__ == "__main__":
    main()
