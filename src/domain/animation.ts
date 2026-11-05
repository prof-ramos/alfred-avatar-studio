// Interpolação de quadros-chave (PRD §4.3).
import type { Animation, AnimationChannel, Easing } from './types';

export const EASING_FUNCTIONS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

export type ChannelSample = Partial<Record<AnimationChannel, number>>;

/** Converte o tempo de reprodução em posição dentro da animação, respeitando loop/once. */
export function resolvePosition(anim: Animation, elapsedMs: number): { position: number; finished: boolean } {
  const d = Math.max(1, anim.durationMs);
  if (anim.mode === 'loop') return { position: ((elapsedMs % d) + d) % d, finished: false };
  if (elapsedMs >= d) return { position: d, finished: true };
  return { position: Math.max(0, elapsedMs), finished: false };
}

/**
 * Amostra os canais da animação na posição dada. Cada canal é interpolado apenas entre
 * os quadros-chave que o definem; antes do primeiro e depois do último, o valor é mantido.
 */
export function sampleAnimation(anim: Animation, positionMs: number): ChannelSample {
  const frames = [...anim.keyframes].sort((a, b) => a.t - b.t);
  const out: ChannelSample = {};
  const channels = new Set<AnimationChannel>();
  for (const k of frames) for (const c of Object.keys(k.values) as AnimationChannel[]) channels.add(c);

  for (const ch of channels) {
    const defined = frames.filter((k) => k.values[ch] !== undefined);
    if (defined.length === 0) continue;
    if (positionMs <= defined[0].t) {
      out[ch] = defined[0].values[ch];
      continue;
    }
    const last = defined[defined.length - 1];
    if (positionMs >= last.t) {
      out[ch] = last.values[ch];
      continue;
    }
    for (let i = 1; i < defined.length; i++) {
      const a = defined[i - 1];
      const b = defined[i];
      if (positionMs <= b.t) {
        const span = b.t - a.t;
        const raw = span <= 0 ? 1 : (positionMs - a.t) / span;
        const e = EASING_FUNCTIONS[b.easing](raw);
        out[ch] = (a.values[ch] as number) + ((b.values[ch] as number) - (a.values[ch] as number)) * e;
        break;
      }
    }
  }
  return out;
}

/** Valores padrão e limites dos canais, usados pelo editor da linha do tempo. */
export const CHANNEL_RANGES: Record<AnimationChannel, { min: number; max: number; step: number; neutral: number }> = {
  eyeOpen: { min: 0, max: 1, step: 0.05, neutral: 1 },
  eyeScale: { min: 0.5, max: 1.6, step: 0.05, neutral: 1 },
  gazeX: { min: -30, max: 30, step: 1, neutral: 0 },
  gazeY: { min: -30, max: 30, step: 1, neutral: 0 },
  browLift: { min: -15, max: 20, step: 1, neutral: 0 },
  browTilt: { min: -30, max: 30, step: 1, neutral: 0 },
  mouthOpen: { min: 0, max: 1, step: 0.05, neutral: 0 },
  mouthCurve: { min: -1, max: 1, step: 0.05, neutral: 0.3 },
  mouthWidthScale: { min: 0.3, max: 1.8, step: 0.05, neutral: 1 },
};
