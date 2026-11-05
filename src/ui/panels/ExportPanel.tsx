// Exportador multiformato (PRD §9).
import { useState } from 'react';
import {
  exportCArray,
  exportEsphomePack,
  exportMjpeg,
  exportPng,
  exportProjectJson,
  exportSpritesheet,
  triggerDownload,
} from '../../export/assetExporter';
import { ESPHOME_STATES, type LvglVersion } from '../../export/formats';
import type { BackgroundMode } from '../../render/canvasRenderer';
import { useSim, useStore } from '../context';
import { Button, Section, Select, Toggle } from '../controls';

export function ExportPanel() {
  const { store, state } = useStore();
  const { snap } = useSim();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pngBg, setPngBg] = useState<BackgroundMode>('circle');
  const [fps, setFps] = useState<15 | 30>(state.project.device.targetFps);
  const [lvgl, setLvgl] = useState<LvglVersion>(9);
  const [swap, setSwap] = useState(false);
  const [carraySource, setCarraySource] = useState<'current' | 'animation'>('current');
  const [animId, setAnimId] = useState<string>(state.selectedAnimationId ?? Object.keys(state.project.animations)[0] ?? '');

  const animations = Object.values(state.project.animations);
  const selectedAnim = state.project.animations[animId] ? animId : (animations[0]?.id ?? '');
  const onProgress = (done: number, total: number) => setProgress({ done, total });

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setProgress(null);
    try {
      await fn();
      store.toast('success', `${label}: exportação concluída.`);
    } catch (e) {
      store.toast('error', `${label}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const current = { state: snap.state, emotion: snap.emotion };

  return (
    <div className="space-y-4">
      <Section title="Projeto (JSON)">
        <Button testId="project-export-json" onClick={() => triggerDownload(exportProjectJson(store.project))}>
          Exportar projeto JSON
        </Button>
      </Section>

      <Section title="Imagem estática (PNG 240 × 240)">
        <Select<BackgroundMode>
          label="Fundo"
          value={pngBg}
          options={[
            { value: 'circle', label: 'Preto circular' },
            { value: 'transparent', label: 'Transparente' },
            { value: 'square', label: 'Quadrado sólido' },
          ]}
          onChange={setPngBg}
          testId="export-png-bg"
        />
        <Button
          testId="export-png"
          disabled={!!busy}
          onClick={() => run('PNG', async () => triggerDownload(await exportPng(store.project, current, pngBg)))}
        >
          Exportar PNG da pose atual
        </Button>
      </Section>

      <Section title="Pacote de estados ESPHome">
        <p className="text-xs text-fg-3">{ESPHOME_STATES.map((e) => e.file).join(', ')}</p>
        <Button
          testId="export-esphome"
          disabled={!!busy}
          onClick={() => run('Pacote ESPHome', async () => triggerDownload(await exportEsphomePack(store.project, snap.userEmotion, onProgress)))}
        >
          Exportar pacote ESPHome (.zip)
        </Button>
      </Section>

      <Section title="Animação: spritesheet e MJPEG">
        <Select
          label="Animação"
          value={selectedAnim}
          options={animations.map((a) => ({ value: a.id, label: a.name }))}
          onChange={setAnimId}
          testId="export-animation"
        />
        <Select<15 | 30>
          label="Taxa de quadros"
          value={fps}
          options={[
            { value: 30, label: '30 FPS' },
            { value: 15, label: '15 FPS' },
          ]}
          onChange={setFps}
          testId="export-fps"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            testId="export-spritesheet"
            disabled={!!busy || !selectedAnim}
            onClick={() =>
              run('Spritesheet', async () => triggerDownload(await exportSpritesheet(store.project, selectedAnim, fps, snap.userEmotion, onProgress)))
            }
          >
            Spritesheet (PNG + JSON)
          </Button>
          <Button
            testId="export-mjpeg"
            disabled={!!busy || !selectedAnim}
            onClick={() =>
              run('MJPEG', async () => {
                const r = await exportMjpeg(store.project, selectedAnim, fps, snap.userEmotion, 0.85, onProgress);
                triggerDownload(r.mjpeg);
              })
            }
          >
            Vídeo MJPEG
          </Button>
          <Button
            testId="export-jpeg-sequence"
            disabled={!!busy || !selectedAnim}
            onClick={() =>
              run('Sequência JPEG', async () => {
                const r = await exportMjpeg(store.project, selectedAnim, fps, snap.userEmotion, 0.85, onProgress);
                triggerDownload(r.sequence);
              })
            }
          >
            Sequência JPEG (.zip)
          </Button>
        </div>
        <p className="text-xs text-fg-3">O MJPEG roda direto do cartão MicroSD no Spotpear Ball V2, sem regravar o firmware</p>
      </Section>

      <Section title="C Array / LVGL (RGB565)">
        <Select<LvglVersion>
          label="Versão do LVGL"
          value={lvgl}
          options={[
            { value: 9, label: 'LVGL 9 (lv_image_dsc_t)' },
            { value: 8, label: 'LVGL 8 (lv_img_dsc_t)' },
          ]}
          onChange={setLvgl}
          testId="export-lvgl-version"
        />
        <Select<'current' | 'animation'>
          label="Origem"
          value={carraySource}
          options={[
            { value: 'current', label: 'Quadro atual' },
            { value: 'animation', label: 'Todos os quadros da animação' },
          ]}
          onChange={setCarraySource}
          testId="export-carray-source"
        />
        <Toggle label="Trocar bytes (LV_COLOR_16_SWAP)" checked={swap} onChange={setSwap} testId="export-swap" />
        <Button
          testId="export-carray"
          disabled={!!busy}
          onClick={() =>
            run('C Array', async () =>
              triggerDownload(
                await exportCArray(
                  store.project,
                  {
                    version: lvgl,
                    swap,
                    source:
                      carraySource === 'current' || !selectedAnim
                        ? { kind: 'current', req: current }
                        : { kind: 'animation', animationId: selectedAnim, fps, emotion: snap.userEmotion },
                  },
                  onProgress,
                ),
              ),
            )
          }
        >
          Exportar .c / .h
        </Button>
      </Section>

      {busy && (
        <div role="status" data-testid="export-progress" className="rounded-lg border border-line bg-raised p-3 font-mono text-xs tabular-nums text-fg-2">
          Exportando {busy}
          {progress ? `: ${progress.done}/${progress.total} quadros` : '…'}
        </div>
      )}
    </div>
  );
}
