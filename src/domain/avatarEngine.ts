// AvatarEngine: calcula a pose final do rosto aplicando as camadas na ordem inversa
// de precedência do PRD §6.3 (6 → 1). Camadas superiores podem sobrescrever as inferiores.
import { CHANNEL_RANGES, type ChannelSample } from './animation';
import { resolveEmotion } from './emotions';
import { blinkFactor, saccadeOffset } from './spontaneous';
import type { AvatarConfig, EmotionId, EmotionOverride, EmotionValue, OperationalState } from './types';

export type Indicator =
  | 'none'
  | 'listening'
  | 'thinking'
  | 'executing'
  | 'connecting'
  | 'success'
  | 'error'
  | 'sleep'
  | 'charging'
  | 'low_battery';

export interface FacePose {
  eyeOpenL: number;
  eyeOpenR: number;
  eyeScale: number;
  eyeScaleY: number;
  gazeX: number;
  gazeY: number;
  browLiftL: number;
  browLiftR: number;
  /** Graus; positivo abaixa a ponta interna. */
  browTiltL: number;
  browTiltR: number;
  mouthOpen: number;
  mouthCurve: number;
  mouthWidthScale: number;
  mouthSkew: number;
  /** Escala de "respiração" aplicada ao rosto inteiro (estado sleep). */
  breath: number;
  indicator: Indicator;
  /** Fase 0..1 para animar o indicador. */
  indicatorPhase: number;
}

export interface EngineInput {
  avatar: AvatarConfig;
  emotionOverrides?: Partial<Record<EmotionId, EmotionOverride>>;
  state: OperationalState;
  /** Tempo desde a entrada no estado atual. */
  stateElapsedMs: number;
  emotion: EmotionValue;
  /** Relógio global da simulação, em ms. */
  timeMs: number;
  seed: number;
  /** Canais da animação ativa (camada 2), ou null. */
  animation: ChannelSample | null;
  /** Liga piscadas e micromovimentos (camada 5). */
  spontaneous: boolean;
}

export type LayerName = 'base' | 'spontaneous' | 'emotion' | 'speech' | 'animation' | 'state';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Envelope sintético de fala (0..1). Compartilhado com o áudio para manter a sincronia. */
export function speechEnvelope(t: number): number {
  const syllable = Math.abs(Math.sin(t * 0.018) * Math.sin(t * 0.0071 + 1.3));
  const phrase = 0.55 + 0.45 * Math.sin(t * 0.0013);
  return clamp(0.12 + 0.75 * syllable * phrase, 0, 1);
}

// Camada 6 — geometria-base
function baseLayer(avatar: AvatarConfig): FacePose {
  const p = avatar.parameters;
  return {
    eyeOpenL: p.eyes.eyelidOpen,
    eyeOpenR: p.eyes.eyelidOpen,
    eyeScale: 1,
    eyeScaleY: 1,
    gazeX: 0,
    gazeY: 0,
    browLiftL: 0,
    browLiftR: 0,
    browTiltL: p.eyebrows.tilt,
    browTiltR: p.eyebrows.tilt,
    mouthOpen: p.mouth.openness,
    mouthCurve: p.mouth.curvature,
    mouthWidthScale: 1,
    mouthSkew: 0,
    breath: 1,
    indicator: 'none',
    indicatorPhase: 0,
  };
}

// Camada 5 — comportamento espontâneo
function spontaneousLayer(pose: FacePose, input: EngineInput): void {
  if (!input.spontaneous || input.state === 'sleep' || input.state === 'wake') return;
  const b = blinkFactor(input.seed, input.timeMs);
  pose.eyeOpenL *= b;
  pose.eyeOpenR *= b;
  const s = saccadeOffset(input.seed, input.timeMs);
  pose.gazeX += s.x;
  pose.gazeY += s.y;
}

// Camada 4 — modificador de emoção
function emotionLayer(pose: FacePose, input: EngineInput): void {
  const i = clamp(input.emotion.intensity, 0, 1);
  if (i === 0 || input.emotion.id === 'neutral') return;
  const e = resolveEmotion(input.emotion.id, input.emotionOverrides?.[input.emotion.id]);
  pose.eyeOpenL *= lerp(1, e.eyeOpen, i);
  pose.eyeOpenR *= lerp(1, e.eyeOpen, i);
  pose.eyeScale *= lerp(1, e.eyeScale, i);
  pose.eyeScaleY *= lerp(1, e.eyeScaleY, i);
  pose.gazeX += e.gazeX * i;
  pose.gazeY += e.gazeY * i;
  pose.browLiftL += (e.browLift + e.browLiftL) * i;
  pose.browLiftR += (e.browLift + e.browLiftR) * i;
  pose.browTiltL += (e.browTiltInner + e.browTiltAsym) * i;
  pose.browTiltR += (e.browTiltInner - e.browTiltAsym) * i;
  if (e.mouthCurve !== null) pose.mouthCurve = lerp(pose.mouthCurve, e.mouthCurve, i);
  pose.mouthOpen = clamp(pose.mouthOpen + e.mouthOpen * i, 0, 1);
  pose.mouthWidthScale *= lerp(1, e.mouthWidthScale, i);
  pose.mouthSkew += e.mouthSkew * i;
}

// Camada 3 — fala sintética (somente em speaking)
function speechLayer(pose: FacePose, input: EngineInput): void {
  if (input.state !== 'speaking') return;
  pose.mouthOpen = speechEnvelope(input.timeMs);
}

// Camada 2 — animação / quadro-chave ativo (sobrescreve os canais que define)
function animationLayer(pose: FacePose, input: EngineInput): void {
  const a = input.animation;
  if (!a) return;
  if (a.eyeOpen !== undefined) pose.eyeOpenL = pose.eyeOpenR = clamp(a.eyeOpen, 0, 1);
  if (a.eyeScale !== undefined) pose.eyeScale = a.eyeScale;
  if (a.gazeX !== undefined) pose.gazeX = a.gazeX;
  if (a.gazeY !== undefined) pose.gazeY = a.gazeY;
  if (a.browLift !== undefined) pose.browLiftL = pose.browLiftR = a.browLift;
  if (a.browTilt !== undefined) pose.browTiltL = pose.browTiltR = a.browTilt;
  if (a.mouthOpen !== undefined) pose.mouthOpen = clamp(a.mouthOpen, 0, 1);
  if (a.mouthCurve !== undefined) pose.mouthCurve = a.mouthCurve;
  if (a.mouthWidthScale !== undefined) pose.mouthWidthScale = a.mouthWidthScale;
}

// Camada 1 — restrições de estado (maior precedência)
function stateLayer(pose: FacePose, input: EngineInput): void {
  const t = input.stateElapsedMs;
  const cycle = (period: number) => (input.timeMs % period) / period;
  switch (input.state) {
    case 'sleep':
      pose.eyeOpenL = pose.eyeOpenR = 0;
      pose.mouthOpen = 0;
      pose.gazeX = 0;
      pose.gazeY = 3;
      pose.breath = 1 + 0.02 * Math.sin((input.timeMs / 4000) * Math.PI * 2);
      pose.indicator = 'sleep';
      pose.indicatorPhase = cycle(3000);
      break;
    case 'wake': {
      // Sobrepõe qualquer pose anterior: olhos abrem rapidamente a partir de fechados.
      const k = clamp(t / 350, 0, 1);
      const open = 1 - (1 - k) * (1 - k);
      pose.eyeOpenL = pose.eyeOpenR = open;
      pose.eyeScale = 1 + 0.12 * Math.sin(k * Math.PI);
      pose.eyeScaleY = 1;
      pose.gazeX = 0;
      pose.gazeY = 0;
      pose.browLiftL = pose.browLiftR = 5 * open;
      pose.browTiltL = pose.browTiltR = input.avatar.parameters.eyebrows.tilt;
      pose.mouthOpen = 0;
      pose.mouthCurve = input.avatar.parameters.mouth.curvature;
      pose.mouthSkew = 0;
      pose.mouthWidthScale = 1;
      break;
    }
    case 'listening':
      pose.eyeScale *= 1.08;
      pose.browLiftL += 3;
      pose.browLiftR += 3;
      pose.indicator = 'listening';
      pose.indicatorPhase = cycle(1200);
      break;
    case 'thinking': {
      const a = cycle(2400) * Math.PI * 2;
      pose.gazeX += 8 * Math.cos(a);
      pose.gazeY += -7 + 2 * Math.sin(a);
      pose.indicator = 'thinking';
      pose.indicatorPhase = cycle(900);
      break;
    }
    case 'executing':
      pose.gazeY -= 2;
      pose.indicator = 'executing';
      pose.indicatorPhase = cycle(1000);
      break;
    case 'success':
      pose.mouthCurve = Math.max(pose.mouthCurve, 0.9);
      pose.eyeOpenL *= 0.75;
      pose.eyeOpenR *= 0.75;
      pose.indicator = 'success';
      pose.indicatorPhase = clamp(t / 400, 0, 1);
      break;
    case 'error':
      pose.browTiltL -= 10;
      pose.browTiltR -= 10;
      pose.mouthCurve = Math.min(pose.mouthCurve, -0.45);
      pose.indicator = 'error';
      pose.indicatorPhase = clamp(t / 300, 0, 1);
      break;
    case 'connecting':
      pose.gazeX += 10 * Math.sin(cycle(1800) * Math.PI * 2);
      pose.indicator = 'connecting';
      pose.indicatorPhase = cycle(1500);
      break;
    case 'charging':
      pose.eyeOpenL *= 0.85;
      pose.eyeOpenR *= 0.85;
      pose.mouthCurve = Math.max(pose.mouthCurve, 0.35);
      pose.indicator = 'charging';
      pose.indicatorPhase = cycle(2000);
      break;
    case 'low_battery':
      pose.eyeOpenL *= 0.5;
      pose.eyeOpenR *= 0.5;
      pose.browLiftL -= 3;
      pose.browLiftR -= 3;
      pose.mouthCurve = Math.min(pose.mouthCurve, -0.15);
      pose.indicator = 'low_battery';
      pose.indicatorPhase = cycle(1000);
      break;
    case 'idle':
    case 'speaking':
      break;
  }
}

/** Pose final do rosto. */
export function computePose(input: EngineInput): FacePose {
  const pose = baseLayer(input.avatar);
  spontaneousLayer(pose, input);
  emotionLayer(pose, input);
  speechLayer(pose, input);
  animationLayer(pose, input);
  stateLayer(pose, input);
  pose.eyeOpenL = clamp(pose.eyeOpenL, 0, 1);
  pose.eyeOpenR = clamp(pose.eyeOpenR, 0, 1);
  pose.mouthOpen = clamp(pose.mouthOpen, 0, 1);
  pose.mouthCurve = clamp(pose.mouthCurve, -1, 1);
  pose.mouthSkew = clamp(pose.mouthSkew, -1, 1);
  pose.eyeScale = clamp(pose.eyeScale, CHANNEL_RANGES.eyeScale.min, CHANNEL_RANGES.eyeScale.max);
  return pose;
}
