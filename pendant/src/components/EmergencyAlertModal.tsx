import React, { useEffect } from 'react';
import { AlertTriangle, ShieldAlert, PhoneCall, MapPin, CheckCircle2, XCircle, HeartPulse, BellRing } from 'lucide-react';
import { BiometricState, EmergencyState, FriendContact } from '../types/compass';
import { hapticAudio } from '../audio/hapticAudio';

interface EmergencyAlertModalProps {
  emergency: EmergencyState;
  biometrics: BiometricState;
  friends: FriendContact[];
  onCancelEmergency: () => void;
  onConfirmImmediateDispatch: () => void;
}

export const EmergencyAlertModal: React.FC<EmergencyAlertModalProps> = ({
  emergency,
  biometrics,
  friends,
  onCancelEmergency,
  onConfirmImmediateDispatch,
}) => {
  useEffect(() => {
    if (emergency.isActive && !emergency.dispatched) {
      hapticAudio.playEmergencyBeep(false);
    } else if (emergency.isActive && emergency.dispatched) {
      hapticAudio.playEmergencyBeep(true);
    }
  }, [emergency.isActive, emergency.countdown, emergency.dispatched]);

  if (!emergency.isActive) return null;

  const isCountingDown = emergency.countdown > 0 && !emergency.dispatched;
  const emergencyContacts = friends.filter((f) => f.isEmergencyContact || f.id === 'f1');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-xl bg-slate-950 border-2 border-red-500/80 rounded-3xl overflow-hidden shadow-2xl shadow-red-900/50">
        {/* Top Emergency Warning Header */}
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <ShieldAlert className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">
                {isCountingDown ? 'CRITICAL BIOMETRIC ALERT' : 'EMS & CONTACTS DISPATCHED'}
              </h2>
              <p className="text-xs text-red-100 font-medium">
                {isCountingDown ? 'Automated Safety Protocol Engaged' : 'Emergency Assistance En Route'}
              </p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-black/30 font-mono text-xs font-bold uppercase tracking-wider">
            911 SOS
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Countdown or Dispatched Status */}
          {isCountingDown ? (
            <div className="bg-red-950/40 border border-red-500/40 rounded-2xl p-5 text-center">
              <span className="text-xs font-mono font-bold text-red-300 uppercase tracking-widest">
                Auto-Dispatch In
              </span>
              <div className="text-7xl font-extrabold font-mono text-red-500 my-1 animate-pulse">
                {emergency.countdown}
              </div>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Vitals exceed safe threshold: <span className="font-bold text-red-400">{biometrics.heartRate} BPM</span> &{' '}
                <span className="font-bold text-amber-400">{biometrics.stressLevel}% Stress</span>.
                Emergency personnel and family are being alerted.
              </p>
            </div>
          ) : (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-base">
                <CheckCircle2 className="w-5 h-5" />
                <span>Live Location Dropped to Responders</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Local 911 dispatch center and emergency contacts received exact coordinates.
              </p>
            </div>
          )}

          {/* Dropped Location & Street Corner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-sky-400" />
                Physical Location Dropped
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">GPS + UWB ACCURATE</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">
                  {emergency.emergencyCoords.streetCorner}
                </div>
                <div className="text-xs font-mono text-slate-400 mt-0.5">
                  Lat: {emergency.emergencyCoords.lat.toFixed(5)}° N, Lng: {emergency.emergencyCoords.lng.toFixed(5)}° W
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 text-xs font-mono border border-sky-500/30">
                ±1.5m radius
              </div>
            </div>
          </div>

          {/* Contacts receiving the broadcast */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-amber-400" />
                Emergency Contacts Reached
              </span>
              <span className="text-[11px] font-mono text-slate-500">Auto SMS + Ring</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-rose-600/30 text-rose-300 flex items-center justify-center font-bold text-[10px]">
                    911
                  </div>
                  <div>
                    <span className="font-semibold text-white">Metro Emergency Dispatch (EMS)</span>
                    <div className="text-[10px] text-slate-400 font-mono">Priority 1 Medical Protocol</div>
                  </div>
                </div>
                <span className="text-emerald-400 font-mono text-[11px] font-bold">
                  {isCountingDown ? 'Queued' : 'Dispatched'}
                </span>
              </div>

              {emergencyContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[10px]">
                      {contact.initials}
                    </div>
                    <div>
                      <span className="font-medium text-slate-200">{contact.name}</span>
                      <span className="text-[10px] text-slate-500 ml-1.5">({contact.phone})</span>
                    </div>
                  </div>
                  <span className="text-sky-400 font-mono text-[11px]">
                    {isCountingDown ? 'Armed' : 'Location Sent'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons: Cancel vs Immediate Dispatch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={onCancelEmergency}
              className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700 active:scale-98"
            >
              <XCircle className="w-4 h-4 text-slate-400" />
              <span>I&apos;m Safe / Cancel Alert</span>
            </button>

            {isCountingDown ? (
              <button
                onClick={onConfirmImmediateDispatch}
                className="py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/40 transition-all active:scale-98"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Dispatch EMS Now</span>
              </button>
            ) : (
              <button
                onClick={onCancelEmergency}
                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>All Responders Stand Down</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
