// Comportamentos espontâneos reproduzíveis: piscadas e micromovimentos do olhar (PRD §6.3, item 5).
import { mulberry32 } from './random';

export const BLINK_DURATION_MS = 160;

export interface SpontaneousSchedule {
  blinks: number[];
  saccades: Array<{ t: number; x: number; y: number }>;
}

const cache = new Map<number, SpontaneousSchedule & { horizon: number; nextRand: () => number; lastBlink: number; lastSaccade: number }>();

/** Gera (e guarda) a agenda determinística até `horizonMs` para a semente informada. */
export function getSchedule(seed: number, horizonMs: number): SpontaneousSchedule {
  let s = cache.get(seed);
  if (!s) {
    const rand = mulberry32(seed);
    s = { blinks: [], saccades: [], horizon: 0, nextRand: rand, lastBlink: 0, lastSaccade: 0 };
    cache.set(seed, s);
    if (cache.size > 16) cache.delete(cache.keys().next().value as number);
  }
  while (s.lastBlink < horizonMs || s.lastSaccade < horizonMs) {
    if (s.lastBlink <= s.lastSaccade) {
      s.lastBlink += 2200 + s.nextRand() * 3800;
      s.blinks.push(Math.round(s.lastBlink));
    } else {
      s.lastSaccade += 1400 + s.nextRand() * 2600;
      s.saccades.push({ t: Math.round(s.lastSaccade), x: Math.round((s.nextRand() - 0.5) * 6), y: Math.round((s.nextRand() - 0.5) * 4) });
    }
  }
  s.horizon = Math.max(s.horizon, horizonMs);
  return s;
}

/** Fator multiplicativo das pálpebras (1 = aberto, 0 = fechado) no instante `t`. */
export function blinkFactor(seed: number, t: number): number {
  const { blinks } = getSchedule(seed, t + BLINK_DURATION_MS);
  for (let i = blinks.length - 1; i >= 0; i--) {
    const b = blinks[i];
    if (b > t) continue;
    const dt = t - b;
    if (dt >= BLINK_DURATION_MS) return 1;
    const half = BLINK_DURATION_MS / 2;
    return dt < half ? 1 - dt / half : (dt - half) / half;
  }
  return 1;
}

/** Deslocamento sutil do olhar no instante `t`. */
export function saccadeOffset(seed: number, t: number): { x: number; y: number } {
  const { saccades } = getSchedule(seed, t);
  for (let i = saccades.length - 1; i >= 0; i--) {
    if (saccades[i].t <= t) return { x: saccades[i].x, y: saccades[i].y };
  }
  return { x: 0, y: 0 };
}

/** Instantes de piscada no intervalo [from, to), úteis para diagnóstico e testes. */
export function blinksBetween(seed: number, from: number, to: number): number[] {
  return getSchedule(seed, to).blinks.filter((b) => b >= from && b < to);
}
