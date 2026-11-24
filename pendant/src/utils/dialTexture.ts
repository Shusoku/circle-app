import * as THREE from 'three';
import { BiometricState, DisplayMode, EmergencyState, FriendContact } from '../types/compass';

export class DialTextureController {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;
  private animTime: number = 0;

  constructor(size: number = 1024) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;
  }

  public update(
    mode: DisplayMode,
    targetFriend: FriendContact,
    biometrics: BiometricState,
    emergency: EmergencyState,
    isPinging: boolean,
    dt: number
  ) {
    this.animTime += dt;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = w * 0.46;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Dark OLED background
    const bgGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, r);
    bgGrad.addColorStop(0, '#0c1017');
    bgGrad.addColorStop(0.85, '#05070a');
    bgGrad.addColorStop(1, '#000000');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Mode-specific render
    if (mode === 'emergency' || emergency.isActive) {
      this.renderEmergencyMode(ctx, cx, cy, r, emergency, biometrics);
    } else if (mode === 'map') {
      this.renderVicinityMapMode(ctx, cx, cy, r, targetFriend);
    } else if (mode === 'biometrics') {
      this.renderBiometricsMode(ctx, cx, cy, r, biometrics);
    } else {
      this.renderCompassMode(ctx, cx, cy, r, targetFriend, isPinging);
    }

    // Outer subtle bezel shadow & bezel ring
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    this.texture.needsUpdate = true;
  }

  private renderCompassMode(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    friend: FriendContact,
    isPinging: boolean
  ) {
    const t = this.animTime;

    // Outer degree tick marks (360 degrees)
    ctx.save();
    for (let deg = 0; deg < 360; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 30 === 0;
      const isCardinal = deg % 90 === 0;
      const tickLen = isCardinal ? 24 : isMajor ? 16 : 8;
      const outerR = r - 12;
      const innerR = outerR - tickLen;

      const x1 = cx + Math.sin(rad) * outerR;
      const y1 = cy - Math.cos(rad) * outerR;
      const x2 = cx + Math.sin(rad) * innerR;
      const y2 = cy - Math.cos(rad) * innerR;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = isCardinal ? 3 : isMajor ? 2 : 1;
      ctx.strokeStyle = isCardinal ? '#38bdf8' : isMajor ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)';
      ctx.stroke();

      // Cardinal labels (N, E, S, W)
      if (isCardinal) {
        const labelR = innerR - 22;
        const lx = cx + Math.sin(rad) * labelR;
        const ly = cy - Math.cos(rad) * labelR;
        const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : 'W';
        ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = deg === 0 ? '#38bdf8' : '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx, ly);
      }
    }
    ctx.restore();

    // Render Guilloché Luxury Dial Background Rings
    ctx.save();
    // Concentric luxury horology rings
    [0.85, 0.65, 0.48, 0.32, 0.18].forEach((scale, i) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Subtle celestial crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.75, cy);
    ctx.lineTo(cx - 35, cy);
    ctx.moveTo(cx + 35, cy);
    ctx.lineTo(cx + r * 0.75, cy);
    ctx.moveTo(cx, cy - r * 0.75);
    ctx.lineTo(cx, cy - 35);
    ctx.moveTo(cx, cy + 35);
    ctx.lineTo(cx, cy + r * 0.75);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // CONDITIONAL: ARROW & BEARING INDICATORS ONLY APPEAR ONCE DOUBLE TAPPED!
    if (isPinging) {
      const friendAngleRad = (friend.bearingDegrees * Math.PI) / 180;
      const beaconDist = friend.distanceMeters;
      const proximitySpeed = Math.max(1.5, Math.min(6, 60 / Math.max(beaconDist, 3)));
      const pulsePhase = (t * proximitySpeed) % 1;

      // Friend beacon sector glow
      const sectorR = r * 0.72;
      const fx = cx + Math.sin(friendAngleRad) * sectorR;
      const fy = cy - Math.cos(friendAngleRad) * sectorR;

      // Dynamic wave ripples radiating from friend bearing
      for (let i = 0; i < 3; i++) {
        const waveProgress = (pulsePhase + i / 3) % 1;
        const waveRadius = 15 + waveProgress * (r * 0.55);
        const alpha = (1 - waveProgress) * 0.7;

        ctx.beginPath();
        ctx.arc(cx, cy, waveRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // TARGET FRIEND BEARING ARROW (CHEVRON POINTER)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(friendAngleRad);

      // Glowing Directional Arrow Pointer
      ctx.beginPath();
      ctx.moveTo(0, -r + 44);
      ctx.lineTo(-15, -r + 76);
      ctx.lineTo(0, -r + 66);
      ctx.lineTo(15, -r + 76);
      ctx.closePath();
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Illuminated guideline from center jewel to arrow
      ctx.beginPath();
      ctx.setLineDash([5, 6]);
      ctx.moveTo(0, -55);
      ctx.lineTo(0, -r + 85);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Friend Avatar / Badge in dial
      ctx.beginPath();
      ctx.arc(fx, fy, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(friend.initials, fx, fy);

      // Telemetry Hub: Distance Readout & Details
      ctx.font = 'bold 38px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(`${friend.distanceMeters}m`, cx, cy + 96);

      ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`${friend.name.toUpperCase()} // UWB LOCK`, cx, cy + 124);

      // Street corner hint
      ctx.font = '500 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(friend.streetCorner, cx, cy + 148);

      // Top status line
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('● BEACON ACTIVE // HAPTIC PULSE', cx, cy - 100);
    } else {
      // STANDBY LUXURY STATE (ARROW IS HIDDEN)
      // Subtle center halo invitation to double-tap
      const breathe = (Math.sin(t * 2.5) + 1) * 0.5; // 0 to 1
      ctx.beginPath();
      ctx.arc(cx, cy, 48 + breathe * 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.15 + breathe * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Luxury horology brand insignia
      ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText('C O M P A S S', cx, cy - 70);

      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('HAUTE HARMONIC CORE', cx, cy - 54);

      // Center Prompt (Surrounding the central tactile jewel)
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('DOUBLE-TAP NEEDLE', cx, cy + 82);

      ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('to illuminate directional arrow & ping friend', cx, cy + 104);

      // Discreet bottom tech badge
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText('UWB 8.0GHz • 50M WATER RESISTANT', cx, cy + 146);
    }
  }

  private renderVicinityMapMode(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    friend: FriendContact
  ) {
    const t = this.animTime;
    ctx.save();

    // Clip to circle
    ctx.beginPath();
    ctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
    ctx.clip();

    // Map background tiles & grid
    ctx.fillStyle = '#070b12';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Crowd heat density circular glow
    const crowdGrad = ctx.createRadialGradient(cx + 80, cy - 60, 20, cx + 80, cy - 60, 160);
    crowdGrad.addColorStop(0, 'rgba(239, 68, 68, 0.28)');
    crowdGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.15)');
    crowdGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = crowdGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Street blocks (buildings/city blocks)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;

    const blocks = [
      { x: cx - 220, y: cy - 220, w: 160, h: 140 },
      { x: cx - 40, y: cy - 220, w: 150, h: 140 },
      { x: cx + 130, y: cy - 220, w: 120, h: 140 },
      { x: cx - 220, y: cy - 50, w: 160, h: 120 },
      { x: cx - 40, y: cy - 50, w: 150, h: 120 },
      { x: cx + 130, y: cy - 50, w: 120, h: 120 },
      { x: cx - 220, y: cy + 90, w: 160, h: 130 },
      { x: cx - 40, y: cy + 90, w: 150, h: 130 },
      { x: cx + 130, y: cy + 90, w: 120, h: 130 },
    ];

    blocks.forEach((b) => {
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 8);
      ctx.fill();
      ctx.stroke();
    });

    // Street roads & labels
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'center';

    // Avenues (Vertical)
    ctx.fillText('4TH ST', cx - 50, cy - r + 30);
    ctx.fillText('5TH AVE', cx + 120, cy - r + 30);

    // Streets (Horizontal)
    ctx.fillText('PINE ST', cx - r + 50, cy - 60);
    ctx.fillText('MARKET ST', cx - r + 60, cy + 80);

    // Direct path line to friend
    const friendAngleRad = (friend.bearingDegrees * Math.PI) / 180;
    const friendDistPx = Math.min(r * 0.75, friend.distanceMeters * 2.8 + 50);
    const fx = cx + Math.sin(friendAngleRad) * friendDistPx;
    const fy = cy - Math.cos(friendAngleRad) * friendDistPx;

    // Glowing navigation path line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(fx, fy);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // User location dot (center)
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Friend beacon on map
    const pulse = Math.sin(t * 4) * 4;
    ctx.beginPath();
    ctx.arc(fx, fy, 14 + pulse, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(fx, fy, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(friend.initials, fx, fy);

    // Street corner banner at bottom of dial
    ctx.restore();

    ctx.fillStyle = 'rgba(8, 14, 26, 0.9)';
    ctx.beginPath();
    ctx.roundRect(cx - 160, cy + 90, 320, 52, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText('CURRENT VICINITY INTERSECTION', cx, cy + 110);

    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Corner of 5th Ave & Pine St', cx, cy + 130);
  }

  private renderBiometricsMode(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    bio: BiometricState
  ) {
    const t = this.animTime;
    const isHighStress = bio.stressLevel > 75;
    const isCritical = bio.stressLevel > 85 || bio.heartRate > 135;

    // Header
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillStyle = isCritical ? '#ef4444' : isHighStress ? '#f97316' : '#10b981';
    ctx.textAlign = 'center';
    ctx.fillText(isCritical ? '● BIOMETRIC ALERT: CRITICAL' : isHighStress ? '▲ ELEVATED STRESS' : '● REAL-TIME VITALS STABLE', cx, cy - 130);

    // Heart Rate in giant typography
    ctx.font = 'bold 64px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = isCritical ? '#ef4444' : '#ffffff';
    ctx.fillText(`${bio.heartRate}`, cx, cy - 40);

    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('BPM / HEART RATE', cx, cy - 10);

    // Animated PPG / ECG Waveform
    const waveY = cy + 50;
    const waveW = r * 1.3;
    const startX = cx - waveW / 2;

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = isCritical ? '#ef4444' : '#10b981';
    ctx.shadowColor = isCritical ? '#ef4444' : '#10b981';
    ctx.shadowBlur = 8;

    for (let x = 0; x < waveW; x += 4) {
      const prog = (x / waveW + t * 0.8) % 1;
      let yOffset = 0;
      // Synthesize ECG heartbeat peak (P, Q, R, S, T waves)
      if (prog > 0.45 && prog < 0.55) {
        const local = (prog - 0.45) * 10; // 0 to 1
        if (local < 0.2) yOffset = -5 * Math.sin(local * Math.PI * 5); // P wave
        else if (local < 0.4) yOffset = 8; // Q dip
        else if (local < 0.6) yOffset = -35; // R sharp spike!
        else if (local < 0.75) yOffset = 14; // S drop
        else yOffset = -8 * Math.sin((local - 0.75) * Math.PI * 4); // T wave
      } else {
        yOffset = (Math.sin(prog * 20 + t * 4) * 2);
      }
      const plotX = startX + x;
      const plotY = waveY + yOffset;
      if (x === 0) ctx.moveTo(plotX, plotY);
      else ctx.lineTo(plotX, plotY);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Stress level meter bar
    const barW = 280;
    const barH = 14;
    const barX = cx - barW / 2;
    const barY = cy + 105;

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 7);
    ctx.fill();

    const fillW = Math.max(8, (barW * bio.stressLevel) / 100);
    const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(0.65, '#f59e0b');
    grad.addColorStop(1, '#ef4444');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillW, barH, 7);
    ctx.fill();

    // Stress text
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`STRESS SCORE: ${bio.stressLevel}%`, cx, cy + 140);

    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`HRV: ${bio.hrv}ms  |  TEMP: ${bio.skinTemp.toFixed(1)}°C  |  EDA: SENSING`, cx, cy + 160);
  }

  private renderEmergencyMode(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    emergency: EmergencyState,
    biometrics: BiometricState
  ) {
    const t = this.animTime;
    const flash = Math.sin(t * 8) > 0;

    // Pulsing red danger ring
    ctx.lineWidth = 14;
    ctx.strokeStyle = flash ? '#ef4444' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 15, 0, Math.PI * 2);
    ctx.stroke();

    // Hazard title
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.fillText('EMERGENCY SOS', cx, cy - 110);

    if (emergency.countdown > 0 && !emergency.dispatched) {
      ctx.font = 'bold 78px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${emergency.countdown}`, cx, cy - 20);

      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('SECONDS TO DISPATCH', cx, cy + 25);
    } else {
      ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#22c55e';
      ctx.fillText('EMS DISPATCHED', cx, cy - 30);

      ctx.font = '600 15px "JetBrains Mono", monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('911 & CONTACTS ALERTED', cx, cy + 10);
    }

    // Reason & coordinates
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f87171';
    ctx.fillText(`TRIGGER: HR ${biometrics.heartRate} BPM (EXCEEDED THRESHOLD)`, cx, cy + 60);

    // Dropped coordinates
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`LOCATION: ${emergency.emergencyCoords.streetCorner}`, cx, cy + 95);

    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${emergency.emergencyCoords.lat.toFixed(4)}° N, ${emergency.emergencyCoords.lng.toFixed(4)}° W (GPS LOCK)`, cx, cy + 115);

    ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('Double tap to cancel / Stand down', cx, cy + 145);
  }

  public dispose() {
    this.texture.dispose();
  }
}
