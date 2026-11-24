import React from 'react';
import { Compass, BatteryCharging, Radio, HeartPulse, AlertTriangle, Info, MapPin } from 'lucide-react';
import { BiometricState, EmergencyState, FriendContact } from '../types/compass';

interface TopHeaderProps {
  biometrics: BiometricState;
  emergency: EmergencyState;
  activeFriend: FriendContact;
  isArrowActive: boolean;
  onOpenSpecs: () => void;
  onTriggerSOS: () => void;
  onOpenMap: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  biometrics,
  emergency,
  activeFriend,
  isArrowActive,
  onOpenSpecs,
  onTriggerSOS,
  onOpenMap,
}) => {
  const isHighStress = biometrics.stressLevel > 75;
  const isEmergency = emergency.isActive;

  return (
    <header className="absolute top-0 left-0 right-0 z-30 pointer-events-none p-4 md:p-6 flex items-start justify-between">
      {/* Brand & Hardware Identity */}
      <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/80 border border-slate-700/60 rounded-2xl px-4 py-2.5 backdrop-blur-md shadow-xl">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
          <Compass className="w-6 h-6 stroke-[2.2]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              COMPASS
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                CORE C-1
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-medium hidden sm:block">
            Wearable Crowd Navigation & Biometric Pendant
          </p>
        </div>
      </div>

      {/* Center Telemetry & Street Corner pill */}
      <div className="hidden lg:flex pointer-events-auto items-center gap-2 bg-slate-900/80 border border-slate-700/60 rounded-2xl px-3.5 py-2 backdrop-blur-md text-xs shadow-xl">
        <button
          onClick={onOpenMap}
          className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 font-medium px-2 py-1 rounded-lg hover:bg-sky-500/10 transition-colors"
          title="Click to view full vicinity map"
        >
          <MapPin className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-mono text-slate-200">Corner: 5th Ave & Pine St</span>
        </button>

        <span className="w-px h-4 bg-slate-700" />

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-colors ${
          isArrowActive
            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
            : 'bg-slate-800 text-slate-400 border border-slate-700/60'
        }`}>
          <span>{isArrowActive ? '⚡ Arrow: Deployed' : '○ Arrow: Retracted'}</span>
        </div>

        <span className="w-px h-4 bg-slate-700" />

        <div className="flex items-center gap-1.5 text-emerald-400 px-2 py-1">
          <Radio className="w-3.5 h-3.5" />
          <span className="font-mono text-slate-300">UWB 8.0GHz Lock</span>
        </div>

        <span className="w-px h-4 bg-slate-700" />

        <div className={`flex items-center gap-1.5 px-2 py-1 ${isHighStress ? 'text-amber-400' : 'text-slate-300'}`}>
          <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
          <span className="font-mono font-medium">{biometrics.heartRate} BPM</span>
        </div>

        <span className="w-px h-4 bg-slate-700" />

        <div className="flex items-center gap-1.5 text-slate-300 px-2 py-1">
          <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono">94%</span>
        </div>
      </div>

      {/* Right Action Buttons */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          onClick={onOpenSpecs}
          className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-xl px-3 py-2 text-xs font-medium backdrop-blur-md transition-all shadow-md active:scale-95"
          title="Hardware Specifications & Architecture"
        >
          <Info className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline">Hardware Specs</span>
        </button>

        <button
          onClick={onTriggerSOS}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-lg active:scale-95 ${
            isEmergency
              ? 'bg-red-600 text-white animate-pulse shadow-red-600/40'
              : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
          }`}
          title="Simulate Emergency SOS Alert trigger"
        >
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{isEmergency ? 'SOS ACTIVE' : 'TEST SOS'}</span>
        </button>
      </div>
    </header>
  );
};
