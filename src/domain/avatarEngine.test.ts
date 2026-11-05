import { describe, expect, it } from 'vitest';
import { computePose, speechEnvelope, type EngineInput } from './avatarEngine';
import { createDefaultProject } from './project';
import { EMOTIONS } from './types';

const base = (patch: Partial<EngineInput> = {}): EngineInput => ({
  avatar: createDefaultProject().avatar,
  state: 'idle',
  stateElapsedMs: 1000,
  emotion: { id: 'neutral', intensity: 1 },
  timeMs: 100,
  seed: 42,
  animation: null,
  spontaneous: false,
  ...patch,
});

describe('AvatarEngine — precedência (PRD §6.3)', () => {
  it('geometria-base reflete os parâmetros do editor', () => {
    const input = base();
    input.avatar.parameters.eyes.eyelidOpen = 0.6;
    input.avatar.parameters.mouth.curvature = -0.4;
    const p = computePose(input);
    expect(p.eyeOpenL).toBeCloseTo(0.6);
    expect(p.mouthCurve).toBeCloseTo(-0.4);
  });

  it('sleep força pálpebras fechadas mesmo com animação abrindo os olhos', () => {
    const p = computePose(base({ state: 'sleep', animation: { eyeOpen: 1, mouthOpen: 1 } }));
    expect(p.eyeOpenL).toBe(0);
    expect(p.eyeOpenR).toBe(0);
    expect(p.mouthOpen).toBe(0);
  });

  it('wake sobrepõe a pose anterior (emoção e animação)', () => {
    const p = computePose(base({ state: 'wake', stateElapsedMs: 0, emotion: { id: 'angry', intensity: 1 }, animation: { eyeOpen: 1 } }));
    expect(p.eyeOpenL).toBe(0);
    const angry = computePose(base({ emotion: { id: 'angry', intensity: 1 } }));
    expect(p.browTiltL).not.toBeCloseTo(angry.browTiltL);
  });

  it('animação sobrescreve a emoção nos canais que define', () => {
    const p = computePose(base({ emotion: { id: 'sad', intensity: 1 }, animation: { mouthCurve: 0.8 } }));
    expect(p.mouthCurve).toBeCloseTo(0.8);
  });

  it('fala modula a boca somente em speaking', () => {
    const idle = computePose(base({ timeMs: 1234 }));
    const speaking = computePose(base({ state: 'speaking', timeMs: 1234 }));
    expect(idle.mouthOpen).toBe(0);
    expect(speaking.mouthOpen).toBeCloseTo(speechEnvelope(1234));
  });

  it('fala sobrepõe a abertura de boca da emoção', () => {
    const p = computePose(base({ state: 'speaking', timeMs: 500, emotion: { id: 'surprised', intensity: 1 } }));
    expect(p.mouthOpen).toBeCloseTo(speechEnvelope(500));
  });

  it('comportamento espontâneo fica abaixo da emoção e é desligável', () => {
    // Instante dentro de uma piscada para a semente 42.
    const on = computePose(base({ spontaneous: true, timeMs: 0 }));
    const off = computePose(base({ spontaneous: false, timeMs: 0 }));
    expect(on.eyeOpenL).toBeLessThanOrEqual(off.eyeOpenL);
  });
});

describe('AvatarEngine — estado e emoção ortogonais', () => {
  it('trocar a emoção não altera o estado, e vice-versa', () => {
    const a = computePose(base({ state: 'speaking', emotion: { id: 'curious', intensity: 0.8 }, timeMs: 700 }));
    const b = computePose(base({ state: 'speaking', emotion: { id: 'neutral', intensity: 1 }, timeMs: 700 }));
    expect(a.mouthOpen).toBeCloseTo(b.mouthOpen); // a fala continua igual
    expect(a.browLiftR).not.toBeCloseTo(b.browLiftR); // a emoção continua aplicada
  });

  it('intensidade 0 equivale a neutro e intensidade escala o efeito', () => {
    const neutral = computePose(base());
    const zero = computePose(base({ emotion: { id: 'happy', intensity: 0 } }));
    const half = computePose(base({ emotion: { id: 'happy', intensity: 0.5 } }));
    const full = computePose(base({ emotion: { id: 'happy', intensity: 1 } }));
    expect(zero).toEqual(neutral);
    expect(half.mouthCurve).toBeGreaterThan(neutral.mouthCurve);
    expect(full.mouthCurve).toBeGreaterThan(half.mouthCurve);
  });

  it('as dez emoções diferem da neutra', () => {
    const neutral = computePose(base());
    for (const id of EMOTIONS.filter((e) => e !== 'neutral')) {
      expect(computePose(base({ emotion: { id, intensity: 1 } })), id).not.toEqual(neutral);
    }
  });

  it('aplica sobrescritas de emoção do projeto', () => {
    const p = computePose(base({ emotion: { id: 'happy', intensity: 1 }, emotionOverrides: { happy: { mouthCurve: -1 } } }));
    expect(p.mouthCurve).toBeCloseTo(-1);
  });
});
