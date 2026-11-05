// Runtime do simulador: estado operacional, emoção, cenários, entrada, áudio, reprodução
// de animações e laço de renderização. Executa fora da árvore React (PRD §11.1).
import { AudioFeedback } from '../audio/audioFeedback';
import { resolvePosition, sampleAnimation } from '../domain/animation';
import { computePose, speechEnvelope, type FacePose } from '../domain/avatarEngine';
import { EMOTIONS, type EmotionValue, type GestureBindingKey, type GestureEvent, type InputSource, type LogicalTouchEvent, type OperationalState, type TouchPhase } from '../domain/types';
import { SCENARIOS, ScenarioRunner, browserTimers, canTransition, type ScenarioDefinition, type TimerApi } from '../domain/stateMachine';
import { renderFrame } from '../render/canvasRenderer';
import { clientToLogical, type Rect } from '../input/coords';
import { CircularContactFilter, GestureRecognizer } from '../input/gestures';
import type { StudioStore } from './studioStore';

export interface StateLogEntry {
  state: OperationalState;
  at: number;
  forced?: boolean;
}

export interface GestureLogEntry {
  type: 'tap' | 'longPress' | 'swipe' | 'cancel';
  direction?: 'up' | 'down' | 'left' | 'right';
  at: number;
}

export interface ButtonLogEntry {
  gpio: 0;
  /** Nível lógico: 0 = pressionado (ativo em nível baixo). */
  level: 0 | 1;
  source: InputSource;
  timestamp: number;
}

export interface PlaybackState {
  animId: string | null;
  /** A camada de animação está aplicada ao rosto. */
  active: boolean;
  playing: boolean;
  origin: 'timeline' | 'binding';
}

export interface DeviceStatus {
  wifi: boolean;
  battery: number;
  charging: boolean;
  micMuted: boolean;
}

export interface SimSnapshot {
  state: OperationalState;
  emotion: EmotionValue;
  userEmotion: EmotionValue;
  scenarioId: string | null;
  playback: PlaybackState;
  status: DeviceStatus;
  pttDown: boolean;
  spontaneous: boolean;
}

export interface DiagSnapshot {
  fps: number;
  lastTouch: LogicalTouchEvent | null;
  touchHistory: LogicalTouchEvent[];
  rejectedTouches: number;
  stateLog: StateLogEntry[];
  gestureLog: GestureLogEntry[];
  invalidTransitions: Array<{ from: OperationalState; to: OperationalState; at: number }>;
}

type Listener = () => void;

const WAKE_UP: ScenarioDefinition = {
  id: 'wakeUp',
  label: 'Acordar',
  steps: [
    { state: 'wake', durationMs: 500 },
    { state: 'idle', durationMs: 0 },
  ],
};

export class Simulator {
  readonly audio = new AudioFeedback();
  private state: OperationalState = 'idle';
  private stateEnteredAt = 0;
  private userEmotion: EmotionValue = { id: 'neutral', intensity: 1 };
  private scenarioEmotion: EmotionValue | null = null;
  private runner: ScenarioRunner;
  private pttDown = false;
  private spontaneous = true;
  private status: DeviceStatus = { wifi: true, battery: 80, charging: false, micMuted: false };

  private playback: PlaybackState = { animId: null, active: false, playing: false, origin: 'timeline' };
  private playOffset = 0;
  private playStartedAt = 0;

  private filter = new CircularContactFilter();
  private recognizer = new GestureRecognizer();
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  private canvasCtx: CanvasRenderingContext2D | null = null;
  private raf: number | null = null;
  private lastFrameAt = -Infinity;
  private frameTimes: number[] = [];
  private fps = 0;
  private lastPose: FacePose | null = null;
  private hidden = false;

  readonly stateLog: StateLogEntry[] = [];
  readonly gestureLog: GestureLogEntry[] = [];
  readonly buttonLog: ButtonLogEntry[] = [];
  readonly touchHistory: LogicalTouchEvent[] = [];
  private rejectedTouches = 0;
  private lastTouch: LogicalTouchEvent | null = null;
  private invalidTransitions: DiagSnapshot['invalidTransitions'] = [];

  private listeners = new Set<Listener>();
  private diagListeners = new Set<Listener>();
  private snapshot: SimSnapshot;
  private diagSnapshot: DiagSnapshot;
  private diagDirty = false;
  private lastDiagEmit = 0;

  constructor(
    private readonly store: StudioStore,
    private readonly timers: TimerApi = browserTimers,
  ) {
    this.runner = new ScenarioRunner(
      timers,
      (step) => {
        this.scenarioEmotion = step.emotion ?? null;
        this.setState(step.state);
      },
      () => {
        this.scenarioEmotion = null;
        this.emit();
      },
    );
    this.snapshot = this.buildSnapshot();
    this.diagSnapshot = this.buildDiag();
    this.stateEnteredAt = this.timers.now();
    this.stateLog.push({ state: 'idle', at: this.stateEnteredAt });
  }

  // ---------------------------------------------------------------- assinaturas

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snapshot;
  subscribeDiag = (l: Listener) => {
    this.diagListeners.add(l);
    return () => this.diagListeners.delete(l);
  };
  getDiagSnapshot = () => this.diagSnapshot;

  private buildSnapshot(): SimSnapshot {
    return {
      state: this.state,
      emotion: this.effectiveEmotion,
      userEmotion: this.userEmotion,
      scenarioId: this.runner.activeId,
      playback: { ...this.playback },
      status: { ...this.status },
      pttDown: this.pttDown,
      spontaneous: this.spontaneous,
    };
  }

  private buildDiag(): DiagSnapshot {
    return {
      fps: this.fps,
      lastTouch: this.lastTouch,
      touchHistory: this.touchHistory.slice(-30),
      rejectedTouches: this.rejectedTouches,
      stateLog: this.stateLog.slice(-40),
      gestureLog: this.gestureLog.slice(-30),
      invalidTransitions: this.invalidTransitions.slice(-20),
    };
  }

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    for (const l of this.listeners) l();
    this.markDiag();
  }

  private markDiag(): void {
    this.diagDirty = true;
    if (this.raf === null) this.flushDiag();
  }

  private flushDiag(): void {
    this.diagDirty = false;
    this.lastDiagEmit = this.timers.now();
    this.diagSnapshot = this.buildDiag();
    for (const l of this.diagListeners) l();
  }

  // ---------------------------------------------------------------- estado e emoção

  get currentState(): OperationalState {
    return this.state;
  }

  get effectiveEmotion(): EmotionValue {
    return this.scenarioEmotion ?? this.userEmotion;
  }

  get currentFps(): number {
    return this.fps;
  }

  get scenarioActive(): string | null {
    return this.runner.activeId;
  }

  get isRenderLoopRunning(): boolean {
    return this.raf !== null;
  }

  get pose(): FacePose | null {
    return this.lastPose;
  }

  /** Aplica uma transição. Sem `force`, transições inválidas são registradas e ignoradas. */
  setState(to: OperationalState, opts: { force?: boolean } = {}): boolean {
    const from = this.state;
    if (from === to) return true;
    if (!opts.force && !canTransition(from, to)) {
      this.invalidTransitions.push({ from, to, at: this.timers.now() });
      this.markDiag();
      return false;
    }
    this.state = to;
    this.stateEnteredAt = this.timers.now();
    this.stateLog.push({ state: to, at: this.stateEnteredAt, ...(opts.force && { forced: true }) });
    if (this.stateLog.length > 500) this.stateLog.splice(0, 100);
    this.onEnterState(to, from);
    this.emit();
    return true;
  }

  private onEnterState(to: OperationalState, from: OperationalState): void {
    if (from === 'speaking') this.audio.stopSpeech();
    switch (to) {
      case 'wake':
        this.audio.cue('wake');
        break;
      case 'listening':
        if (from !== 'wake') this.audio.cue('wake');
        break;
      case 'success':
        this.audio.cue('success');
        break;
      case 'error':
        this.audio.cue('error');
        break;
      case 'speaking':
        this.audio.startSpeech();
        break;
      default:
        break;
    }
  }

  /** Seleção manual de estado no painel (ignora a tabela de transições). */
  forceState(to: OperationalState): void {
    this.runner.cancel();
    this.scenarioEmotion = null;
    this.setState(to, { force: true });
  }

  setEmotion(e: EmotionValue): void {
    this.userEmotion = { id: e.id, intensity: Math.min(1, Math.max(0, e.intensity)) };
    this.emit();
  }

  cycleEmotion(dir: 1 | -1): void {
    const i = EMOTIONS.indexOf(this.userEmotion.id);
    const next = EMOTIONS[(i + dir + EMOTIONS.length) % EMOTIONS.length];
    this.setEmotion({ id: next, intensity: this.userEmotion.intensity || 0.8 });
  }

  setSpontaneous(on: boolean): void {
    this.spontaneous = on;
    this.emit();
  }

  setStatus(patch: Partial<DeviceStatus>): void {
    this.status = { ...this.status, ...patch, battery: Math.round(Math.min(100, Math.max(0, patch.battery ?? this.status.battery))) };
    this.emit();
  }

  // ---------------------------------------------------------------- cenários

  runScenario(id: string): void {
    const def = id === 'wakeUp' ? WAKE_UP : SCENARIOS[id];
    if (!def) return;
    this.runner.cancel();
    this.scenarioEmotion = null;
    this.pttDown = false;
    if (this.state !== 'idle' && !(def === WAKE_UP && this.state === 'sleep')) this.setState('idle');
    this.runner.start(def);
    this.emit();
  }

  cancelScenario(): void {
    this.runner.cancel();
    this.scenarioEmotion = null;
    this.pttDown = false;
    this.setState('idle');
    this.emit();
  }

  activate(): void {
    if (this.runner.activeId) return;
    if (this.state === 'sleep') this.runScenario('wakeUp');
    else this.runScenario('dialog');
  }

  toggleSleep(): void {
    if (this.state === 'sleep') this.runScenario('wakeUp');
    else {
      this.runner.cancel();
      this.scenarioEmotion = null;
      this.setState('idle');
      this.setState('sleep');
    }
  }

  // ---------------------------------------------------------------- botão físico (GPIO 0)

  pttPress(source: InputSource = 'hardware_button'): void {
    if (this.pttDown) return;
    this.pttDown = true;
    this.buttonLog.push({ gpio: 0, level: 0, source, timestamp: this.timers.now() });
    this.runner.cancel();
    this.scenarioEmotion = null;
    if (this.state !== 'idle') this.setState('idle');
    this.setState('listening');
    this.emit();
  }

  pttRelease(source: InputSource = 'hardware_button'): void {
    if (!this.pttDown) return;
    this.pttDown = false;
    this.buttonLog.push({ gpio: 0, level: 1, source, timestamp: this.timers.now() });
    if (this.state === 'listening') {
      this.runner.start(SCENARIOS.pttRelease);
    }
    this.emit();
  }

  // ---------------------------------------------------------------- toque e gestos

  /** Entrada de ponteiro em coordenadas de cliente. Retorna se o evento foi aceito. */
  handlePointer(phase: TouchPhase, clientX: number, clientY: number, rect: Rect, source: InputSource): boolean {
    const { x, y } = clientToLogical(clientX, clientY, rect);
    const raw: LogicalTouchEvent = { phase, x, y, timestamp: this.timers.now(), source };
    const e = this.filter.filter(raw);
    if (!e) {
      if (phase === 'down') {
        this.rejectedTouches++;
        this.markDiag();
      }
      return false;
    }
    this.lastTouch = e;
    this.touchHistory.push(e);
    if (this.touchHistory.length > 200) this.touchHistory.splice(0, 50);
    this.recognizer.setThresholds(this.store.project.device.gestureThresholds);
    this.processGestures(this.recognizer.handle(e));
    this.scheduleLongPress();
    this.markDiag();
    return true;
  }

  get contactActive(): boolean {
    return this.filter.isDown;
  }

  private scheduleLongPress(): void {
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
    const at = this.recognizer.pendingLongPressAt();
    if (at === null) return;
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      this.processGestures(this.recognizer.tick(this.timers.now()));
      this.markDiag();
    }, Math.max(0, at - this.timers.now()));
  }

  private processGestures(gestures: GestureEvent[]): void {
    for (const g of gestures) {
      const at = g.timestamp;
      if (g.type === 'swipe') this.gestureLog.push({ type: 'swipe', direction: g.direction, at });
      else this.gestureLog.push({ type: g.type, at });
      if (this.gestureLog.length > 200) this.gestureLog.splice(0, 50);
      if (g.type === 'cancel') continue;
      const key: GestureBindingKey =
        g.type === 'swipe' ? (`swipe${g.direction[0].toUpperCase()}${g.direction.slice(1)}` as GestureBindingKey) : g.type;
      this.runBinding(key);
    }
  }

  private runBinding(gesture: GestureBindingKey): void {
    const binding = this.store.project.bindings.find((b) => b.gesture === gesture);
    if (!binding) return;
    const a = binding.action;
    if (a === 'none') return;
    if (a === 'activate') this.activate();
    else if (a === 'toggleSleep') this.toggleSleep();
    else if (a === 'nextEmotion') this.cycleEmotion(1);
    else if (a === 'prevEmotion') this.cycleEmotion(-1);
    else if (a === 'scenario:task') this.runScenario('task');
    else if (a === 'scenario:failure') this.runScenario('failure');
    else if (a === 'toggleMute') {
      const on = !this.store.project.runtime.soundEnabled;
      this.store.update((d) => {
        d.runtime.soundEnabled = on;
      });
      this.audio.setEnabled(on);
    } else if (a.startsWith('animation:')) {
      const id = a.slice(10);
      if (this.playback.active && this.playback.animId === id && this.playback.origin === 'binding') this.stop();
      else this.play(id, 'binding', true);
    }
  }

  // ---------------------------------------------------------------- reprodução de animações

  playbackPosition(now = this.timers.now()): number {
    return this.playback.playing ? this.playOffset + (now - this.playStartedAt) : this.playOffset;
  }

  /** Posição efetiva dentro da animação (aplica loop/once). */
  animationPosition(now = this.timers.now()): number {
    const anim = this.playback.animId ? this.store.project.animations[this.playback.animId] : undefined;
    if (!anim) return 0;
    return resolvePosition(anim, this.playbackPosition(now)).position;
  }

  play(animId: string, origin: PlaybackState['origin'] = 'timeline', restart = false): void {
    const anim = this.store.project.animations[animId];
    if (!anim) return;
    const now = this.timers.now();
    if (restart || this.playback.animId !== animId) this.playOffset = 0;
    if (anim.mode === 'once' && this.playOffset >= anim.durationMs) this.playOffset = 0;
    this.playStartedAt = now;
    this.playback = { animId, active: true, playing: true, origin };
    this.emit();
  }

  pause(): void {
    if (!this.playback.playing) return;
    this.playOffset = this.playbackPosition();
    this.playback = { ...this.playback, playing: false };
    this.emit();
  }

  stop(): void {
    this.playOffset = 0;
    this.playback = { ...this.playback, active: false, playing: false };
    this.emit();
  }

  rewind(): void {
    this.playOffset = 0;
    this.playStartedAt = this.timers.now();
    this.playback = { ...this.playback, active: this.playback.animId !== null };
    this.emit();
  }

  /** Avança (ou recua) um quadro na taxa-alvo atual. */
  step(dir: 1 | -1 = 1): void {
    const anim = this.playback.animId ? this.store.project.animations[this.playback.animId] : undefined;
    if (!anim) return;
    const frame = 1000 / this.store.project.device.targetFps;
    const pos = resolvePosition(anim, this.playbackPosition()).position;
    this.playOffset = Math.min(anim.durationMs, Math.max(0, pos + dir * frame));
    this.playback = { ...this.playback, active: true, playing: false };
    this.emit();
  }

  seek(ms: number): void {
    const anim = this.playback.animId ? this.store.project.animations[this.playback.animId] : undefined;
    if (!anim) return;
    this.playOffset = Math.min(anim.durationMs, Math.max(0, ms));
    this.playStartedAt = this.timers.now();
    this.playback = { ...this.playback, active: true };
    this.emit();
  }

  /** Seleciona a animação do editor sem reproduzi-la. */
  selectAnimation(animId: string | null): void {
    if (this.playback.animId === animId) return;
    this.playOffset = 0;
    this.playback = { animId, active: false, playing: false, origin: 'timeline' };
    this.emit();
  }

  // ---------------------------------------------------------------- renderização

  attachCanvas(canvas: HTMLCanvasElement | null): void {
    this.canvasCtx = canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;
    if (this.canvasCtx) {
      this.lastFrameAt = -Infinity;
      this.renderNow(this.timers.now());
    }
  }

  computePoseAt(now: number): FacePose {
    const project = this.store.project;
    let animation = null;
    const anim = this.playback.animId ? project.animations[this.playback.animId] : undefined;
    if (this.playback.active && anim) {
      const { position, finished } = resolvePosition(anim, this.playbackPosition(now));
      animation = sampleAnimation(anim, position);
      if (finished && this.playback.playing) {
        this.playOffset = anim.durationMs;
        // Animações disparadas por gesto liberam o rosto ao terminar; no editor, a última pose permanece.
        this.playback = { ...this.playback, playing: false, active: this.playback.origin === 'timeline' };
        queueMicrotask(() => this.emit());
      }
    }
    return computePose({
      avatar: project.avatar,
      emotionOverrides: project.emotions,
      state: this.state,
      stateElapsedMs: now - this.stateEnteredAt,
      emotion: this.effectiveEmotion,
      timeMs: now,
      seed: project.runtime.randomSeed,
      animation,
      spontaneous: this.spontaneous,
    });
  }

  renderNow(now: number): void {
    const pose = this.computePoseAt(now);
    this.lastPose = pose;
    if (this.state === 'speaking') this.audio.updateSpeech(speechEnvelope(now), now);
    if (!this.canvasCtx) return;
    renderFrame(this.canvasCtx, this.store.project.avatar, pose, {
      background: 'square',
      rgb565: this.store.project.device.colorPreview === 'rgb565',
    });
  }

  start(): void {
    if (this.raf !== null || this.hidden) return;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const now = this.timers.now();
      const interval = 1000 / this.store.project.device.targetFps;
      if (now - this.lastFrameAt < interval - 1.5) return;
      this.lastFrameAt = now;
      this.renderNow(now);
      this.frameTimes.push(now);
      while (this.frameTimes.length && this.frameTimes[0] < now - 1000) this.frameTimes.shift();
      if (now - this.lastDiagEmit >= 250) {
        this.fps = this.frameTimes.length;
        this.diagDirty = true;
      }
      if (this.diagDirty && now - this.lastDiagEmit >= 250) this.flushDiag();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stopLoop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  /** Suspende timers, áudio e renderização com a aba em segundo plano (PRD §11.1). */
  setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (hidden) {
      this.stopLoop();
      this.runner.pause();
      if (this.playback.playing) {
        this.playOffset = this.playbackPosition();
        this.playback = { ...this.playback, playing: false };
        this.resumePlaybackOnShow = true;
      }
      this.audio.stopSpeech();
      this.audio.suspend();
      if (this.filter.isDown) this.handlePointer('cancel', 0, 0, { left: 0, top: 0, width: 240, height: 240 }, 'mouse');
    } else {
      this.audio.resume();
      this.runner.resume();
      if (this.resumePlaybackOnShow) {
        this.resumePlaybackOnShow = false;
        this.playStartedAt = this.timers.now();
        this.playback = { ...this.playback, playing: true };
      }
      if (this.state === 'speaking') this.audio.startSpeech();
      this.start();
    }
    this.emit();
  }
  private resumePlaybackOnShow = false;

  get isHidden(): boolean {
    return this.hidden;
  }

  syncAudioSettings(): void {
    const rt = this.store.project.runtime;
    this.audio.setEnabled(rt.soundEnabled);
    this.audio.setVolume(rt.volume);
  }

  dispose(): void {
    this.stopLoop();
    this.runner.cancel();
    this.audio.stopSpeech();
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
  }
}
