// Biblioteca de emoções (PRD §6.2). Valores descrevem a expressão em intensidade 1.0.
import type { EmotionId, EmotionOverride } from './types';

export interface EmotionModifier {
  /** Fator de abertura das pálpebras. */
  eyeOpen: number;
  /** Fator de escala dos olhos. */
  eyeScale: number;
  /** Fator de achatamento vertical dos olhos. */
  eyeScaleY: number;
  gazeX: number;
  gazeY: number;
  browLift: number;
  /** Elevação extra apenas da sobrancelha esquerda/direita (assimetria). */
  browLiftL: number;
  browLiftR: number;
  /** Graus: positivo abaixa a ponta interna (irritação); negativo eleva (tristeza). */
  browTiltInner: number;
  /** Graus aplicados com sinais opostos em cada lado (confusão). */
  browTiltAsym: number;
  /** Curvatura-alvo absoluta da boca (-1 a 1). `null` mantém a curvatura-base. */
  mouthCurve: number | null;
  mouthOpen: number;
  mouthWidthScale: number;
  /** Assimetria da boca (-1 a 1). */
  mouthSkew: number;
}

export const NEUTRAL_MODIFIER: EmotionModifier = {
  eyeOpen: 1,
  eyeScale: 1,
  eyeScaleY: 1,
  gazeX: 0,
  gazeY: 0,
  browLift: 0,
  browLiftL: 0,
  browLiftR: 0,
  browTiltInner: 0,
  browTiltAsym: 0,
  mouthCurve: null,
  mouthOpen: 0,
  mouthWidthScale: 1,
  mouthSkew: 0,
};

const m = (partial: Partial<EmotionModifier>): EmotionModifier => ({ ...NEUTRAL_MODIFIER, ...partial });

export const EMOTION_LIBRARY: Record<EmotionId, EmotionModifier> = {
  neutral: m({}),
  happy: m({ eyeOpen: 0.8, eyeScaleY: 0.8, browLift: 3, mouthCurve: 0.95, mouthWidthScale: 1.15 }),
  curious: m({ eyeScale: 1.08, gazeX: 5, gazeY: -2, browLiftR: 8, mouthCurve: 0.1, mouthWidthScale: 0.7 }),
  surprised: m({ eyeScale: 1.25, browLift: 10, mouthCurve: 0, mouthOpen: 0.8, mouthWidthScale: 0.55 }),
  confused: m({ browTiltAsym: 14, browLiftL: 4, gazeX: -3, mouthCurve: -0.1, mouthSkew: 0.6 }),
  suspicious: m({ eyeOpen: 0.45, browTiltInner: 10, gazeX: -7, mouthCurve: -0.1, mouthWidthScale: 0.7 }),
  angry: m({ eyeOpen: 0.7, browTiltInner: 24, browLift: -4, mouthCurve: -0.6, mouthWidthScale: 0.85 }),
  sad: m({ eyeOpen: 0.8, browTiltInner: -18, gazeY: 4, mouthCurve: -0.7, mouthWidthScale: 0.8 }),
  excited: m({ eyeScale: 1.15, browLift: 6, mouthCurve: 1, mouthOpen: 0.5, mouthWidthScale: 1.2 }),
  tired: m({ eyeOpen: 0.45, browLift: -3, browTiltInner: -6, gazeY: 3, mouthCurve: -0.1, mouthWidthScale: 0.8 }),
  ironic: m({ eyeOpen: 0.85, browLiftR: 7, mouthCurve: 0.4, mouthSkew: 0.8 }),
};

/** Aplica as sobrescritas do projeto sobre o modificador da biblioteca. */
export function resolveEmotion(id: EmotionId, override?: EmotionOverride): EmotionModifier {
  const base = EMOTION_LIBRARY[id];
  if (!override) return base;
  return {
    ...base,
    ...(override.eyeOpen !== undefined && { eyeOpen: override.eyeOpen }),
    ...(override.eyeScaleY !== undefined && { eyeScaleY: override.eyeScaleY }),
    ...(override.browTiltInner !== undefined && { browTiltInner: override.browTiltInner }),
    ...(override.browLift !== undefined && { browLift: override.browLift }),
    ...(override.mouthCurve !== undefined && { mouthCurve: override.mouthCurve }),
    ...(override.mouthOpen !== undefined && { mouthOpen: override.mouthOpen }),
    ...(override.mouthWidthScale !== undefined && { mouthWidthScale: override.mouthWidthScale }),
  };
}
