import { describe, expect, it } from 'vitest';
import { EASING_FUNCTIONS, resolvePosition, sampleAnimation } from './animation';
import type { Animation } from './types';

const anim = (patch: Partial<Animation> = {}): Animation => ({
  id: 'a',
  name: 'A',
  durationMs: 1000,
  mode: 'once',
  keyframes: [
    { id: 'k1', t: 0, easing: 'linear', values: { gazeX: 0, eyeOpen: 1 } },
    { id: 'k2', t: 1000, easing: 'linear', values: { gazeX: 10 } },
  ],
  ...patch,
});

describe('easing', () => {
  it('todas as curvas começam em 0 e terminam em 1', () => {
    for (const f of Object.values(EASING_FUNCTIONS)) {
      expect(f(0)).toBeCloseTo(0);
      expect(f(1)).toBeCloseTo(1);
    }
  });
  it('easeIn < linear < easeOut no meio do intervalo', () => {
    expect(EASING_FUNCTIONS.easeIn(0.5)).toBeLessThan(0.5);
    expect(EASING_FUNCTIONS.easeOut(0.5)).toBeGreaterThan(0.5);
    expect(EASING_FUNCTIONS.easeInOut(0.5)).toBeCloseTo(0.5);
  });
});

describe('amostragem de quadros-chave', () => {
  it('interpola linearmente', () => {
    expect(sampleAnimation(anim(), 500).gazeX).toBeCloseTo(5);
  });

  it('usa a curva do quadro-chave de destino', () => {
    const a = anim();
    a.keyframes[1].easing = 'easeIn';
    expect(sampleAnimation(a, 500).gazeX).toBeCloseTo(2.5);
  });

  it('mantém canais definidos em apenas um quadro-chave', () => {
    expect(sampleAnimation(anim(), 800).eyeOpen).toBe(1);
  });

  it('mantém o valor fora do intervalo', () => {
    const a = anim({ keyframes: [{ id: 'k', t: 200, easing: 'linear', values: { gazeX: 3 } }] });
    expect(sampleAnimation(a, 0).gazeX).toBe(3);
    expect(sampleAnimation(a, 900).gazeX).toBe(3);
  });

  it('loop reinicia e once termina na última pose', () => {
    expect(resolvePosition(anim({ mode: 'loop' }), 1250)).toEqual({ position: 250, finished: false });
    expect(resolvePosition(anim(), 1250)).toEqual({ position: 1000, finished: true });
  });
});
