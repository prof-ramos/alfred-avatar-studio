// Fase 2 — Personalização, emoções e exportação de imagem (docs/PLANO_E2E.md §5.2).
import path from 'node:path';
import {
  bridge,
  canvasImage,
  canvasPixels,
  downloadBytes,
  expect,
  getState,
  openStudio,
  pngInfo,
  setRange,
  test,
  unzip,
  waitSaved,
} from '../helpers/studio';

const fixture = (name: string) => path.join(import.meta.dirname, '..', 'fixtures', name);
const EMOTIONS = ['neutral', 'happy', 'curious', 'surprised', 'confused', 'suspicious', 'angry', 'sad', 'excited', 'tired', 'ironic'];

/** Verdadeiro se o valor de 8 bits resulta da expansão de um canal com `bits` bits. */
const expanded = (v: number, bits: 5 | 6) => {
  const q = v >> (8 - bits);
  return (bits === 5 ? (q << 3) | (q >> 2) : (q << 2) | (q >> 4)) === v;
};

test.describe('Fase 2 @f2', () => {
  test('E2E-F2-01 as 11 expressões são selecionáveis e alteram o rosto', async ({ page }) => {
    await openStudio(page, { clock: true, noSpontaneous: true });
    await page.getByTestId('tab-emotions').click();
    const neutral = await canvasImage(page, true);
    for (const id of EMOTIONS) {
      await page.getByTestId(`emotion-${id}`).click();
      expect((await bridge<{ id: string }>(page, 'getEmotion')).id).toBe(id);
      const img = await canvasImage(page, true);
      if (id === 'neutral') expect(img).toBe(neutral);
      else expect(img, id).not.toBe(neutral);
    }
  });

  test('E2E-F2-02 intensidade 0 equivale ao neutro e 0.5 difere de 1.0', async ({ page }) => {
    await openStudio(page, { clock: true, noSpontaneous: true });
    await page.getByTestId('tab-emotions').click();
    const neutral = await canvasImage(page, true);
    await page.getByTestId('emotion-happy').click();
    await setRange(page, 'emotion-intensity', 0);
    expect(await canvasImage(page, true)).toBe(neutral);
    await setRange(page, 'emotion-intensity', 0.5);
    const half = await canvasImage(page, true);
    await setRange(page, 'emotion-intensity', 1);
    const full = await canvasImage(page, true);
    expect(half).not.toBe(full);
    expect(half).not.toBe(neutral);
  });

  test('E2E-F2-03 estado e emoção são ortogonais', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('state-speaking').click();
    await page.getByTestId('tab-emotions').click();
    await page.getByTestId('emotion-curious').click();
    await setRange(page, 'emotion-intensity', 0.8);
    expect(await getState(page)).toBe('speaking');
    expect(await bridge(page, 'getEmotion')).toEqual({ id: 'curious', intensity: 0.8 });
    await page.getByTestId('emotion-sad').click();
    expect(await getState(page)).toBe('speaking');
    await page.getByTestId('state-idle').click();
    expect(await bridge(page, 'getEmotion')).toEqual({ id: 'sad', intensity: 0.8 });
  });

  test('E2E-F2-04/05 piscadas reproduzíveis com a mesma semente e diferentes com outra', async ({ page }) => {
    await openStudio(page);
    const a = await bridge<number[]>(page, 'getBlinks', 0, 60_000);
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    expect(await bridge<number[]>(page, 'getBlinks', 0, 60_000)).toEqual(a);
    expect(a.length).toBeGreaterThan(8);

    await page.getByTestId('tab-emotions').click();
    await page.getByTestId('random-seed').fill('7');
    expect(await bridge<number>(page, 'getSeed')).toBe(7);
    expect(await bridge<number[]>(page, 'getBlinks', 0, 60_000)).not.toEqual(a);
  });

  test('E2E-F2-06 prévia RGB565 quantiza as cores do canvas', async ({ page }) => {
    await openStudio(page, { clock: true, noSpontaneous: true });
    await page.getByTestId('color-primary').fill('#7dd3fd');
    await canvasImage(page, true);
    const quantized = (px: number[]) =>
      px.every((v, i) => (i % 4 === 3 ? true : expanded(v, i % 4 === 1 ? 6 : 5)));
    expect(quantized(await canvasPixels(page))).toBe(false);
    await page.getByTestId('rgb565-toggle').click();
    await canvasImage(page, true);
    expect(quantized(await canvasPixels(page))).toBe(true);
    await page.getByTestId('rgb565-toggle').click();
    await canvasImage(page, true);
    expect(quantized(await canvasPixels(page))).toBe(false);
  });

  test('E2E-F2-07 PNG exportado mantém 32 bits mesmo com a prévia RGB565', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('color-primary').fill('#7dd3fd');
    await page.getByTestId('rgb565-toggle').click();
    await page.getByTestId('tab-export').click();
    const { bytes } = await downloadBytes(page, () => page.getByTestId('export-png').click());
    expect(pngInfo(bytes)).toMatchObject({ width: 240, height: 240, colorType: 6 });
    const notQuantized = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = 240;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, 240, 240).data;
      for (let i = 0; i < d.length; i += 4) {
        const r5 = d[i] >> 3;
        if (d[i + 3] === 255 && ((r5 << 3) | (r5 >> 2)) !== d[i]) return true;
      }
      return false;
    }, Buffer.from(bytes).toString('base64'));
    expect(notQuantized).toBe(true);
  });

  test('E2E-F2-08 exporta o projeto JSON no schema v1.4', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('tab-export').click();
    const { name, bytes } = await downloadBytes(page, () => page.getByTestId('project-export-json').click());
    expect(name).toMatch(/\.alfred\.json$/);
    const json = JSON.parse(Buffer.from(bytes).toString('utf8'));
    expect(json.schemaVersion).toBe(2);
    expect(json.$schema).toContain('project-v1.4.json');
    expect(json.device.profile).toBe('XIAOZHI_ROBOT_BALL_128');
  });

  test('E2E-F2-09 importar o JSON exportado em contexto limpo preserva 100% dos dados', async ({ page, browser }) => {
    await openStudio(page);
    await setRange(page, 'param-eyes-spacing', 50);
    await page.getByTestId('param-mouth-style').selectOption('oval');
    await page.getByTestId('color-accent').fill('#f472b6');
    await waitSaved(page);
    const original = await bridge<Record<string, unknown>>(page, 'getProject');
    await page.getByTestId('tab-export').click();
    const { bytes } = await downloadBytes(page, () => page.getByTestId('project-export-json').click());

    const ctx = await browser.newContext();
    const fresh = await ctx.newPage();
    await openStudio(fresh);
    await fresh.getByTestId('tab-projects').click();
    await fresh.getByTestId('project-import-input').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(bytes) });
    const originalId = (original.project as { id: string }).id;
    await expect.poll(async () => (await bridge<any>(fresh, 'getProject')).project.id).toBe(originalId);
    const imported = await bridge<Record<string, { updatedAt?: string }>>(fresh, 'getProject');
    const strip = (p: Record<string, any>) => ({ ...p, project: { ...p.project, updatedAt: undefined } });
    expect(strip(imported)).toEqual(strip(original));
    await ctx.close();
  });

  test('importa os valores iniciais na sessão aberta e os preserva no JSON', async ({ page }) => {
    await openStudio(page);
    expect(await getState(page)).toBe('idle');
    const project = await bridge<{ runtime: Record<string, unknown> }>(page, 'getProject');
    project.runtime.defaultState = 'sleep';
    project.runtime.defaultEmotion = 'sad';

    await page.getByTestId('tab-projects').click();
    await page.getByTestId('project-import-input').setInputFiles({
      name: 'sleep-sad.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
    await expect.poll(() => getState(page)).toBe('sleep');
    expect(await bridge(page, 'getEmotion')).toEqual({ id: 'sad', intensity: 0.8 });

    await page.getByTestId('tab-export').click();
    const { bytes } = await downloadBytes(page, () => page.getByTestId('project-export-json').click());
    expect(JSON.parse(Buffer.from(bytes).toString('utf8')).runtime).toEqual(project.runtime);
  });

  test('E2E-F2-10 rejeita JSON inválido, malformado e com marcação sem executar código', async ({ page }) => {
    await openStudio(page);
    let dialogs = 0;
    page.on('dialog', (d) => {
      dialogs++;
      void d.dismiss();
    });
    const before = await bridge(page, 'getProject');
    await page.getByTestId('tab-projects').click();
    for (const f of ['invalido-schema.json', 'invalido-xss.json', 'malformado.json']) {
      await page.getByTestId('project-import-input').setInputFiles(fixture(f));
      await expect(page.getByTestId('import-errors'), f).toBeVisible();
      await expect(page.getByTestId('import-errors')).toContainText('Importação rejeitada');
    }
    expect(dialogs).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(await bridge(page, 'getProject')).toEqual(before);
  });

  test('E2E-F2-11 migra projeto da versão 1 do schema', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('tab-projects').click();
    await page.getByTestId('project-import-input').setInputFiles(fixture('projeto-v1.json'));
    await expect(page.getByTestId('toast-success')).toContainText('migrado');
    const p = await bridge<any>(page, 'getProject');
    expect(p.schemaVersion).toBe(2);
    expect(p.avatar.primaryColor).toBe('#A7F3D0');
    expect(p.avatar.parameters.eyes.width).toBe(30);
    expect(p.device.targetFps).toBe(15);
  });

  test('E2E-F2-12 PNG estático 240 × 240 com fundo circular e transparente', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('tab-export').click();
    for (const bg of ['circle', 'transparent', 'square']) {
      await page.getByTestId('export-png-bg').selectOption(bg);
      const { bytes } = await downloadBytes(page, () => page.getByTestId('export-png').click());
      expect(pngInfo(bytes), bg).toMatchObject({ width: 240, height: 240 });
      const corner = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = c.height = 240;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return [ctx.getImageData(2, 2, 1, 1).data[3], ctx.getImageData(120, 230, 1, 1).data[3]];
      }, Buffer.from(bytes).toString('base64'));
      if (bg === 'circle') expect(corner).toEqual([0, 255]);
      if (bg === 'transparent') expect(corner).toEqual([0, 0]);
      if (bg === 'square') expect(corner).toEqual([255, 255]);
    }
  });

  test('E2E-F2-13 pacote ESPHome contém os 7 estados em 240 × 240', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('tab-export').click();
    const { name, bytes } = await downloadBytes(page, () => page.getByTestId('export-esphome').click());
    expect(name).toMatch(/-esphome\.zip$/);
    const files = unzip(bytes);
    const pngs = Object.keys(files).filter((f) => f.endsWith('.png')).sort();
    expect(pngs).toEqual(['error.png', 'idle.png', 'listening.png', 'loading.png', 'mute.png', 'replying.png', 'thinking.png']);
    for (const f of pngs) expect(pngInfo(files[f]), f).toMatchObject({ width: 240, height: 240 });
    // Estados diferentes geram imagens diferentes.
    expect(Buffer.from(files['idle.png']).equals(Buffer.from(files['mute.png']))).toBe(false);
    expect(Buffer.from(files['idle.png']).equals(Buffer.from(files['thinking.png']))).toBe(false);
  });

  test('E2E-F2-14 cria, duplica e alterna entre projetos independentes', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('tab-projects').click();
    await page.getByTestId('project-new-name').fill('Alfred Noturno');
    await page.getByTestId('project-new').click();
    await expect(page.getByTestId('header-project-name')).toHaveText('Alfred Noturno');
    await page.getByTestId('tab-avatar').click();
    await setRange(page, 'param-eyes-width', 90);
    await page.getByTestId('tab-projects').click();
    await page.getByTestId('project-duplicate').click();
    await expect(page.getByTestId('header-project-name')).toHaveText('Alfred Noturno (cópia)');
    await expect(page.getByTestId('project-item')).toHaveCount(3);

    await page.getByTestId('project-item').filter({ hasText: 'Alfred Classic' }).getByRole('button').first().click();
    await expect(page.getByTestId('header-project-name')).toHaveText('Alfred Classic');
    expect((await bridge<any>(page, 'getProject')).avatar.parameters.eyes.width).toBe(48);

    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    await page.getByTestId('tab-projects').click();
    await expect(page.getByTestId('project-item')).toHaveCount(3);
  });

  test('E2E-F2-15 critério de aceite da Fase 2', async ({ page, browser }) => {
    await openStudio(page);
    // Avatar 1
    await setRange(page, 'param-eyes-width', 60);
    await page.getByTestId('tab-emotions').click();
    await page.getByTestId('emotion-happy').click();
    // Avatar 2
    await page.getByTestId('tab-projects').click();
    await page.getByTestId('project-new-name').fill('Alfred Sério');
    await page.getByTestId('project-new').click();
    await page.getByTestId('tab-avatar').click();
    await page.getByTestId('param-eyes-shape').selectOption('softRect');
    await page.getByTestId('color-primary').fill('#fca5a5');
    await waitSaved(page);
    await page.getByTestId('tab-projects').click();
    await expect(page.getByTestId('project-item')).toHaveCount(2);

    await page.getByTestId('tab-export').click();
    const pack = unzip((await downloadBytes(page, () => page.getByTestId('export-esphome').click())).bytes);
    expect(Object.keys(pack).filter((f) => f.endsWith('.png'))).toHaveLength(7);

    const original = await bridge<any>(page, 'getProject');
    const { bytes } = await downloadBytes(page, () => page.getByTestId('project-export-json').click());
    const ctx = await browser.newContext();
    const fresh = await ctx.newPage();
    await openStudio(fresh);
    await fresh.getByTestId('tab-projects').click();
    await fresh.getByTestId('project-import-input').setInputFiles({ name: 'a.json', mimeType: 'application/json', buffer: Buffer.from(bytes) });
    await expect(fresh.getByTestId('header-project-name')).toHaveText('Alfred Sério');
    const imported = await bridge<any>(fresh, 'getProject');
    expect({ ...imported, project: { ...imported.project, updatedAt: 0 } }).toEqual({ ...original, project: { ...original.project, updatedAt: 0 } });
    await ctx.close();
  });

  test('E2E-F2-16 PNG da pose atual preserva a animação pausada', async ({ page }) => {
    await openStudio(page, { clock: true, noSpontaneous: true });
    await page.getByTestId('tab-animation').click();
    await page.getByTestId('tl-play').click();
    await page.clock.runFor(600);
    await page.getByTestId('tl-pause').click();
    await page.clock.runFor(40);
    expect((await bridge<{ gazeX: number }>(page, 'getPose')).gazeX).toBeLessThan(-10);

    await page.getByTestId('tab-export').click();
    await page.getByTestId('export-png-bg').selectOption('square');
    const matchesCanvas = async () => {
      const { bytes } = await downloadBytes(page, () => page.getByTestId('export-png').click());
      return page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = c.height = 240;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const exported = ctx.getImageData(0, 0, 240, 240).data;
        const live = (document.querySelector('[data-testid=display-canvas]') as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 240, 240).data;
        let diff = 0;
        for (let i = 0; i < live.length; i++) if (Math.abs(live[i] - exported[i]) > 2) diff++;
        return diff / live.length;
      }, Buffer.from(bytes).toString('base64'));
    };
    expect(await matchesCanvas()).toBeLessThan(0.001);

    // Sem a animação, o PNG exportado não corresponde mais à pose pausada.
    const paused = await bridge<{ gazeX: number }>(page, 'getPose');
    await page.getByTestId('tab-animation').click();
    await page.getByTestId('tl-stop').click();
    await page.clock.runFor(40);
    expect((await bridge<{ gazeX: number }>(page, 'getPose')).gazeX).not.toBeCloseTo(paused.gazeX);
    await page.getByTestId('tab-export').click();
    expect(await matchesCanvas()).toBeLessThan(0.001);
  });
});
