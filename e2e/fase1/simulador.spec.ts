// Fase 1 — Simulador básico (docs/PLANO_E2E.md §5.1).
import {
  PONTOS,
  bridge,
  canvasImage,
  expect,
  gesture,
  getState,
  gestures,
  logicalToPage,
  openStudio,
  setRange,
  stateSeq,
  tap,
  test,
  waitSaved,
} from '../helpers/studio';

test.describe('Fase 1 @f1', () => {
  test('E2E-F1-01 carrega o estúdio em português com canvas 240 × 240 @smoke', async ({ page }) => {
    await openStudio(page);
    await expect(page).toHaveTitle('Alfred Avatar Studio');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { name: 'Alfred Avatar Studio' })).toBeVisible();
    await expect(page.getByText('Cenários de conversação')).toBeVisible();
    const canvas = page.getByTestId('display-canvas');
    await expect(canvas).toHaveAttribute('width', '240');
    await expect(canvas).toHaveAttribute('height', '240');
  });

  test('E2E-F1-02/03 alterna Robô → Display → Pixel → Robô preservando o estado', async ({ page }) => {
    await openStudio(page);
    const vp = page.getByTestId('device-viewport');
    await expect(vp).toHaveAttribute('data-mode', 'robot');
    await expect(page.getByTestId('robot-body')).toBeVisible();
    await page.getByTestId('state-thinking').click();

    await page.getByTestId('mode-display').click();
    await expect(vp).toHaveAttribute('data-mode', 'display');
    await expect(page.getByTestId('robot-body')).toHaveCount(0);

    await page.getByTestId('mode-pixel').click();
    await expect(vp).toHaveAttribute('data-mode', 'pixel');

    await page.getByTestId('mode-robot').click();
    await expect(page.getByTestId('robot-body')).toBeVisible();
    expect(await getState(page)).toBe('thinking');
  });

  test('E2E-F1-04 modo Pixel nas escalas 1×, 2× e 4× com grade', async ({ page }) => {
    await openStudio(page);
    await page.getByTestId('mode-pixel').click();
    const canvas = page.getByTestId('display-canvas');
    for (const s of [1, 2, 4]) {
      await page.getByTestId(`pixel-scale-${s}`).click();
      const box = await canvas.boundingBox();
      expect(box?.width).toBeCloseTo(240 * s, 0);
      await expect(canvas).toHaveCSS('image-rendering', 'pixelated');
    }
    await expect(page.getByTestId('pixel-grid')).toBeVisible();
    await page.getByTestId('pixel-grid-toggle').click();
    await expect(page.getByTestId('pixel-grid')).toHaveCount(0);
  });

  test('E2E-F1-05 alterna pernas removíveis e salva no projeto', async ({ page }) => {
    await openStudio(page);
    await expect(page.getByTestId('robot-legs')).toBeVisible();
    await page.getByTestId('legs-toggle').click();
    await expect(page.getByTestId('robot-legs')).toHaveCount(0);
    await expect(page.getByTestId('legs-toggle')).toHaveText('Esfera pura');
    expect(((await bridge(page, 'getProject')) as { device: { showLegs: boolean } }).device.showLegs).toBe(false);
  });

  test('E2E-F1-06 guia de área segura com margem de 8 px', async ({ page }) => {
    await openStudio(page);
    await expect(page.getByTestId('safe-area-overlay')).toHaveCount(0);
    await page.getByTestId('safe-area-toggle').click();
    await expect(page.getByTestId('safe-area-overlay')).toHaveAttribute('r', '112');
    await page.getByTestId('safe-area-toggle').click();
    await expect(page.getByTestId('safe-area-overlay')).toHaveCount(0);
  });

  test('E2E-F1-07 editar geometria e cor reflete no canvas sem reiniciar a animação', async ({ page }) => {
    await openStudio(page, { clock: true, noSpontaneous: true });
    const before = await canvasImage(page, true);
    await page.getByTestId('tab-animation').click();
    await page.getByTestId('tl-play').click();
    await page.clock.runFor(700);
    const pos1 = (await bridge<{ position: number }>(page, 'getPlayback')).position;
    await page.getByTestId('tab-avatar').click();
    await setRange(page, 'param-eyes-width', 70);
    await page.getByTestId('color-primary').fill('#ff8800');
    await page.clock.runFor(100);
    const pos2 = (await bridge<{ position: number }>(page, 'getPlayback')).position;
    expect(pos2).toBeGreaterThan(pos1);
    expect(await canvasImage(page, true)).not.toBe(before);
    const project = (await bridge(page, 'getProject')) as { avatar: { primaryColor: string; parameters: { eyes: { width: number } } } };
    expect(project.avatar.parameters.eyes.width).toBe(70);
    expect(project.avatar.primaryColor).toBe('#FF8800');
  });

  test('E2E-F1-08 toque simples no centro gera evento lógico e desperta @smoke', async ({ page }) => {
    await openStudio(page);
    await tap(page, ...PONTOS.centro);
    const last = await bridge<{ phase: string; x: number; y: number; source: string }>(page, 'getLastTouchEvent');
    expect(last.phase).toBe('up');
    expect(Math.abs(last.x - 120.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(last.y - 120.5)).toBeLessThanOrEqual(1);
    expect(last.source).toBe('mouse');
    expect((await gestures(page)).map((g) => g.type)).toEqual(['tap']);
    expect((await stateSeq(page)).slice(0, 2)).toEqual(['idle', 'wake']);
  });

  test('E2E-F1-09 cliques fora do círculo, na moldura, carcaça e pernas são descartados', async ({ page }) => {
    await openStudio(page);
    await tap(page, ...PONTOS.foraDoCirculo);
    const body = await page.getByTestId('robot-body').boundingBox();
    if (!body) throw new Error('corpo não visível');
    await page.mouse.click(body.x + 70, body.y + 200); // moldura/carcaça
    await page.mouse.click(body.x + 30, body.y + 200); // carcaça
    await page.mouse.click(body.x + 119, body.y + 405); // perna dianteira
    expect(await bridge<unknown[]>(page, 'getTouchHistory')).toEqual([]);
    expect(await getState(page)).toBe('idle');
  });

  test('E2E-F1-10 arrastar para fora do círculo cancela o contato', async ({ page }) => {
    await openStudio(page);
    await gesture(page, [120, 120], { to: [238, 238], steps: 8 });
    const history = await bridge<Array<{ phase: string }>>(page, 'getTouchHistory');
    expect(history.at(-1)?.phase).toBe('cancel');
    expect((await gestures(page)).map((g) => g.type)).toEqual(['cancel']);
    expect(await getState(page)).toBe('idle');
  });

  test('E2E-F1-11 botão físico GPIO 0 no corpo do robô ativa Push-to-Talk @smoke', async ({ page }) => {
    await openStudio(page);
    const btn = await page.getByTestId('gpio0-button').boundingBox();
    if (!btn) throw new Error('botão não visível');
    await page.mouse.move(btn.x + btn.width / 2, btn.y + btn.height / 2);
    await page.mouse.down();
    expect(await getState(page)).toBe('listening');
    await expect(page.getByTestId('gpio0-button')).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.up();
    expect(await getState(page)).toBe('thinking');
    const log = await bridge<Array<{ gpio: number; level: number; source: string }>>(page, 'getButtonLog');
    expect(log).toEqual([
      expect.objectContaining({ gpio: 0, level: 0, source: 'hardware_button' }),
      expect.objectContaining({ gpio: 0, level: 1, source: 'hardware_button' }),
    ]);
  });

  test('E2E-F1-12 atalhos B e barra de espaço; ignorados com foco em campo de texto', async ({ page }) => {
    await openStudio(page);
    await page.keyboard.down('b');
    expect(await getState(page)).toBe('listening');
    await page.keyboard.up('b');
    await page.getByTestId('scenario-cancel').click();

    await page.keyboard.down(' ');
    expect(await getState(page)).toBe('listening');
    await page.keyboard.up(' ');
    await page.getByTestId('scenario-cancel').click();

    await page.getByTestId('tab-projects').click();
    await page.getByTestId('project-name').focus();
    await page.keyboard.press('b');
    await page.keyboard.press(' ');
    expect(await getState(page)).toBe('idle');
    await expect(page.getByTestId('project-name')).toHaveValue('Alfred Classicb ');
  });

  test('E2E-F1-13 ciclo completo de diálogo na ordem @smoke', async ({ page }) => {
    await openStudio(page, { clock: true });
    await page.getByTestId('scenario-dialog').click();
    await page.clock.runFor(10_000);
    expect(await stateSeq(page)).toEqual(['idle', 'wake', 'listening', 'thinking', 'speaking', 'idle']);
    await expect(page.getByTestId('state-indicator')).toHaveAttribute('data-state', 'idle');
  });

  test('E2E-F1-14 cenários de tarefa, falha e conectividade', async ({ page }) => {
    await openStudio(page, { clock: true });
    const cases: Array<[string, string[]]> = [
      ['task', ['executing', 'success', 'idle']],
      ['failure', ['error', 'idle']],
      ['connectOk', ['connecting', 'idle']],
      ['connectFail', ['connecting', 'error', 'idle']],
    ];
    for (const [id, expected] of cases) {
      const before = (await stateSeq(page)).length;
      await page.getByTestId(`scenario-${id}`).click();
      await page.clock.runFor(10_000);
      expect((await stateSeq(page)).slice(before), id).toEqual(expected);
    }
  });

  test('E2E-F1-15 cancelar o cenário descarta eventos pendentes', async ({ page }) => {
    await openStudio(page, { clock: true });
    await page.getByTestId('scenario-dialog').click();
    await page.clock.runFor(1200);
    expect(await getState(page)).toBe('listening');
    await page.getByTestId('scenario-cancel').click();
    const seq = await stateSeq(page);
    await page.clock.runFor(30_000);
    expect(await stateSeq(page)).toEqual(seq);
    expect(seq.at(-1)).toBe('idle');
  });

  test('E2E-F1-16 alterações persistem após recarregar a página @smoke', async ({ page }) => {
    await openStudio(page);
    await setRange(page, 'param-eyes-width', 66);
    await setRange(page, 'param-mouth-curvature', -0.5);
    await page.getByTestId('safe-area-toggle').click();
    await page.getByTestId('mode-display').click();
    await waitSaved(page);
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    await expect(page.getByTestId('param-eyes-width')).toHaveValue('66');
    await expect(page.getByTestId('param-mouth-curvature')).toHaveValue('-0.5');
    await expect(page.getByTestId('device-viewport')).toHaveAttribute('data-mode', 'display');
    await expect(page.getByTestId('safe-area-overlay')).toBeVisible();
  });

  test('E2E-F1-17 critério de aceite da Fase 1', async ({ page }) => {
    await openStudio(page);
    // Altera a geometria básica do rosto.
    await setRange(page, 'param-eyes-height', 30);
    await setRange(page, 'param-mouth-width', 80);
    // Toca na tela circular e observa a transição.
    const c = await logicalToPage(page, 120, 150);
    await page.mouse.click(c.x, c.y);
    await expect(page.getByTestId('state-indicator')).not.toHaveAttribute('data-state', 'idle');
    await page.getByTestId('scenario-cancel').click();
    // Aciona o botão físico.
    const btn = await page.getByTestId('gpio0-button').boundingBox();
    await page.mouse.move(btn!.x + btn!.width / 2, btn!.y + btn!.height / 2);
    await page.mouse.down();
    await expect(page.getByTestId('state-indicator')).toHaveAttribute('data-state', 'listening');
    await page.mouse.up();
    // Recarrega e confirma que as alterações permanecem.
    await waitSaved(page);
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    await expect(page.getByTestId('param-eyes-height')).toHaveValue('30');
    await expect(page.getByTestId('param-mouth-width')).toHaveValue('80');
  });
});
