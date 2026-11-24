import React, { useState } from 'react';
import {
  Users,
  MapPin,
  HeartPulse,
  Sliders,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Layers,
  Sparkles,
  Zap,
  Activity,
  Compass,
} from 'lucide-react';
import {
  BiometricState,
  DeviceSpecs,
  DisplayMode,
  FriendContact,
  MaterialFinish,
} from '../types/compass';
import { hapticAudio } from '../audio/hapticAudio';

interface BottomControlDockProps {
  specs: DeviceSpecs;
  friends: FriendContact[];
  targetFriend: FriendContact;
  biometrics: BiometricState;
  onSelectFriend: (friendId: string) => void;
  onChangeDistance: (meters: number) => void;
  onDoubleTapNeedle: () => void;
  onSetDisplayMode: (mode: DisplayMode) => void;
  onSetExploded: (progress: number) => void;
  onSetFinish: (finish: MaterialFinish) => void;
  onSetHeartRate: (bpm: number) => void;
  onSetStress: (stress: number) => void;
  onToggleHapticsMute: () => void;
  onSelectCamera: (preset: string) => void;
  onOpenMap: () => void;
  onSimulateEmergencyThreshold: () => void;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  specs,
  friends,
  targetFriend,
  biometrics,
  onSelectFriend,
  onChangeDistance,
  onDoubleTapNeedle,
  onSetDisplayMode,
  onSetExploded,
  onSetFinish,
  onSetHeartRate,
  onSetStress,
  onToggleHapticsMute,
  onSelectCamera,
  onOpenMap,
  onSimulateEmergencyThreshold,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'radar' | 'map' | 'vitals' | 'hardware'>('radar');

  const finishes: { id: MaterialFinish; label: string; color: string; desc: string }[] = [
    { id: 'titanium', label: 'Titanium', color: '#c8cdd4', desc: 'Grade 5 Brushed' },
    { id: 'obsidian', label: 'Obsidian', color: '#181a1f', desc: 'Satin Ceramic' },
    { id: 'rosegold', label: 'Rose Gold', color: '#e0a18a', desc: 'Luxury Finish' },
    { id: 'emerald', label: 'Emerald Glow', color: '#10b981', desc: 'Phosphor Edition' },
  ];

  const cameraPresets = [
    { id: 'front', label: 'Front Dial' },
    { id: 'perspective', label: '3D Studio' },
    { id: 'back', label: 'Rear Sensors' },
    { id: 'macro', label: 'Macro Needle' },
    { id: 'wear', label: 'Torque Cord' },
  ];

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-3 transition-transform duration-300 ease-out select-none ${
        isCollapsed ? 'translate-y-[calc(100%-42px)]' : 'translate-y-0'
      }`}
    >
      {/* Collapse / Expand Toggle Bar */}
      <div className="flex justify-center mb-1">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 px-4 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium shadow-lg backdrop-blur-md transition-all active:scale-95"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Zen / Cinema View</span>
            </>
          )}
        </button>
      </div>

      {/* Main Glassmorphic Dock Container */}
      <div className="bg-slate-900/90 border border-slate-700/70 rounded-3xl p-3.5 shadow-2xl backdrop-blur-xl">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => {
                setActiveTab('radar');
                onSetDisplayMode('compass');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'radar'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Friend Radar</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('map');
                onSetDisplayMode('map');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'map'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Vicinity Map</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('vitals');
                onSetDisplayMode('biometrics');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'vitals'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <HeartPulse className="w-3.5 h-3.5" />
              <span>Biometrics & EMS</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('hardware');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'hardware'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>3D Hardware</span>
            </button>
          </div>

          {/* Quick Haptic Sound Mute & Ping State */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleHapticsMute}
              className={`p-2 rounded-xl border text-xs transition-colors ${
                specs.hapticsMuted
                  ? 'bg-slate-800 text-slate-500 border-slate-700'
                  : 'bg-sky-500/10 text-sky-300 border-sky-500/30 hover:bg-sky-500/20'
              }`}
              title={specs.hapticsMuted ? 'Unmute haptic clicks' : 'Mute haptic audio'}
            >
              {specs.hapticsMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* TAB 1: RADAR & FRIENDS */}
        {activeTab === 'radar' && (
          <div className="space-y-3">
            {/* Friends Selector & Direct Double-Tap CTA */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Friends list */}
              <div className="md:col-span-7 flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                  Friend:
                </span>
                {friends.map((f) => {
                  const isSelected = f.id === targetFriend.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => onSelectFriend(f.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-left transition-all shrink-0 ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-400 text-white shadow-md shadow-sky-500/10'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          isSelected ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {f.initials}
                      </div>
                      <div>
                        <div className="text-xs font-semibold leading-none">{f.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">
                          {f.distanceMeters}m • {f.bearingDegrees}°
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Action Button: Double-Tap Needle to Reveal/Stow Arrow */}
              <div className="md:col-span-5 flex items-center gap-2 justify-end">
                <button
                  onClick={onDoubleTapNeedle}
                  className={`w-full py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 ${
                    specs.isDoubleTapPinging
                      ? 'bg-sky-500 text-white shadow-sky-500/30'
                      : 'bg-gradient-to-r from-sky-600 via-cyan-500 to-sky-500 hover:from-sky-500 hover:to-cyan-400 text-white shadow-cyan-500/25 ring-1 ring-white/20'
                  }`}
                >
                  {specs.isDoubleTapPinging ? <Zap className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-amber-200" />}
                  <span>
                    {specs.isDoubleTapPinging ? 'Arrow Active • Double-Tap to Stow' : 'Double-Tap Needle to Reveal Arrow'}
                  </span>
                </button>
              </div>
            </div>

            {/* Proximity Distance Slider (Shows how ping accelerates as you get closer) */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-3 flex flex-col md:flex-row items-center gap-4">
              <div className="w-full md:w-48 shrink-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    Proximity Radar
                  </span>
                  <span className="font-mono text-sky-400 font-bold">
                    {targetFriend.distanceMeters} meters
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Ping pulses intensify & accelerate closer to friend
                </p>
              </div>

              <div className="flex-1 w-full flex items-center gap-3">
                <span className="text-[10px] font-mono text-emerald-400 shrink-0">2m (Very Close)</span>
                <input
                  type="range"
                  min="2"
                  max="80"
                  step="1"
                  value={targetFriend.distanceMeters}
                  onChange={(e) => onChangeDistance(Number(e.target.value))}
                  className="w-full accent-sky-400 h-2 bg-slate-700 rounded-lg cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-400 shrink-0">80m (Far)</span>
              </div>

              <div className="hidden lg:block text-right shrink-0">
                <span className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Tip: Double-click 3D needle directly!
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VICINITY STREET MAP */}
        {activeTab === 'map' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3">
                <div className="text-[10px] font-mono text-sky-400 font-semibold uppercase">
                  Your Current Intersection
                </div>
                <div className="text-sm font-bold text-white mt-1">Corner of 5th Ave & Pine St</div>
                <div className="text-xs text-slate-400 mt-0.5">Crowd Density: Moderate (72 ppl/50m)</div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3">
                <div className="text-[10px] font-mono text-emerald-400 font-semibold uppercase">
                  {targetFriend.name}&apos;s Location
                </div>
                <div className="text-sm font-bold text-white mt-1">{targetFriend.streetCorner}</div>
                <div className="text-xs text-slate-400 mt-0.5">Distance: {targetFriend.distanceMeters} meters away</div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={onOpenMap}
                  className="w-full h-full min-h-[50px] py-2.5 px-4 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
                >
                  <MapPin className="w-4 h-4 text-sky-400" />
                  <span>Expand Vicinity Map & Share Corner</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REAL-TIME BIOMETRICS & EMS */}
        {activeTab === 'vitals' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Heart rate slider */}
              <div className="md:col-span-4 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                    Heart Rate
                  </span>
                  <span className="font-mono text-rose-400 font-bold">{biometrics.heartRate} BPM</span>
                </div>
                <input
                  type="range"
                  min="55"
                  max="165"
                  value={biometrics.heartRate}
                  onChange={(e) => onSetHeartRate(Number(e.target.value))}
                  className="w-full accent-rose-500 h-2 bg-slate-700 rounded-lg cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                  <span>60 Resting</span>
                  <span className="text-rose-400">&gt;130 Critical</span>
                </div>
              </div>

              {/* Stress score slider */}
              <div className="md:col-span-4 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    Stress Score
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{biometrics.stressLevel}%</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="98"
                  value={biometrics.stressLevel}
                  onChange={(e) => onSetStress(Number(e.target.value))}
                  className="w-full accent-amber-500 h-2 bg-slate-700 rounded-lg cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                  <span>20 Calm</span>
                  <span className="text-amber-400">&gt;80 Panic Alert</span>
                </div>
              </div>

              {/* Automated Emergency Trigger explanation & simulation button */}
              <div className="md:col-span-4 flex flex-col justify-between h-full">
                <button
                  onClick={onSimulateEmergencyThreshold}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-98"
                >
                  <Zap className="w-4 h-4" />
                  <span>Simulate Panic / Emergency Vitals</span>
                </button>
                <p className="text-[10px] text-slate-400 mt-1 text-center">
                  Auto-dispatches 911 & drops physical GPS coordinates to contacts
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 3D HARDWARE, FINISHES & EXPLODED VIEW */}
        {activeTab === 'hardware' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Exploded View Slider */}
              <div className="md:col-span-4 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Exploded Architecture
                  </span>
                  <span className="font-mono text-indigo-300 font-bold">
                    {Math.round(specs.explodedProgress * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={specs.explodedProgress}
                  onChange={(e) => onSetExploded(Number(e.target.value))}
                  className="w-full accent-indigo-400 h-2 bg-slate-700 rounded-lg cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                  <span>Assembled</span>
                  <span>Internal Layers</span>
                </div>
              </div>

              {/* Material Finishes */}
              <div className="md:col-span-4 flex items-center gap-1.5">
                {finishes.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onSetFinish(f.id)}
                    className={`flex-1 flex flex-col items-center justify-center p-2 rounded-2xl border text-center transition-all ${
                      specs.finish === f.id
                        ? 'bg-slate-800 border-sky-400 text-white shadow-md'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 mb-1"
                      style={{ backgroundColor: f.color }}
                    />
                    <span className="text-[11px] font-semibold leading-tight">{f.label}</span>
                  </button>
                ))}
              </div>

              {/* Camera Presets */}
              <div className="md:col-span-4 flex items-center gap-1 overflow-x-auto">
                {cameraPresets.map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => onSelectCamera(cam.id)}
                    className="flex-1 py-2 px-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-medium transition-colors text-center whitespace-nowrap"
                  >
                    {cam.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
