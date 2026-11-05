import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCENARIOS, ScenarioRunner, canTransition, type TimerApi } from './stateMachine';
import { OPERATIONAL_STATES, type OperationalState } from './types';

const timers: TimerApi = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

describe('transições', () => {
  it('permite retornar a idle a partir de qualquer estado', () => {
    for (const s of OPERATIONAL_STATES) if (s !== 'idle') expect(canTransition(s, 'idle')).toBe(true);
  });

  it('rejeita transições inválidas', () => {
    expect(canTransition('idle', 'speaking')).toBe(false);
    expect(canTransition('sleep', 'listening')).toBe(false);
    expect(canTransition('success', 'error')).toBe(false);
    expect(canTransition('idle', 'idle')).toBe(false);
  });

  it('todos os cenários usam apenas transições válidas a partir de idle', () => {
    for (const def of Object.values(SCENARIOS)) {
      let from: OperationalState = def.id === 'pttRelease' ? 'listening' : 'idle';
      for (const step of def.steps) {
        expect(canTransition(from, step.state), `${def.id}: ${from} → ${step.state}`).toBe(true);
        from = step.state;
      }
    }
  });
});

describe('ScenarioRunner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('executa o ciclo completo de diálogo na ordem', () => {
    const seen: string[] = [];
    const r = new ScenarioRunner(timers, (s) => seen.push(s.state));
    r.start(SCENARIOS.dialog);
    vi.advanceTimersByTime(10_000);
    expect(seen).toEqual(['wake', 'listening', 'thinking', 'speaking', 'idle']);
    expect(r.activeId).toBeNull();
  });

  it('cancela imediatamente e descarta timers pendentes', () => {
    const seen: string[] = [];
    const ended: Array<[string, boolean]> = [];
    const r = new ScenarioRunner(timers, (s) => seen.push(s.state), (id, c) => ended.push([id, c]));
    r.start(SCENARIOS.dialog);
    vi.advanceTimersByTime(600);
    r.cancel();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(30_000);
    expect(seen).toEqual(['wake', 'listening']);
    expect(ended).toEqual([['dialog', true]]);
  });

  it('pausa e retoma preservando o tempo restante', () => {
    const seen: string[] = [];
    const r = new ScenarioRunner(timers, (s) => seen.push(s.state));
    r.start(SCENARIOS.task);
    vi.advanceTimersByTime(1500);
    r.pause();
    vi.advanceTimersByTime(60_000);
    expect(seen).toEqual(['executing']);
    r.resume();
    vi.advanceTimersByTime(499);
    expect(seen).toEqual(['executing']);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual(['executing', 'success']);
  });

  it('iniciar outro cenário substitui o anterior sem eventos atrasados', () => {
    const seen: string[] = [];
    const r = new ScenarioRunner(timers, (s) => seen.push(s.state));
    r.start(SCENARIOS.dialog);
    r.start(SCENARIOS.failure);
    vi.advanceTimersByTime(30_000);
    expect(seen).toEqual(['wake', 'error', 'idle']);
  });
});
