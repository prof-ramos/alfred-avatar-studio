// Máquina de estados operacionais e cenários de conversação (PRD §4.4, §6.1).
import type { EmotionValue, OperationalState } from './types';

/** Transições permitidas. Retornar a `idle` é sempre permitido (cancelamento). */
export const TRANSITIONS: Record<OperationalState, readonly OperationalState[]> = {
  idle: ['wake', 'listening', 'executing', 'error', 'sleep', 'connecting', 'charging', 'low_battery'],
  wake: ['listening', 'error'],
  listening: ['thinking', 'error'],
  thinking: ['speaking', 'executing', 'error'],
  speaking: ['listening', 'error'],
  executing: ['success', 'error'],
  success: [],
  error: [],
  sleep: ['wake'],
  connecting: ['error'],
  charging: ['low_battery'],
  low_battery: ['charging', 'sleep'],
};

export function canTransition(from: OperationalState, to: OperationalState): boolean {
  if (from === to) return false;
  if (to === 'idle') return true;
  return TRANSITIONS[from].includes(to);
}

export interface ScenarioStep {
  state: OperationalState;
  /** Tempo de permanência no estado antes do próximo passo. */
  durationMs: number;
  emotion?: EmotionValue;
}

export interface ScenarioDefinition {
  id: string;
  label: string;
  steps: ScenarioStep[];
}

export const SCENARIOS: Record<string, ScenarioDefinition> = {
  dialog: {
    id: 'dialog',
    label: 'Ciclo completo de diálogo',
    steps: [
      { state: 'wake', durationMs: 500 },
      { state: 'listening', durationMs: 2000 },
      { state: 'thinking', durationMs: 1500 },
      { state: 'speaking', durationMs: 3000, emotion: { id: 'happy', intensity: 0.6 } },
      { state: 'idle', durationMs: 0 },
    ],
  },
  task: {
    id: 'task',
    label: 'Tarefa e sucesso',
    steps: [
      { state: 'executing', durationMs: 2000 },
      { state: 'success', durationMs: 1200, emotion: { id: 'happy', intensity: 0.8 } },
      { state: 'idle', durationMs: 0 },
    ],
  },
  failure: {
    id: 'failure',
    label: 'Falha',
    steps: [
      { state: 'error', durationMs: 2000, emotion: { id: 'confused', intensity: 0.7 } },
      { state: 'idle', durationMs: 0 },
    ],
  },
  connectOk: {
    id: 'connectOk',
    label: 'Conectividade (sucesso)',
    steps: [
      { state: 'connecting', durationMs: 2500 },
      { state: 'idle', durationMs: 0 },
    ],
  },
  connectFail: {
    id: 'connectFail',
    label: 'Conectividade (falha)',
    steps: [
      { state: 'connecting', durationMs: 2500 },
      { state: 'error', durationMs: 1800, emotion: { id: 'sad', intensity: 0.6 } },
      { state: 'idle', durationMs: 0 },
    ],
  },
  /** Continuação após soltar o botão Push-to-Talk. */
  pttRelease: {
    id: 'pttRelease',
    label: 'Resposta após Push-to-Talk',
    steps: [
      { state: 'thinking', durationMs: 1200 },
      { state: 'speaking', durationMs: 2500, emotion: { id: 'happy', intensity: 0.5 } },
      { state: 'idle', durationMs: 0 },
    ],
  },
};

export interface TimerApi {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
}

export const browserTimers: TimerApi = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => performance.now(),
};

/**
 * Executa os passos de um cenário com um único timer pendente por vez.
 * `cancel()` descarta o timer imediatamente; `pause()`/`resume()` preservam o tempo restante.
 */
export class ScenarioRunner {
  private handle: unknown = null;
  private steps: ScenarioStep[] = [];
  private index = -1;
  private remaining = 0;
  private stepStartedAt = 0;
  private paused = false;
  private _activeId: string | null = null;

  constructor(
    private readonly timers: TimerApi,
    private readonly onStep: (step: ScenarioStep, scenarioId: string) => void,
    private readonly onEnd: (scenarioId: string, cancelled: boolean) => void = () => {},
  ) {}

  get activeId(): string | null {
    return this._activeId;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  start(def: ScenarioDefinition): void {
    this.clearTimer();
    this._activeId = def.id;
    this.steps = def.steps;
    this.index = -1;
    this.paused = false;
    this.advance();
  }

  cancel(): void {
    const id = this._activeId;
    this.clearTimer();
    this._activeId = null;
    this.steps = [];
    this.index = -1;
    this.paused = false;
    if (id) this.onEnd(id, true);
  }

  pause(): void {
    if (!this._activeId || this.paused) return;
    this.remaining = Math.max(0, this.remaining - (this.timers.now() - this.stepStartedAt));
    this.clearTimer();
    this.paused = true;
  }

  resume(): void {
    if (!this._activeId || !this.paused) return;
    this.paused = false;
    this.schedule(this.remaining);
  }

  private advance(): void {
    this.index++;
    const id = this._activeId as string;
    const step = this.steps[this.index];
    if (!step) {
      this._activeId = null;
      this.onEnd(id, false);
      return;
    }
    this.onStep(step, id);
    // onStep pode ter cancelado o cenário.
    if (this._activeId !== id) return;
    if (this.index === this.steps.length - 1) {
      this._activeId = null;
      this.onEnd(id, false);
      return;
    }
    this.schedule(step.durationMs);
  }

  private schedule(ms: number): void {
    this.remaining = ms;
    this.stepStartedAt = this.timers.now();
    this.handle = this.timers.setTimeout(() => {
      this.handle = null;
      this.advance();
    }, ms);
  }

  private clearTimer(): void {
    if (this.handle !== null) this.timers.clearTimeout(this.handle);
    this.handle = null;
  }
}
