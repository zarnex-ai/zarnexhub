// Web Audio API Synthesizer Sound FX Engine for Sci-Fi Command Dashboard
class SoundFXEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Load mute setting from LocalStorage if it exists
    const storedMute = localStorage.getItem('zarnex_hud_mute');
    this.isMuted = storedMute === 'true';
  }

  private initCtx() {
    if (!this.ctx) {
      // Create audio context on-demand
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('zarnex_hud_mute', String(this.isMuted));
    // Play a click confirmation if unmuting
    if (!this.isMuted) {
      setTimeout(() => this.playClick(), 50);
    }
    return this.isMuted;
  }

  public getMutedState(): boolean {
    return this.isMuted;
  }

  // Dual micro-ticks on hover (digital mechanical feel)
  public playHover() {
    if (this.isMuted) return;
    try {
      const audioCtx = this.initCtx();
      const now = audioCtx.currentTime;

      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2500, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.015);

      gainNode.gain.setValueAtTime(0.015, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.015);
    } catch (e) {
      console.warn('Sound failed to play:', e);
    }
  }

  // Tactical click beep (cursor select)
  public playClick() {
    if (this.isMuted) return;
    try {
      const audioCtx = this.initCtx();
      const now = audioCtx.currentTime;

      // Note 1 (High beep)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1600, now);
      gain1.gain.setValueAtTime(0.02, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.04);

      // Note 2 (slightly offset lower beep)
      setTimeout(() => {
        if (this.isMuted) return;
        const nowOffset = audioCtx.currentTime;
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2200, nowOffset);
        gain2.gain.setValueAtTime(0.015, nowOffset);
        gain2.gain.exponentialRampToValueAtTime(0.0001, nowOffset + 0.03);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(nowOffset);
        osc2.stop(nowOffset + 0.03);
      }, 20);

    } catch (e) {
      console.warn('Sound failed to play:', e);
    }
  }

  // Resonant sweep whoosh for sending message
  public playSend() {
    if (this.isMuted) return;
    try {
      const audioCtx = this.initCtx();
      const now = audioCtx.currentTime;
      const duration = 0.28;

      const osc = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const gainNode = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(1500, now + duration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(2500, now + duration);
      filter.Q.setValueAtTime(8, now);

      gainNode.gain.setValueAtTime(0.02, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Sound failed to play:', e);
    }
  }

  // Soft notification bell chime for receiving message
  public playReceive() {
    if (this.isMuted) return;
    try {
      const audioCtx = this.initCtx();
      const now = audioCtx.currentTime;
      const duration = 0.6;

      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      // Cyber chord: G5 (784Hz) and C6 (1046Hz)
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(784, now);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046, now);

      gainNode.gain.setValueAtTime(0.03, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + duration);
      osc2.stop(now + duration);
    } catch (e) {
      console.warn('Sound failed to play:', e);
    }
  }

  // Rhythmic scan sweeping tone (for biometric laser or telemetry processing)
  public playScan(duration: number = 0.5) {
    if (this.isMuted) return;
    try {
      const audioCtx = this.initCtx();
      const now = audioCtx.currentTime;

      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      // Sweeps up and down rapidly to sound like a digital scan beam
      for (let i = 0; i < duration * 10; i++) {
        const time = now + i * 0.1;
        const freq = i % 2 === 0 ? 350 : 250;
        osc.frequency.setValueAtTime(freq, time);
      }

      gainNode.gain.setValueAtTime(0.015, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Sound failed to play:', e);
    }
  }

  // Warning buzz alert for errors
  public playWarning() {
    if (this.isMuted) return;
    try {
      const audioCtx = this.initCtx();
      const now = audioCtx.currentTime;

      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.setValueAtTime(100, now + 0.12);

      gainNode.gain.setValueAtTime(0.03, now);
      gainNode.gain.setValueAtTime(0.03, now + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Sound failed to play:', e);
    }
  }
}

export const soundFx = new SoundFXEngine();
