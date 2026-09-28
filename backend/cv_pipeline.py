"""
FSOC PAT High-Speed Computer Vision Pipeline (<1.0ms Target)
Features:
- Dynamic Perimeter-Sampled ROI (64x64 / 128x128 Edge-Margin Guard)
- 3-Pixel Outer Border Background Noise Estimation (mu_bg + 3.0 * sigma_bg)
- Thresholded Center of Gravity (TCoG) Centroid Extractor
- Telemetry Finite State Machine (SEARCHING -> ACQUIRED -> TRACKING -> LOST)
- 4x Spatial Downsampled Full-Frame Acquisition Scan
- Pre-warmed SIMD memory buffers to eliminate cold-start latency spikes
"""

import base64
import time
from typing import Tuple, Optional, Dict, Any, Union
import numpy as np

try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False


class DynamicPerimeterTCoGTracker:
    """
    Ultra-Fast Optical Spot Detector (<1.0ms) using Dynamic ROI and
    Perimeter-Sampled Thresholded Center of Gravity (TCoG).
    """
    def __init__(
        self,
        default_roi_size: int = 64,
        expanded_roi_size: int = 128,
        perimeter_width: int = 3,
        sigma_multiplier: float = 3.0,
        edge_margin: int = 8,
        min_signal_sum: float = 10.0
    ):
        self.default_roi_size = default_roi_size
        self.expanded_roi_size = expanded_roi_size
        self.perimeter_width = perimeter_width
        self.sigma_multiplier = sigma_multiplier
        self.edge_margin = edge_margin
        self.min_signal_sum = min_signal_sum

        # State tracking
        self.next_roi_size = default_roi_size
        self.last_noise_mu = 0.0
        self.last_noise_sigma = 0.0
        self.last_threshold = 0.0
        self.last_tcog_sum = 0.0
        self.dropout_counter = 0

        # Pre-warm NumPy memory allocations & JIT caches
        self._warmup_cache()

    def _warmup_cache(self) -> None:
        """Execute a quick synthetic pass to prime CPU caches & memory pools."""
        try:
            dummy = np.zeros((self.expanded_roi_size, self.expanded_roi_size), dtype=np.uint8)
            dummy[32:36, 32:36] = 200
            self.extract_centroid_tcog(dummy, 34.0, 34.0)
            self.next_roi_size = self.default_roi_size
            self.dropout_counter = 0
        except Exception:
            pass

    def extract_centroid_tcog(
        self,
        frame_gray: np.ndarray,
        proj_x: float,
        proj_y: float
    ) -> Tuple[Optional[Tuple[float, float]], str, Dict[str, Any]]:
        """
        Extracts sub-pixel optical centroid using Perimeter-Sampled TCoG within a localized ROI.
        
        Returns:
            Tuple of:
            - centroid: (cx_global, cy_global) or None if dropout
            - status: 'DETECTED' | 'DROPOUT' | 'EDGE_MARGIN'
            - metadata: dictionary containing noise floor, threshold, and ROI bounds
        """
        h_frame, w_frame = frame_gray.shape[:2]
        roi_half = self.next_roi_size // 2

        # 1. Clamp ROI slice bounds to image frame
        cx_int = int(round(proj_x))
        cy_int = int(round(proj_y))

        x_min = max(0, cx_int - roi_half)
        x_max = min(w_frame, cx_int + roi_half)
        y_min = max(0, cy_int - roi_half)
        y_max = min(h_frame, cy_int + roi_half)

        roi = frame_gray[y_min:y_max, x_min:x_max]
        h_roi, w_roi = roi.shape[:2]

        if h_roi < 10 or w_roi < 10:
            self.dropout_counter += 1
            self.next_roi_size = self.expanded_roi_size
            return None, "DROPOUT", {"reason": "ROI_TOO_SMALL"}

        # 2. Noise Floor Estimation: Sample outer perimeter border safely
        pw = min(self.perimeter_width, max(1, h_roi // 4), max(1, w_roi // 4))
        top_border = roi[:pw, :].flatten()
        bottom_border = roi[-pw:, :].flatten()
        left_border = roi[pw:-pw, :pw].flatten()
        right_border = roi[pw:-pw, -pw:].flatten()

        perimeter_pixels = np.concatenate([top_border, bottom_border, left_border, right_border])
        if perimeter_pixels.size == 0:
            perimeter_pixels = roi.flatten()

        mu_bg = float(np.mean(perimeter_pixels))
        sigma_bg = float(np.std(perimeter_pixels))
        threshold = mu_bg + self.sigma_multiplier * max(sigma_bg, 1.0)

        self.last_noise_mu = mu_bg
        self.last_noise_sigma = sigma_bg
        self.last_threshold = threshold

        # 3. Thresholded Center of Gravity (TCoG)
        # Zero out pixels below threshold
        roi_f32 = roi.astype(np.float32)
        signal_mask = roi_f32 > threshold
        roi_signal = np.where(signal_mask, roi_f32 - threshold, 0.0)

        tcog_sum = float(np.sum(roi_signal))
        self.last_tcog_sum = tcog_sum

        if tcog_sum <= self.min_signal_sum:
            self.dropout_counter += 1
            self.next_roi_size = self.expanded_roi_size  # Expand on dropout
            return None, "DROPOUT", {
                "mu_bg": mu_bg,
                "sigma_bg": sigma_bg,
                "threshold": threshold,
                "tcog_sum": tcog_sum
            }

        # Calculate local center of mass (sub-pixel precision)
        y_coords, x_coords = np.mgrid[0:h_roi, 0:w_roi]
        cx_local = float(np.sum(x_coords * roi_signal) / tcog_sum)
        cy_local = float(np.sum(y_coords * roi_signal) / tcog_sum)

        # Map back to global frame coordinates
        cx_global = cx_local + x_min
        cy_global = cy_local + y_min
        self.dropout_counter = 0

        # 4. Edge Margin Guard: Expand ROI if beacon touches border
        status = "DETECTED"
        if (
            cx_local <= self.edge_margin or
            cx_local >= (w_roi - self.edge_margin) or
            cy_local <= self.edge_margin or
            cy_local >= (h_roi - self.edge_margin)
        ):
            self.next_roi_size = self.expanded_roi_size
            status = "EDGE_MARGIN"
        else:
            self.next_roi_size = self.default_roi_size

        return (cx_global, cy_global), status, {
            "mu_bg": mu_bg,
            "sigma_bg": sigma_bg,
            "threshold": threshold,
            "tcog_sum": tcog_sum,
            "roi_bounds": [x_min, y_min, x_max, y_max]
        }

    def full_frame_acquisition_scan(self, frame_gray: np.ndarray, downsample_factor: int = 4) -> Optional[Tuple[float, float]]:
        """
        4x Spatial Downsampled Full-Frame Acquisition Scan for 'SEARCHING' mode.
        """
        if not HAS_OPENCV or frame_gray is None:
            return None

        h, w = frame_gray.shape[:2]
        small_w = max(1, w // downsample_factor)
        small_h = max(1, h // downsample_factor)

        small_frame = cv2.resize(frame_gray, (small_w, small_h), interpolation=cv2.INTER_AREA)
        blurred = cv2.GaussianBlur(small_frame, (5, 5), 0)

        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(blurred)
        if max_val > 40:
            # Map downsampled peak back to full resolution
            peak_x = max_loc[0] * downsample_factor + (downsample_factor / 2.0)
            peak_y = max_loc[1] * downsample_factor + (downsample_factor / 2.0)
            
            # Refine peak locally with small ROI
            refined, status, _ = self.extract_centroid_tcog(frame_gray, peak_x, peak_y)
            return refined if refined is not None else (peak_x, peak_y)

        return None


class VisionTracker:
    """
    Integrated High-Performance Optical Tracker & Telemetry State Machine.
    """
    def __init__(self):
        self.tcog = DynamicPerimeterTCoGTracker()
        self.state = "SEARCHING"
        self.consecutive_detections = 0
        self.consecutive_dropouts = 0

    def process_frame_pipeline(
        self,
        frame_np: np.ndarray,
        proj_x: float = 320.0,
        proj_y: float = 240.0
    ) -> Tuple[Optional[Tuple[float, float]], str, float]:
        """
        Processes frame using state-adaptive optical detection.
        
        Returns:
            Tuple of (centroid_opt, current_fsm_state, latency_ms)
        """
        t_start = time.perf_counter()

        if frame_np is None:
            self.consecutive_dropouts += 1
            if self.consecutive_dropouts > 5:
                self.state = "SEARCHING"
            return None, self.state, 0.0

        # Channel normalization
        if len(frame_np.shape) == 3:
            if frame_np.shape[2] == 3:
                gray = cv2.cvtColor(frame_np, cv2.COLOR_BGR2GRAY)
            elif frame_np.shape[2] == 4:
                gray = cv2.cvtColor(frame_np, cv2.COLOR_BGRA2GRAY)
            else:
                gray = frame_np[:, :, 0]
        else:
            gray = frame_np

        centroid = None

        # State Machine Execution
        if self.state in ["TRACKING", "ACQUIRED"]:
            # High-Speed localized TCoG scan
            centroid, status, meta = self.tcog.extract_centroid_tcog(gray, proj_x, proj_y)

            if centroid is not None:
                self.consecutive_detections += 1
                self.consecutive_dropouts = 0
                if self.state == "ACQUIRED" and self.consecutive_detections >= 3:
                    self.state = "TRACKING"
            else:
                self.consecutive_dropouts += 1
                self.consecutive_detections = 0
                if self.consecutive_dropouts > 5:
                    self.state = "LOST"
                elif self.consecutive_dropouts > 10:
                    self.state = "SEARCHING"

        elif self.state in ["SEARCHING", "LOST"]:
            # 4x Downsampled full-frame acquisition
            centroid = self.tcog.full_frame_acquisition_scan(gray, downsample_factor=4)
            if centroid is not None:
                self.consecutive_detections += 1
                self.consecutive_dropouts = 0
                self.state = "ACQUIRED"
            else:
                self.consecutive_dropouts += 1
                self.consecutive_detections = 0
                self.state = "SEARCHING"

        elapsed_ms = (time.perf_counter() - t_start) * 1000.0
        return centroid, self.state, elapsed_ms

    def decode_b64(self, frame_b64: str) -> Optional[np.ndarray]:
        """Decodes base64 string to OpenCV BGR numpy array."""
        if not HAS_OPENCV or not frame_b64:
            return None
        try:
            if "," in frame_b64:
                frame_b64 = frame_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(frame_b64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception:
            return None
