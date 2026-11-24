/**
 * Procedural Web Audio API sound generator for Compass haptic feedback,
 * needle double-tap confirmation, proximity pulse cadence, and emergency beacons.
 */

class HapticAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private lastPingTime: number = 0;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Double-tap tactile haptic confirmation:
   * Two quick crisp micro-thuds like high-end LRA vibration actuator.
   */
  public playDoubleTapFeedback() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [0, 0.09].forEach((delay) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now + delay);
      osc.frequency.exponentialRampToValueAtTime(45, now + delay + 0.05);

      gain.gain.setValueAtTime(0.4, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.07);
    });
  }

  /**
   * Proximity Haptic Pulse:
   * Subtle resonant magnetic ping click. Frequency and rate increase as distance shrinks.
   * distanceMeters: e.g. 2m (very close, intense rapid tap) to 80m (slow gentle pulse)
   */
  public playProximityPulse(distanceMeters: number) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Debounce to prevent audio stacking
    if (now - this.lastPingTime < 0.1) return;
    this.lastPingTime = now;

    // Distance normalized: closer = higher pitch & sharper click
    const proximityNorm = Math.max(0, Math.min(1, 1 - distanceMeters / 60)); // 1 when < 2m, 0 when > 60m
    const baseFreq = 220 + proximityNorm * 380; // 220Hz up to 600Hz

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.08);

    const volume = 0.15 + proximityNorm * 0.35;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Heart Rate pulse sound (subtle cardiac thud)
   */
  public playHeartbeatThump() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Emergency countdown beep / siren chime
   */
  public playEmergencyBeep(isCritical: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    const freq = isCritical ? 880 : 660;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.setValueAtTime(freq * 1.2, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }
}

export const hapticAudio = new HapticAudioEngine();
