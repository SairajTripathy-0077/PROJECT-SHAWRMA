"""
FSOC PAT High-Speed Multi-Target Computer Vision Pipeline (<1.0ms Target)
Aerospace-Grade Architecture Featuring:
- Dynamic ROI Merging for Proximity Targets (<64px)
- NMS Peak Detection for Multi-Spot Resolution (Up to 2 Targets)
- Soft-Masked Thresholded Center of Gravity (TCoG) with Continuous Inverse-Square Weighting
- Perimeter-Sampled Background Noise Estimation (mu_bg + 3.0 * sigma_bg)
- Multi-Target Telemetry Finite State Machine (SEARCHING -> ACQUIRED -> TRACKING -> LOST)
- Pre-warmed SIMD memory buffers to eliminate cold-start latency spikes
"""

import base64
import time
from typing import Tuple, Optional, Dict, Any, Union, List
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
    Supports Single-Spot and Multi-Spot Soft-Masked Separation.
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
            self.extract_multi_centroids_soft_tcog(dummy, [(32.0, 32.0), (45.0, 45.0)])
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
        Extracts sub-pixel optical centroid for a single beacon using Perimeter-Sampled TCoG.
        """
        h_frame, w_frame = frame_gray.shape[:2]
        roi_half = self.next_roi_size // 2

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
        roi_f32 = roi.astype(np.float32)
        signal_mask = roi_f32 > threshold
        roi_signal = np.where(signal_mask, roi_f32 - threshold, 0.0)

        tcog_sum = float(np.sum(roi_signal))
        self.last_tcog_sum = tcog_sum

        if tcog_sum <= self.min_signal_sum:
            self.dropout_counter += 1
            self.next_roi_size = self.expanded_roi_size
            return None, "DROPOUT", {
                "mu_bg": mu_bg,
                "sigma_bg": sigma_bg,
                "threshold": threshold,
                "tcog_sum": tcog_sum
            }

        y_coords, x_coords = np.mgrid[0:h_roi, 0:w_roi]
        cx_local = float(np.sum(x_coords * roi_signal) / tcog_sum)
        cy_local = float(np.sum(y_coords * roi_signal) / tcog_sum)

        cx_global = cx_local + x_min
        cy_global = cy_local + y_min
        self.dropout_counter = 0

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

    def extract_multi_centroids_soft_tcog(
        self,
        frame_gray: np.ndarray,
        predicted_centers: List[Tuple[float, float]]
    ) -> List[Optional[Tuple[float, float]]]:
        """
        Multi-Target Soft-Masked TCoG Centroid Extractor:
        1. Merges bounding boxes if targets are <64px apart.
        2. Detects local NMS peaks.
        3. Computes continuous inverse-square soft weights to isolate overlapping spots.
        
        Returns:
            List of detected sub-pixel coordinates [(x1, y1), (x2, y2)], or None for missed spots.
        """
        if not predicted_centers:
            return []

        h_frame, w_frame = frame_gray.shape[:2]

        if len(predicted_centers) == 1:
            c, _, _ = self.extract_centroid_tcog(frame_gray, predicted_centers[0][0], predicted_centers[0][1])
            return [c]

        p1, p2 = predicted_centers[0], predicted_centers[1]
        dist_centers = float(np.hypot(p1[0] - p2[0], p1[1] - p2[1]))

        # Case A: Targets are far apart (>= 64px) -> Process in independent ROIs
        if dist_centers >= 64.0:
            c1, _, _ = self.extract_centroid_tcog(frame_gray, p1[0], p1[1])
            c2, _, _ = self.extract_centroid_tcog(frame_gray, p2[0], p2[1])
            return [c1, c2]

        # Case B: Targets are in close proximity (< 64px) -> Dynamic Merged ROI & Soft Masking
        pad = 32
        x_min = max(0, int(round(min(p1[0], p2[0]))) - pad)
        x_max = min(w_frame, int(round(max(p1[0], p2[0]))) + pad)
        y_min = max(0, int(round(min(p1[0], p2[1]))) - pad)
        y_max = min(h_frame, int(round(max(p1[1], p2[1]))) + pad)

        roi = frame_gray[y_min:y_max, x_min:x_max]
        h_roi, w_roi = roi.shape[:2]

        if h_roi < 10 or w_roi < 10:
            return [None, None]

        # Noise Floor on merged perimeter
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

        roi_f32 = roi.astype(np.float32)
        signal_mask = roi_f32 > threshold
        roi_signal = np.where(signal_mask, roi_f32 - threshold, 0.0)

        if np.sum(roi_signal) <= self.min_signal_sum:
            return [None, None]

        # NMS Peak Detection (Find up to 2 local maxima)
        peaks = self._find_nms_peaks(roi_signal, num_peaks=2, min_distance=6)

        if len(peaks) == 0:
            return [None, None]
        elif len(peaks) == 1:
            # Only 1 distinct peak found (merged spot or single beacon active)
            y_coords, x_coords = np.mgrid[0:h_roi, 0:w_roi]
            s = float(np.sum(roi_signal))
            cx = float(np.sum(x_coords * roi_signal) / s) + x_min
            cy = float(np.sum(y_coords * roi_signal) / s) + y_min
            return [(cx, cy), None]

        # 2 Peaks Found: Soft-Masked TCoG Separation
        pk1, pk2 = peaks[0], peaks[1]
        y_coords, x_coords = np.mgrid[0:h_roi, 0:w_roi]

        # Vectorized Euclidean distances from every pixel to Peak 1 and Peak 2
        d1_sq = (x_coords - pk1[0]) ** 2 + (y_coords - pk1[1]) ** 2
        d2_sq = (x_coords - pk2[0]) ** 2 + (y_coords - pk2[1]) ** 2
        eps = 1e-4

        # Continuous Inverse-Square Distance Weights
        # Near Peak 1 (d1 -> 0): w1 -> 1.0, w2 -> 0.0
        # Near Peak 2 (d2 -> 0): w2 -> 1.0, w1 -> 0.0
        denom = d1_sq + d2_sq + 2.0 * eps
        w1 = (d2_sq + eps) / denom
        w2 = (d1_sq + eps) / denom

        # Soft-masked intensity fields
        sig1 = roi_signal * w1
        sig2 = roi_signal * w2

        sum1 = float(np.sum(sig1))
        sum2 = float(np.sum(sig2))

        c1 = None
        c2 = None

        if sum1 > self.min_signal_sum * 0.4:
            cx1 = float(np.sum(x_coords * sig1) / sum1) + x_min
            cy1 = float(np.sum(y_coords * sig1) / sum1) + y_min
            c1 = (cx1, cy1)

        if sum2 > self.min_signal_sum * 0.4:
            cx2 = float(np.sum(x_coords * sig2) / sum2) + x_min
            cy2 = float(np.sum(y_coords * sig2) / sum2) + y_min
            c2 = (cx2, cy2)

        return [c1, c2]

    def _find_nms_peaks(self, roi_signal: np.ndarray, num_peaks: int = 2, min_distance: int = 6) -> List[Tuple[int, int]]:
        """Finds up to num_peaks local maxima using non-maximum suppression."""
        h, w = roi_signal.shape[:2]
        if HAS_OPENCV:
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
            dilated = cv2.dilate(roi_signal, kernel)
            local_max_mask = (roi_signal == dilated) & (roi_signal > 0)
        else:
            local_max_mask = roi_signal > 10.0

        y_idxs, x_idxs = np.where(local_max_mask)
        if len(x_idxs) == 0:
            return []

        intensities = roi_signal[y_idxs, x_idxs]
        sorted_indices = np.argsort(-intensities)

        selected_peaks: List[Tuple[int, int]] = []
        for idx in sorted_indices:
            px = int(x_idxs[idx])
            py = int(y_idxs[idx])

            # Check distance to already selected peaks
            is_separated = True
            for sx, sy in selected_peaks:
                if np.hypot(px - sx, py - sy) < min_distance:
                    is_separated = False
                    break

            if is_separated:
                selected_peaks.append((px, py))
                if len(selected_peaks) >= num_peaks:
                    break

        return selected_peaks

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
            peak_x = max_loc[0] * downsample_factor + (downsample_factor / 2.0)
            peak_y = max_loc[1] * downsample_factor + (downsample_factor / 2.0)
            refined, status, _ = self.extract_centroid_tcog(frame_gray, peak_x, peak_y)
            return refined if refined is not None else (peak_x, peak_y)

        return None


class VisionTracker:
    """
    Integrated High-Performance Optical Tracker & Telemetry State Machine.
    Supports Single-Target and Multi-Target Soft-Masked TCoG.
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
        """Processes frame using state-adaptive optical detection (Single target)."""
        t_start = time.perf_counter()

        if frame_np is None:
            self.consecutive_dropouts += 1
            if self.consecutive_dropouts > 5:
                self.state = "SEARCHING"
            return None, self.state, 0.0

        gray = self._to_gray(frame_np)
        centroid = None

        if self.state in ["TRACKING", "ACQUIRED"]:
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

    def process_multi_targets(
        self,
        frame_np: np.ndarray,
        predicted_centers: List[Tuple[float, float]]
    ) -> Tuple[List[Optional[Tuple[float, float]]], str, float]:
        """
        Processes frame for multi-target Soft-Masked TCoG detection.
        """
        t_start = time.perf_counter()
        if frame_np is None:
            return [None] * len(predicted_centers), "LOST", 0.0

        gray = self._to_gray(frame_np)
        measurements = self.tcog.extract_multi_centroids_soft_tcog(gray, predicted_centers)

        active_count = sum(1 for m in measurements if m is not None)
        if active_count > 0:
            state = "TRACKING"
        else:
            state = "SEARCHING"

        elapsed_ms = (time.perf_counter() - t_start) * 1000.0
        return measurements, state, elapsed_ms

    def _to_gray(self, frame_np: np.ndarray) -> np.ndarray:
        if len(frame_np.shape) == 3:
            if frame_np.shape[2] == 3:
                return cv2.cvtColor(frame_np, cv2.COLOR_BGR2GRAY) if HAS_OPENCV else frame_np[:, :, 0]
            elif frame_np.shape[2] == 4:
                return cv2.cvtColor(frame_np, cv2.COLOR_BGRA2GRAY) if HAS_OPENCV else frame_np[:, :, 0]
            else:
                return frame_np[:, :, 0]
        return frame_np

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


# Class Aliases for Aerospace-Grade Directives
CVPipeline = VisionTracker
SoftMaskedTCoGDetector = DynamicPerimeterTCoGTracker
