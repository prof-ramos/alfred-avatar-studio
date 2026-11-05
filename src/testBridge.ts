// Ponte somente leitura para testes E2E. Ativada apenas fora de produção e com `?test=1`.
import { blinksBetween } from './domain/spontaneous';
import type { Simulator } from './runtime/simulator';
import type { StudioStore } from './runtime/studioStore';

export function installTestBridge(sim: Simulator, store: StudioStore): void {
  if (import.meta.env.MODE === 'production') return;
  if (!new URLSearchParams(window.location.search).has('test')) return;
  const bridge = {
    getState: () => sim.currentState,
    getEmotion: () => ({ ...sim.effectiveEmotion }),
    getLastTouchEvent: () => sim.touchHistory.at(-1) ?? null,
    getTouchHistory: () => sim.touchHistory.map((e) => ({ ...e })),
    getGestureLog: () => sim.gestureLog.map((g) => ({ type: g.type, ...(g.direction && { direction: g.direction }) })),
    getStateLog: () => sim.stateLog.map((s) => ({ ...s })),
    getButtonLog: () => sim.buttonLog.map((b) => ({ ...b })),
    getFps: () => sim.currentFps,
    getSeed: () => store.project.runtime.randomSeed,
    getBlinks: (from: number, to: number) => blinksBetween(store.project.runtime.randomSeed, from, to),
    getAudioLog: () => sim.audio.log.map((a) => ({ cue: a.cue, gain: a.gain })),
    getPose: () => (sim.pose ? { ...sim.pose } : null),
    getPlayback: () => ({ ...sim.getSnapshot().playback, position: sim.animationPosition() }),
    getProject: () => JSON.parse(store.exportJson()) as unknown,
    getSaveStatus: () => store.getState().saveStatus,
    isRenderLoopRunning: () => sim.isRenderLoopRunning,
    scenarioActive: () => sim.scenarioActive,
    flush: () => store.flush(),
  };
  Object.defineProperty(window, '__ALFRED_TEST__', { value: Object.freeze(bridge), configurable: false });
}
