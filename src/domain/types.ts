// Contratos de dados do Alfred Avatar Studio (PRD §5, §6 e §8).

export const OPERATIONAL_STATES = [
  'idle',
  'wake',
  'listening',
  'thinking',
  'speaking',
  'executing',
  'success',
  'error',
  'sleep',
  'connecting',
  'charging',
  'low_battery',
] as const;
export type OperationalState = (typeof OPERATIONAL_STATES)[number];

export const EMOTIONS = [
  'neutral',
  'happy',
  'curious',
  'surprised',
  'confused',
  'suspicious',
  'angry',
  'sad',
  'excited',
  'tired',
  'ironic',
] as const;
export type EmotionId = (typeof EMOTIONS)[number];

export interface EmotionValue {
  id: EmotionId;
  /** 0.0 (neutro) a 1.0 (máxima expressão). */
  intensity: number;
}

export type EyeShape = 'rounded' | 'elliptic' | 'softRect';
export type MouthStyle = 'curve' | 'segment' | 'oval';

export interface AvatarParameters {
  eyes: { shape: EyeShape; width: number; height: number; spacing: number; eyelidOpen: number; offsetY: number };
  eyebrows: { tilt: number; elevation: number; thickness: number; curvature: number };
  mouth: { style: MouthStyle; width: number; height: number; openness: number; curvature: number; offsetY: number };
}

export interface AvatarConfig {
  background: string;
  primaryColor: string;
  accentColor: string;
  glow: boolean;
  strokeWidth: number;
  parameters: AvatarParameters;
}

export interface GestureThresholds {
  longPressMs: number;
  movementTolerancePx: number;
  swipeMinDistancePx: number;
}

export type ColorPreview = 'rgba32' | 'rgb565';
export type TargetFps = 15 | 30;

export interface DeviceConfig {
  profile: 'XIAOZHI_ROBOT_BALL_128';
  width: 240;
  height: 240;
  shape: 'circle';
  targetFps: TargetFps;
  colorPreview: ColorPreview;
  showLegs: boolean;
  showSafeArea: boolean;
  gestureThresholds: GestureThresholds;
}

export interface RuntimeConfig {
  defaultState: OperationalState;
  defaultEmotion: EmotionId;
  randomSeed: number;
  soundEnabled: boolean;
  volume: number;
}

/** Canais da pose facial que uma animação pode controlar. */
export const ANIMATION_CHANNELS = [
  'eyeOpen',
  'eyeScale',
  'gazeX',
  'gazeY',
  'browLift',
  'browTilt',
  'mouthOpen',
  'mouthCurve',
  'mouthWidthScale',
] as const;
export type AnimationChannel = (typeof ANIMATION_CHANNELS)[number];

export const EASINGS = ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const;
export type Easing = (typeof EASINGS)[number];

export interface Keyframe {
  id: string;
  /** Instante do quadro-chave em milissegundos a partir do início da animação. */
  t: number;
  /** Curva usada para chegar a este quadro-chave a partir do anterior. */
  easing: Easing;
  values: Partial<Record<AnimationChannel, number>>;
}

export type PlaybackMode = 'loop' | 'once';

export interface Animation {
  id: string;
  name: string;
  durationMs: number;
  mode: PlaybackMode;
  keyframes: Keyframe[];
}

export const GESTURES = ['tap', 'longPress', 'swipeUp', 'swipeDown', 'swipeLeft', 'swipeRight'] as const;
export type GestureBindingKey = (typeof GESTURES)[number];

/** Ação disparada por um gesto. `animation:<id>` reproduz uma animação do projeto. */
export type BindingAction =
  | 'none'
  | 'activate'
  | 'toggleSleep'
  | 'nextEmotion'
  | 'prevEmotion'
  | 'scenario:task'
  | 'scenario:failure'
  | 'toggleMute'
  | `animation:${string}`;

export interface GestureBinding {
  gesture: GestureBindingKey;
  action: BindingAction;
}

export interface EmotionOverride {
  eyeOpen?: number;
  eyeScaleY?: number;
  browTiltInner?: number;
  browLift?: number;
  mouthCurve?: number;
  mouthOpen?: number;
  mouthWidthScale?: number;
}

export interface Project {
  $schema: string;
  schemaVersion: 2;
  project: { id: string; name: string; createdAt: string; updatedAt: string };
  device: DeviceConfig;
  avatar: AvatarConfig;
  runtime: RuntimeConfig;
  emotions: Partial<Record<EmotionId, EmotionOverride>>;
  animations: Record<string, Animation>;
  bindings: GestureBinding[];
}

export type TouchPhase = 'down' | 'move' | 'up' | 'cancel';
export type InputSource = 'mouse' | 'touch' | 'pen' | 'hardware_button';

export interface LogicalTouchEvent {
  phase: TouchPhase;
  /** Coordenadas lógicas no espaço 0..239. */
  x: number;
  y: number;
  /** Milissegundos de relógio monotônico. */
  timestamp: number;
  source: InputSource;
}

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export type GestureEvent =
  | { type: 'tap'; x: number; y: number; timestamp: number }
  | { type: 'longPress'; x: number; y: number; timestamp: number }
  | { type: 'swipe'; direction: SwipeDirection; dx: number; dy: number; timestamp: number }
  | { type: 'cancel'; timestamp: number };
