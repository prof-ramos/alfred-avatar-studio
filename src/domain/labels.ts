import type { AnimationChannel, BindingAction, Easing, EmotionId, GestureBindingKey, OperationalState } from './types';

export const STATE_LABELS: Record<OperationalState, string> = {
  idle: 'Repouso',
  wake: 'Despertando',
  listening: 'Ouvindo',
  thinking: 'Pensando',
  speaking: 'Falando',
  executing: 'Executando',
  success: 'Concluído',
  error: 'Erro',
  sleep: 'Dormindo',
  connecting: 'Conectando',
  charging: 'Carregando',
  low_battery: 'Bateria baixa',
};

export const EMOTION_LABELS: Record<EmotionId, string> = {
  neutral: 'Neutra',
  happy: 'Feliz',
  curious: 'Curioso',
  surprised: 'Surpreso',
  confused: 'Confuso',
  suspicious: 'Desconfiado',
  angry: 'Irritado',
  sad: 'Triste',
  excited: 'Animado',
  tired: 'Cansado',
  ironic: 'Irônico',
};

export const CHANNEL_LABELS: Record<AnimationChannel, string> = {
  eyeOpen: 'Abertura dos olhos',
  eyeScale: 'Escala dos olhos',
  gazeX: 'Olhar horizontal',
  gazeY: 'Olhar vertical',
  browLift: 'Elevação das sobrancelhas',
  browTilt: 'Inclinação das sobrancelhas',
  mouthOpen: 'Abertura da boca',
  mouthCurve: 'Curvatura da boca',
  mouthWidthScale: 'Largura da boca',
};

export const EASING_LABELS: Record<Easing, string> = {
  linear: 'Linear',
  easeIn: 'Aceleração (easeIn)',
  easeOut: 'Desaceleração (easeOut)',
  easeInOut: 'Suave (easeInOut)',
};

export const GESTURE_LABELS: Record<GestureBindingKey, string> = {
  tap: 'Toque simples',
  longPress: 'Toque prolongado',
  swipeUp: 'Deslizar para cima',
  swipeDown: 'Deslizar para baixo',
  swipeLeft: 'Deslizar para a esquerda',
  swipeRight: 'Deslizar para a direita',
};

export const ACTION_LABELS: Record<string, string> = {
  none: 'Nenhuma',
  activate: 'Ativar diálogo',
  toggleSleep: 'Dormir / acordar',
  nextEmotion: 'Próxima emoção',
  prevEmotion: 'Emoção anterior',
  'scenario:task': 'Cenário de tarefa',
  'scenario:failure': 'Cenário de falha',
  toggleMute: 'Mutar / desmutar som',
};

export function actionLabel(action: BindingAction, animationName?: string): string {
  if (action.startsWith('animation:')) return `Animação: ${animationName ?? action.slice(10)}`;
  return ACTION_LABELS[action] ?? action;
}
