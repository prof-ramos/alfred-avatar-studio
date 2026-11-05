// Fase 3 — Animação, gestos avançados, som e mídia (docs/PLANO_E2E.md §5.3).
import {
  bridge,
  countJpegFrames,
  downloadBytes,
  expect,
  gesture,
  gestures,
  getState,
  jpegSize,
  logicalToPage,
  openStudio,
  pngInfo,
  setRange,
  test,
  unzip,
} from '../helpers/studio';
import type { Page } from '@playwright/test';

const playback = (page: Page) => bridge<{ position: number; playing: boolean; active: boolean; animId: string }>(page, 'getPlayback');
const audioLog = (page: Page) => bridge<Array<{ cue: string; gain: number }>>(page, 'getAudioLog');

test.describe('Fase 3 @f3', () => {
  test('E2E-F3-01 arrastar um quadro-chave na linha do tempo', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('tab-animation').click();
    await expect(page.getByTestId('tl-animation-select')).toHaveValue('olhar-lateral');
    const bar = (await page.getByTestId('timeline').boundingBox())!;
    const marker = (await page.getByTestId('keyframe-1').boundingBox())!;
    await page.mouse.move(marker.x + marker.width / 2, marker.y + marker.height / 2);
    await page.mouse.down();
    await page.mouse.move(bar.x + bar.width * 0.4, bar.y + bar.height / 2, { steps: 6 });
    await page.mouse.up();
    const t = Number(await page.getByTestId('keyframe-1').getAttribute('data-t'));
    expect(Math.abs(t - 960)).toBeLessThanOrEqual(30);
    expect((await bridge<any>(page, 'getProject')).animations['olhar-lateral'].keyframes[1].t).toBe(t);
  });

  test('E2E-F3-02 play, pausa, quadro a quadro, voltar ao início e parar', async ({ page }) => {
    await openStudio(page, { clock: true });
    await page.getByTestId('tab-animation').click();
    await page.getByTestId('tl-play').click();
    await page.clock.runFor(600);
    await page.getByTestId('tl-pause').click();
    const p1 = (await playback(page)).position;
    expect(Math.abs(p1 - 600)).toBeLessThanOrEqual(20);
    await page.clock.runFor(1000);
    expect((await playback(page)).position).toBe(p1);
    await page.getByTestId('tl-step').click();
    expect((await playback(page)).position).toBeCloseTo(p1 + 1000 / 30, 0);
    await page.getByTestId('tl-step-back').click();
    expect((await playback(page)).position).toBeCloseTo(p1, 0);
    await page.getByTestId('tl-rewind').click();
    expect((await playback(page)).position).toBe(0);
    await page.getByTestId('tl-stop').click();
    expect((await playback(page)).active).toBe(false);
  });

  test('E2E-F3-03 modos loop e execução única', async ({ page }) => {
    await openStudio(page, { clock: true });
    await page.getByTestId('tab-animation').click();
    await page.getByTestId('tl-play').click(); // olhar-lateral: loop de 2400 ms
    await page.clock.runFor(3000);
    let p = await playback(page);
    expect(p.playing).toBe(true);
    expect(Math.abs(p.position - 600)).toBeLessThanOrEqual(20);

    await page.getByTestId('tl-animation-select').selectOption('surpresa'); // once, 1200 ms
    await page.getByTestId('tl-play').click();
    await page.clock.runFor(2000);
    p = await playback(page);
    expect(p.playing).toBe(false);
    expect(p.position).toBe(1200);
  });

  test('E2E-F3-04 a curva de interpolação altera a pose intermediária', async ({ page }) => {
    await openStudio(page, { clock: true, noSpontaneous: true });
    await page.getByTestId('tab-animation').click();
    await page.getByTestId('keyframe-1').click(); // t = 600, gazeX = -12
    const bar = (await page.getByTestId('timeline').boundingBox())!;
    const seekTo300 = async () => {
      await page.mouse.click(bar.x + bar.width * (300 / 2400), bar.y + 4);
      await page.clock.runFor(40);
      return (await bridge<{ gazeX: number }>(page, 'getPose')).gazeX;
    };
    await page.getByTestId('kf-easing').selectOption('linear');
    expect(await seekTo300()).toBeCloseTo(-6, 0);
    await page.getByTestId('kf-easing').selectOption('easeIn');
    expect(await seekTo300()).toBeCloseTo(-3, 0);
  });

  test('E2E-F3-05 toque prolongado: 499 ms é toque simples, 500 ms é prolongado', async ({ page }) => {
    await openStudio(page, { clock: true });
    await gesture(page, [120, 120], { holdMs: 499, clock: true });
    expect((await gestures(page)).map((g) => g.type)).toEqual(['tap']);
    await page.getByTestId('scenario-cancel').click();
    await gesture(page, [120, 120], { holdMs: 500, clock: true });
    expect((await gestures(page)).map((g) => g.type)).toEqual(['tap', 'longPress']);
    expect(await getState(page)).toBe('sleep');
  });

  test('E2E-F3-06 swipe nas quatro direções', async ({ page }) => {
    await openStudio(page, { clock: true });
    const cases: Array<[string, [number, number]]> = [
      ['right', [160, 120]],
      ['left', [80, 120]],
      ['up', [120, 80]],
      ['down', [120, 160]],
    ];
    for (const [, to] of cases) {
      await gesture(page, [120, 120], { to, holdMs: 80, clock: true });
      await page.getByTestId('scenario-cancel').click({ force: true }).catch(() => undefined);
    }
    expect(await gestures(page)).toEqual(cases.map(([direction]) => ({ type: 'swipe', direction })));
  });

  test('E2E-F3-07 limiares de 6 px (toque) e 24 px (swipe)', async ({ page }) => {
    await openStudio(page, { clock: true });
    const run = async (dx: number) => {
      const before = (await gestures(page)).length;
      await gesture(page, [100, 120], { to: [100 + dx, 120], holdMs: 80, clock: true });
      await page.clock.runFor(10_000); // encerra qualquer cenário disparado
      return (await gestures(page)).slice(before).map((g) => g.type);
    };
    expect(await run(5)).toEqual(['tap']);
    expect(await run(7)).toEqual([]);
    expect(await run(23)).toEqual([]);
    expect(await run(24)).toEqual(['swipe']);
  });

  test('E2E-F3-08 sinais sonoros de despertar, sucesso e erro', async ({ page }) => {
    await openStudio(page, { clock: true });
    for (const id of ['dialog', 'task', 'failure']) {
      await page.getByTestId(`scenario-${id}`).click();
      await page.clock.runFor(8000);
    }
    const cues = (await audioLog(page)).map((a) => a.cue).filter((c) => c !== 'speech');
    expect(cues).toEqual(['wake', 'success', 'error']);
  });

  test('E2E-F3-09 mudo e volume', async ({ page }) => {
    await openStudio(page, { clock: true });
    await setRange(page, 'volume-slider', 0.3);
    await page.getByTestId('scenario-task').click();
    await page.clock.runFor(4000);
    expect((await audioLog(page)).find((a) => a.cue === 'success')?.gain).toBeCloseTo(0.3);

    await page.getByTestId('sound-toggle').uncheck();
    const n = (await audioLog(page)).length;
    await page.getByTestId('scenario-dialog').click();
    await page.clock.runFor(8000);
    const after = (await audioLog(page)).slice(n);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((a) => a.gain === 0)).toBe(true);
  });

  test('E2E-F3-10 modulação de fala apenas durante speaking', async ({ page }) => {
    await openStudio(page, { clock: true });
    await page.getByTestId('state-speaking').click();
    await page.clock.runFor(2000);
    const speech = (await audioLog(page)).filter((a) => a.cue === 'speech').length;
    expect(speech).toBeGreaterThanOrEqual(3);
    await page.getByTestId('state-idle').click();
    await page.clock.runFor(2000);
    expect((await audioLog(page)).filter((a) => a.cue === 'speech').length).toBe(speech);
  });

  test('E2E-F3-11 spritesheet PNG + JSON', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('tab-export').click();
    await page.getByTestId('export-fps').selectOption('15');
    const files = unzip((await downloadBytes(page, () => page.getByTestId('export-spritesheet').click())).bytes);
    const png = Object.keys(files).find((f) => f.endsWith('.png'))!;
    const json = JSON.parse(Buffer.from(files[Object.keys(files).find((f) => f.endsWith('.json'))!]).toString('utf8'));
    expect(json.frames).toHaveLength(36); // 2400 ms a 15 FPS
    expect(json.fps).toBe(15);
    expect(json.animation.loop).toBe(true);
    const info = pngInfo(files[png]);
    expect(info).toMatchObject({ width: json.columns * 240, height: json.rows * 240 });
    for (const f of json.frames) {
      expect(f.frame.x + 240).toBeLessThanOrEqual(info.width);
      expect(f.frame.y + 240).toBeLessThanOrEqual(info.height);
    }
    expect(json.frames.reduce((s: number, f: { durationMs: number }) => s + f.durationMs, 0)).toBe(2400);
  });

  test('E2E-F3-12 MJPEG e sequência JPEG para o cartão SD', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('tab-export').click();
    await page.getByTestId('export-animation').selectOption('surpresa');
    const mjpeg = await downloadBytes(page, () => page.getByTestId('export-mjpeg').click());
    expect(mjpeg.name).toMatch(/\.mjpeg$/);
    expect(countJpegFrames(mjpeg.bytes)).toBe(36); // 1200 ms a 30 FPS
    expect(jpegSize(mjpeg.bytes)).toEqual({ width: 240, height: 240 });

    const seq = unzip((await downloadBytes(page, () => page.getByTestId('export-jpeg-sequence').click())).bytes);
    const jpgs = Object.keys(seq).filter((f) => f.endsWith('.jpg')).sort();
    expect(jpgs).toHaveLength(36);
    expect(jpgs[0]).toBe('surpresa_0000.jpg');
    expect(jpegSize(seq[jpgs[0]])).toEqual({ width: 240, height: 240 });
  });

  test('E2E-F3-13 C Array / header LVGL em RGB565', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('tab-export').click();
    for (const v of ['9', '8']) {
      await page.getByTestId('export-lvgl-version').selectOption(v);
      const files = unzip((await downloadBytes(page, () => page.getByTestId('export-carray').click())).bytes);
      const c = Buffer.from(files[Object.keys(files).find((f) => f.endsWith('.c'))!]).toString('utf8');
      const h = Buffer.from(files[Object.keys(files).find((f) => f.endsWith('.h'))!]).toString('utf8');
      expect(c).toContain('[115200]');
      expect((c.match(/0x[0-9a-f]{2}/g) ?? []).length).toBe(115_200);
      expect(h).toContain(v === '9' ? 'lv_image_dsc_t' : 'lv_img_dsc_t');
    }
  });

  test('E2E-F3-14 painel de diagnóstico: FPS, coordenadas e histórico', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('tab-diagnostics').click();
    await expect.poll(async () => Number(await page.getByTestId('diag-fps').textContent())).toBeGreaterThan(10);
    const p = await logicalToPage(page, 60, 120);
    await page.mouse.click(p.x, p.y);
    await expect(page.getByTestId('diag-coords')).toContainText('(60.5, 120.5)');
    await expect(page.getByTestId('diag-touch-entry')).toHaveCount(2);
    await page.mouse.click(p.x + 10, p.y);
    await expect(page.getByTestId('diag-touch-entry')).toHaveCount(4);
  });

  test('E2E-F3-15 critério de aceite da Fase 3', async ({ page }) => {
    await openStudio(page);
    // Cria a animação.
    await page.getByTestId('tab-animation').click();
    await page.getByTestId('tl-new').click();
    await page.getByTestId('tl-name').fill('Piscadela');
    await page.getByTestId('tl-duration').fill('900');
    await page.getByTestId('keyframe-1').click();
    await page.getByTestId('kf-channel-mouthCurve').check();
    await setRange(page, 'kf-value-mouthCurve', 1);
    await page.getByTestId('tl-play').click();
    // Som e gestos.
    await page.getByTestId('state-success').click();
    expect((await audioLog(page)).some((a) => a.cue === 'success' && a.gain > 0)).toBe(true);
    await page.getByTestId('state-idle').click();
    await gesture(page, [120, 120], { to: [170, 120] });
    await gesture(page, [120, 120], { to: [70, 120] });
    expect((await gestures(page)).map((g) => g.direction)).toEqual(['right', 'left']);
    // Exporta MJPEG e spritesheet da animação criada.
    await page.getByTestId('tab-export').click();
    await page.getByTestId('export-animation').selectOption({ label: 'Piscadela' });
    const mjpeg = await downloadBytes(page, () => page.getByTestId('export-mjpeg').click());
    expect(countJpegFrames(mjpeg.bytes)).toBe(27);
    const sheet = unzip((await downloadBytes(page, () => page.getByTestId('export-spritesheet').click())).bytes);
    expect(Object.keys(sheet).some((f) => f.endsWith('.json'))).toBe(true);
    // A aplicação continua responsiva.
    await page.getByTestId('mode-display').click();
    await expect(page.getByTestId('device-viewport')).toHaveAttribute('data-mode', 'display');
  });
});
