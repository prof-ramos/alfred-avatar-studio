// Projeto padrão, validação estrita e migração de schema (PRD §8, §9.1, §11.3).
import {
  ANIMATION_CHANNELS,
  EASINGS,
  EMOTIONS,
  GESTURES,
  OPERATIONAL_STATES,
  type Animation,
  type AnimationChannel,
  type BindingAction,
  type EmotionOverride,
  type GestureBinding,
  type Keyframe,
  type Project,
} from './types';

export const SCHEMA_URL = 'https://alfred-studio.local/schemas/project-v1.4.json';
export const CURRENT_SCHEMA_VERSION = 2;

export function newId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `${prefix}-${rand}`;
}

export function defaultAnimations(): Record<string, Animation> {
  return {
    'olhar-lateral': {
      id: 'olhar-lateral',
      name: 'Olhar lateral',
      durationMs: 2400,
      mode: 'loop',
      keyframes: [
        { id: 'k1', t: 0, easing: 'linear', values: { gazeX: 0 } },
        { id: 'k2', t: 600, easing: 'easeInOut', values: { gazeX: -12 } },
        { id: 'k3', t: 1800, easing: 'easeInOut', values: { gazeX: 12 } },
        { id: 'k4', t: 2400, easing: 'easeInOut', values: { gazeX: 0 } },
      ],
    },
    surpresa: {
      id: 'surpresa',
      name: 'Surpresa',
      durationMs: 1200,
      mode: 'once',
      keyframes: [
        { id: 'k1', t: 0, easing: 'linear', values: { eyeScale: 1, browLift: 0, mouthOpen: 0 } },
        { id: 'k2', t: 250, easing: 'easeOut', values: { eyeScale: 1.25, browLift: 10, mouthOpen: 0.7 } },
        { id: 'k3', t: 900, easing: 'linear', values: { eyeScale: 1.25, browLift: 10, mouthOpen: 0.7 } },
        { id: 'k4', t: 1200, easing: 'easeInOut', values: { eyeScale: 1, browLift: 0, mouthOpen: 0 } },
      ],
    },
  };
}

export function defaultBindings(): GestureBinding[] {
  return [
    { gesture: 'tap', action: 'activate' },
    { gesture: 'longPress', action: 'toggleSleep' },
    { gesture: 'swipeLeft', action: 'prevEmotion' },
    { gesture: 'swipeRight', action: 'nextEmotion' },
    { gesture: 'swipeUp', action: 'scenario:task' },
    { gesture: 'swipeDown', action: 'animation:surpresa' },
  ];
}

export function createDefaultProject(name = 'Alfred Classic', id = newId('alfred')): Project {
  const now = new Date().toISOString();
  return {
    $schema: SCHEMA_URL,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project: { id, name, createdAt: now, updatedAt: now },
    device: {
      profile: 'XIAOZHI_ROBOT_BALL_128',
      width: 240,
      height: 240,
      shape: 'circle',
      targetFps: 30,
      colorPreview: 'rgba32',
      showLegs: true,
      showSafeArea: false,
      gestureThresholds: { longPressMs: 500, movementTolerancePx: 6, swipeMinDistancePx: 24 },
    },
    avatar: {
      background: '#000000',
      primaryColor: '#7DD3FC',
      accentColor: '#38BDF8',
      glow: true,
      strokeWidth: 4,
      parameters: {
        eyes: { shape: 'rounded', width: 48, height: 48, spacing: 36, eyelidOpen: 1, offsetY: -12 },
        eyebrows: { tilt: 0, elevation: 0, thickness: 4, curvature: 0.2 },
        mouth: { style: 'curve', width: 42, height: 16, openness: 0, curvature: 0.3, offsetY: 44 },
      },
    },
    runtime: { defaultState: 'idle', defaultEmotion: 'neutral', randomSeed: 42, soundEnabled: true, volume: 0.6 },
    emotions: {},
    animations: defaultAnimations(),
    bindings: defaultBindings(),
  };
}

export function cloneProject(p: Project): Project {
  return JSON.parse(JSON.stringify(p)) as Project;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export type ValidationResult = { ok: true; project: Project; migrated: boolean } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
// Caracteres de controle e marcação são recusados em textos livres.
const UNSAFE_TEXT = /[<>\u0000-\u001f\u007f]/;

class Checker {
  errors: string[] = [];

  num(src: Obj, key: string, path: string, min: number, max: number, fallback: number, integer = false): number {
    const v = src[key];
    if (v === undefined) return fallback;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
      this.errors.push(`${path}.${key}: esperado número ${integer ? 'inteiro ' : ''}entre ${min} e ${max}`);
      return fallback;
    }
    return v;
  }

  bool(src: Obj, key: string, path: string, fallback: boolean): boolean {
    const v = src[key];
    if (v === undefined) return fallback;
    if (typeof v !== 'boolean') {
      this.errors.push(`${path}.${key}: esperado verdadeiro/falso`);
      return fallback;
    }
    return v;
  }

  oneOf<T extends string | number>(src: Obj, key: string, path: string, options: readonly T[], fallback: T): T {
    const v = src[key];
    if (v === undefined) return fallback;
    if (!options.includes(v as T)) {
      this.errors.push(`${path}.${key}: valor não permitido`);
      return fallback;
    }
    return v as T;
  }

  color(src: Obj, key: string, path: string, fallback: string): string {
    const v = src[key];
    if (v === undefined) return fallback;
    if (typeof v !== 'string' || !HEX.test(v)) {
      this.errors.push(`${path}.${key}: esperado cor no formato #RRGGBB`);
      return fallback;
    }
    return v.toUpperCase();
  }

  text(src: Obj, key: string, path: string, max: number, fallback: string, required = false): string {
    const v = src[key];
    if (v === undefined) {
      if (required) this.errors.push(`${path}.${key}: campo obrigatório`);
      return fallback;
    }
    if (typeof v !== 'string' || v.length === 0 || v.length > max || UNSAFE_TEXT.test(v)) {
      this.errors.push(`${path}.${key}: texto inválido (1 a ${max} caracteres, sem marcação)`);
      return fallback;
    }
    return v;
  }

  id(src: Obj, key: string, path: string, fallback: string, required = false): string {
    const v = src[key];
    if (v === undefined) {
      if (required) this.errors.push(`${path}.${key}: campo obrigatório`);
      return fallback;
    }
    if (typeof v !== 'string' || !ID.test(v)) {
      this.errors.push(`${path}.${key}: identificador inválido`);
      return fallback;
    }
    return v;
  }

  date(src: Obj, key: string, path: string, fallback: string): string {
    const v = src[key];
    if (v === undefined) return fallback;
    if (typeof v !== 'string' || v.length > 40 || Number.isNaN(Date.parse(v))) {
      this.errors.push(`${path}.${key}: data inválida`);
      return fallback;
    }
    return v;
  }

  obj(src: Obj, key: string, path: string, required = false): Obj {
    const v = src[key];
    if (v === undefined) {
      if (required) this.errors.push(`${path}.${key}: campo obrigatório`);
      return {};
    }
    if (!isObj(v)) {
      this.errors.push(`${path}.${key}: esperado objeto`);
      return {};
    }
    return v;
  }
}

function isValidAction(v: unknown, animationIds: Set<string>): v is BindingAction {
  if (typeof v !== 'string') return false;
  if (v.startsWith('animation:')) return animationIds.has(v.slice(10));
  return ['none', 'activate', 'toggleSleep', 'nextEmotion', 'prevEmotion', 'scenario:task', 'scenario:failure', 'toggleMute'].includes(v);
}

function validateV2(raw: Obj): ValidationResult {
  const c = new Checker();
  const d = createDefaultProject('Projeto importado', 'importado');

  if (raw.schemaVersion !== CURRENT_SCHEMA_VERSION) return { ok: false, errors: ['schemaVersion: versão não suportada'] };

  const pr = c.obj(raw, 'project', 'project', true);
  const dv = c.obj(raw, 'device', 'device', true);
  const av = c.obj(raw, 'avatar', 'avatar', true);
  const rt = c.obj(raw, 'runtime', 'runtime');
  if (c.errors.length) return { ok: false, errors: c.errors };

  if (dv.profile !== 'XIAOZHI_ROBOT_BALL_128') c.errors.push('device.profile: perfil de dispositivo não suportado');
  if (dv.width !== undefined && dv.width !== 240) c.errors.push('device.width: deve ser 240');
  if (dv.height !== undefined && dv.height !== 240) c.errors.push('device.height: deve ser 240');
  if (dv.shape !== undefined && dv.shape !== 'circle') c.errors.push('device.shape: deve ser "circle"');

  const gt = c.obj(dv, 'gestureThresholds', 'device');
  const params = c.obj(av, 'parameters', 'avatar');
  const eyes = c.obj(params, 'eyes', 'avatar.parameters');
  const brows = c.obj(params, 'eyebrows', 'avatar.parameters');
  const mouth = c.obj(params, 'mouth', 'avatar.parameters');
  const dp = d.avatar.parameters;

  const project: Project = {
    $schema: SCHEMA_URL,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project: {
      id: c.id(pr, 'id', 'project', d.project.id, true),
      name: c.text(pr, 'name', 'project', 80, d.project.name, true),
      createdAt: c.date(pr, 'createdAt', 'project', d.project.createdAt),
      updatedAt: c.date(pr, 'updatedAt', 'project', d.project.updatedAt),
    },
    device: {
      profile: 'XIAOZHI_ROBOT_BALL_128',
      width: 240,
      height: 240,
      shape: 'circle',
      targetFps: c.oneOf(dv, 'targetFps', 'device', [15, 30] as const, 30),
      colorPreview: c.oneOf(dv, 'colorPreview', 'device', ['rgba32', 'rgb565'] as const, 'rgba32'),
      showLegs: c.bool(dv, 'showLegs', 'device', true),
      showSafeArea: c.bool(dv, 'showSafeArea', 'device', false),
      gestureThresholds: {
        longPressMs: c.num(gt, 'longPressMs', 'device.gestureThresholds', 200, 2000, 500, true),
        movementTolerancePx: c.num(gt, 'movementTolerancePx', 'device.gestureThresholds', 1, 20, 6),
        swipeMinDistancePx: c.num(gt, 'swipeMinDistancePx', 'device.gestureThresholds', 10, 120, 24),
      },
    },
    avatar: {
      background: c.color(av, 'background', 'avatar', d.avatar.background),
      primaryColor: c.color(av, 'primaryColor', 'avatar', d.avatar.primaryColor),
      accentColor: c.color(av, 'accentColor', 'avatar', d.avatar.accentColor),
      glow: c.bool(av, 'glow', 'avatar', true),
      strokeWidth: c.num(av, 'strokeWidth', 'avatar', 1, 12, d.avatar.strokeWidth),
      parameters: {
        eyes: {
          shape: c.oneOf(eyes, 'shape', 'avatar.parameters.eyes', ['rounded', 'elliptic', 'softRect'] as const, dp.eyes.shape),
          width: c.num(eyes, 'width', 'avatar.parameters.eyes', 8, 100, dp.eyes.width),
          height: c.num(eyes, 'height', 'avatar.parameters.eyes', 4, 100, dp.eyes.height),
          spacing: c.num(eyes, 'spacing', 'avatar.parameters.eyes', 0, 120, dp.eyes.spacing),
          eyelidOpen: c.num(eyes, 'eyelidOpen', 'avatar.parameters.eyes', 0, 1, dp.eyes.eyelidOpen),
          offsetY: c.num(eyes, 'offsetY', 'avatar.parameters.eyes', -60, 60, dp.eyes.offsetY),
        },
        eyebrows: {
          tilt: c.num(brows, 'tilt', 'avatar.parameters.eyebrows', -45, 45, dp.eyebrows.tilt),
          elevation: c.num(brows, 'elevation', 'avatar.parameters.eyebrows', -20, 30, dp.eyebrows.elevation),
          thickness: c.num(brows, 'thickness', 'avatar.parameters.eyebrows', 0, 12, dp.eyebrows.thickness),
          curvature: c.num(brows, 'curvature', 'avatar.parameters.eyebrows', -1, 1, dp.eyebrows.curvature),
        },
        mouth: {
          style: c.oneOf(mouth, 'style', 'avatar.parameters.mouth', ['curve', 'segment', 'oval'] as const, dp.mouth.style),
          width: c.num(mouth, 'width', 'avatar.parameters.mouth', 0, 160, dp.mouth.width),
          height: c.num(mouth, 'height', 'avatar.parameters.mouth', 0, 80, dp.mouth.height),
          openness: c.num(mouth, 'openness', 'avatar.parameters.mouth', 0, 1, dp.mouth.openness),
          curvature: c.num(mouth, 'curvature', 'avatar.parameters.mouth', -1, 1, dp.mouth.curvature),
          offsetY: c.num(mouth, 'offsetY', 'avatar.parameters.mouth', -60, 80, dp.mouth.offsetY),
        },
      },
    },
    runtime: {
      defaultState: c.oneOf(rt, 'defaultState', 'runtime', OPERATIONAL_STATES, 'idle'),
      defaultEmotion: c.oneOf(rt, 'defaultEmotion', 'runtime', EMOTIONS, 'neutral'),
      randomSeed: c.num(rt, 'randomSeed', 'runtime', 0, 0xffffffff, 42, true),
      soundEnabled: c.bool(rt, 'soundEnabled', 'runtime', true),
      volume: c.num(rt, 'volume', 'runtime', 0, 1, 0.6),
    },
    emotions: {},
    animations: {},
    bindings: [],
  };

  // Sobrescritas de emoção
  const emotions = c.obj(raw, 'emotions', 'emotions');
  for (const key of Object.keys(emotions)) {
    if (!(EMOTIONS as readonly string[]).includes(key)) {
      c.errors.push(`emotions.${key}: emoção desconhecida`);
      continue;
    }
    const src = isObj(emotions[key]) ? (emotions[key] as Obj) : null;
    if (!src) {
      c.errors.push(`emotions.${key}: esperado objeto`);
      continue;
    }
    const out: EmotionOverride = {};
    for (const field of ['eyeOpen', 'eyeScaleY', 'browTiltInner', 'browLift', 'mouthCurve', 'mouthOpen', 'mouthWidthScale'] as const) {
      if (src[field] !== undefined) out[field] = c.num(src, field, `emotions.${key}`, -100, 100, 0);
    }
    project.emotions[key as keyof Project['emotions']] = out;
  }

  // Animações
  const anims = c.obj(raw, 'animations', 'animations');
  const animKeys = Object.keys(anims);
  if (animKeys.length > 50) c.errors.push('animations: máximo de 50 animações');
  for (const key of animKeys.slice(0, 50)) {
    const path = `animations.${key}`;
    if (!ID.test(key)) {
      c.errors.push(`${path}: identificador inválido`);
      continue;
    }
    const a = isObj(anims[key]) ? (anims[key] as Obj) : null;
    if (!a) {
      c.errors.push(`${path}: esperado objeto`);
      continue;
    }
    const durationMs = c.num(a, 'durationMs', path, 100, 60000, 1000, true);
    const kfs = Array.isArray(a.keyframes) ? a.keyframes : null;
    if (!kfs) {
      c.errors.push(`${path}.keyframes: esperado lista`);
      continue;
    }
    if (kfs.length > 200) c.errors.push(`${path}.keyframes: máximo de 200 quadros-chave`);
    const keyframes: Keyframe[] = [];
    kfs.slice(0, 200).forEach((kRaw, i) => {
      const kp = `${path}.keyframes[${i}]`;
      if (!isObj(kRaw)) {
        c.errors.push(`${kp}: esperado objeto`);
        return;
      }
      const vals = c.obj(kRaw, 'values', kp);
      const values: Partial<Record<AnimationChannel, number>> = {};
      for (const vk of Object.keys(vals)) {
        if (!(ANIMATION_CHANNELS as readonly string[]).includes(vk)) {
          c.errors.push(`${kp}.values.${vk}: canal desconhecido`);
          continue;
        }
        values[vk as AnimationChannel] = c.num(vals, vk, `${kp}.values`, -200, 200, 0);
      }
      keyframes.push({
        id: c.id(kRaw, 'id', kp, `k${i + 1}`),
        t: c.num(kRaw, 't', kp, 0, durationMs, 0, true),
        easing: c.oneOf(kRaw, 'easing', kp, EASINGS, 'linear'),
        values,
      });
    });
    keyframes.sort((x, y) => x.t - y.t);
    project.animations[key] = {
      id: key,
      name: c.text(a, 'name', path, 80, key),
      durationMs,
      mode: c.oneOf(a, 'mode', path, ['loop', 'once'] as const, 'once'),
      keyframes,
    };
  }

  // Vínculos de gestos
  const animIds = new Set(Object.keys(project.animations));
  if (raw.bindings !== undefined) {
    if (!Array.isArray(raw.bindings)) c.errors.push('bindings: esperado lista');
    else {
      const seen = new Set<string>();
      raw.bindings.slice(0, 12).forEach((b, i) => {
        if (!isObj(b) || !(GESTURES as readonly string[]).includes(b.gesture as string) || !isValidAction(b.action, animIds)) {
          c.errors.push(`bindings[${i}]: vínculo inválido`);
          return;
        }
        if (seen.has(b.gesture as string)) return;
        seen.add(b.gesture as string);
        project.bindings.push({ gesture: b.gesture as GestureBinding['gesture'], action: b.action });
      });
    }
  }

  if (c.errors.length) return { ok: false, errors: c.errors };
  return { ok: true, project, migrated: false };
}

/**
 * Migra a estrutura da versão 1 do schema (PRD 1.0–1.3) para a versão 2.
 * Na versão 1, o rosto ficava em `avatar.face`, a cor em `avatar.color` e não havia
 * pernas, área segura, limiares de gesto, som nem vínculos de gestos.
 */
export function migrateV1(raw: Obj): Obj {
  const d = createDefaultProject();
  const av = isObj(raw.avatar) ? raw.avatar : {};
  const face = isObj(av.face) ? av.face : {};
  const rt = isObj(raw.runtime) ? raw.runtime : {};
  const dv = isObj(raw.device) ? raw.device : {};
  const animations = isObj(raw.animations) ? raw.animations : {};
  // Vínculos padrão que apontam para animações ausentes no projeto antigo ficam sem ação.
  const bindings = d.bindings.map((b) =>
    b.action.startsWith('animation:') && !(b.action.slice(10) in animations) ? { ...b, action: 'none' as const } : b,
  );
  return {
    $schema: SCHEMA_URL,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project: raw.project,
    device: { ...d.device, profile: dv.profile ?? d.device.profile, targetFps: dv.targetFps ?? d.device.targetFps },
    avatar: {
      ...d.avatar,
      background: av.background ?? d.avatar.background,
      primaryColor: av.color ?? av.primaryColor ?? d.avatar.primaryColor,
      parameters: {
        eyes: { ...d.avatar.parameters.eyes, ...(isObj(face.eyes) ? face.eyes : {}) },
        eyebrows: { ...d.avatar.parameters.eyebrows, ...(isObj(face.eyebrows) ? face.eyebrows : {}) },
        mouth: { ...d.avatar.parameters.mouth, ...(isObj(face.mouth) ? face.mouth : {}) },
      },
    },
    runtime: { ...d.runtime, ...rt },
    emotions: {},
    animations,
    bindings,
  };
}

export function validateProject(raw: unknown): ValidationResult {
  if (!isObj(raw)) return { ok: false, errors: ['O arquivo não contém um objeto JSON de projeto'] };
  if (raw.schemaVersion === 1) {
    const result = validateV2(migrateV1(raw));
    return result.ok ? { ...result, migrated: true } : result;
  }
  if (raw.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return { ok: false, errors: ['schemaVersion: versão não suportada (esperado 1 ou 2)'] };
  }
  return validateV2(raw);
}

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export function parseProjectJson(text: string): ValidationResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, errors: ['Arquivo maior que 2 MB'] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['JSON malformado'] };
  }
  return validateProject(raw);
}
