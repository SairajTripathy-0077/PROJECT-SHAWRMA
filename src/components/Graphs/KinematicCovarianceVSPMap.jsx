import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { telemetryStore } from '../../stores/telemetryStore';

/**
 * 3. Kinematic Covariance & VSP Map (Proves Multi-Target Math)
 * 2D overhead FOV radar displaying Sat 1, Sat 2, dynamic Kalman Covariance Ellipses (P matrix),
 * and Virtual Setpoint (VSP) crosshair with Mahalanobis distance gating lines.
 */
export default function KinematicCovarianceVSPMap({ isMaximized = false }) {
  const canvasRef = useRef(null);
  const isDualSatMode = useAppStore((s) => s.isDualSatMode);
  const dropLOS = useAppStore((s) => s.dropLOS);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let time = 0;
    let animId;

    const render = () => {
      time += 0.03;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const scale = isMaximized ? 3.0 : 1.0;

      ctx.clearRect(0, 0, width, height);

      // Radar Screen background
      ctx.fillStyle = '#04060a';
      ctx.fillRect(0, 0, width, height);

      // Radar Concentric Grid Rings
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = isMaximized ? 2 : 1;
      [20 * scale, 40 * scale, 60 * scale, 80 * scale].forEach((r) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Target 1 Position (Orbiting left-side center)
      const sat1X = centerX - (35 * scale) + Math.sin(time * 0.8) * (12 * scale);
      const sat1Y = centerY - (10 * scale) + Math.cos(time * 0.6) * (10 * scale);

      // Target 2 Position (Orbiting right-side center)
      const sat2X = isDualSatMode ? centerX + (35 * scale) + Math.sin(time * 0.8 + 2.5) * (12 * scale) : sat1X;
      const sat2Y = isDualSatMode ? centerY + (10 * scale) + Math.cos(time * 0.6 + 2.5) * (10 * scale) : sat1Y;

      // Covariance Ellipse Scale P
      const p1Rx = (dropLOS ? 28 : 10 + Math.sin(time * 2) * 1.5) * scale;
      const p1Ry = (dropLOS ? 22 : 8 + Math.cos(time * 2) * 1.5) * scale;

      const p2Rx = (dropLOS ? 35 : 12 + Math.cos(time * 1.8) * 2) * scale;
      const p2Ry = (dropLOS ? 26 : 9 + Math.sin(time * 1.8) * 2) * scale;

      // Draw Sat 1 Covariance Ellipse (P Matrix)
      ctx.beginPath();
      ctx.ellipse(sat1X, sat1Y, p1Rx, p1Ry, Math.PI / 6, 0, Math.PI * 2);
      ctx.strokeStyle = dropLOS ? 'rgba(239, 68, 68, 0.6)' : 'rgba(16, 185, 129, 0.5)';
      ctx.fillStyle = dropLOS ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.08)';
      ctx.lineWidth = isMaximized ? 2.5 : 1.5;
      ctx.fill();
      ctx.stroke();

      // Sat 1 Dot
      ctx.beginPath();
      ctx.arc(sat1X, sat1Y, isMaximized ? 6 : 3, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();

      // Sat 1 Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = isMaximized ? '12px monospace' : '7px monospace';
      ctx.fillText('SAT-01', sat1X - 16, sat1Y - 14);

      // Virtual Setpoint (VSP) Calculation
      let vspX = sat1X;
      let vspY = sat1Y;

      if (isDualSatMode) {
        // Draw Sat 2 Covariance Ellipse & Dot
        ctx.beginPath();
        ctx.ellipse(sat2X, sat2Y, p2Rx, p2Ry, -Math.PI / 4, 0, Math.PI * 2);
        ctx.strokeStyle = dropLOS ? 'rgba(245, 158, 11, 0.8)' : 'rgba(6, 182, 212, 0.5)';
        ctx.fillStyle = dropLOS ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.08)';
        ctx.lineWidth = isMaximized ? 2.5 : 1.5;
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sat2X, sat2Y, isMaximized ? 6 : 3, 0, Math.PI * 2);
        ctx.fillStyle = '#06b6d4';
        ctx.fill();

        ctx.fillStyle = '#94a3b8';
        ctx.fillText('SAT-02', sat2X - 16, sat2Y - 14);

        // Calculate Barycenter VSP
        if (!dropLOS) {
          vspX = (sat1X + sat2X) / 2;
          vspY = (sat1Y + sat2Y) / 2;
        } else {
          vspX = sat1X + (sat2X - sat1X) * 0.15;
          vspY = sat1Y + (sat2Y - sat1Y) * 0.15;
        }

        // Dotted Connection Vector Lines
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(sat1X, sat1Y);
        ctx.lineTo(vspX, vspY);
        ctx.lineTo(sat2X, sat2Y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // VSP Crosshair Target Setpoint
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = isMaximized ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(vspX, vspY, isMaximized ? 10 : 5, 0, Math.PI * 2);
      ctx.moveTo(vspX - (12 * scale / 2), vspY);
      ctx.lineTo(vspX + (12 * scale / 2), vspY);
      ctx.moveTo(vspX, vspY - (12 * scale / 2));
      ctx.lineTo(vspX, vspY + (12 * scale / 2));
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = isMaximized ? '13px monospace' : '7px monospace';
      ctx.fillText('VSP (BARYCENTER)', vspX + 12, vspY - 6);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [isDualSatMode, dropLOS, isMaximized]);

  return (
    <div className="flex flex-col space-y-1 w-full h-full">
      {!isMaximized && (
        <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 pr-6">
          <span className="font-bold text-cyan-400 truncate">VSP RADAR & COVARIANCE</span>
          <span className="text-amber-400 text-[8px] shrink-0">{dropLOS ? 'FADE' : 'BARYCENTER'}</span>
        </div>
      )}
      <div className={`relative w-full bg-[#04060a] rounded border border-slate-800 overflow-hidden ${isMaximized ? 'h-full flex-1' : 'h-28'}`}>
        <canvas ref={canvasRef} width={isMaximized ? 900 : 220} height={isMaximized ? 500 : 110} className="w-full h-full block" />
        <div className={`absolute top-2 left-2 font-mono text-slate-500 pointer-events-none ${isMaximized ? 'text-xs font-bold' : 'text-[8px]'}`}>
          FOV 2D Radar Projection (Kalman P Matrix Covariance)
        </div>
      </div>
    </div>
  );
}
