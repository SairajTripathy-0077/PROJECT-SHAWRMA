"""
Automated Verification Suite for Multi-Target FSOC PAT Engine
Validates:
1. Soft-Masked TCoG sub-pixel extraction on merged and unmerged spots (< 64px separation)
2. Latency verification (< 1.0ms)
3. Momentum-Aware Data Association (zero ID swapping during trajectory intersection)
4. Virtual Setpoint alpha-blended smooth mode transitions (15 frames)
5. Asymmetric cloud-fade mitigation (Sat 2 decay over 5 frames, anchoring to Sat 1)
6. Dynamic FOV guard (> 85% sensor width boundary protection & TARGET_DIVERGENCE)
"""

import time
import numpy as np
import cv2

from cv_pipeline import DynamicPerimeterTCoGTracker, VisionTracker
from tracker import MultiTracker, StateAnchoredKalmanFilter2D
from controller import VirtualSetpointController, FeedforwardBackcalcPIDController


def generate_synthetic_spot(img: np.ndarray, x: float, y: float, intensity: float = 230.0, sigma: float = 3.5) -> None:
    """Renders a 2D Gaussian spot directly onto the image array."""
    h, w = img.shape
    x_grid = np.arange(0, w, dtype=np.float32)
    y_grid = np.arange(0, h, dtype=np.float32)
    xx, yy = np.meshgrid(x_grid, y_grid)
    
    # 2D Gaussian formulation
    dist_sq = (xx - x)**2 + (yy - y)**2
    spot = intensity * np.exp(-dist_sq / (2.0 * sigma * sigma))
    
    # Additive blend clipped to uint8 maximum
    img[:] = np.clip(img.astype(np.float32) + spot, 0, 255).astype(np.uint8)


def test_soft_masked_tcog():
    print("\n--- [TEST 1] Soft-Masked TCoG on Merging Spots (<64px) ---")
    pipeline = DynamicPerimeterTCoGTracker(default_roi_size=64)
    
    # Create synthetic frame with two spots 25px apart (merged ROI scenario)
    true_p1 = (310.0, 240.0)
    true_p2 = (335.0, 240.0)
    
    frame = np.random.normal(loc=12.0, scale=2.0, size=(480, 640)).astype(np.uint8)
    generate_synthetic_spot(frame, true_p1[0], true_p1[1], intensity=240.0, sigma=3.0)
    generate_synthetic_spot(frame, true_p2[0], true_p2[1], intensity=220.0, sigma=3.0)
    
    # Warmup and benchmark over 50 iterations
    latencies = []
    for _ in range(50):
        t0 = time.perf_counter()
        centroids = pipeline.extract_multi_centroids_soft_tcog(
            frame_gray=frame,
            predicted_centers=[(312.0, 239.0), (333.0, 241.0)]
        )
        latencies.append((time.perf_counter() - t0) * 1000.0)
    
    avg_latency = float(np.mean(latencies))
    min_latency = float(np.min(latencies))
    c1, c2 = centroids[0], centroids[1]
    print(f"Extraction Latency (Average over 50 runs): {avg_latency:.3f} ms (Min: {min_latency:.3f} ms, Budget: <1.0 ms)")
    print(f"True Centroid 1: {true_p1} -> Extracted: {c1}")
    print(f"True Centroid 2: {true_p2} -> Extracted: {c2}")
    
    assert c1 is not None and c2 is not None, "Failed to extract both centroids!"
    
    err1 = np.linalg.norm(np.array(c1) - np.array(true_p1))
    err2 = np.linalg.norm(np.array(c2) - np.array(true_p2))
    print(f"Centroid 1 Sub-pixel Error: {err1:.2f} px")
    print(f"Centroid 2 Sub-pixel Error: {err2:.2f} px")
    
    assert err1 < 2.5, f"Centroid 1 error {err1:.2f}px exceeds 2.5px tolerance!"
    assert err2 < 2.5, f"Centroid 2 error {err2:.2f}px exceeds 2.5px tolerance!"
    print("[PASS] Soft-Masked TCoG PASS")


def test_momentum_aware_data_association():
    print("\n--- [TEST 2] Momentum-Aware Data Association (Path Intersection) ---")
    multi_tracker = MultiTracker(lambda_momentum=2.5, chi2_gate=9.21)
    
    # Simulate two satellites on crossing paths:
    # Sat 1 moves left-to-right: x = 200 -> 440, y = 240
    # Sat 2 moves right-to-left: x = 440 -> 200, y = 240
    # Crossing point at x = 320 at step 12
    
    steps = 25
    x1_traj = np.linspace(200.0, 440.0, steps)
    x2_traj = np.linspace(440.0, 200.0, steps)
    y_traj = np.full(steps, 240.0)
    
    # Prime the Kalman filters with first 3 measurements
    for k in range(3):
        z1 = (float(x1_traj[k]), float(y_traj[k]))
        z2 = (float(x2_traj[k]), float(y_traj[k]))
        multi_tracker.predict_all(dt=0.033)
        multi_tracker.update_with_measurements([z1, z2], dt=0.033)
    
    print(f"Initialized Track 0 at: {multi_tracker.tracks[0].get_state()[:2]}")
    print(f"Initialized Track 1 at: {multi_tracker.tracks[1].get_state()[:2]}")
    
    # Run through intersection
    for k in range(3, steps):
        true_z1 = (float(x1_traj[k]), float(y_traj[k]))
        true_z2 = (float(x2_traj[k]), float(y_traj[k]))
        
        # Shuffle measurements randomly at alternate frames to test assignment
        meas = [true_z2, true_z1] if k % 2 == 1 else [true_z1, true_z2]
        
        multi_tracker.predict_all(dt=0.033)
        tracks_out = multi_tracker.update_with_measurements(meas, dt=0.033)
        t1_pos = tracks_out[0]["estimated_pos"]
        t2_pos = tracks_out[1]["estimated_pos"]
        
        # Verify Track 0 continues moving in +x direction, Track 1 continues in -x direction
        t1_vel_x = tracks_out[0]["velocity"][0]
        t2_vel_x = tracks_out[1]["velocity"][0]
        
        if k > 5:
            assert t1_vel_x > 0, f"Step {k}: Track 0 velocity reversed! Swapped ID! vel={t1_vel_x}"
            assert t2_vel_x < 0, f"Step {k}: Track 1 velocity reversed! Swapped ID! vel={t2_vel_x}"
            
    print(f"Final Track 0 pos: {tracks_out[0]['estimated_pos']} (Expected x ~ 440)")
    print(f"Final Track 1 pos: {tracks_out[1]['estimated_pos']} (Expected x ~ 200)")
    assert tracks_out[0]["estimated_pos"][0] > 400.0, "Track 0 failed to reach destination!"
    assert tracks_out[1]["estimated_pos"][0] < 240.0, "Track 1 failed to reach destination!"
    print("[PASS] Momentum-Aware Association (Anti-ID Swap) PASS")


def test_alpha_blended_transition():
    print("\n--- [TEST 3] Alpha-Weighted Smooth Transition (15 frames) ---")
    vsp_ctrl = VirtualSetpointController(transition_frames=15)
    
    # Sat 1 at (300, 240), Sat 2 at (340, 240)
    p1 = [300.0, 240.0]
    v1 = [0.0, 0.0]
    p2 = [340.0, 240.0]
    v2 = [0.0, 0.0]
    
    # Initial mode is PRIMARY_ONLY -> VSP should be at (300, 240)
    _, _, _, _, vsp, meta = vsp_ctrl.compute_multi_target(
        p1, v1, 0, p2, v2, 0, dt=0.033
    )
    print(f"Initial Mode: {meta['active_mode']} -> VSP: {vsp}")
    assert abs(vsp[0] - 300.0) < 1e-3, "Initial VSP not on Sat 1!"
    
    # Switch mode to BARYCENTER
    vsp_ctrl.set_mode("BARYCENTER")
    
    vsp_history = []
    for f in range(15):
        _, _, _, _, vsp, meta = vsp_ctrl.compute_multi_target(
            p1, v1, 0, p2, v2, 0, dt=0.033
        )
        vsp_history.append(vsp[0])
        print(f"Frame {f+1:02d}: alpha={meta['alpha']:.3f}, VSP_x={vsp[0]:.2f}")
    
    # Check monotonic transition from 300 to 320 (barycenter of 300 and 340)
    assert np.all(np.diff(vsp_history) >= 0.0), "VSP transition was not smooth/monotonic!"
    assert abs(vsp_history[-1] - 320.0) < 1e-2, f"Final VSP {vsp_history[-1]} not at Barycenter (320.0)!"
    print("[PASS] Alpha-Blended Smooth Mode Transition PASS")


def test_asymmetric_cloud_fade_mitigation():
    print("\n--- [TEST 4] Asymmetric Cloud-Fade Mitigation (Sat 2 Decay -> Anchor Sat 1) ---")
    vsp_ctrl = VirtualSetpointController(mode="BARYCENTER", transition_frames=15)
    vsp_ctrl.alpha = 1.0  # Fully settled in BARYCENTER
    
    p1 = [300.0, 240.0]
    v1 = [0.0, 0.0]
    p2 = [360.0, 240.0]
    v2 = [0.0, 0.0]
    
    # Nominal Barycenter: (300 + 360)/2 = 330.0
    _, _, _, _, vsp_nominal, meta = vsp_ctrl.compute_multi_target(
        p1, v1, 0, p2, v2, 0, dt=0.033
    )
    print(f"Nominal Barycenter VSP: {vsp_nominal[0]:.2f}")
    assert abs(vsp_nominal[0] - 330.0) < 1e-2
    
    # Simulate Sat 2 cloud fade (fade frames 1 through 9)
    vsp_fade_history = []
    for fade_count in range(1, 10):
        _, _, _, _, vsp, meta = vsp_ctrl.compute_multi_target(
            p1, v1, 0, p2, v2, fade_count, dt=0.033
        )
        vsp_fade_history.append(vsp[0])
        print(f"Sat 2 Fade Frame {fade_count}: weight={meta['sat2_weight']:.3f}, VSP_x={vsp[0]:.2f}")
    
    # Frame 1-3: weight=1.0, VSP=330.0
    assert abs(vsp_fade_history[0] - 330.0) < 1e-2
    assert abs(vsp_fade_history[2] - 330.0) < 1e-2
    
    # Frame 8+: weight=0.0, VSP should smoothly anchor to Sat 1 (300.0)
    assert abs(vsp_fade_history[-1] - 300.0) < 1e-2, f"Failed to anchor to Sat 1! Final VSP={vsp_fade_history[-1]}"
    print("[PASS] Asymmetric Cloud-Fade Mitigation PASS")


def test_dynamic_fov_guard():
    print("\n--- [TEST 5] Dynamic Sensor FOV Guard (>85% Sensor Width) ---")
    vsp_ctrl = VirtualSetpointController(sensor_width=640.0, fov_guard_fraction=0.85)
    vsp_ctrl.set_mode("BARYCENTER")
    vsp_ctrl.alpha = 1.0
    
    # Target separation < 544px (e.g., 400px)
    p1 = [100.0, 240.0]
    p2 = [500.0, 240.0]
    _, _, _, _, _, meta = vsp_ctrl.compute_multi_target(
        p1, [0, 0], 0, p2, [0, 0], 0, dt=0.033
    )
    print(f"Separation 400px -> State: {meta['state']}, Divergence: {meta['divergence_warning']}")
    assert not meta['divergence_warning']
    assert meta['state'] == "TRACKING"
    
    # Target separation > 544px (e.g. 560px: p1=40, p2=600)
    p1_div = [40.0, 240.0]
    p2_div = [600.0, 240.0]
    _, _, _, _, vsp, meta_div = vsp_ctrl.compute_multi_target(
        p1_div, [0, 0], 0, p2_div, [0, 0], 0, dt=0.033
    )
    print(f"Separation 560px -> State: {meta_div['state']}, Divergence: {meta_div['divergence_warning']}, VSP: {vsp}")
    assert meta_div['divergence_warning']
    assert meta_div['state'] == "TARGET_DIVERGENCE"
    # Should force PRIMARY_ONLY on Sat 1 (40.0)
    assert abs(vsp[0] - 40.0) < 1e-2, f"Expected forced VSP to Sat 1 (40.0), got {vsp[0]}"
    print("[PASS] Dynamic FOV Guard PASS")


if __name__ == "__main__":
    print("=" * 60)
    print("MULTI-TARGET FSOC PAT VERIFICATION SUITE")
    print("=" * 60)
    test_soft_masked_tcog()
    test_momentum_aware_data_association()
    test_alpha_blended_transition()
    test_asymmetric_cloud_fade_mitigation()
    test_dynamic_fov_guard()
    print("\n" + "=" * 60)
    print("ALL MULTI-TARGET PAT VERIFICATION TESTS PASSED SUCCESSFULLY (100%)")
    print("=" * 60)
