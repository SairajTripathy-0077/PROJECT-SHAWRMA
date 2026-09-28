// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;

use bridge::BridgeServer;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

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
    pub pan_vel: f64,
    pub tilt_vel: f64,
    pub error_px: [f64; 2],
    pub rmse: f64,
}

pub struct PythonSidecarProcess {
    pub child: Arc<Mutex<Option<Child>>>,
}

impl Drop for PythonSidecarProcess {
    fn drop(&mut self) {
        if let Ok(mut lock) = self.child.lock() {
            if let Some(mut child) = lock.take() {
                println!("[Rust Subprocess] Terminating Python tracker child process...");
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

pub struct AppState {
    pub gains: Mutex<PidTuningGains>,
    pub sidecar: PythonSidecarProcess,
}

#[tauri::command]
fn update_pid_gains(gains: PidTuningGains, state: State<'_, AppState>) -> Result<String, String> {
    let mut current_gains = state.gains.lock().map_err(|e| e.to_string())?;
    *current_gains = gains.clone();
    println!("[Tauri IPC] Live Gains Updated: {:?}", gains);
    Ok("Gains updated".into())
}

#[tauri::command]
fn process_frame(payload: FramePayload, state: State<'_, AppState>) -> Result<TrackerTelemetryResponse, String> {
    let current_gains = state.gains.lock().map_err(|e| e.to_string())?.clone();

    let drop_los = payload.drop_los.unwrap_or(false);
    if drop_los {
        return Ok(TrackerTelemetryResponse {
            state: "PREDICTIVE_HOLD".into(),
            pan_vel: 0.0,
            tilt_vel: 0.0,
            error_px: [payload.error_x, payload.error_y],
            rmse: (payload.error_x * payload.error_x + payload.error_y * payload.error_y).sqrt(),
        });
    }

    let kp = current_gains.kp_pan;
    let pan_v = (payload.error_x * kp * 0.002).clamp(-2.0, 2.0);
    let tilt_v = (-payload.error_y * current_gains.kp_tilt * 0.002).clamp(-2.0, 2.0);
    let rmse = (payload.error_x * payload.error_x + payload.error_y * payload.error_y).sqrt();

    let is_locked = payload.error_x.abs() < 15.0 && payload.error_y.abs() < 15.0;

    Ok(TrackerTelemetryResponse {
        state: if is_locked { "TRACKING".into() } else { "ACQUIRE".into() },
        pan_vel: pan_v,
        tilt_vel: tilt_v,
        error_px: [payload.error_x, payload.error_y],
        rmse,
    })
}

fn spawn_python_sidecar() -> Arc<Mutex<Option<Child>>> {
    println!("[Rust Subprocess] Spawning Python sidecar tracker process...");
    let child_res = Command::new("python")
        .arg("backend/tracker.py")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn();

    match child_res {
        Ok(child) => Arc::new(Mutex::new(Some(child))),
        Err(err) => {
            eprintln!("[Rust Subprocess] Failed to spawn Python sidecar: {}", err);
            Arc::new(Mutex::new(None))
        }
    }
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

    let sidecar_handle = spawn_python_sidecar();

    // Spawn Tokio TCP Bridge Server on port 8765
    tauri::async_runtime::spawn(async move {
        let bridge = BridgeServer::new(8765);
        if let Err(err) = bridge.start().await {
            eprintln!("[Rust Bridge Error] {}", err);
        }
    });

    tauri::Builder::default()
        .manage(AppState {
            gains: Mutex::new(initial_gains),
            sidecar: PythonSidecarProcess {
                child: sidecar_handle,
            },
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![process_frame, update_pid_gains])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                println!("[Tauri Window] Window close requested. Cleaning up child processes...");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running FSOC PAT Tauri application");
}
