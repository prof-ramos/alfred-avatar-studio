import { useEffect, useState } from 'react';
import { EMOTION_LABELS, STATE_LABELS } from '../domain/labels';
import type { TargetFps } from '../domain/types';
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
    <div className="flex flex-wrap items-center justify-center gap-1.5" role="toolbar" aria-label="Visualização">
      <div className="flex rounded-md border border-slate-700 p-0.5">
        {(
          [
            ['robot', 'Robô'],
            ['display', 'Display'],
            ['pixel', 'Pixel'],
          ] as const
        ).map(([m, label]) => (
          <Button key={m} variant="ghost" testId={`mode-${m}`} pressed={view.mode === m} onClick={() => store.setView({ mode: m })}>
            {label}
          </Button>
        ))}
      </div>
      {view.mode === 'pixel' && (
        <div className="flex rounded-md border border-slate-700 p-0.5">
          {([1, 2, 4] as const).map((s) => (
            <Button key={s} variant="ghost" testId={`pixel-scale-${s}`} pressed={view.pixelScale === s} onClick={() => store.setView({ pixelScale: s })}>
              {s}×
            </Button>
          ))}
          <Button variant="ghost" testId="pixel-grid-toggle" pressed={view.pixelGrid} onClick={() => store.setView({ pixelGrid: !view.pixelGrid })}>
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
        Prévia RGB565
      </Button>
      <Button testId="overlays-toggle" pressed={view.showOverlays} onClick={() => store.setView({ showOverlays: !view.showOverlays })}>
        Indicadores
      </Button>
      <select
        aria-label="FPS-alvo"
        data-testid="fps-select"
        value={device.targetFps}
        onChange={(e) => setDevice((d) => (d.targetFps = Number(e.target.value) as TargetFps))}
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
      >
        <option value={30}>30 FPS</option>
        <option value={15}>15 FPS</option>
      </select>
    </div>
  );
}

function StatusBar() {
  const { sim, snap } = useSim();
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
      <span className="rounded-full border border-slate-700 px-3 py-1">
        Estado:{' '}
        <strong data-testid="state-indicator" data-state={snap.state} className="text-sky-300">
          {STATE_LABELS[snap.state]}
        </strong>
      </span>
      <span className="rounded-full border border-slate-700 px-3 py-1">
        Emoção:{' '}
        <strong data-testid="emotion-indicator" data-emotion={snap.emotion.id} className="text-sky-300">
          {EMOTION_LABELS[snap.emotion.id]} ({snap.emotion.intensity.toFixed(2)})
        </strong>
      </span>
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
          className={`pointer-events-auto rounded-md border px-3 py-2 text-sm shadow-lg ${
            t.kind === 'error' ? 'border-red-700 bg-red-950 text-red-100' : t.kind === 'success' ? 'border-emerald-700 bg-emerald-950 text-emerald-100' : 'border-slate-700 bg-slate-900'
          }`}
          onClick={() => store.dismissToast(t.id)}
        >
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
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2">
        <div>
          <h1 className="text-lg font-semibold">Alfred Avatar Studio</h1>
          <p className="text-xs text-slate-400">Simulador do Spotpear Ball V2 · perfil XIAOZHI_ROBOT_BALL_128 · 240 × 240</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300" data-testid="header-project-name">
            {state.project.project.name}
          </span>
          <span data-testid="save-status" data-status={state.saveStatus} className="text-xs text-slate-500">
            {SAVE_LABEL[state.saveStatus]}
          </span>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="border-b border-slate-800 lg:border-r lg:border-b-0" aria-label="Edição">
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
          <div className="p-4 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto">
            {left === 'avatar' && <AvatarEditor />}
            {left === 'emotions' && <EmotionPanel />}
            {left === 'animation' && <TimelinePanel />}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col items-center gap-4 p-4" aria-label="Dispositivo">
          <ViewToolbar />
          <div className="flex w-full justify-center overflow-auto py-2">
            <DeviceViewport />
          </div>
          <StatusBar />
        </section>

        <aside className="border-t border-slate-800 lg:border-t-0 lg:border-l" aria-label="Simulação e saída">
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
          <div className="p-4 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto">
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
