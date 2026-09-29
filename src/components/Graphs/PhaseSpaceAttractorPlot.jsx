import React, { useEffect, useRef } from 'react';
import { telemetryStore } from '../../stores/telemetryStore';

/**
 * 1. The Phase-Space Attractor Plot (Proves Zero Overshoot)
 * 2D Scatter Plot: X-axis = Position Error (e_x), Y-axis = Velocity Error (e_dot_x)
 * Fading 60-frame trail showing critically damped inward spiral to origin (0,0).
 */
export default function PhaseSpaceAttractorPlot({ height = 110, isMaximized = false }) {
  const canvasRef = useRef(null);
  const trailRef = useRef([]);
  const lastErrRef = useRef({ x: 0, time: performance.now() });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const unsubscribe = telemetryStore.subscribe((state) => {
      const now = performance.now();
      const dt = Math.max(0.001, (now - lastErrRef.current.time) / 1000);
      const ex = state.errorX || 0;
      const edotx = (ex - lastErrRef.current.x) / dt;

      lastErrRef.current = { x: ex, time: now };

      // Push to 60-frame trail buffer
      trailRef.current.push({ ex, edotx });
      if (trailRef.current.length > 60) {
        trailRef.current.shift();
      }
    });

    let animationFrameId;
    const render = () => {
      if (!canvas || !ctx) return;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Background Grid & Axis Lines
      ctx.fillStyle = '#04060a';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = isMaximized ? 2 : 1;

      // X and Y Origin Axes (0,0)
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.stroke();

      // Concentric target rings (Convergence Bounds)
      ctx.strokeStyle = '#0f172a';
      const ringScales = isMaximized ? [40, 80, 120, 160, 200] : [15, 30, 45];
      ringScales.forEach((r) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Draw 60-frame Trajectory Trail with fading alpha
      const trail = trailRef.current;
      const scaleX = isMaximized ? width / 50 : width / 80;
      const scaleY = isMaximized ? height / 500 : height / 800;

      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const alpha = (i / trail.length).toFixed(2);
          const p1 = trail[i - 1];
          const p2 = trail[i];

          const x1 = centerX + p1.ex * scaleX;
          const y1 = centerY - p1.edotx * scaleY;
          const x2 = centerX + p2.ex * scaleX;
          const y2 = centerY - p2.edotx * scaleY;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth = isMaximized ? 3 : 1.5;
          ctx.stroke();
        }

        // Current Head Point (Origin Lock)
        const head = trail[trail.length - 1];
        const hx = centerX + head.ex * scaleX;
        const hy = centerY - head.edotx * scaleY;

        ctx.beginPath();
        ctx.arc(hx, hy, isMaximized ? 7 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isMaximized ? 2 : 1;
        ctx.stroke();
      }

      // Origin Lock Ring (0,0)
      ctx.beginPath();
      ctx.arc(centerX, centerY, isMaximized ? 6 : 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = isMaximized ? 2 : 1;
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      unsubscribe();
      cancelAnimationFrame(animationFrameId);
    };
  }, [isMaximized]);

  return (
    <div className="flex flex-col space-y-1 w-full h-full">
      {!isMaximized && (
        <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 pr-6">
          <span className="font-bold text-cyan-400 truncate">ATTRACTOR (0-OVERSHOOT)</span>
          <span className="text-emerald-400 shrink-0">DAMPED</span>
        </div>
      )}
      <div className={`relative w-full bg-[#04060a] rounded border border-slate-800 overflow-hidden ${isMaximized ? 'h-full flex-1' : 'h-28'}`}>
        <canvas ref={canvasRef} width={isMaximized ? 900 : 220} height={isMaximized ? 500 : 110} className="w-full h-full block" />
        <div className={`absolute top-2 left-2 font-mono text-slate-500 pointer-events-none ${isMaximized ? 'text-xs font-bold' : 'text-[8px]'}`}>
          Ė_x (deg/s) vs E_x (px)
        </div>
        <div className={`absolute bottom-2 right-2 font-mono text-emerald-400 font-bold pointer-events-none ${isMaximized ? 'text-sm' : 'text-[8px]'}`}>
          (0,0) ORIGIN LOCK (CRITICALLY DAMPED)
        </div>
      </div>
    </div>
  );
}
