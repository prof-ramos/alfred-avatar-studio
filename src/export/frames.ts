// Renderização fora da tela para exportações. Usa tempo fixo e sem comportamento
// espontâneo, para que o mesmo projeto gere sempre os mesmos arquivos.
import { resolvePosition, sampleAnimation } from '../domain/animation';
import { computePose, type FacePose } from '../domain/avatarEngine';
import { DISPLAY_SIZE } from '../domain/profile';
import type { EmotionValue, OperationalState, Project } from '../domain/types';
import { renderFrame, type BackgroundMode } from '../render/canvasRenderer';

export interface PoseRequest {
  state: OperationalState;
  emotion: EmotionValue;
  timeMs?: number;
  stateElapsedMs?: number;
  animationId?: string;
  animationPositionMs?: number;
}

export function poseFor(project: Project, req: PoseRequest): FacePose {
  const anim = req.animationId ? project.animations[req.animationId] : undefined;
  return computePose({
    avatar: project.avatar,
    emotionOverrides: project.emotions,
    state: req.state,
    stateElapsedMs: req.stateElapsedMs ?? 1000,
    emotion: req.emotion,
    timeMs: req.timeMs ?? 400,
    seed: project.runtime.randomSeed,
    animation: anim ? sampleAnimation(anim, req.animationPositionMs ?? 0) : null,
    spontaneous: false,
  });
}

export function createFrameCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = DISPLAY_SIZE;
  canvas.height = DISPLAY_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D indisponível');
  return { canvas, ctx };
}

export function drawPose(
  ctx: CanvasRenderingContext2D,
  project: Project,
  pose: FacePose,
  background: BackgroundMode,
  extraIcon: 'mute' | 'none' = 'none',
): void {
  renderFrame(ctx, project.avatar, pose, { background, rgb565: false, extraIcon });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao codificar imagem'))), type, quality);
  });
}

export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Limite de quadros por exportação de animação (30 s a 30 FPS ou 60 s a 15 FPS). */
export const MAX_EXPORT_FRAMES = 900;

export class FrameLimitError extends Error {
  constructor(
    readonly frames: number,
    readonly fps: number,
    readonly limit: number,
  ) {
    const maxSeconds = Math.floor(limit / fps);
    super(
      `Animação longa demais para exportar: ${frames.toLocaleString('pt-BR')} quadros a ${fps} FPS (limite de ${limit}). ` +
        (fps > 15 ? 'Use 15 FPS ou encurte a animação' : 'Encurte a animação') +
        ` para até ${maxSeconds} s`,
    );
    this.name = 'FrameLimitError';
  }
}

/** Quantidade de quadros de uma animação na taxa informada. */
export function frameCount(durationMs: number, fps: number): number {
  return Math.max(1, Math.round((durationMs / 1000) * fps));
}

/**
 * Posições (ms) dos quadros de uma animação amostrada na taxa informada.
 * Acima do limite, lança FrameLimitError em vez de truncar a animação.
 */
export function frameTimes(durationMs: number, fps: number, maxFrames = MAX_EXPORT_FRAMES): number[] {
  const count = frameCount(durationMs, fps);
  if (count > maxFrames) throw new FrameLimitError(count, fps, maxFrames);
  return Array.from({ length: count }, (_, i) => Math.round((i * 1000) / fps));
}

export function animationPoses(project: Project, animationId: string, fps: number, emotion: EmotionValue): FacePose[] {
  const anim = project.animations[animationId];
  if (!anim) throw new Error('Animação não encontrada');
  return frameTimes(anim.durationMs, fps).map((t) =>
    poseFor(project, {
      state: 'idle',
      emotion,
      timeMs: t,
      animationId,
      animationPositionMs: resolvePosition(anim, t).position,
    }),
  );
}

/** Cede o controle ao navegador entre quadros para não travar a interface. */
export const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));
