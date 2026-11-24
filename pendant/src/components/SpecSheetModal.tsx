import React from 'react';
import { X, Cpu, Zap, Activity, Radio, Shield, Battery, Eye } from 'lucide-react';

interface SpecSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpecSheetModal: React.FC<SpecSheetModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const specs = [
    {
      category: 'Crowd Navigation & Radar',
      icon: Radio,
      items: [
        { label: 'Ultra-Wideband (UWB)', value: 'Channel 5 & 9 (6.5GHz – 8.0GHz) with ±8cm spatial accuracy' },
        { label: 'Tactile Jewel Bearing', value: 'Double-tap capacitive sensor with sapphire pivot dome' },
        { label: 'Haptic Resonance Engine', value: 'High-G dual-axis Linear Resonant Actuator (LRA) pulsing up to 180Hz' },
        { label: 'Proximity Curve', value: 'Inverse exponential haptic feedback scaling from 80m down to 0.5m' },
        { label: 'Vicinity Corner Mapping', value: 'Real-time vector GIS projection with street intersection lookup' },
      ],
    },
    {
      category: 'Biometric Safety & EMS Trigger',
      icon: Activity,
      items: [
        { label: 'Photoplethysmography (PPG)', value: 'Dual 525nm green + 940nm infra-red optical emitter cluster' },
        { label: 'Electrodermal Activity (EDA)', value: 'Micro-amp skin conductance sensor for sympathetic stress response' },
        { label: 'Automated SOS Threshold', value: 'Auto-triggers emergency broadcast when HR > 130 BPM or Stress > 80%' },
        { label: 'EMS Dispatch Pipeline', value: 'Instant GPS + UWB location drop with 10-second safety cancel abort' },
      ],
    },
    {
      category: 'Materials & Physical Architecture',
      icon: Shield,
      items: [
        { label: 'Pendant Chassis', value: 'Aerospace Grade 5 Titanium (Ti-6Al-4V) / Obsidian Ceramic' },
        { label: 'Optical Lens', value: 'Curved monocrystalline sapphire crystal (Mohs hardness 9)' },
        { label: 'Necklace Cord', value: 'Ergonomic hypoallergenic liquid silicone torque cord with neodymium clasp' },
        { label: 'Water Resistance', value: '5 ATM (50 meters ISO 22810:2010 certified)' },
        { label: 'Micro-OLED Display', value: '1.2-inch circular OLED, 454×454 resolution, 1000 nits peak brightness' },
      ],
    },
    {
      category: 'Battery & Power',
      icon: Battery,
      items: [
        { label: 'Cell Type', value: 'Custom shaped 280mAh Solid-State Lithium Polymer' },
        { label: 'Battery Runtime', value: '72 hours continuous crowd tracking / 14 days low-power standby' },
        { label: 'Charging Dock', value: 'Magnetic rear pogo ring (0 to 80% in 22 minutes)' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Compass Core C-1 Hardware Blueprint
              </h2>
              <p className="text-xs text-slate-400">Industrial architecture, sensor stack & radio specifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Specs List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {specs.map((group, idx) => {
            const Icon = group.icon;
            return (
              <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider mb-3">
                  <Icon className="w-4 h-4" />
                  <span>{group.category}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                      <div className="text-[10px] font-mono text-slate-400 uppercase">{item.label}</div>
                      <div className="text-xs font-semibold text-slate-200 mt-0.5">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
