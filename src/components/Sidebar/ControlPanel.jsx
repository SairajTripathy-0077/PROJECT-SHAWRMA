import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import EnvironmentPanel from '../Panels/EnvironmentPanel';
import CameraPanel from '../Panels/CameraPanel';
import DetectionPanel from '../Panels/DetectionPanel';
import TrackingPanel from '../Panels/TrackingPanel';
import AnalyticsPanel from '../Panels/AnalyticsPanel';
import DisturbanceLab from '../Panels/DisturbanceLab';
import ReportsPanel from '../Panels/ReportsPanel';
import SettingsPanel from '../Panels/SettingsPanel';

export default function ControlPanel() {
  const { activeTab } = useAppStore();

  const renderActivePanel = () => {
    switch (activeTab) {
      case 'ORBIT & BIOME':
        return <EnvironmentPanel />;
      case 'OPTICAL SENSORS':
        return <CameraPanel />;
      case 'KALMAN & PID DECK':
        return <TrackingPanel />;
      case 'OPTICAL LINK BUDGET':
        return <AnalyticsPanel />;
      case 'DISTURBANCE LAB':
        return <DisturbanceLab />;
      case 'BENCHMARK LOGS':
        return <ReportsPanel />;
      case 'SYSTEM MATRIX':
        return <SettingsPanel />;
      default:
        return <EnvironmentPanel />;
    }
  };

  return (
    <div
      className="bg-[#07090e]/95 border border-slate-800 p-4 rounded-xl shadow-2xl backdrop-blur-xl transition-all relative z-50 pointer-events-auto select-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {renderActivePanel()}
    </div>
  );
}
