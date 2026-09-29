import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Camera, Eye, Zap, Shield, Sparkles, Gauge, Activity, Sliders } from 'lucide-react';

export default function CameraPanel() {
  const { 
    zoomFov, setZoomFov, 
    gimbalMaxVel, setGimbalMaxVel, 
    sensorMode, setSensorMode 
  } = useAppStore();

  const ifovMicroRad = ((zoomFov * Math.PI / 180 / 640) * 1e6).toFixed(1);
  const focalLengthMm = Math.round((150) / Math.tan((zoomFov * Math.PI / 180) / 2));

  const SENSOR_SPECS = [
    {
      id: 0,
      name: 'VIS RGB',
      band: '400-700nm',
      tag: 'Visible',
      accent: 'cyan'
    },
    {
      id: 1,
      name: 'SWIR',
      band: '1550nm',
      tag: 'Short-Wave IR',
      accent: 'amber'
    },
    {
      id: 2,
      name: 'FLIR',
      band: '3-5µm MWIR',
      tag: 'Mid-Wave IR',
      accent: 'indigo'
    }
  ];

  const currentSensor = SENSOR_SPECS[sensorMode] || SENSOR_SPECS[0];

  return (
    <div
      className="space-y-2 font-mono text-[10px] select-auto pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between text-cyan-400 font-bold border-b border-slate-800 pb-1">
        <div className="flex items-center space-x-1.5">
          <Camera className="w-3.5 h-3.5" />
          <span>CAMERA & SENSORS</span>
        </div>
        <div className="flex items-center space-x-1.5 text-[9px]">
          <span className="text-slate-500">APT:</span>
          <span className="text-slate-300">300mm</span>
        </div>
      </div>

      {/* Sensor Switcher */}
      <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 space-y-1.5">
        <div className="flex justify-between items-center text-[9px]">
          <label className="text-slate-400 font-bold flex items-center space-x-1">
            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            <span>SENSOR MODE</span>
          </label>
          <span className="text-slate-500">
            BAND: <span className="text-slate-200 font-bold">{currentSensor.band}</span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {SENSOR_SPECS.map((sensor) => {
            const isActive = sensorMode === sensor.id;
            let activeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-500/20';
            if (sensor.id === 1) activeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/20';
            if (sensor.id === 2) activeClass = 'bg-cyan-950/80 text-cyan-200 border-cyan-400/60 shadow-cyan-500/20';

            return (
              <button
                key={sensor.id}
                onClick={() => setSensorMode(sensor.id)}
                className={`py-1 px-1.5 rounded flex flex-col items-center justify-center space-y-0.5 border transition-all cursor-pointer ${
                  isActive
                    ? `${activeClass} shadow-sm`
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-current animate-ping' : 'bg-slate-600'}`} />
                  <span className="text-[9px] font-bold tracking-wider">{sensor.name}</span>
                </div>
                <span className="text-[7px] opacity-75 font-mono">{sensor.tag}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FOV & Gimbal Controls */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* FOV Zoom */}
        <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[9px] font-bold">
            <span className="text-slate-400 flex items-center space-x-1">
              <Eye className="w-2.5 h-2.5 text-cyan-400" />
              <span>FOV ZOOM</span>
            </span>
            <div className="flex items-center space-x-1">
              <span className="text-slate-500 text-[8px]">EFL:{focalLengthMm}mm</span>
              <span className="text-cyan-400 text-[10px] px-1 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30">
                {zoomFov}°
              </span>
            </div>
          </div>

          <input
            type="range"
            min="5"
            max="60"
            step="1"
            value={zoomFov}
            onChange={(e) => setZoomFov(parseInt(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
          />

          <div className="flex justify-between items-center">
            <div className="flex space-x-0.5">
              {[
                { fov: 15, label: '15°' },
                { fov: 30, label: '30°' },
                { fov: 45, label: '45°' },
                { fov: 60, label: '60°' },
              ].map(({ fov, label }) => (
                <button
                  key={fov}
                  onClick={() => setZoomFov(fov)}
                  className={`px-1 py-0.5 rounded text-[7px] font-mono border transition-all cursor-pointer ${
                    zoomFov === fov
                      ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[8px] text-slate-400 font-mono">
              IFOV:<span className="text-cyan-300 font-bold">{ifovMicroRad}</span>µrad
            </span>
          </div>
        </div>

        {/* Gimbal Speed */}
        <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-[9px] font-bold">
            <span className="text-slate-400 flex items-center space-x-1">
              <Gauge className="w-2.5 h-2.5 text-emerald-400" />
              <span>GIMBAL SPEED</span>
            </span>
            <span className="text-emerald-400 text-[10px] px-1 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30">
              {gimbalMaxVel}°/s
            </span>
          </div>

          <input
            type="range"
            min="30"
            max="300"
            step="10"
            value={gimbalMaxVel}
            onChange={(e) => setGimbalMaxVel(parseInt(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer h-1 bg-slate-950 rounded-lg appearance-none"
          />

          <div className="flex justify-between items-center">
            <div className="flex space-x-0.5">
              {[
                { vel: 60, label: '60' },
                { vel: 120, label: '120' },
                { vel: 240, label: '240' },
                { vel: 300, label: '300' },
              ].map(({ vel, label }) => (
                <button
                  key={vel}
                  onClick={() => setGimbalMaxVel(vel)}
                  className={`px-1 py-0.5 rounded text-[7px] font-mono border transition-all cursor-pointer ${
                    gimbalMaxVel === vel
                      ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[8px] text-slate-400 font-mono">
              <span className="text-emerald-300 font-bold">{(gimbalMaxVel * Math.PI / 180).toFixed(2)}</span>rad/s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
