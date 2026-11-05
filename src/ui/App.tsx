import { useEffect, useState } from 'react';
import { EMOTION_LABELS, STATE_LABELS } from '../domain/labels';
import type { OperationalState } from '../domain/types';
import { useSim, useStore } from './context';
import { Button, Tabs } from './controls';
import { DeviceViewport, useRenderLoop } from './DeviceViewport';
import { AvatarEditor } from './panels/AvatarEditor';
import { DiagnosticsPanel } from './panels/DiagnosticsPanel';
import { EmotionPanel } from './panels/EmotionPanel';
import { ExportPanel } from './panels/ExportPanel';
import { ProjectPanel } from './panels/ProjectPanel';
import { SimulationPanel } from './panels/SimulationPanel';
import { TimelinePanel } from './panels/TimelinePanel';

type LeftTab = 'avatar' | 'emotions' | 'animation';
type RightTab = 'simulation' | 'export' | 'projects' | 'diagnostics';

const SAVE_LABEL = { idle: '', saving: 'Salvando…', saved: 'Salvo', error: 'Erro ao salvar' } as const;

function isTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Atalhos do botão físico: B ou barra de espaço (Push-to-Talk). */
function useHardwareShortcut() {
  const { sim } = useSim();
  useEffect(() => {
    const isPtt = (e: KeyboardEvent) => e.code === 'Space' || e.key === 'b' || e.key === 'B';
    const down = (e: KeyboardEvent) => {
      if (!isPtt(e) || isTextField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (!e.repeat) sim.pttPress('hardware_button');
    };
    const up = (e: KeyboardEvent) => {
      if (!isPtt(e) || isTextField(e.target)) return;
      e.preventDefault();
      sim.pttRelease('hardware_button');
    };
    const blur = () => sim.pttRelease('hardware_button');
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [sim]);
}

function useRuntimeSync() {
  const { sim } = useSim();
  const { store, state } = useStore();
  const { soundEnabled, volume } = state.project.runtime;
  useEffect(() => sim.syncAudioSettings(), [sim, soundEnabled, volume]);
  useEffect(() => sim.selectAnimation(state.selectedAnimationId), [sim, state.selectedAnimationId]);
  useEffect(() => {
    const onVis = () => sim.setHidden(document.visibilityState === 'hidden');
    const onHide = () => void store.flush();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    };
  }, [sim, store]);
}

function ViewToolbar() {
  const { store, state } = useStore();
  const { view } = state;
  const { device } = state.project;
  const setDevice = (fn: (d: typeof device) => void) => store.update((p) => fn(p.device));

  return (
    <div className="flex flex-wrap items-center justify-center gap-2" role="toolbar" aria-label="Visualização">
      <div className="flex gap-1 rounded-lg border border-line p-1">
        {(
          [
            ['robot', 'Robô'],
            ['display', 'Display'],
            ['pixel', 'Pixel'],
          ] as const
        ).map(([m, label]) => (
          <Button key={m} variant="ghost" className="px-2" testId={`mode-${m}`} pressed={view.mode === m} onClick={() => store.setView({ mode: m })}>
            {label}
          </Button>
        ))}
      </div>
      {view.mode === 'pixel' && (
        <div className="flex gap-1 rounded-lg border border-line p-1">
          {([1, 2, 4] as const).map((s) => (
            <Button key={s} variant="ghost" className="px-2" testId={`pixel-scale-${s}`} pressed={view.pixelScale === s} onClick={() => store.setView({ pixelScale: s })}>
              {s}×
            </Button>
          ))}
          <Button variant="ghost" className="px-2" testId="pixel-grid-toggle" pressed={view.pixelGrid} onClick={() => store.setView({ pixelGrid: !view.pixelGrid })}>
            Grade
          </Button>
        </div>
      )}
      {view.mode === 'robot' && (
        <Button testId="legs-toggle" pressed={device.showLegs} onClick={() => setDevice((d) => (d.showLegs = !d.showLegs))}>
          {device.showLegs ? 'Com pernas' : 'Esfera pura'}
        </Button>
      )}
      <Button testId="safe-area-toggle" pressed={device.showSafeArea} onClick={() => setDevice((d) => (d.showSafeArea = !d.showSafeArea))}>
        Área segura
      </Button>
      <Button
        testId="rgb565-toggle"
        pressed={device.colorPreview === 'rgb565'}
        onClick={() => setDevice((d) => (d.colorPreview = d.colorPreview === 'rgb565' ? 'rgba32' : 'rgb565'))}
      >
        RGB565
      </Button>
      <Button testId="overlays-toggle" pressed={view.showOverlays} onClick={() => store.setView({ showOverlays: !view.showOverlays })}>
        Status
      </Button>
    </div>
  );
}

/** Cor do LED RGB (WS2812, GPIO 48) por estado: a assinatura visual do estúdio. */
const LED_COLOR: Record<OperationalState, string> = {
  idle: 'var(--color-fg-3)',
  wake: 'var(--color-accent)',
  listening: 'var(--color-accent)',
  thinking: 'var(--color-warning)',
  speaking: 'var(--color-accent)',
  executing: 'var(--color-warning)',
  success: 'var(--color-positive)',
  error: 'var(--color-negative)',
  sleep: '#3b4256',
  connecting: 'var(--color-warning)',
  charging: 'var(--color-positive)',
  low_battery: 'var(--color-negative)',
};

function StatusBar() {
  const { sim, snap } = useSim();
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
      <dl className="flex items-center gap-4 font-mono text-xs text-fg-3">
        <div className="flex items-center gap-2">
          <span
            data-testid="status-led"
            aria-hidden="true"
            className="h-2 w-2 rounded-full transition-colors duration-150"
            style={{ backgroundColor: LED_COLOR[snap.state] }}
          />
          <dt className="sr-only">Estado</dt>
          <dd data-testid="state-indicator" data-state={snap.state} className="text-fg">
            {STATE_LABELS[snap.state]}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt>Emoção</dt>
          <dd data-testid="emotion-indicator" data-emotion={snap.emotion.id} className="tabular-nums text-fg-2">
            {EMOTION_LABELS[snap.emotion.id]} {snap.emotion.intensity.toFixed(2)}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt>GPIO 0</dt>
          <dd data-testid="gpio-level" className="text-fg-2">
            {snap.pttDown ? 'nível 0' : 'nível 1'}
          </dd>
        </div>
      </dl>
      <Button testId="activate-button" variant="primary" onClick={() => sim.activate()} disabled={!!snap.scenarioId}>
        Ativar por voz (simulado)
      </Button>
    </div>
  );
}

function Toasts() {
  const { store, state } = useStore();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {state.toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          data-testid={`toast-${t.kind}`}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            t.kind === 'error' ? 'border-negative/40 bg-raised text-fg' : 'border-line bg-raised text-fg'
          }`}
          onClick={() => store.dismissToast(t.id)}
        >
          <span
            aria-hidden="true"
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.kind === 'error' ? 'bg-negative' : t.kind === 'success' ? 'bg-positive' : 'bg-fg-3'}`}
          />
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function App() {
  const { state } = useStore();
  const [left, setLeft] = useState<LeftTab>('avatar');
  const [right, setRight] = useState<RightTab>('simulation');
  useRenderLoop();
  useHardwareShortcut();
  useRuntimeSync();

  return (
    <div className="flex min-h-screen flex-col bg-page text-fg">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-line bg-sink px-6 py-2">
        <div>
          <h1 className="text-base font-medium">Alfred Avatar Studio</h1>
          <p className="font-mono text-xs text-fg-3">Simulador do Spotpear Ball V2 · perfil XIAOZHI_ROBOT_BALL_128 · 240 × 240</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-fg" data-testid="header-project-name">
            {state.project.project.name}
          </span>
          <span data-testid="save-status" data-status={state.saveStatus} className="text-xs text-fg-3">
            {SAVE_LABEL[state.saveStatus]}
          </span>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[336px_minmax(0,1fr)_384px]">
        <aside className="border-b border-line bg-surface lg:border-r lg:border-b-0" aria-label="Edição">
          <Tabs<LeftTab>
            idPrefix="tab"
            value={left}
            onChange={setLeft}
            tabs={[
              { id: 'avatar', label: 'Avatar' },
              { id: 'emotions', label: 'Emoções' },
              { id: 'animation', label: 'Animação' },
            ]}
          />
          <div className="p-5 lg:max-h-[calc(100vh-104px)] lg:overflow-y-auto">
            {left === 'avatar' && <AvatarEditor />}
            {left === 'emotions' && <EmotionPanel />}
            {left === 'animation' && <TimelinePanel />}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col items-center gap-6 p-6" aria-label="Dispositivo">
          <ViewToolbar />
          <div className="flex w-full justify-center overflow-auto py-2">
            <DeviceViewport />
          </div>
          <StatusBar />
        </section>

        <aside className="border-t border-line bg-surface lg:border-t-0 lg:border-l" aria-label="Simulação e saída">
          <Tabs<RightTab>
            idPrefix="tab"
            value={right}
            onChange={setRight}
            tabs={[
              { id: 'simulation', label: 'Simulação' },
              { id: 'export', label: 'Exportar' },
              { id: 'projects', label: 'Projetos' },
              { id: 'diagnostics', label: 'Diagnóstico' },
            ]}
          />
          <div className="p-5 lg:max-h-[calc(100vh-104px)] lg:overflow-y-auto">
            {right === 'simulation' && <SimulationPanel />}
            {right === 'export' && <ExportPanel />}
            {right === 'projects' && <ProjectPanel />}
            {right === 'diagnostics' && <DiagnosticsPanel />}
          </div>
        </aside>
      </main>
      <Toasts />
    </div>
  );
}
