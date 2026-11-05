// AudioFeedback: sinais sonoros sintéticos via Web Audio API, sem arquivos de mídia (PRD §4.5).

export type AudioCue = 'wake' | 'success' | 'error' | 'speech';

export interface AudioLogEntry {
  cue: AudioCue;
  gain: number;
  at: number;
}

type AudioContextCtor = typeof AudioContext;

export class AudioFeedback {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private speechOsc: OscillatorNode | null = null;
  private speechGain: GainNode | null = null;
  private lastSpeechLog = 0;
  enabled = true;
  volume = 0.6;
  readonly log: AudioLogEntry[] = [];

  private get effectiveGain(): number {
    return this.enabled ? this.volume : 0;
  }

  /** Cria o contexto sob demanda; navegadores exigem um gesto do usuário antes de tocar. */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor: AudioContextCtor | undefined =
      typeof window !== 'undefined'
        ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext)
        : undefined;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.effectiveGain;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyMaster();
    if (!enabled) this.stopSpeech();
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyMaster();
  }

  private applyMaster(): void {
    if (this.master && this.ctx) this.master.gain.setValueAtTime(this.effectiveGain, this.ctx.currentTime);
  }

  private record(cue: AudioCue): void {
    this.log.push({ cue, gain: this.effectiveGain, at: performance.now() });
    if (this.log.length > 200) this.log.splice(0, this.log.length - 200);
  }

  private tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', endFreq?: number, peak = 0.35): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  cue(cue: Exclude<AudioCue, 'speech'>): void {
    this.record(cue);
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + 0.01;
    switch (cue) {
      case 'wake':
        // Dois acordes senoidais curtos.
        this.tone(660, t, 0.14);
        this.tone(830, t, 0.14, 'sine', undefined, 0.2);
        this.tone(880, t + 0.12, 0.18);
        this.tone(1100, t + 0.12, 0.18, 'sine', undefined, 0.2);
        break;
      case 'success':
        this.tone(1320, t, 0.12);
        this.tone(1760, t + 0.1, 0.16);
        break;
      case 'error':
        this.tone(520, t, 0.35, 'triangle', 220);
        break;
    }
  }

  startSpeech(): void {
    this.record('speech');
    if (!this.enabled || this.speechOsc) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.speechOsc = ctx.createOscillator();
    this.speechGain = ctx.createGain();
    this.speechOsc.type = 'triangle';
    this.speechOsc.frequency.value = 190;
    this.speechGain.gain.value = 0;
    this.speechOsc.connect(this.speechGain).connect(this.master);
    this.speechOsc.start();
  }

  /** Modula a fala sintética com o mesmo envelope que anima a boca. */
  updateSpeech(envelope: number, now: number): void {
    if (now - this.lastSpeechLog > 500) {
      this.lastSpeechLog = now;
      this.record('speech');
    }
    if (!this.speechOsc || !this.speechGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.speechGain.gain.setTargetAtTime(0.08 * envelope, t, 0.02);
    this.speechOsc.frequency.setTargetAtTime(160 + 80 * envelope, t, 0.03);
  }

  stopSpeech(): void {
    if (!this.speechOsc) return;
    try {
      this.speechOsc.stop();
    } catch {
      /* já parado */
    }
    this.speechOsc.disconnect();
    this.speechGain?.disconnect();
    this.speechOsc = null;
    this.speechGain = null;
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }
}
