/**
 * Web Audio API Sound Synthesizer for Smart Canteen Hardware Simulation
 * Zero external audio files required - pure mathematical waveform synthesis
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Read user preference from localStorage if previously set
    const saved = localStorage.getItem('canteen_audio_muted');
    if (saved !== null) {
      this.isMuted = saved === 'true';
    }
  }

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx) {
      const AudioClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioClass) {
        this.ctx = new AudioClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('canteen_audio_muted', String(this.isMuted));
    if (!this.isMuted) {
      this.playScannerBeep();
    }
    return !this.isMuted;
  }

  public isAudioEnabled(): boolean {
    return !this.isMuted;
  }

  /**
   * Dual High-Frequency Chime for Valid Verification
   */
  public playVerificationChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // Harmonic dual sweep
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      osc2.frequency.setValueAtTime(1174.66, now); // D6
      osc2.frequency.setValueAtTime(1760.00, now + 0.08); // A6

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn('Audio synthesis error:', e);
    }
  }

  /**
   * Low Harsh Sawtooth Buzzer for Duplicate / Security Double-Dip Block
   */
  public playWarningBuzzer(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(115, now + 0.4);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      console.warn('Audio synthesis error:', e);
    }
  }

  /**
   * 80mm Stepper Motor Thermal Paper Feed Sound
   * Synthesizes the mechanical paper drive stepper motor
   */
  public playThermalMotorSound(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const duration = 0.85;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // 58Hz mechanical stepper rhythm
        const pulse = Math.sin((i / ctx.sampleRate) * 2 * Math.PI * 58) > 0.75 ? 1.0 : 0.25;
        data[i] = white * pulse * 0.12;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2100;
      filter.Q.value = 2.2;

      noise.connect(filter);
      filter.connect(ctx.destination);
      noise.start();

      // Trigger cutter click at end of paper ejection
      setTimeout(() => this.playPaperCutSound(), 700);
    } catch (e) {
      console.warn('Audio synthesis error:', e);
    }
  }

  /**
   * Mechanical Auto-Cutter Guillotine Click
   */
  public playPaperCutSound(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2800, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      console.warn('Audio synthesis error:', e);
    }
  }

  /**
   * 2D Barcode Scanner Laser Decode Beep
   */
  public playScannerBeep(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2480, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      console.warn('Audio synthesis error:', e);
    }
  }
}

export const soundEngine = new SoundEngine();
