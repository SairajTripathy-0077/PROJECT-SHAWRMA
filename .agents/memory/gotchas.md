# Known Gotchas & Nuances

*Last Updated: 2026-09-28T22:33:00+05:30*

---

## 1. Coordinate Inversions in Gimbal Pan/Tilt
- **Issue**: Screen pixel coordinates place origin `(0,0)` at the top-left (Y increasing downwards), whereas Three.js / WebGL 3D optical gimbals increase elevation (tilt up) along positive Y.
- **Handling**: In `FeedforwardBackcalcPIDController` / `controller.py`, `tilt_velocity` returned to Three.js is inverted (`v_cmd_y_threejs = -v_final_y_opencv`). When writing offline verification tests simulating OpenCV sensor images, remember that camera motion in OpenCV pixels is `spot_y = target_y - gimbal_tilt_opencv` with `gimbal_tilt_opencv += (-res["tilt_velocity"]) * dt`.

## 2. Canvas Base64 Frame Overhead & Stdio Buffering
- **Issue**: Transmitting uncompressed frames over JSON IPC causes frame buffer saturation, and Python standard I/O buffers lines on Windows.
- **Handling**: Canvas frames are downscaled and JPEG-encoded at quality `0.55-0.60` (`640x480`). Always pass `flush=True` in `print(json.dumps(resp), flush=True)` calls.

## 3. Cold-Start Python Memory Allocation & JIT Spikes
- **Issue**: The first invocation of `extract_centroid_tcog` or OpenCV resize can take $\approx 1.1\text{ms}$ due to module import and initial NumPy memory pool allocations, while subsequent frames execute in $<0.35\text{ms}$.
- **Handling**: Call `_warmup_cache()` inside `DynamicPerimeterTCoGTracker.__init__` with a dummy patch so memory pools and CPU caches are pre-warmed before the first live frame.

## 4. Actuator Velocity Limits vs High-Speed Maneuvers
- **Issue**: High-frequency Lissajous maneuvers ($0.35\text{Hz}$, $45\text{px}$ amplitude) reach peak velocities of $99\text{px/s}$. If `max_vel` is hardcoded to $50\text{px/s}$, the gimbal cannot keep up due to physical saturation.
- **Handling**: Maintain default `max_vel = 180.0\text{px/s}` and $a_{max} = 3500.0\text{px/s}^2$ with back-calculation anti-windup ($K_{aw} = 0.6$) to allow high-speed agile tracking without integrator windup.

## 5. Border & Corner ROI Slicing
- **Issue**: When a spot approaches the edge or corner of the camera frame, $64\times 64$ ROI slice bounds can become truncated ($<10\text{px}$), causing perimeter extraction to fail.
- **Handling**: Dynamic border width calculation `pw = min(perimeter_width, max(1, h_roi // 4), max(1, w_roi // 4))` and fallback to full ROI flattened array prevents any matrix degeneracy. Edge margin guard auto-expands to $128\times 128$.
