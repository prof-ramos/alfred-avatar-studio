// Partes puras dos exportadores (sem DOM), cobertas por testes unitários.
import { DISPLAY_SIZE } from '../domain/profile';
import type { OperationalState } from '../domain/types';

// ---------------------------------------------------------------- ESPHome (PRD §9.4)

export interface EsphomeEntry {
  file: string;
  label: string;
  state: OperationalState;
  timeMs: number;
  icon?: 'mute';
}

/** Nomes exigidos pela integração `RealDeco/xiaozhi-esphome`. */
export const ESPHOME_STATES: EsphomeEntry[] = [
  { file: 'idle.png', label: 'Repouso', state: 'idle', timeMs: 0 },
  { file: 'listening.png', label: 'Ouvindo', state: 'listening', timeMs: 0 },
  { file: 'thinking.png', label: 'Processando', state: 'thinking', timeMs: 300 },
  { file: 'replying.png', label: 'Falando', state: 'speaking', timeMs: 260 },
  { file: 'error.png', label: 'Erro', state: 'error', timeMs: 0 },
  { file: 'loading.png', label: 'Inicialização', state: 'connecting', timeMs: 1100 },
  { file: 'mute.png', label: 'Microfone mudo', state: 'idle', timeMs: 0, icon: 'mute' },
];

// ---------------------------------------------------------------- Spritesheet (PRD §9.3)

export interface SheetLayout {
  columns: number;
  rows: number;
  width: number;
  height: number;
  frames: Array<{ x: number; y: number; w: number; h: number }>;
}

export function computeSheetLayout(frameCount: number, size = DISPLAY_SIZE): SheetLayout {
  const columns = Math.max(1, Math.ceil(Math.sqrt(frameCount)));
  const rows = Math.max(1, Math.ceil(frameCount / columns));
  const frames = Array.from({ length: frameCount }, (_, i) => ({
    x: (i % columns) * size,
    y: Math.floor(i / columns) * size,
    w: size,
    h: size,
  }));
  return { columns, rows, width: columns * size, height: rows * size, frames };
}

export interface SpritesheetMeta {
  app: string;
  version: string;
  image: string;
  animation: { id: string; name: string; durationMs: number; loop: boolean };
  fps: number;
  frameSize: { w: number; h: number };
  size: { w: number; h: number };
  columns: number;
  rows: number;
  frames: Array<{ index: number; frame: { x: number; y: number; w: number; h: number }; durationMs: number }>;
}

export function buildSpritesheetMeta(
  layout: SheetLayout,
  anim: { id: string; name: string; durationMs: number; mode: 'loop' | 'once' },
  fps: number,
  image: string,
): SpritesheetMeta {
  const n = layout.frames.length;
  // Distribui a duração total entre os quadros, compensando o arredondamento no último.
  const base = Math.floor(anim.durationMs / n);
  return {
    app: 'Alfred Avatar Studio',
    version: '1.4',
    image,
    animation: { id: anim.id, name: anim.name, durationMs: anim.durationMs, loop: anim.mode === 'loop' },
    fps,
    frameSize: { w: DISPLAY_SIZE, h: DISPLAY_SIZE },
    size: { w: layout.width, h: layout.height },
    columns: layout.columns,
    rows: layout.rows,
    frames: layout.frames.map((f, i) => ({
      index: i,
      frame: f,
      durationMs: i === n - 1 ? anim.durationMs - base * (n - 1) : base,
    })),
  };
}

// ---------------------------------------------------------------- MJPEG (PRD §9.5)

/** Concatena quadros JPEG em um fluxo MJPEG bruto (.mjpeg), lido pelo player do cartão SD. */
export function concatJpegFrames(frames: Uint8Array[]): Uint8Array {
  const total = frames.reduce((s, f) => s + f.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const f of frames) {
    out.set(f, off);
    off += f.length;
  }
  return out;
}

/** Conta os pares SOI/EOI (FFD8…FFD9) de um fluxo MJPEG. */
export function countJpegFrames(bytes: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && (i === 0 || (bytes[i - 1] === 0xd9 && bytes[i - 2] === 0xff))) count++;
  }
  return count;
}

export function padFrameName(prefix: string, index: number, ext: string): string {
  return `${prefix}_${String(index).padStart(4, '0')}.${ext}`;
}

// ---------------------------------------------------------------- C Array / LVGL (PRD §9.6)

export type LvglVersion = 8 | 9;

export function toCIdentifier(name: string): string {
  const id = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z_]/.test(id) ? id || 'alfred_frame' : `img_${id}`;
}

function bytesToCRows(bytes: Uint8Array): string {
  const rows: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = Array.from(bytes.subarray(i, i + 16), (b) => `0x${b.toString(16).padStart(2, '0')}`);
    rows.push(`  ${chunk.join(', ')},`);
  }
  return rows.join('\n');
}

export interface CArrayFrame {
  name: string;
  bytes: Uint8Array;
}

export function generateLvglSource(baseName: string, frames: CArrayFrame[], version: LvglVersion, swapped: boolean): { c: string; h: string } {
  const guard = `${baseName.toUpperCase()}_H`;
  const stamp = 'Gerado pelo Alfred Avatar Studio — perfil XIAOZHI_ROBOT_BALL_128 (240 × 240, RGB565).';
  const swapNote = swapped ? 'Bytes trocados (equivale a LV_COLOR_16_SWAP = 1).' : 'Little-endian (LV_COLOR_16_SWAP = 0).';

  const decls = frames.map((f) =>
    version === 9 ? `extern const lv_image_dsc_t ${f.name};` : `extern const lv_img_dsc_t ${f.name};`,
  );
  const h = `/* ${stamp} */
#ifndef ${guard}
#define ${guard}

#ifdef __cplusplus
extern "C" {
#endif

#include "lvgl.h"

#define ${baseName.toUpperCase()}_FRAME_COUNT ${frames.length}

${decls.join('\n')}

#ifdef __cplusplus
}
#endif

#endif /* ${guard} */
`;

  const bodies = frames.map((f) => {
    const map = `${f.name}_map`;
    const desc =
      version === 9
        ? `const lv_image_dsc_t ${f.name} = {
  .header.magic = LV_IMAGE_HEADER_MAGIC,
  .header.cf = LV_COLOR_FORMAT_RGB565,
  .header.flags = 0,
  .header.w = ${DISPLAY_SIZE},
  .header.h = ${DISPLAY_SIZE},
  .header.stride = ${DISPLAY_SIZE * 2},
  .data_size = sizeof(${map}),
  .data = ${map},
};`
        : `const lv_img_dsc_t ${f.name} = {
  .header.cf = LV_IMG_CF_TRUE_COLOR,
  .header.always_zero = 0,
  .header.reserved = 0,
  .header.w = ${DISPLAY_SIZE},
  .header.h = ${DISPLAY_SIZE},
  .data_size = sizeof(${map}),
  .data = ${map},
};`;
    return `/* ${f.bytes.length} bytes = 240 × 240 × 2 */
static const LV_ATTRIBUTE_MEM_ALIGN uint8_t ${map}[${f.bytes.length}] = {
${bytesToCRows(f.bytes)}
};

${desc}`;
  });

  const c = `/* ${stamp}
 * Formato: RGB565 — ${swapNote}
 * LVGL ${version}.x
 */
#include "${baseName}.h"

#ifndef LV_ATTRIBUTE_MEM_ALIGN
#define LV_ATTRIBUTE_MEM_ALIGN
#endif

${bodies.join('\n\n')}
`;
  return { c, h };
}
