// Painel de diagnóstico: FPS, coordenadas, histórico de toque e memória (PRD §11.2, RF-23).
import { STATE_LABELS } from '../../domain/labels';
import { MEMORY_ESTIMATES } from '../../domain/profile';
import { useDiag, useStore } from '../context';
import type { TargetFps } from '../../domain/types';
import { FIELD, Section } from '../controls';

const fmtKiB = (b: number) => `${(b / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} KiB`;

export function DiagnosticsPanel() {
  const diag = useDiag();
  const { store, state } = useStore();
  const t = diag.lastTouch;
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;

  return (
    <div data-testid="diagnostics-panel" className="space-y-4">
      <Section title="Desempenho">
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-fg-2">FPS medido</dt>
          <dd data-testid="diag-fps" className="text-right font-mono tabular-nums">
            {diag.fps}
          </dd>
          <dt className="flex items-center text-fg-2">
            <label htmlFor="fps-select">FPS-alvo</label>
          </dt>
          <dd className="text-right">
            <select
              id="fps-select"
              data-testid="fps-select"
              value={state.project.device.targetFps}
              onChange={(e) =>
                store.update((d) => {
                  d.device.targetFps = Number(e.target.value) as TargetFps;
                })
              }
              className={`${FIELD} font-mono tabular-nums`}
            >
              <option value={30}>30</option>
              <option value={15}>15</option>
            </select>
          </dd>
          {mem && (
            <>
              <dt className="text-fg-2">Heap JS (medição real)</dt>
              <dd className="text-right font-mono tabular-nums">{(mem.usedJSHeapSize / 1048576).toFixed(1)} MiB</dd>
            </>
          )}
        </dl>
      </Section>

      <Section title="Toque">
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-fg-2">Último evento</dt>
          <dd data-testid="diag-coords" className="text-right font-mono tabular-nums">
            {t ? `${t.phase} (${t.x.toFixed(1)}, ${t.y.toFixed(1)})` : '—'}
          </dd>
          <dt className="text-fg-2">Fonte</dt>
          <dd className="text-right font-mono tabular-nums">{t?.source ?? '—'}</dd>
          <dt className="text-fg-2">Contatos rejeitados</dt>
          <dd data-testid="diag-rejected" className="text-right font-mono tabular-nums">
            {diag.rejectedTouches}
          </dd>
        </dl>
        <ol data-testid="diag-touch-history" className="max-h-40 space-y-0.5 overflow-auto rounded-lg bg-sink p-3 font-mono text-xs tabular-nums text-fg-2">
          {diag.touchHistory
            .slice()
            .reverse()
            .map((e, i) => (
              <li key={`${e.timestamp}-${i}`} data-testid="diag-touch-entry">
                {e.timestamp.toFixed(0)} ms · {e.phase} · ({e.x.toFixed(1)}, {e.y.toFixed(1)})
              </li>
            ))}
        </ol>
      </Section>

      <Section title="Gestos reconhecidos">
        <ol data-testid="diag-gesture-history" className="max-h-32 space-y-0.5 overflow-auto rounded-lg bg-sink p-3 font-mono text-xs tabular-nums text-fg-2">
          {diag.gestureLog
            .slice()
            .reverse()
            .map((g, i) => (
              <li key={`${g.at}-${i}`}>
                {g.at.toFixed(0)} ms · {g.type}
                {g.direction ? ` (${g.direction})` : ''}
              </li>
            ))}
        </ol>
      </Section>

      <Section title="Estados">
        <ol data-testid="diag-state-history" className="max-h-32 space-y-0.5 overflow-auto rounded-lg bg-sink p-3 font-mono text-xs tabular-nums text-fg-2">
          {diag.stateLog
            .slice()
            .reverse()
            .map((s, i) => (
              <li key={`${s.at}-${i}`}>
                {s.at.toFixed(0)} ms · {STATE_LABELS[s.state]}
                {s.forced ? ' (forçado)' : ''}
              </li>
            ))}
        </ol>
        {diag.invalidTransitions.length > 0 && (
          <p className="text-xs text-warning">
            Transições inválidas ignoradas: {diag.invalidTransitions.map((x) => `${x.from}→${x.to}`).join(', ')}
          </p>
        )}
      </Section>

      <Section title="Memória gráfica estimada (orçamento de tela)">
        <table className="w-full text-xs">
          <tbody>
            {MEMORY_ESTIMATES.map((m) => (
              <tr key={m.label} className="border-b border-line last:border-0">
                <td className="py-1 pr-2 text-fg-2">
                  {m.label}
                  <span className="block font-mono text-fg-3">{m.formula}</span>
                </td>
                <td className="py-1 text-right align-top font-mono tabular-nums">
                  {fmtKiB(m.bytes)}
                  <span className="block text-fg-3">{m.bytes.toLocaleString('pt-BR')} B</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-fg-3">Estimativas matemáticas, não a memória total do ESP32-S3 (8 MB de PSRAM)</p>
      </Section>
    </div>
  );
}
