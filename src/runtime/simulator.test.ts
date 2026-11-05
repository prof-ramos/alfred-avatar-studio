import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { Simulator } from './simulator';
import { StudioStore } from './studioStore';

const rect = { left: 0, top: 0, width: 240, height: 240 };

async function setup() {
  globalThis.indexedDB = new IDBFactory();
  const store = new StudioStore();
  await store.init();
  const sim = new Simulator(store);
  return { store, sim };
}

describe('Simulator', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  it('toque simples no centro inicia o diálogo', async () => {
    const { sim } = await setup();
    sim.handlePointer('down', 120, 120, rect, 'mouse');
    vi.advanceTimersByTime(100);
    sim.handlePointer('up', 120, 120, rect, 'mouse');
    expect(sim.currentState).toBe('wake');
    vi.advanceTimersByTime(10_000);
    expect(sim.stateLog.map((s) => s.state)).toEqual(['idle', 'wake', 'listening', 'thinking', 'speaking', 'idle']);
  });

  it('cliques fora do círculo são descartados', async () => {
    const { sim } = await setup();
    expect(sim.handlePointer('down', 3, 3, rect, 'mouse')).toBe(false);
    sim.handlePointer('up', 3, 3, rect, 'mouse');
    expect(sim.currentState).toBe('idle');
    expect(sim.getDiagSnapshot().rejectedTouches).toBe(1);
  });

  it('cancelar cenário não deixa eventos atrasados', async () => {
    const { sim } = await setup();
    sim.runScenario('dialog');
    vi.advanceTimersByTime(700);
    sim.cancelScenario();
    const len = sim.stateLog.length;
    vi.advanceTimersByTime(30_000);
    expect(sim.stateLog.length).toBe(len);
    expect(sim.currentState).toBe('idle');
  });

  it('Push-to-Talk (GPIO 0): pressionar vai para listening e soltar responde', async () => {
    const { sim } = await setup();
    sim.pttPress('hardware_button');
    expect(sim.currentState).toBe('listening');
    expect(sim.buttonLog.at(-1)).toMatchObject({ gpio: 0, level: 0, source: 'hardware_button' });
    sim.pttRelease('hardware_button');
    expect(sim.currentState).toBe('thinking');
    vi.advanceTimersByTime(10_000);
    expect(sim.currentState).toBe('idle');
  });

  it('toque prolongado alterna o modo dormir', async () => {
    const { sim } = await setup();
    sim.handlePointer('down', 120, 120, rect, 'mouse');
    vi.advanceTimersByTime(500);
    expect(sim.currentState).toBe('sleep');
    sim.handlePointer('up', 120, 120, rect, 'mouse');
    expect(sim.currentState).toBe('sleep');
  });

  it('swipe para a direita troca a emoção sem alterar o estado', async () => {
    const { sim } = await setup();
    sim.forceState('speaking');
    sim.handlePointer('down', 100, 120, rect, 'mouse');
    sim.handlePointer('move', 120, 120, rect, 'mouse');
    sim.handlePointer('up', 140, 120, rect, 'mouse');
    expect(sim.effectiveEmotion.id).toBe('happy');
    expect(sim.currentState).toBe('speaking');
  });

  it('transições inválidas são registradas e ignoradas', async () => {
    const { sim } = await setup();
    expect(sim.setState('speaking')).toBe(false);
    expect(sim.currentState).toBe('idle');
    expect(sim.getDiagSnapshot().invalidTransitions.at(-1)).toMatchObject({ from: 'idle', to: 'speaking' });
  });

  it('som mudo registra sinais com ganho zero', async () => {
    const { sim, store } = await setup();
    store.update((d) => (d.runtime.soundEnabled = false));
    sim.syncAudioSettings();
    sim.runScenario('task');
    vi.advanceTimersByTime(5000);
    expect(sim.audio.log.map((l) => l.cue)).toContain('success');
    expect(sim.audio.log.every((l) => l.gain === 0)).toBe(true);
  });

  it('reprodução: play, pausa, passo e parada', async () => {
    const { sim } = await setup();
    sim.selectAnimation('olhar-lateral');
    sim.play('olhar-lateral');
    vi.advanceTimersByTime(600);
    sim.pause();
    expect(sim.animationPosition()).toBe(600);
    vi.advanceTimersByTime(1000);
    expect(sim.animationPosition()).toBe(600);
    sim.step(1);
    expect(sim.animationPosition()).toBeCloseTo(600 + 1000 / 30);
    expect(sim.computePoseAt(performance.now()).gazeX).toBeLessThan(-10);
    sim.stop();
    expect(sim.getSnapshot().playback.active).toBe(false);
  });
});
