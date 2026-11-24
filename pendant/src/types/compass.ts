export type DisplayMode = 'compass' | 'map' | 'biometrics' | 'emergency';

export type MaterialFinish = 'titanium' | 'obsidian' | 'rosegold' | 'emerald';

export interface FriendContact {
  id: string;
  name: string;
  avatar: string;
  initials: string;
  distanceMeters: number;
  bearingDegrees: number; // Angle relative to compass north
  streetCorner: string;
  status: 'online' | 'moving' | 'stationary';
  battery: number;
  phone: string;
  isEmergencyContact: boolean;
}

export interface BiometricState {
  heartRate: number; // BPM (normal 60-95, high > 125)
  stressLevel: number; // 0 - 100 (normal < 55, critical > 80)
  hrv: number; // ms
  skinTemp: number; // Celsius (e.g. 36.6)
  ecgHistory: number[]; // real-time wave points
  lastReadingTimestamp: number;
}

export interface EmergencyState {
  isActive: boolean;
  countdown: number; // seconds remaining before dispatch (e.g. 10 -> 0)
  dispatched: boolean;
  reason: 'stress_threshold' | 'heart_rate_threshold' | 'manual_sos' | 'fall_detected' | null;
  notifiedContacts: string[];
  dispatchedTimestamp?: string;
  emergencyCoords: {
    lat: number;
    lng: number;
    streetCorner: string;
  };
}

export interface DeviceSpecs {
  finish: MaterialFinish;
  explodedProgress: number; // 0 (assembled) to 1 (fully exploded)
  displayMode: DisplayMode;
  hapticsMuted: boolean;
  selectedFriendId: string;
  isDoubleTapPinging: boolean;
  hapticIntensity: number; // 0 to 1
  wireframe: boolean;
  showInternals: boolean;
}
