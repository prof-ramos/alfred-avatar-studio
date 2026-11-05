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

/** Posições (ms) dos quadros de uma animação amostrada na taxa informada. */
export function frameTimes(durationMs: number, fps: number, maxFrames = 900): number[] {
  const count = Math.min(maxFrames, Math.max(1, Math.round((durationMs / 1000) * fps)));
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
