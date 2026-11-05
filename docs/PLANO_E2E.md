# Plano de testes E2E | Alfred Avatar Studio

**Versão do documento:** 1.0  
**Data:** 05/11/2026  
**Referência:** [PRD.md](../PRD.md) v1.4 (§7.1, §10, §11, §12, §14.2)  
**Ferramenta:** Playwright (`@playwright/test`)  
**Status:** Implementado. Os casos estão em `e2e/` e o resultado da última execução está na seção 12.

---

## 1. Objetivo e escopo

Este plano define como validar, de ponta a ponta e no navegador, os fluxos de usuário das **Fases 1 a 3** do Alfred Avatar Studio. Cada caso é rastreável a um requisito funcional (RF) ou não funcional (RNF) do PRD e aos critérios de aceite de cada fase.

### 1.1. Dentro do escopo

- Fluxos de interface: modos de visualização, editor de avatar, simulador de conversação, linha do tempo e exportações.
- Pipeline de entrada: toque de ponto único, gestos (tap, long press, swipe) e botão físico simulado (`GPIO 0`).
- Persistência no IndexedDB, importação/exportação de JSON e integridade dos arquivos exportados.
- Regressão visual do canvas 240 × 240 com semente e relógio controlados.
- Requisitos operacionais verificáveis no navegador: operação offline, suspensão em segundo plano e estabilidade de FPS.

### 1.2. Fora do escopo

- Hardware real (Fases 4 e 5), firmware, WebSerial/WebUSB (RF-25).
- Desempenho ou emulação do ESP32-S3.
- ASR, TTS neural ou LLMs externos.
- Gravação/reprodução de sequências de toque (RF-24, P2).
- Lógica pura já coberta por Vitest (§14.1 do PRD): máquina de estados, precedência de composição, easing, migrações e validação de schema em nível de unidade. O E2E cobre apenas o efeito desses comportamentos na interface.

---

## 2. Ambiente e configuração

### 2.1. Navegadores e projetos

| Projeto Playwright | Navegador | Uso |
|---|---|---|
| `chromium` | Chromium (headless) | Projeto principal; único que gera *baselines* visuais |
| `webkit` | WebKit | Aproximação do Safari no macOS; sem comparação visual |
| `chromium-dpr2` | Chromium com `deviceScaleFactor: 2` | Independência do `devicePixelRatio` (tela Retina do M3) |
| `firefox` | Firefox | Opcional; apenas suíte `@smoke` |

### 2.2. Restrições do computador de referência (MacBook Air M3, 8 GB)

- `workers: 2` localmente; no CI, conforme a máquina do runner.
- `trace` e `video` somente em `on-first-retry`; `screenshot: 'only-on-failure'`.
- `retries: 0` localmente e `2` no CI.
- Servidor de desenvolvimento do Vite em `127.0.0.1` (PRD §11.3).

### 2.3. Configuração proposta

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? undefined : 2,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173/?test=1',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-dpr2', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 2 }, grep: /@dpr/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grepInvert: /@visual/ },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2.4. Estrutura de diretórios

```text
e2e/
├── fase1/            # specs @f1
├── fase2/            # specs @f2
├── fase3/            # specs @f3
├── transversais/     # specs de coordenadas, offline, FPS
├── fixtures/         # projetos JSON válidos, inválidos e de versões antigas
├── helpers/          # coordenadas, IndexedDB, leitura de pixels, exportações
└── pages/            # page objects (StudioPage, DevicePage, TimelinePage…)
```

---

## 3. Estratégia de testabilidade

Para que os testes sejam determinísticos, a aplicação deve expor os contratos a seguir. Eles fazem parte da implementação das Fases 1–3.

### 3.1. Seletores estáveis (`data-testid`)

| Área | IDs |
|---|---|
| Dispositivo | `device-viewport`, `display-canvas`, `robot-body`, `robot-legs`, `gpio0-button`, `safe-area-overlay`, `status-overlay` |
| Modos | `mode-robot`, `mode-display`, `mode-pixel`, `pixel-scale-1`, `pixel-scale-2`, `pixel-scale-4`, `pixel-grid-toggle` |
| Opções | `legs-toggle`, `safe-area-toggle`, `rgb565-toggle`, `sound-toggle`, `volume-slider` |
| Editor | `param-<grupo>-<campo>` (ex.: `param-eyes-width`), `color-primary`, `color-accent`, `color-background` |
| Estado e emoção | `state-indicator`, `emotion-select`, `emotion-intensity` |
| Cenários | `scenario-<id>` (ex.: `scenario-dialog`), `scenario-cancel` |
| Linha do tempo | `timeline`, `keyframe-<n>`, `tl-play`, `tl-pause`, `tl-stop`, `tl-rewind`, `tl-step`, `tl-loop-mode` |
| Projetos | `project-new`, `project-duplicate`, `project-list`, `project-import`, `project-export-json` |
| Exportações | `export-png`, `export-esphome`, `export-spritesheet`, `export-mjpeg`, `export-carray` |
| Diagnóstico | `diagnostics-panel`, `diag-fps`, `diag-coords`, `diag-touch-history` |

Textos visíveis continuam em português e são verificados por `getByRole`/`getByText` nos casos de idioma; os demais casos usam `data-testid`.

### 3.2. Ponte de teste

Disponível somente quando a URL contém `?test=1` **e** a build é de desenvolvimento/teste (`import.meta.env.MODE !== 'production'`):

Implementação: `src/testBridge.ts`.

```ts
interface AlfredTestBridge {
  getState(): OperationalState;            // 'idle' | 'wake' | ...
  getEmotion(): { id: EmotionId; intensity: number };
  getLastTouchEvent(): LogicalTouchEvent | null;
  getTouchHistory(): LogicalTouchEvent[];
  getGestureLog(): Array<{ type: 'tap' | 'longPress' | 'swipe' | 'cancel'; direction?: 'up' | 'down' | 'left' | 'right' }>;
  getStateLog(): Array<{ state: OperationalState; at: number; forced?: boolean }>;
  /** Botão Boot: nível 0 = pressionado (ativo em nível baixo). */
  getButtonLog(): Array<{ gpio: 0; level: 0 | 1; source: 'hardware_button'; timestamp: number }>;
  getFps(): number;
  getSeed(): number;
  getBlinks(fromMs: number, toMs: number): number[];
  getAudioLog(): Array<{ cue: 'wake' | 'success' | 'error' | 'speech'; gain: number }>;
  getPose(): FacePose | null;
  getPlayback(): { animId: string | null; active: boolean; playing: boolean; position: number };
  getProject(): Project;
  isRenderLoopRunning(): boolean;
  flush(): Promise<void>;                  // força o salvamento no IndexedDB
}
declare global { interface Window { __ALFRED_TEST__?: AlfredTestBridge } }
```

O isolamento do IndexedDB vem do contexto novo que o Playwright cria para cada teste; não há `resetStorage()`.

A ponte apenas **lê** o estado; as ações sempre ocorrem pela interface (clique, teclado, ponteiro), para não mascarar defeitos de UI.

### 3.3. Determinismo

| Fonte de variação | Controle |
|---|---|
| Tempo (long press, cenários, piscadas, timeline) | `page.clock.install()` + `page.clock.runFor(ms)` |
| Aleatoriedade (piscadas, micromovimentos) | `randomSeed` fixo (`42`) no projeto de fixture |
| Áudio | `AudioContext` substituído por espião via `page.addInitScript`; nenhum som real |
| Persistência | Contexto novo por teste (IndexedDB isolado); `resetStorage()` quando necessário |
| Fontes e antialiasing | *Baselines* visuais apenas no projeto `chromium` |

### 3.4. Downloads

Todas as exportações são capturadas com `page.waitForEvent('download')`, salvas em `testInfo.outputPath()` e inspecionadas pelos helpers da seção 7.

---

## 4. Helper de coordenadas

O display usa espaço lógico `0..239` e área útil circular `(x-120)² + (y-120)² <= 120²` (PRD §4.6, §5.2). O helper converte coordenadas lógicas em coordenadas de página, independentemente do modo, da escala e do `devicePixelRatio`:

```ts
// e2e/helpers/coords.ts
import type { Page } from '@playwright/test';

export async function logicalToPage(page: Page, x: number, y: number) {
  const box = await page.getByTestId('display-canvas').boundingBox();
  if (!box) throw new Error('display-canvas não visível');
  const s = box.width / 240; // escala CSS efetiva (1×, 2×, 4× ou ajuste ao layout)
  return { x: box.x + (x + 0.5) * s, y: box.y + (y + 0.5) * s };
}

export const PONTOS = {
  centro: [120, 120],
  bordaInterna: [120, 1],    // distância 119 do centro: dentro
  foraDoCirculo: [5, 5],     // canto do quadrado 240×240: fora
  limiteDireito: [239, 120], // distância 119: dentro
} as const;
```

Pontos fora do canvas (moldura, carcaça, pernas) são obtidos pelos `boundingBox()` de `robot-body` e `robot-legs`, descontando a área do canvas.

---

## 5. Matriz de casos de teste

Prioridade: **P0** bloqueia a entrega da fase; **P1** deve passar ou ter exceção registrada.

### 5.1. Fase 1 — Simulador básico (`@f1`)

| ID | RF | Cenário | Resultado esperado | Prior. |
|---|---|---|---|:---:|
| E2E-F1-01 | RF-01 | Abrir o estúdio | Interface em português; `display-canvas` com `width=240` e `height=240`; nenhum erro no console | P0 |
| E2E-F1-02 | RF-02, RF-03 | Selecionar modo Robô | `robot-body` (SVG) visível com o canvas inscrito na moldura | P0 |
| E2E-F1-03 | RF-03 | Alternar Robô → Display → Pixel → Robô | Somente o modo ativo é exibido; avatar e estado preservados | P0 |
| E2E-F1-04 | RF-03 | Modo Pixel nas escalas 1×, 2× e 4×, com e sem grade | Canvas com 240, 480 e 960 px CSS; `image-rendering: pixelated`; grade alterna | P0 |
| E2E-F1-05 | RF-10 | Alternar `legs-toggle` | `robot-legs` aparece/desaparece; preferência salva no projeto | P1 |
| E2E-F1-06 | RF-11 | Ativar `safe-area-toggle` | `safe-area-overlay` visível com margem de 8 px lógicos; desativar remove | P1 |
| E2E-F1-07 | RF-04 | Alterar largura dos olhos e cor primária com animação ativa | Canvas muda (diff de pixels); animação não reinicia (`getStateLog` sem reinício) | P0 |
| E2E-F1-08 | RF-07 | Tap no centro do display | `LogicalTouchEvent` `down`/`up` em ~(120,120), `source` correto; gesto `tap`; transição para `wake` | P0 |
| E2E-F1-09 | RF-07 | Clique em `foraDoCirculo`, na moldura, na carcaça e nas pernas | Nenhum `LogicalTouchEvent`; estado permanece `idle` | P0 |
| E2E-F1-10 | RF-07 | Pressionar no centro e arrastar para fora do círculo | Evento `cancel` emitido ao cruzar a borda; nenhum gesto reconhecido | P0 |
| E2E-F1-11 | RF-08 | Pressionar e soltar `gpio0-button` no modo Robô | `getButtonLog()` registra GPIO 0 em nível 0 e depois 1, com `source: 'hardware_button'`; estado `listening` enquanto pressionado (Push-to-Talk) e `thinking` ao soltar | P0 |
| E2E-F1-12 | RF-08 | Teclas `B` e barra de espaço | Mesmo efeito de E2E-F1-11; atalho **não** dispara com foco em campo de texto | P0 |
| E2E-F1-13 | RF-05, RF-06 | Executar `scenario-dialog` | Sequência `idle → wake → listening → thinking → speaking → idle` em ordem | P0 |
| E2E-F1-14 | RF-06 | Executar cenários de tarefa, falha e conectividade | Sequências do PRD §4.4 (`executing → success`, `error`, `connecting`) | P0 |
| E2E-F1-15 | RF-06 | Iniciar cenário, cancelar no meio e avançar o relógio 30 s | Estado vai para `idle` e nenhuma transição posterior ao cancelamento | P0 |
| E2E-F1-16 | RF-09 | Alterar parâmetros e recarregar a página | Parâmetros, modo e opções restaurados do IndexedDB | P0 |
| E2E-F1-17 | RF-04, 07, 08, 09 | **Critério de aceite da Fase 1** (jornada única): abrir, alterar geometria, tocar na tela, clicar no botão, observar transição, recarregar | Todas as etapas passam e as alterações persistem | P0 |

### 5.2. Fase 2 — Personalização, emoções e exportação de imagem (`@f2`)

| ID | RF | Cenário | Resultado esperado | Prior. |
|---|---|---|---|:---:|
| E2E-F2-01 | RF-12 | Selecionar cada uma das 11 expressões (10 emoções + `neutral`) | `getEmotion()` reflete a escolha; canvas difere do neutro (exceto `neutral`) | P0 |
| E2E-F2-02 | RF-12 | Intensidade 0.0, 0.5 e 1.0 em `happy` | 0.0 equivale visualmente a `neutral`; 0.5 e 1.0 diferem entre si | P1 |
| E2E-F2-03 | RF-12, RF-05 | Estado `speaking` com `curious` a 0.8 | Estado e emoção coexistem; trocar emoção não altera estado e vice-versa | P0 |
| E2E-F2-04 | RF-13 | Seed 42, avançar relógio 60 s duas vezes (recarregando entre elas) | Sequências de piscadas idênticas (log e *snapshots* em instantes fixos) | P1 |
| E2E-F2-05 | RF-13 | Alterar seed para 7 | Sequência de piscadas diferente da seed 42 | P1 |
| E2E-F2-06 | RF-17 | Ativar `rgb565-toggle` com gradiente na paleta | Todos os pixels lidos do canvas pertencem aos níveis de R/B com 5 bits e G com 6 bits (expansão por replicação de bits); desativar restaura | P1 |
| E2E-F2-07 | RF-17, RF-19 | Exportar PNG com prévia RGB565 ativa | PNG exportado mantém 32 bits sem quantização | P1 |
| E2E-F2-08 | RF-18 | Exportar projeto JSON | Arquivo válido no schema v1.4, `schemaVersion: 2`, `device.profile: XIAOZHI_ROBOT_BALL_128` | P0 |
| E2E-F2-09 | RF-18 | Importar o JSON exportado em contexto limpo | Igualdade profunda com o original (exceto `updatedAt`); canvas idêntico | P0 |
| E2E-F2-10 | RF-18 | Importar fixtures inválidas: schema quebrado, tipos errados, campos com `<script>`/`<img onerror>` | Importação rejeitada com mensagem em português; nenhum script executado (`page.on('dialog')` e listener de erro sem disparo); projeto atual intacto | P0 |
| E2E-F2-11 | RF-18 | Importar fixture de versão anterior do schema | Migração aplicada; projeto abre com valores esperados | P1 |
| E2E-F2-12 | RF-19 | Exportar PNG estático (fundo transparente e fundo preto circular) | PNG 240 × 240; canal alfa conforme opção | P0 |
| E2E-F2-13 | RF-19 | Exportar pacote ESPHome | Exatamente 7 arquivos: `idle`, `listening`, `thinking`, `replying`, `error`, `loading`, `mute` (`.png`, 240 × 240) | P0 |
| E2E-F2-14 | RF-09 | Criar, duplicar e alternar entre projetos | Lista mostra todos; alterações em um não afetam o outro; persistem após recarga | P0 |
| E2E-F2-15 | RF-12, 18, 19 | **Critério de aceite da Fase 2**: criar e salvar dois avatares distintos, exportar pacote ESPHome, reimportar JSON | Pacote completo e reimportação com 100% de integridade | P0 |

### 5.3. Fase 3 — Animação, gestos avançados, som e mídia (`@f3`)

| ID | RF | Cenário | Resultado esperado | Prior. |
|---|---|---|---|:---:|
| E2E-F3-01 | RF-14 | Criar 3 keyframes e arrastar o segundo no `timeline` | Keyframes persistem na nova posição; duração respeitada | P1 |
| E2E-F3-02 | RF-14 | Play, Pause, Stop, Voltar ao início, avanço quadro a quadro | Posição da agulha e canvas correspondem ao tempo esperado (relógio controlado) | P1 |
| E2E-F3-03 | RF-14 | Modos `loop` e `once` | `once` para no fim; `loop` reinicia | P1 |
| E2E-F3-04 | RF-14 | Trocar curva para `linear` e `easeInOut` | Canvas no ponto médio difere entre curvas (verificação de efeito; cálculo coberto por Vitest) | P1 |
| E2E-F3-05 | RF-15 | Manter contato 499 ms e 500 ms sem mover | 499 ms → `tap`; 500 ms → `longPress` | P0 |
| E2E-F3-06 | RF-15 | Swipe de 40 px nas 4 direções a partir do centro | `swipe` com direção correta em cada caso | P0 |
| E2E-F3-07 | RF-15 | Limiares: deslocamento de 5 px, 7 px, 23 px e 24 px | 5 px → `tap`; 7 px → nenhum `tap`; 23 px → nenhum `swipe`; 24 px → `swipe` | P0 |
| E2E-F3-08 | RF-16 | Entrar em `wake`, `success` e `error` | `getAudioLog()` registra os sinais `wake`, `success` e `error` na ordem | P1 |
| E2E-F3-09 | RF-16 | Mutar e ajustar volume | Com mudo, nenhum sinal com `gain > 0`; volume altera o ganho registrado | P1 |
| E2E-F3-10 | RF-16 | Estado `speaking` | Sinais `speech` registrados enquanto a boca anima; cessam ao sair de `speaking` | P1 |
| E2E-F3-11 | RF-20 | Exportar spritesheet | PNG + JSON; JSON descreve N quadros, posições dentro da imagem, durações e loop | P1 |
| E2E-F3-12 | RF-21 | Exportar MJPEG e sequência JPEG | Arquivo MJPEG com quadros JPEG (marcadores `FFD8`/`FFD9`), 240 × 240; sequência com nomes ordenados | P1 |
| E2E-F3-13 | RF-22 | Exportar C Array / Header LVGL | `.c` e `.h` gerados; array com `240 × 240 × 2 = 115200` bytes; `lv_img_dsc_t` declarado | P1 |
| E2E-F3-14 | RF-23 | Abrir `diagnostics-panel` e tocar em pontos conhecidos | FPS exibido; coordenadas lógicas corretas; histórico acumula toques na ordem | P1 |
| E2E-F3-15 | RF-14, 15, 16, 20, 21 | **Critério de aceite da Fase 3**: criar animação com som, testar swipes, exportar MJPEG e spritesheet | Fluxo conclui sem travamento (nenhuma tarefa longa > 2 s; página responde) | P0 |

### 5.4. Casos transversais (`@tx`)

| ID | Ref. | Cenário | Resultado esperado | Prior. |
|---|---|---|---|:---:|
| E2E-TX-01 | RF-07, §14.2 | Matriz parametrizada: modos {Robô, Display, Pixel} × escalas {1×, 2×, 4×} × DPR {1, 2} (`@dpr`); tap em `centro`, `bordaInterna`, `limiteDireito` e `foraDoCirculo` | Coordenadas lógicas com erro ≤ 1 px; pontos fora rejeitados em todas as combinações | P0 |
| E2E-TX-02 | RNF §11.1 | Ocultar a aba (`visibilitychange`) durante animação | `isRenderLoopRunning()` falso e timers suspensos; retomada ao voltar | P1 |
| E2E-TX-03 | RNF §11.3 | Bloquear toda requisição não-loopback via `context.route('**/*')` e executar a suíte `@smoke` | Nenhuma requisição externa tentada; aplicação funcional | P0 |
| E2E-TX-04 | RNF §11.1 | Reproduzir animação por 10 s (relógio real) | FPS médio ≥ 28 com alvo de 30; ≥ 14 com alvo de 15 | P1 |
| E2E-TX-05 | Geral | Todas as jornadas de aceite | Nenhum `console.error` nem `pageerror` | P0 |

> O E2E-TX-04 depende do desempenho da máquina; no CI roda como informativo (`test.info().annotations`) e só bloqueia na máquina de referência.

---

## 6. Regressão visual

- Alvo: pixels do canvas lógico 240 × 240 (via `toDataURL`, comparados com `toMatchSnapshot`), sem a barra de status, a carcaça ou o marcador de toque. Um quadro por estado operacional (10) e por emoção (5), com seed 42, comportamento espontâneo desligado e relógio parado.
- Somente no projeto `chromium` (`@visual`); WebKit é excluído para evitar falsos positivos de antialiasing.
- Tolerância: `maxDiffPixelRatio: 0.001`.
- As imagens de referência levam o sufixo da plataforma (`-chromium-linux.png`). No macOS, gere as do próprio sistema com `npm run test:e2e:update` na primeira execução.
- Atualização de *baselines*: `npm run test:e2e:update`, apenas em commit dedicado e com revisão das imagens no PR.

---

## 7. Validação de exportações

| Formato | Verificações automatizadas |
|---|---|
| JSON | Validação contra o schema v1.4; igualdade profunda após reimportação |
| PNG | Assinatura `89 50 4E 47`; chunk `IHDR` com largura/altura 240; profundidade e tipo de cor conforme opção de fundo |
| Pacote ESPHome | Arquivo compactado (ou múltiplos downloads) com exatamente os 7 nomes; cada PNG validado como acima |
| Spritesheet | Dimensões do PNG = colunas × 240 por linhas × 240; JSON com quadros dentro dos limites e soma das durações igual à da animação |
| MJPEG / JPEG | Contagem de pares `FFD8`…`FFD9` = número de quadros esperado; dimensões 240 × 240 no marcador SOF |
| C Array / LVGL | `.h` declara `lv_img_dsc_t`; `.c` contém 115.200 bytes por quadro RGB565; `LV_IMG_CF_TRUE_COLOR` (ou equivalente) |

Os helpers ficam em `e2e/helpers/exports.ts` e leem os bytes com `fs` do Node, sem dependências adicionais além de, opcionalmente, um leitor de ZIP para o pacote ESPHome.

---

## 8. Rastreabilidade

| RF | Descrição resumida | Casos E2E | Também em Vitest |
|---|---|---|:---:|
| RF-01 | Display circular 240 × 240 | F1-01 | — |
| RF-02 | Corpo vetorial do robô | F1-02 | — |
| RF-03 | Modos Robô, Display e Pixel | F1-02, F1-03, F1-04, TX-01 | — |
| RF-04 | Editor paramétrico do rosto | F1-07, F1-17 | Sim |
| RF-05 | Máquina de estados | F1-13, F2-03 | Sim |
| RF-06 | Cenários de conversação | F1-13, F1-14, F1-15 | Sim |
| RF-07 | Toque com conversão circular | F1-08, F1-09, F1-10, TX-01 | Sim |
| RF-08 | Botão GPIO 0 e atalho | F1-11, F1-12, F1-17 | — |
| RF-09 | Persistência IndexedDB | F1-16, F2-14 | Sim |
| RF-10 | Pernas removíveis | F1-05 | — |
| RF-11 | Guia de área segura | F1-06 | — |
| RF-12 | 10 emoções + intensidade | F2-01, F2-02, F2-03 | Sim |
| RF-13 | Comportamentos espontâneos | F2-04, F2-05 | Sim |
| RF-14 | Linha do tempo e keyframes | F3-01 a F3-04 | Sim |
| RF-15 | Long press e swipe | F3-05, F3-06, F3-07 | Sim |
| RF-16 | Feedback sonoro sintético | F3-08, F3-09, F3-10 | — |
| RF-17 | Prévia RGB565 | F2-06, F2-07 | Sim |
| RF-18 | Exportação/importação JSON | F2-08 a F2-11 | Sim |
| RF-19 | PNG e pacote ESPHome | F2-07, F2-12, F2-13 | Sim |
| RF-20 | Spritesheet | F3-11 | Sim |
| RF-21 | MJPEG para cartão SD | F3-12 | Sim |
| RF-22 | C Array / LVGL | F3-13 | Sim |
| RF-23 | Painel de diagnóstico | F3-14 | — |
| RF-24 | Gravação de sequências de toque | Fora do escopo (P2) | — |
| RF-25 | WebSerial / flash | Fora do escopo (Fase 5) | — |

Critérios de aceite: Fase 1 → E2E-F1-17; Fase 2 → E2E-F2-15; Fase 3 → E2E-F3-15.

---

## 9. Execução e CI

### 9.1. Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:smoke": "playwright test --grep @smoke",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:update": "playwright test --project=chromium --grep @visual --update-snapshots"
  }
}
```

Instalação local (ARM nativo no macOS):

```bash
npm i -D @playwright/test
npx playwright install chromium webkit
```

### 9.2. Tags

| Tag | Conteúdo |
|---|---|
| `@smoke` | E2E-F1-01, F1-08, F1-11, F1-13, F1-16 (execução < 1 min) |
| `@f1`, `@f2`, `@f3`, `@tx` | Casos por fase |
| `@visual` | Comparações de *screenshot* |
| `@dpr` | Casos executados também no projeto `chromium-dpr2` |

### 9.3. Pipeline sugerido (GitHub Actions)

1. `npm ci`
2. `npx playwright install --with-deps chromium webkit` (com cache de `~/.cache/ms-playwright`)
3. `npm run test` (Vitest) — falha interrompe o pipeline
4. `npm run test:e2e`
5. Publicar `playwright-report/` e `test-results/` como artefatos (retenção de 14 dias)

Gatilhos: `pull_request` e `push` em `main`. As suítes de fases ainda não implementadas ficam marcadas com `test.fixme` até a entrega correspondente.

---

## 10. Critérios de saída por fase

Uma fase só é declarada concluída quando:

1. 100% dos casos **P0** da fase e dos transversais aplicáveis passam em `chromium` e `webkit`.
2. Casos **P1** passam ou têm exceção registrada (motivo, impacto e prazo) no PR da fase.
3. Nenhum teste instável conhecido: a suíte da fase passa em 3 execuções consecutivas (`--repeat-each=3`).
4. O caso de aceite da fase passa sem *retries*.
5. Verificações que não puderem ser executadas no ambiente disponível estão registradas com o procedimento para completá-las (PRD §1). Resultados presumidos não contam como testes realizados.

---

## 11. Riscos e limitações

| Risco | Mitigação |
|---|---|
| Web Audio sem saída real em modo headless | Espião de `AudioContext`; validação auditiva manual registrada à parte |
| Diferenças de renderização de canvas entre navegadores | *Baselines* visuais apenas em Chromium; WebKit valida comportamento |
| Instabilidade de testes dependentes de tempo | `page.clock` em todos os casos de gestos, cenários e animação; tempo real só em E2E-TX-04 |
| Variação de FPS conforme a máquina | E2E-TX-04 informativo no CI e bloqueante apenas na máquina de referência |
| Ponte de teste vazar para produção | Ativação condicionada a `?test=1` e modo diferente de produção. Na build de produção, o código da ponte é eliminado; verificado com `grep -c __ALFRED_TEST__ dist/assets/*.js` (resultado 0) |
| E2E não comprova funcionamento no hardware | Validação física permanece nas Fases 4 e 5 (inspeção e teste via cartão MicroSD) |

---

## 12. Estado de execução

Última execução: 05/11/2026, em contêiner Linux (Chromium 1243 / Playwright 1.63.0).

| Suíte | Resultado |
|---|---|
| Vitest (`npm test`) | 83 de 83 passando, em 9 arquivos |
| Playwright `chromium` | 68 de 68 passando |
| Playwright `chromium-dpr2` (`@dpr`) | 5 de 5 passando |
| Instabilidade (`--repeat-each=3`, `chromium`) | 204 de 204 passando, sem testes instáveis |
| Playwright `webkit` | **Não executado**: o navegador WebKit não está instalado no ambiente usado. Executar no Mac com `npx playwright install webkit && npx playwright test --project=webkit` |

Verificações ainda pendentes, conforme o PRD §1:

1. Projeto `webkit` (acima).
2. E2E-TX-04 na máquina de referência (MacBook Air M3); no contêiner, o FPS medido foi de ~30 com alvo 30 e ~15 com alvo 15.
3. Escuta real do áudio sintético: os testes verificam apenas o registro de sinais e o ganho.
