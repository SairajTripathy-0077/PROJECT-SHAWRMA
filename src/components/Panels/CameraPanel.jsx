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
      band: '400-700nm Optical',
      tag: 'Visible Spectrum',
      desc: 'High-definition optical RGB imaging for daylight acquisition & visual satellite identification.',
      temp: '295 K (Ambient)',
      accent: 'cyan'
    },
    {
      id: 1,
      name: 'SWIR THERMAL',
      band: '1550nm InGaAs',
      tag: 'Short-Wave IR',
      desc: 'Atmospheric penetration through thin cirrus clouds & optical laser beacon wavelength matching.',
      temp: '190 K (Thermoelectric)',
      accent: 'amber'
    },
    {
      id: 2,
      name: 'WHITE-HOT',
      band: '3-5µm MWIR FLIR',
      tag: 'Mid-Wave FLIR',
      desc: 'High-contrast thermal radiance for day/night target lock & extreme solar glare suppression.',
      temp: '77 K (Stirling Cryo)',
      accent: 'indigo'
    }
  ];

  const currentSensor = SENSOR_SPECS[sensorMode] || SENSOR_SPECS[0];

  return (
    <div
      className="space-y-3 font-mono text-xs select-auto pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between text-cyan-400 font-bold border-b border-slate-800 pb-1.5">
        <div className="flex items-center space-x-2">
          <Camera className="w-4 h-4" />
          <span>02. CAMERA & SENSOR OPTICAL CONTROLS</span>
        </div>
        <div className="flex items-center space-x-2 text-[10px]">
          <span className="text-slate-500">APERTURE:</span>
          <span className="text-slate-300">300mm Cassegrain</span>
        </div>
      </div>

      {/* Multi-Spectral Sensor Feed Switcher */}
      <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-2">
        <div className="flex justify-between items-center text-[10px]">
          <label className="text-slate-400 font-bold flex items-center space-x-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>MULTI-SPECTRAL SENSOR FEED</span>
          </label>
          <span className="text-slate-500">
            ACTIVE BAND: <span className="text-slate-200 font-bold">{currentSensor.band}</span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {SENSOR_SPECS.map((sensor) => {
            const isActive = sensorMode === sensor.id;
            let activeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-500/20';
            if (sensor.id === 1) activeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/20';
            if (sensor.id === 2) activeClass = 'bg-cyan-950/80 text-cyan-200 border-cyan-400/60 shadow-cyan-500/20';

            return (
              <button
                key={sensor.id}
                onClick={() => setSensorMode(sensor.id)}
                className={`py-2 px-2 rounded flex flex-col items-center justify-center space-y-0.5 border transition-all cursor-pointer ${
                  isActive
                    ? `${activeClass} shadow-md`
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-current animate-ping' : 'bg-slate-600'}`} />
                  <span className="text-[11px] font-bold tracking-wider">{sensor.name}</span>
                </div>
                <span className="text-[8px] opacity-75 font-mono">{sensor.tag}</span>
              </button>
            );
          })}
        </div>

        {/* Active Sensor Live Details */}
        <div className="bg-slate-950/90 p-2 rounded border border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
          <p className="line-clamp-1 max-w-[70%] text-slate-300">
            {currentSensor.desc}
          </p>
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-slate-500">DETECTOR TEMP:</span>
            <span className="text-amber-400 font-bold">{currentSensor.temp}</span>
          </div>
        </div>
      </div>

      {/* Optical Controls: FOV Zoom & Max Velocity */}
      <div className="grid grid-cols-2 gap-2">
        {/* Optical Zoom FOV Controller */}
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-slate-400 flex items-center space-x-1">
              <Eye className="w-3 h-3 text-cyan-400" />
              <span>OPTICAL FOV ZOOM</span>
            </span>
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500 text-[9px]">EFL: {focalLengthMm}mm</span>
              <span className="text-cyan-400 text-xs px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30">
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
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg appearance-none"
          />

          <div className="flex justify-between items-center pt-0.5">
            <div className="flex space-x-1">
              {[
                { fov: 15, label: '15° NARROW' },
                { fov: 30, label: '30° MED' },
                { fov: 45, label: '45° NOM' },
                { fov: 60, label: '60° WIDE' },
              ].map(({ fov, label }) => (
                <button
                  key={fov}
                  onClick={() => setZoomFov(fov)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-mono border transition-all cursor-pointer ${
                    zoomFov === fov
                      ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[9px] text-slate-400 font-mono">
              IFOV: <span className="text-cyan-300 font-bold">{ifovMicroRad}</span> µrad/px
            </span>
          </div>
        </div>

        {/* Gimbal Slew Max Velocity Controller */}
        <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-slate-400 flex items-center space-x-1">
              <Gauge className="w-3 h-3 text-emerald-400" />
              <span>GIMBAL MAX VELOCITY</span>
            </span>
            <span className="text-emerald-400 text-xs px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30">
              {gimbalMaxVel} °/s
            </span>
          </div>

          <input
            type="range"
            min="30"
            max="300"
            step="10"
            value={gimbalMaxVel}
            onChange={(e) => setGimbalMaxVel(parseInt(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg appearance-none"
          />

          <div className="flex justify-between items-center pt-0.5">
            <div className="flex space-x-1">
              {[
                { vel: 60, label: '60°/s PREC' },
                { vel: 120, label: '120°/s STD' },
                { vel: 240, label: '240°/s FAST' },
                { vel: 300, label: '300°/s MAX' },
              ].map(({ vel, label }) => (
                <button
                  key={vel}
                  onClick={() => setGimbalMaxVel(vel)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-mono border transition-all cursor-pointer ${
                    gimbalMaxVel === vel
                      ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[9px] text-slate-400 font-mono">
              LIMIT: <span className="text-emerald-300 font-bold">{(gimbalMaxVel * Math.PI / 180).toFixed(2)}</span> rad/s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
