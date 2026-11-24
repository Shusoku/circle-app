import React, { useState } from 'react';
import { X, MapPin, Navigation, Share2, Users, Layers, Check, Compass, ShieldAlert } from 'lucide-react';
import { FriendContact } from '../types/compass';

interface VicinityMapOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  targetFriend: FriendContact;
  friends: FriendContact[];
  onSelectFriend: (id: string) => void;
}

export const VicinityMapOverlay: React.FC<VicinityMapOverlayProps> = ({
  isOpen,
  onClose,
  targetFriend,
  friends,
  onSelectFriend,
}) => {
  const [copiedCorner, setCopiedCorner] = useState(false);
  const [showCrowdHeat, setShowCrowdHeat] = useState(true);

  if (!isOpen) return null;

  const currentCorner = 'Corner of 5th Ave & Pine St';

  const handleShareCorner = () => {
    setCopiedCorner(true);
    navigator.clipboard?.writeText?.(
      `I'm waiting at the ${currentCorner}! Track my Compass beacon at 37.7749° N, 122.4194° W`
    );
    setTimeout(() => setCopiedCorner(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Vicinity Street Corner Radar
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live GPS + UWB
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Identify your exact street intersection to guide friends through crowds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Street Corner Visualizer */}
        <div className="relative flex-1 min-h-[340px] bg-[#070c14] overflow-hidden p-6 flex flex-col justify-between">
          {/* Subtle Grid / Street Background */}
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />

          {/* City Street Blocks & Intersections */}
          <div className="relative w-full h-[280px] rounded-2xl bg-slate-950/80 border border-slate-800/80 overflow-hidden shadow-inner flex items-center justify-center">
            {/* Street Lines */}
            {/* 5th Ave (North-South) */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-16 bg-slate-800/40 border-x border-slate-700/50 flex flex-col justify-around items-center">
              <span className="text-[10px] font-mono text-slate-500 rotate-90 tracking-widest">5TH AVENUE</span>
              <div className="w-0.5 h-full border-r border-dashed border-sky-500/30" />
              <span className="text-[10px] font-mono text-slate-500 rotate-90 tracking-widest">5TH AVENUE</span>
            </div>

            {/* Pine St (East-West) */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-16 bg-slate-800/40 border-y border-slate-700/50 flex items-center justify-around">
              <span className="text-[10px] font-mono text-slate-500 tracking-widest">PINE STREET</span>
              <div className="h-0.5 w-full border-b border-dashed border-sky-500/30" />
              <span className="text-[10px] font-mono text-slate-500 tracking-widest">PINE STREET</span>
            </div>

            {/* Market St (Lower East-West) */}
            <div className="absolute left-0 right-0 bottom-4 h-12 bg-slate-800/30 border-y border-slate-700/40 flex items-center justify-around">
              <span className="text-[9px] font-mono text-slate-600 tracking-widest">MARKET STREET</span>
            </div>

            {/* Crowd Heat Density Overlay */}
            {showCrowdHeat && (
              <>
                {/* Choke point crowd */}
                <div className="absolute top-8 right-16 w-32 h-32 rounded-full bg-red-500/20 blur-xl pointer-events-none" />
                <div className="absolute bottom-6 left-12 w-28 h-28 rounded-full bg-amber-500/20 blur-lg pointer-events-none" />
                <div className="absolute top-12 left-20 px-2 py-1 rounded bg-red-950/80 border border-red-500/40 text-[9px] font-mono text-red-300">
                  Dense Crowd Alert (Festival Stage)
                </div>
              </>
            )}

            {/* Connection Vector between User & Target Friend */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <line
                x1="50%"
                y1="50%"
                x2="68%"
                y2="76%"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeDasharray="4 4"
                className="animate-pulse"
              />
            </svg>

            {/* Center Intersection: YOU ARE HERE */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-sky-500/30 animate-ping absolute inset-0" />
                <div className="w-8 h-8 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center shadow-lg shadow-sky-500/50">
                  <Navigation className="w-4 h-4 text-white fill-white rotate-45" />
                </div>
              </div>
              <div className="mt-1 px-2.5 py-1 rounded-md bg-slate-900/90 border border-sky-400 text-[10px] font-mono text-sky-300 font-bold shadow-md whitespace-nowrap">
                YOU (Corner of 5th & Pine)
              </div>
            </div>

            {/* Friend 1: Maya */}
            <div
              onClick={() => onSelectFriend('f1')}
              className="absolute top-[76%] left-[68%] -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-full bg-cyan-600 border-2 border-cyan-300 flex items-center justify-center text-white text-[11px] font-bold shadow-md group-hover:scale-110 transition-transform">
                M
              </div>
              <div className="mt-1 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[9px] font-mono text-cyan-300 whitespace-nowrap">
                Maya (14m • Market & 4th)
              </div>
            </div>

            {/* Friend 2: Leo */}
            <div
              onClick={() => onSelectFriend('f2')}
              className="absolute top-[28%] left-[28%] -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600 border-2 border-indigo-300 flex items-center justify-center text-white text-[11px] font-bold shadow-md group-hover:scale-110 transition-transform">
                L
              </div>
              <div className="mt-1 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[9px] font-mono text-indigo-300 whitespace-nowrap">
                Leo (48m • 4th & Pine)
              </div>
            </div>
          </div>

          {/* Bottom Card: Street Corner Share & Distance */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-mono text-sky-400 font-semibold uppercase">
                  Tell your friends your street corners:
                </div>
                <div className="text-base font-bold text-white mt-0.5 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-400" />
                  {currentCorner}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Target: {targetFriend.name} is at {targetFriend.streetCorner} ({targetFriend.distanceMeters}m away)
                </div>
              </div>

              <button
                onClick={handleShareCorner}
                className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0 ${
                  copiedCorner
                    ? 'bg-emerald-600 text-white'
                    : 'bg-sky-500 hover:bg-sky-400 text-white'
                }`}
              >
                {copiedCorner ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedCorner ? 'Copied Link!' : 'Drop Corner'}</span>
              </button>
            </div>

            <div className="md:col-span-4 bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-300">Crowd Heat Map</div>
                <div className="text-[11px] text-slate-400">Identify clear navigation corridors</div>
              </div>
              <button
                onClick={() => setShowCrowdHeat(!showCrowdHeat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  showCrowdHeat
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-700 text-slate-400 border-slate-600'
                }`}
              >
                {showCrowdHeat ? 'Density ON' : 'Density OFF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
