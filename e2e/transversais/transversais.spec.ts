// Casos transversais (docs/PLANO_E2E.md §5.4) e regressão visual (§6).
import { PONTOS, bridge, expect, logicalToPage, openStudio, stateSeq, test } from '../helpers/studio';

const VIEWS = [
  { mode: 'robot', scale: 1 },
  { mode: 'display', scale: 1 },
  { mode: 'pixel', scale: 1 },
  { mode: 'pixel', scale: 2 },
  { mode: 'pixel', scale: 4 },
] as const;

test.describe('Transversais @tx', () => {
  for (const v of VIEWS) {
    test(`E2E-TX-01 coordenadas no modo ${v.mode} ${v.scale}× @dpr`, async ({ page }) => {
      // Em 4× o canvas tem 960 px: a janela precisa comportá-lo sem rolagem.
      if (v.scale === 4) await page.setViewportSize({ width: 1900, height: 1200 });
      await openStudio(page);
      await page.getByTestId(`mode-${v.mode}`).click();
      if (v.mode === 'pixel') await page.getByTestId(`pixel-scale-${v.scale}`).click();
      const box = (await page.getByTestId('display-canvas').boundingBox())!;
      expect(box.width).toBeCloseTo(240 * v.scale, 0);

      for (const [x, y] of [PONTOS.centro, PONTOS.bordaInterna, PONTOS.limiteDireito]) {
        const p = await logicalToPage(page, x, y);
        await page.mouse.click(p.x, p.y);
        const last = await bridge<{ x: number; y: number; phase: string }>(page, 'getLastTouchEvent');
        expect(last.phase).toBe('up');
        expect(Math.abs(last.x - (x + 0.5)), `x em (${x}, ${y})`).toBeLessThanOrEqual(1);
        expect(Math.abs(last.y - (y + 0.5)), `y em (${x}, ${y})`).toBeLessThanOrEqual(1);
      }
      const count = (await bridge<unknown[]>(page, 'getTouchHistory')).length;
      const out = await logicalToPage(page, ...PONTOS.foraDoCirculo);
      await page.mouse.click(out.x, out.y);
      expect((await bridge<unknown[]>(page, 'getTouchHistory')).length).toBe(count);
    });
  }

  test('E2E-TX-02 aba em segundo plano suspende renderização e timers', async ({ page }) => {
    await openStudio(page, { clock: true });
    const setVisibility = (state: 'hidden' | 'visible') =>
      page.evaluate((s) => {
        Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
        Object.defineProperty(document, 'hidden', { value: s === 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    expect(await bridge(page, 'isRenderLoopRunning')).toBe(true);
    await page.getByTestId('scenario-task').click();
    await page.clock.runFor(1000);
    await setVisibility('hidden');
    expect(await bridge(page, 'isRenderLoopRunning')).toBe(false);
    await page.clock.runFor(20_000);
    expect(await stateSeq(page)).toEqual(['idle', 'executing']);
    await setVisibility('visible');
    expect(await bridge(page, 'isRenderLoopRunning')).toBe(true);
    await page.clock.runFor(999);
    expect((await stateSeq(page)).at(-1)).toBe('executing');
    await page.clock.runFor(2);
    expect((await stateSeq(page)).at(-1)).toBe('success');
  });

  test('E2E-TX-03 opera sem nenhuma requisição externa @smoke', async ({ page, context }) => {
    const external: string[] = [];
    await context.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host === '127.0.0.1' || host === 'localhost') return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    await openStudio(page);
    await page.getByTestId('scenario-dialog').click();
    await page.getByTestId('tab-emotions').click();
    await page.getByTestId('emotion-happy').click();
    await page.getByTestId('tab-export').click();
    await Promise.all([page.waitForEvent('download'), page.getByTestId('export-png').click()]);
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    expect(external).toEqual([]);
  });

  test('E2E-TX-04 mantém a taxa de quadros próxima do alvo', async ({ page }, info) => {
    await openStudio(page);
    await page.getByTestId('tab-animation').click();
    await page.getByTestId('tl-play').click();
    await page.waitForTimeout(2500);
    const fps30 = await bridge<number>(page, 'getFps');
    await page.getByTestId('tab-diagnostics').click();
    await page.getByTestId('fps-select').selectOption('15');
    await page.waitForTimeout(2000);
    const fps15 = await bridge<number>(page, 'getFps');
    info.annotations.push({ type: 'fps', description: `30 FPS → ${fps30}; 15 FPS → ${fps15}` });
    // No CI o resultado depende da máquina: apenas registra.
    if (!process.env.CI) {
      expect(fps30).toBeGreaterThanOrEqual(28);
      expect(fps15).toBeGreaterThanOrEqual(14);
      expect(fps15).toBeLessThanOrEqual(16);
    }
  });
});

/** Pixels do canvas lógico 240 × 240, sem sobreposições nem carcaça. */
async function canvasPng(page: import('@playwright/test').Page): Promise<Buffer> {
  const url = await page.getByTestId('display-canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png'));
  return Buffer.from(url.split(',')[1], 'base64');
}

test.describe('Regressão visual @visual', () => {
  const STATES = ['idle', 'listening', 'thinking', 'speaking', 'executing', 'success', 'error', 'sleep', 'connecting', 'low_battery'];
  for (const s of STATES) {
    test(`canvas no estado ${s}`, async ({ page }) => {
      await openStudio(page, { clock: true, noSpontaneous: true });
      await page.getByTestId(`state-${s}`).click();
      await page.clock.runFor(500);
      expect(await canvasPng(page)).toMatchSnapshot(`estado-${s}.png`, { maxDiffPixelRatio: 0.001 });
    });
  }
  for (const e of ['happy', 'angry', 'sad', 'surprised', 'ironic']) {
    test(`canvas com emoção ${e}`, async ({ page }) => {
      await openStudio(page, { clock: true, noSpontaneous: true });
      await page.getByTestId('tab-emotions').click();
      await page.getByTestId(`emotion-${e}`).click();
      await page.clock.runFor(100);
      expect(await canvasPng(page)).toMatchSnapshot(`emocao-${e}.png`, { maxDiffPixelRatio: 0.001 });
    });
  }
});
