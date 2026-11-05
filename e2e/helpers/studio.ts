// Fixtures e utilitários compartilhados pelos testes E2E.
import { test as base, expect, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';

export const T0 = new Date('2026-11-05T10:00:00Z').getTime();

/** Ponte de teste exposta pela aplicação com `?test=1` (src/testBridge.ts). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bridge = Record<string, (...args: any[]) => any>;
declare global {
  interface Window {
    __ALFRED_TEST__: Bridge;
  }
}

export interface StudioOptions {
  /** Instala relógio controlado e pausa o tempo. */
  clock?: boolean;
  /** Desliga piscadas para comparações visuais determinísticas. */
  noSpontaneous?: boolean;
}

export async function openStudio(page: Page, opts: StudioOptions = {}): Promise<void> {
  if (opts.clock) await page.clock.install({ time: T0 });
  await page.goto('/?test=1');
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true' && !!window.__ALFRED_TEST__);
  await expect(page.getByTestId('display-canvas')).toBeVisible();
  if (opts.clock) await page.clock.pauseAt(T0 + 1000);
  if (opts.noSpontaneous) {
    await page.getByTestId('tab-emotions').click();
    await page.getByTestId('spontaneous-toggle').uncheck();
    await page.getByTestId('tab-avatar').click();
  }
}

export const bridge = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(([n, a]) => window.__ALFRED_TEST__[n as string](...(a as unknown[])), [name, args] as const) as Promise<T>;

export const getState = (page: Page) => bridge<string>(page, 'getState');
export const stateSeq = async (page: Page) => (await bridge<Array<{ state: string }>>(page, 'getStateLog')).map((s) => s.state);
export const gestures = async (page: Page) => bridge<Array<{ type: string; direction?: string }>>(page, 'getGestureLog');

/** Coordenadas de página do centro do pixel lógico (x, y). */
export async function logicalToPage(page: Page, x: number, y: number) {
  const box = await page.getByTestId('display-canvas').boundingBox();
  if (!box) throw new Error('display-canvas não visível');
  const s = box.width / 240;
  return { x: box.x + (x + 0.5) * s, y: box.y + (y + 0.5) * s };
}

export const PONTOS = {
  centro: [120, 120],
  bordaInterna: [120, 2],
  limiteDireito: [238, 120],
  foraDoCirculo: [5, 5],
} as const;

/** Avança o tempo: com relógio controlado usa runFor, senão espera real. */
export async function advance(page: Page, ms: number, controlled: boolean): Promise<void> {
  if (controlled) await page.clock.runFor(ms);
  else await page.waitForTimeout(ms);
}

/** Pressiona em (x, y) lógicos, opcionalmente arrasta, e solta. */
export async function gesture(
  page: Page,
  from: readonly [number, number],
  opts: { to?: readonly [number, number]; holdMs?: number; clock?: boolean; steps?: number } = {},
): Promise<void> {
  const a = await logicalToPage(page, from[0], from[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const hold = opts.holdMs ?? 60;
  if (opts.to) {
    const b = await logicalToPage(page, opts.to[0], opts.to[1]);
    await page.mouse.move(b.x, b.y, { steps: opts.steps ?? 4 });
  }
  await advance(page, hold, opts.clock ?? false);
  const end = opts.to ? await logicalToPage(page, opts.to[0], opts.to[1]) : a;
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
}

export const tap = (page: Page, x: number, y: number, clock = false) => gesture(page, [x, y], { clock });

/** Força um quadro e retorna a imagem do canvas como data URL. */
export async function canvasImage(page: Page, clock: boolean): Promise<string> {
  await advance(page, 40, clock);
  return page.getByTestId('display-canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL());
}

export async function canvasPixels(page: Page): Promise<number[]> {
  return page.getByTestId('display-canvas').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(0, 0, 240, 240).data));
}

export async function setRange(page: Page, testId: string, value: number): Promise<void> {
  await page.getByTestId(testId).fill(String(value));
}

export async function waitSaved(page: Page, clock = false): Promise<void> {
  if (clock) await page.clock.runFor(500);
  await bridge(page, 'flush');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
}

export async function downloadBytes(page: Page, trigger: () => Promise<void>): Promise<{ name: string; bytes: Uint8Array; download: Download }> {
  const [download] = await Promise.all([page.waitForEvent('download'), trigger()]);
  const path = await download.path();
  return { name: download.suggestedFilename(), bytes: new Uint8Array(await readFile(path)), download };
}

export function unzip(bytes: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(bytes);
}

export function pngInfo(bytes: Uint8Array) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  expect(Array.from(bytes.subarray(0, 8))).toEqual(sig);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20), bitDepth: bytes[24], colorType: bytes[25] };
}

/** Dimensões do primeiro marcador SOF de um JPEG. */
export function jpegSize(bytes: Uint8Array) {
  for (let i = 2; i < bytes.length - 9; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] >= 0xc0 && bytes[i + 1] <= 0xc3) {
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
  }
  throw new Error('SOF não encontrado');
}

export function countJpegFrames(bytes: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < bytes.length - 2; i++) if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) n++;
  return n;
}

/** Fixture: falha o teste se houver erro de console ou exceção na página. */
export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      page.on('pageerror', (e) => errors.push(String(e)));
      await use();
      expect(errors, 'erros no console').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
