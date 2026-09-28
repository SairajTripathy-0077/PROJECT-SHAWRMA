// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;

use bridge::BridgeServer;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FramePayload {
    pub frame: String,
    pub error_x: f64,
    pub error_y: f64,
    pub drop_los: Option<bool>,
    pub gains: Option<PidTuningGains>,
    pub timestamp: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PidTuningGains {
    pub kp_pan: f64,
    pub ki_pan: f64,
    pub kd_pan: f64,
    pub kp_tilt: f64,
    pub ki_tilt: f64,
    pub kd_tilt: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackerTelemetryResponse {
    pub state: String,
    pub pan_velocity: f64,
    pub tilt_velocity: f64,
    pub error_px: [f64; 2],
    pub predicted_px: [f64; 2],
    pub locked: bool,
    pub fps: f64,
    pub cv_latency_ms: f64,
    pub binary_frame_b64: Option<String>,
}

pub struct AppState {
    pub gains: Mutex<PidTuningGains>,
}

#[tauri::command]
fn update_pid_gains(gains: PidTuningGains, state: State<'_, AppState>) -> Result<String, String> {
    let mut current_gains = state.gains.lock().map_err(|e| e.to_string())?;
    *current_gains = gains.clone();
    println!("[Tauri IPC] Gains Synchronized: {:?}", gains);
    Ok("Gains updated successfully".into())
}

#[tauri::command]
fn process_frame(payload: FramePayload, state: State<'_, AppState>) -> Result<TrackerTelemetryResponse, String> {
    let current_gains = state.gains.lock().map_err(|e| e.to_string())?.clone();
    let start_time = std::time::Instant::now();

    let drop_los = payload.drop_los.unwrap_or(false);
    if drop_los {
        return Ok(TrackerTelemetryResponse {
            state: "PREDICTIVE_HOLD".into(),
            pan_velocity: 0.0,
            tilt_velocity: 0.0,
            error_px: [payload.error_x, payload.error_y],
            predicted_px: [payload.error_x * 0.9, payload.error_y * 0.9],
            locked: false,
            fps: 60.0,
            cv_latency_ms: 3.1,
            binary_frame_b64: None,
        });
    }

    let kp = current_gains.kp_pan;
    let pan_vel = (payload.error_x * kp).clamp(-20.0, 20.0);
    let tilt_vel = (-payload.error_y * current_gains.kp_tilt).clamp(-20.0, 20.0);

    let cv_latency = start_time.elapsed().as_secs_f64() * 1000.0;
    let is_locked = payload.error_x.abs() < 15.0 && payload.error_y.abs() < 15.0;

    Ok(TrackerTelemetryResponse {
        state: if is_locked { "TRACKING".into() } else { "ACQUIRE".into() },
        pan_velocity: pan_vel,
        tilt_velocity: tilt_vel,
        error_px: [payload.error_x, payload.error_y],
        predicted_px: [payload.error_x * 0.95, payload.error_y * 0.95],
        locked: is_locked,
        fps: 60.0,
        cv_latency_ms: cv_latency,
        binary_frame_b64: None,
    })
}

fn main() {
    let initial_gains = PidTuningGains {
        kp_pan: 0.08,
        ki_pan: 0.005,
        kd_pan: 0.015,
        kp_tilt: 0.08,
        ki_tilt: 0.005,
        kd_tilt: 0.015,
    };

    // Spawn async Tokio TCP bridge server on port 8765
    tauri::async_runtime::spawn(async move {
        let bridge = BridgeServer::new(8765);
        if let Err(err) = bridge.start().await {
            eprintln!("[Rust Main] Bridge server error: {}", err);
        }
    });

    tauri::Builder::default()
        .manage(AppState {
            gains: Mutex::new(initial_gains),
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![process_frame, update_pid_gains])
        .run(tauri::generate_context!())
        .expect("error while running FSOC PAT Tauri application");
}
