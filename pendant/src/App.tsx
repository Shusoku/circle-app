import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CompassCanvas3D } from './components/CompassCanvas3D';
import { TopHeader } from './components/TopHeader';
import { BottomControlDock } from './components/BottomControlDock';
import { VicinityMapOverlay } from './components/VicinityMapOverlay';
import { EmergencyAlertModal } from './components/EmergencyAlertModal';
import { SpecSheetModal } from './components/SpecSheetModal';
import {
  BiometricState,
  DeviceSpecs,
  DisplayMode,
  EmergencyState,
  FriendContact,
  MaterialFinish,
} from './types/compass';
import { hapticAudio } from './audio/hapticAudio';
import { PairPanel } from './components/PairPanel';
import { useCircleLink, LinkState } from './live/useCircleLink';

// Turns what the Circle server says into the shapes the pendant already uses.
function friendsFromLink(st: LinkState): FriendContact[] {
  const list: FriendContact[] = st.friends.map((f) => ({
    id: f.id,
    name: f.name,
    avatar: '',
    initials: f.initials,
    distanceMeters: f.meters ?? 999,
    bearingDegrees: Math.round(f.bearing ?? 0),
    streetCorner: f.area || f.band,
    status: f.last === 'Live' ? 'moving' : 'stationary',
    battery: 100,
    phone: 'via Circle',
    isEmergencyContact: true,
  }));
  if (st.target?.kind === 'dest') {
    list.unshift({
      id: 'dest', name: st.target.name, avatar: '', initials: 'GO',
      distanceMeters: st.target.meters ?? 0, bearingDegrees: Math.round(st.target.bearing ?? 0),
      streetCorner: 'Phone free walk', status: 'stationary', battery: 100, phone: '', isEmergencyContact: false,
    });
  }
  return list;
}

const NOBODY: FriendContact = {
  id: 'none', name: 'No one yet', avatar: '', initials: '?', distanceMeters: 999, bearingDegrees: 0,
  streetCorner: 'Join a circle in the phone app', status: 'stationary', battery: 0, phone: '', isEmergencyContact: false,
};

const INITIAL_FRIENDS: FriendContact[] = [
  {
    id: 'f1',
    name: 'Maya Chen',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
    initials: 'MC',
    distanceMeters: 14,
    bearingDegrees: 34, // North-North-East
    streetCorner: 'Corner of Market St & 4th St',
    status: 'moving',
    battery: 88,
    phone: '+1 (555) 234-8901',
    isEmergencyContact: true,
  },
  {
    id: 'f2',
    name: 'Leo Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
    initials: 'LV',
    distanceMeters: 48,
    bearingDegrees: 145, // South-East
    streetCorner: 'Corner of Mission St & 5th St',
    status: 'online',
    battery: 92,
    phone: '+1 (555) 892-4112',
    isEmergencyContact: true,
  },
  {
    id: 'f3',
    name: 'Chloe Rivera',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80',
    initials: 'CR',
    distanceMeters: 75,
    bearingDegrees: 290, // West-North-West
    streetCorner: 'Corner of Powell St & Geary St',
    status: 'stationary',
    battery: 64,
    phone: '+1 (555) 441-9032',
    isEmergencyContact: false,
  },
];

export default function App() {
  const [friends, setFriends] = useState<FriendContact[]>(INITIAL_FRIENDS);
  const [selectedFriendId, setSelectedFriendId] = useState<string>('f1');

  const [specs, setSpecs] = useState<DeviceSpecs>({
    finish: 'titanium',
    explodedProgress: 0,
    displayMode: 'compass',
    hapticsMuted: false,
    selectedFriendId: 'f1',
    isDoubleTapPinging: false, // Initially false so arrow is hidden until double tapped
    hapticIntensity: 0.8,
    wireframe: false,
    showInternals: false,
  });

  const [biometrics, setBiometrics] = useState<BiometricState>({
    heartRate: 74,
    stressLevel: 32,
    hrv: 64,
    skinTemp: 36.8,
    ecgHistory: [],
    lastReadingTimestamp: Date.now(),
  });

  const [emergency, setEmergency] = useState<EmergencyState>({
    isActive: false,
    countdown: 10,
    dispatched: false,
    reason: null,
    notifiedContacts: ['Mom', 'Maya Chen', 'Leo Vance'],
    emergencyCoords: {
      lat: 37.7749,
      lng: -122.4194,
      streetCorner: 'Corner of 5th Ave & Pine St',
    },
  });

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(
    'Compass Ready: Double-tap the 3D center needle to ping friends!'
  );

  // Live link to the Circle server (phone app, friends, alerts). Demo mode without it.
  const link = useCircleLink((message, kind) => {
    setToastMessage(message);
    if (kind === 'alert') hapticAudio.playEmergencyBeep(true);
    else if (kind === 'double' || kind === 'triple' || kind === 'ping') hapticAudio.playDoubleTapFeedback();
  });
  const linkRef = useRef(link);
  linkRef.current = link;
  const live = link.live && !!link.state;
  const shownFriends = live ? friendsFromLink(link.state!) : friends;
  const shownSelectedId = live
    ? (link.state!.target?.kind === 'dest' ? 'dest' : link.state!.selected ?? shownFriends[0]?.id)
    : selectedFriendId;
  const targetFriend = shownFriends.find((f) => f.id === shownSelectedId) || shownFriends[0] || NOBODY;

  const liveEmergency = live ? link.state!.emergency : null;
  const shownEmergency: EmergencyState = liveEmergency
    ? {
        ...emergency,
        isActive: liveEmergency.state !== 'idle',
        countdown: liveEmergency.countdown ?? 0,
        dispatched: liveEmergency.state === 'sent',
        reason: (liveEmergency.reason as EmergencyState['reason']) ?? null,
        notifiedContacts: shownFriends.filter((f) => f.id !== 'dest').map((f) => f.name),
      }
    : emergency;

  // The pendant is the sensor: send its vitals up so the server can watch thresholds.
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => linkRef.current.vitals(biometrics.heartRate, biometrics.stressLevel), 300);
    return () => clearTimeout(t);
  }, [live, biometrics.heartRate, biometrics.stressLevel]);

  // Follow the server's alert state on the display.
  const liveEmergencyState = liveEmergency?.state;
  useEffect(() => {
    if (!liveEmergencyState) return;
    setSpecs((prev) => ({
      ...prev,
      displayMode: liveEmergencyState === 'idle' ? (prev.displayMode === 'emergency' ? 'compass' : prev.displayMode) : 'emergency',
    }));
  }, [liveEmergencyState]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Handle Double-Tap on Needle: Deploys arrow or toggles standby
  const handleDoubleTapNeedle = useCallback(() => {
    hapticAudio.playDoubleTapFeedback();
    setSpecs((prev) => {
      const nextState = !prev.isDoubleTapPinging;
      if (nextState) {
        const canPing = linkRef.current.live && targetFriend.id !== 'dest' && targetFriend.id !== 'none';
        if (canPing) linkRef.current.gesture('double');
        setToastMessage(`✨ Arrow Deployed: Tracking ${targetFriend.name} (${targetFriend.distanceMeters}m away)${canPing ? ' and sent “thinking of you”' : ''}`);
        hapticAudio.playProximityPulse(targetFriend.distanceMeters);
      } else {
        setToastMessage(`Arrow Retracted: Standby Mode (Double-tap to show arrow)`);
      }
      return { ...prev, isDoubleTapPinging: nextState };
    });
  }, [targetFriend]);

  // Triple tap: ask the friend to call you.
  const handleTripleTapNeedle = useCallback(() => {
    if (linkRef.current.live && targetFriend.id !== 'dest' && targetFriend.id !== 'none') {
      linkRef.current.gesture('triple');
      setToastMessage(`Asked ${targetFriend.name} to call you`);
    } else {
      setToastMessage(`Triple tap: asks ${targetFriend.name} to call you (demo)`);
    }
  }, [targetFriend]);

  // Periodic Haptic audio pulses while beacon is active
  useEffect(() => {
    if (!specs.isDoubleTapPinging || specs.hapticsMuted || emergency.isActive) return;

    // Pulse interval scales with proximity: closer = more frequent
    // 2m -> 300ms, 80m -> 1800ms
    const intervalMs = Math.max(320, Math.min(2000, targetFriend.distanceMeters * 24));

    const timer = setInterval(() => {
      hapticAudio.playProximityPulse(targetFriend.distanceMeters);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [specs.isDoubleTapPinging, specs.hapticsMuted, targetFriend.distanceMeters, emergency.isActive]);

  // Automated Emergency Monitoring: check if HR or Stress exceeds threshold
  useEffect(() => {
    const isCriticalHR = biometrics.heartRate > 130;
    const isCriticalStress = biometrics.stressLevel > 80;

    if (live) return; // the server watches thresholds when linked
    if ((isCriticalHR || isCriticalStress) && !emergency.isActive && !emergency.dispatched) {
      // Trigger Automated Safety Protocol!
      setEmergency((prev) => ({
        ...prev,
        isActive: true,
        countdown: 10,
        dispatched: false,
        reason: isCriticalHR ? 'heart_rate_threshold' : 'stress_threshold',
      }));
      setSpecs((prev) => ({ ...prev, displayMode: 'emergency' }));
      setToastMessage('CRITICAL VITALS: Automated EMS countdown initiated!');
    }
  }, [live, biometrics.heartRate, biometrics.stressLevel, emergency.isActive, emergency.dispatched]);

  // Emergency Countdown Timer (10 -> 0 seconds)
  useEffect(() => {
    if (live || !emergency.isActive || emergency.dispatched) return;

    if (emergency.countdown > 0) {
      const timer = setTimeout(() => {
        setEmergency((prev) => ({
          ...prev,
          countdown: prev.countdown - 1,
        }));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (emergency.countdown === 0 && !emergency.dispatched) {
      // Countdown reached 0 -> Auto EMS Dispatch!
      setEmergency((prev) => ({
        ...prev,
        dispatched: true,
        dispatchedTimestamp: new Date().toLocaleTimeString(),
      }));
      hapticAudio.playEmergencyBeep(true);
      setToastMessage('EMS Dispatched: Physical coordinates sent to 911 & emergency contacts');
    }
  }, [live, emergency.isActive, emergency.countdown, emergency.dispatched]);

  // Simulate subtle live physiological fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setBiometrics((prev) => {
        // Natural small jitter around current baseline
        const jitterHR = Math.floor((Math.random() - 0.5) * 3);
        const newHR = Math.max(50, Math.min(180, prev.heartRate + jitterHR));
        return {
          ...prev,
          heartRate: newHR,
          lastReadingTimestamp: Date.now(),
        };
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        handleDoubleTapNeedle();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMapOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDoubleTapNeedle]);

  // Helper actions
  const handleSelectFriend = (id: string) => {
    if (live) { if (id !== 'dest') link.select(id); }
    else setSelectedFriendId(id);
    const friend = shownFriends.find((f) => f.id === id);
    if (friend) {
      setToastMessage(`Tracking ${friend.name} (${friend.distanceMeters}m • ${friend.streetCorner})`);
      hapticAudio.playProximityPulse(friend.distanceMeters);
    }
  };

  const handleChangeDistance = (meters: number) => {
    if (live) { setToastMessage('Distance is live from Circle. Use “Walk closer” in the phone app to test.'); return; }
    setFriends((prev) =>
      prev.map((f) => (f.id === selectedFriendId ? { ...f, distanceMeters: meters } : f))
    );
  };

  const handleManualSOS = () => {
    if (live) {
      const st = link.state!.emergency.state;
      if (st === 'pending') { link.cancel(); setToastMessage('Emergency SOS Cancelled'); }
      else if (st === 'sent') { link.safe(); setToastMessage('Your circle was told you are safe'); }
      else link.sos();
      return;
    }
    if (emergency.isActive) {
      // Cancel
      setEmergency((prev) => ({ ...prev, isActive: false, countdown: 10, dispatched: false }));
      setSpecs((prev) => ({ ...prev, displayMode: 'compass' }));
      setToastMessage('Emergency SOS Cancelled');
    } else {
      // Trigger
      setEmergency((prev) => ({
        ...prev,
        isActive: true,
        countdown: 10,
        dispatched: false,
        reason: 'manual_sos',
      }));
      setSpecs((prev) => ({ ...prev, displayMode: 'emergency' }));
    }
  };

  const handleSimulateEmergencyThreshold = () => {
    setBiometrics((prev) => ({
      ...prev,
      heartRate: 142,
      stressLevel: 89,
    }));
  };

  const handleCancelEmergency = () => {
    if (live) {
      if (link.state!.emergency.state === 'pending') link.cancel(); else link.safe();
      setBiometrics((prev) => ({ ...prev, heartRate: 78, stressLevel: 36 }));
      setToastMessage(link.state!.emergency.state === 'pending' ? 'Safety Protocol Aborted: Status Normal' : 'Your circle was told you are safe');
      return;
    }
    setEmergency((prev) => ({
      ...prev,
      isActive: false,
      countdown: 10,
      dispatched: false,
    }));
    setBiometrics((prev) => ({
      ...prev,
      heartRate: 78,
      stressLevel: 36,
    }));
    setSpecs((prev) => ({ ...prev, displayMode: 'compass' }));
    setToastMessage('Safety Protocol Aborted: Status Normal');
  };

  const handleConfirmImmediateDispatch = () => {
    if (live) { link.dispatchNow(); return; }
    setEmergency((prev) => ({
      ...prev,
      countdown: 0,
      dispatched: true,
      dispatchedTimestamp: new Date().toLocaleTimeString(),
    }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07090e]">
      {/* 3D WebGL Scene */}
      <div className="absolute inset-0 z-0">
        <CompassCanvas3D
          specs={specs}
          targetFriend={targetFriend}
          biometrics={biometrics}
          emergency={shownEmergency}
          onDoubleTapNeedle={handleDoubleTapNeedle}
          onTripleTapNeedle={handleTripleTapNeedle}
        />
      </div>

      {/* Top Header HUD */}
      <TopHeader
        biometrics={biometrics}
        emergency={shownEmergency}
        activeFriend={targetFriend}
        isArrowActive={specs.isDoubleTapPinging}
        onOpenSpecs={() => setIsSpecsOpen(true)}
        onTriggerSOS={handleManualSOS}
        onOpenMap={() => setIsMapOpen(true)}
      />

      {/* Pair with the Circle phone app */}
      <PairPanel status={link.status} name={link.state?.me.name} onPair={link.pair} onUnpair={link.unpair} />

      {/* Center Toast Message Banner */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 py-2 rounded-2xl bg-slate-900/90 border border-sky-400/30 text-white text-xs font-medium shadow-xl backdrop-blur-md flex items-center gap-2.5 transition-all">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock (Zero Viewport Occlusion) */}
      <BottomControlDock
        specs={specs}
        friends={shownFriends}
        targetFriend={targetFriend}
        biometrics={biometrics}
        onSelectFriend={handleSelectFriend}
        onChangeDistance={handleChangeDistance}
        onDoubleTapNeedle={handleDoubleTapNeedle}
        onSetDisplayMode={(mode: DisplayMode) => setSpecs((prev) => ({ ...prev, displayMode: mode }))}
        onSetExploded={(val: number) => setSpecs((prev) => ({ ...prev, explodedProgress: val }))}
        onSetFinish={(finish: MaterialFinish) => setSpecs((prev) => ({ ...prev, finish }))}
        onSetHeartRate={(bpm: number) => setBiometrics((prev) => ({ ...prev, heartRate: bpm }))}
        onSetStress={(stress: number) => setBiometrics((prev) => ({ ...prev, stressLevel: stress }))}
        onToggleHapticsMute={() => {
          const nextMuted = !specs.hapticsMuted;
          hapticAudio.setMuted(nextMuted);
          setSpecs((prev) => ({ ...prev, hapticsMuted: nextMuted }));
          setToastMessage(nextMuted ? 'Haptic audio clicks muted' : 'Haptic audio clicks enabled');
        }}
        onSelectCamera={(preset: string) => {
          const win = window as unknown as { setCompassView?: (view: string) => void };
          win.setCompassView?.(preset);
        }}
        onOpenMap={() => setIsMapOpen(true)}
        onSimulateEmergencyThreshold={handleSimulateEmergencyThreshold}
      />

      {/* Vicinity Map Modal */}
      <VicinityMapOverlay
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        targetFriend={targetFriend}
        friends={shownFriends}
        onSelectFriend={handleSelectFriend}
      />

      {/* Emergency Alert & Automated EMS Dispatch Modal */}
      <EmergencyAlertModal
        emergency={shownEmergency}
        biometrics={biometrics}
        friends={shownFriends}
        onCancelEmergency={handleCancelEmergency}
        onConfirmImmediateDispatch={handleConfirmImmediateDispatch}
      />

      {/* Hardware Blueprint & Spec Sheet Modal */}
      <SpecSheetModal isOpen={isSpecsOpen} onClose={() => setIsSpecsOpen(false)} />
    </div>
  );
}
