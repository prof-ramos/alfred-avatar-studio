// AssetExporter: gera os arquivos de exportação no navegador (PRD §9).
import { strToU8, zipSync } from 'fflate';
import type { EmotionValue, Project } from '../domain/types';
import type { BackgroundMode } from '../render/canvasRenderer';
import { rgbaToRgb565Bytes } from '../render/rgb565';
import {
  ESPHOME_STATES,
  buildSpritesheetMeta,
  computeSheetLayout,
  concatJpegFrames,
  generateLvglSource,
  padFrameName,
  toCIdentifier,
  type LvglVersion,
} from './formats';
import { animationPoses, blobToBytes, canvasToBlob, createFrameCanvas, drawPose, poseFor, yieldToUi, type PoseRequest } from './frames';

export interface ExportFile {
  filename: string;
  blob: Blob;
}

export type Progress = (done: number, total: number) => void;

function slug(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'alfred'
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

const zipBlob = (files: Record<string, Uint8Array>) =>
  new Blob([zipSync(files, { level: 6, mtime: new Date('2026-01-01T00:00:00Z') }) as BlobPart], { type: 'application/zip' });

export function exportProjectJson(project: Project): ExportFile {
  return {
    filename: `${slug(project.project.name)}.alfred.json`,
    blob: new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
  };
}

export async function exportPng(project: Project, req: PoseRequest, background: BackgroundMode): Promise<ExportFile> {
  const { canvas, ctx } = createFrameCanvas();
  drawPose(ctx, project, poseFor(project, req), background);
  return { filename: `${slug(project.project.name)}-${req.state}.png`, blob: await canvasToBlob(canvas, 'image/png') };
}

export async function exportEsphomePack(project: Project, emotion: EmotionValue, onProgress?: Progress): Promise<ExportFile> {
  const { canvas, ctx } = createFrameCanvas();
  const files: Record<string, Uint8Array> = {};
  for (const [i, entry] of ESPHOME_STATES.entries()) {
    const pose = poseFor(project, { state: entry.state, emotion, timeMs: entry.timeMs, stateElapsedMs: 1000 });
    drawPose(ctx, project, pose, 'square', entry.icon ?? 'none');
    files[entry.file] = await blobToBytes(await canvasToBlob(canvas, 'image/png'));
    onProgress?.(i + 1, ESPHOME_STATES.length);
    await yieldToUi();
  }
  files['LEIA-ME.txt'] = strToU8(
    [
      'Pacote de estados para ESPHome / Home Assistant (RealDeco/xiaozhi-esphome, Ball_v2.yaml).',
      'Imagens PNG 240 × 240. Copie os arquivos para a pasta de imagens referenciada no YAML.',
      ...ESPHOME_STATES.map((e) => `- ${e.file}: ${e.label}`),
    ].join('\n'),
  );
  return { filename: `${slug(project.project.name)}-esphome.zip`, blob: zipBlob(files) };
}

export async function exportSpritesheet(
  project: Project,
  animationId: string,
  fps: number,
  emotion: EmotionValue,
  onProgress?: Progress,
): Promise<ExportFile> {
  const anim = project.animations[animationId];
  if (!anim) throw new Error('Animação não encontrada');
  const poses = animationPoses(project, animationId, fps, emotion);
  const layout = computeSheetLayout(poses.length);
  const sheet = document.createElement('canvas');
  sheet.width = layout.width;
  sheet.height = layout.height;
  const sctx = sheet.getContext('2d');
  if (!sctx) throw new Error('Canvas 2D indisponível');
  const { canvas, ctx } = createFrameCanvas();
  for (const [i, pose] of poses.entries()) {
    drawPose(ctx, project, pose, 'circle');
    sctx.drawImage(canvas, layout.frames[i].x, layout.frames[i].y);
    onProgress?.(i + 1, poses.length);
    if (i % 10 === 9) await yieldToUi();
  }
  const base = `${slug(project.project.name)}-${slug(anim.name)}`;
  const meta = buildSpritesheetMeta(layout, anim, fps, `${base}.png`);
  const png = await blobToBytes(await canvasToBlob(sheet, 'image/png'));
  return {
    filename: `${base}-spritesheet.zip`,
    blob: zipBlob({ [`${base}.png`]: png, [`${base}.json`]: strToU8(JSON.stringify(meta, null, 2)) }),
  };
}

export interface MjpegResult {
  mjpeg: ExportFile;
  sequence: ExportFile;
  frames: number;
}

export async function exportMjpeg(
  project: Project,
  animationId: string,
  fps: number,
  emotion: EmotionValue,
  quality = 0.85,
  onProgress?: Progress,
): Promise<MjpegResult> {
  const anim = project.animations[animationId];
  if (!anim) throw new Error('Animação não encontrada');
  const poses = animationPoses(project, animationId, fps, emotion);
  const { canvas, ctx } = createFrameCanvas();
  const frames: Uint8Array[] = [];
  for (const [i, pose] of poses.entries()) {
    // JPEG não tem transparência: fundo preto circular sobre preto.
    drawPose(ctx, project, pose, 'square');
    frames.push(await blobToBytes(await canvasToBlob(canvas, 'image/jpeg', quality)));
    onProgress?.(i + 1, poses.length);
    if (i % 5 === 4) await yieldToUi();
  }
  const base = `${slug(project.project.name)}-${slug(anim.name)}`;
  const seq: Record<string, Uint8Array> = {};
  frames.forEach((f, i) => (seq[padFrameName(slug(anim.name), i, 'jpg')] = f));
  seq['LEIA-ME.txt'] = strToU8(
    `Sequência JPEG 240 × 240 a ${fps} FPS (${frames.length} quadros). Copie para o cartão MicroSD (FAT32).`,
  );
  return {
    mjpeg: { filename: `${base}-${fps}fps.mjpeg`, blob: new Blob([concatJpegFrames(frames) as BlobPart], { type: 'video/x-motion-jpeg' }) },
    sequence: { filename: `${base}-jpeg-${fps}fps.zip`, blob: zipBlob(seq) },
    frames: frames.length,
  };
}

export interface CArrayOptions {
  version: LvglVersion;
  swap: boolean;
  /** `current`: pose atual; `animation`: todos os quadros da animação. */
  source: { kind: 'current'; req: PoseRequest } | { kind: 'animation'; animationId: string; fps: number; emotion: EmotionValue };
}

export async function exportCArray(project: Project, opts: CArrayOptions, onProgress?: Progress): Promise<ExportFile> {
  const { ctx } = createFrameCanvas();
  const bg = hexToRgb(project.avatar.background);
  const baseName = toCIdentifier(`alfred_${project.project.name}`);
  const poses =
    opts.source.kind === 'current'
      ? [poseFor(project, opts.source.req)]
      : animationPoses(project, opts.source.animationId, opts.source.fps, opts.source.emotion);
  const frames = [];
  for (const [i, pose] of poses.entries()) {
    drawPose(ctx, project, pose, 'square');
    const data = ctx.getImageData(0, 0, 240, 240).data;
    frames.push({ name: poses.length === 1 ? baseName : `${baseName}_${String(i).padStart(3, '0')}`, bytes: rgbaToRgb565Bytes(data, opts.swap, bg) });
    onProgress?.(i + 1, poses.length);
    if (i % 5 === 4) await yieldToUi();
  }
  const { c, h } = generateLvglSource(baseName, frames, opts.version, opts.swap);
  return { filename: `${baseName}-lvgl${opts.version}.zip`, blob: zipBlob({ [`${baseName}.c`]: strToU8(c), [`${baseName}.h`]: strToU8(h) }) };
}

export function triggerDownload(file: ExportFile): void {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
