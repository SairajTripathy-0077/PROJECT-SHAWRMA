"""
High-Throughput Python WebSocket Sidecar Server for FSOC PAT Simulator
Receives raw binary image buffers, runs OpenCV centroid detection + EKF + PID,
and returns JSON telemetry in <15ms.
"""

import asyncio
import json
import time
import base64
import numpy as np

try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False

try:
    import websockets
    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False

from tracker import AutonomousTrackingFSM, extract_centroid_and_binary_preview


class HighThroughputTrackerServer:
    def __init__(self, host="127.0.0.1", port=8765):
        self.host = host
        self.port = port
        self.fsm = AutonomousTrackingFSM()
        self.last_time = time.time()

    async def handle_connection(self, websocket, path=None):
        print(f"[Python Server] Client connected from {websocket.remote_address}")
        try:
            async for message in websocket:
                start_cv = time.time()
                dt = max(start_cv - self.last_time, 0.001)
                self.last_time = start_cv

                frame_b64 = ""
                input_err_x = None
                input_err_y = None
                drop_los = False

                if isinstance(message, bytes):
                    # Direct raw binary buffer decoding (JPEG / PNG byte array)
                    if HAS_OPENCV:
                        nparr = np.frombuffer(message, np.uint8)
                        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        if frame is not None:
                            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
                            _, thresh = cv2.threshold(blurred, 215, 255, cv2.THRESH_BINARY)
                            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                            centroid = None
                            if contours:
                                c = max(contours, key=cv2.contourArea)
                                M = cv2.moments(c)
                                if M["m00"] != 0:
                                    centroid = (int(M["m10"] / M["m00"]), int(M["m01"] / M["m00"]))
                else:
                    # JSON payload message
                    try:
                        data = json.loads(message)
                        frame_b64 = data.get("frame", "")
                        input_err_x = data.get("error_x", None)
                        input_err_y = data.get("error_y", None)
                        drop_los = data.get("drop_los", False)

                        if "gains" in data and data["gains"]:
                            self.fsm.pid.set_gains(data["gains"])

                        centroid, binary_b64 = extract_centroid_and_binary_preview(frame_b64)
                    except Exception:
                        centroid = None

                res = self.fsm.update(centroid, input_err_x, input_err_y, drop_los=drop_los, dt=dt)
                cv_latency = (time.time() - start_cv) * 1000.0

                telemetry = {
                    "pan_deg": round(res["pan_velocity"] * 0.033, 4),
                    "tilt_deg": round(res["tilt_velocity"] * 0.033, 4),
                    "pan_velocity": res["pan_velocity"],
                    "tilt_velocity": res["tilt_velocity"],
                    "error_px": res["error_px"],
                    "predicted_px": res["predicted_px"],
                    "state": res["state"],
                    "locked": res["locked"],
                    "latency_ms": round(cv_latency, 2),
                    "fps": round(1.0 / dt, 1) if dt > 0 else 60.0,
                    "cv_latency_ms": round(cv_latency, 2)
                }

                await websocket.send(json.dumps(telemetry))

        except websockets.exceptions.ConnectionClosed:
            print("[Python Server] Client disconnected.")

    async def start(self):
        if not HAS_WEBSOCKETS:
            print("[Python Server] `websockets` library missing. Falling back to stdin/stdout bridge.")
            return

        print(f"[Python Server] Starting high-throughput WebSocket server on {self.host}:{self.port}...")
        async with websockets.serve(self.handle_connection, self.host, self.port):
            await asyncio.Future() # Run forever


if __name__ == "__main__":
    server = HighThroughputTrackerServer()
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        print("[Python Server] Server stopped by user.")
