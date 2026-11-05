// Painel de diagnóstico: FPS, coordenadas, histórico de toque e memória (PRD §11.2, RF-23).
import { STATE_LABELS } from '../../domain/labels';
import { MEMORY_ESTIMATES } from '../../domain/profile';
import { useDiag, useStore } from '../context';
import { Section } from '../controls';

const fmtBytes = (b: number) => `${b.toLocaleString('pt-BR')} bytes (${(b / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KiB)`;

export function DiagnosticsPanel() {
  const diag = useDiag();
  const { state } = useStore();
  const t = diag.lastTouch;
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;

  return (
    <div data-testid="diagnostics-panel" className="space-y-4">
      <Section title="Desempenho">
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-400">FPS medido</dt>
          <dd data-testid="diag-fps" className="text-right font-mono">
            {diag.fps}
          </dd>
          <dt className="text-slate-400">FPS-alvo</dt>
          <dd className="text-right font-mono">{state.project.device.targetFps}</dd>
          {mem && (
            <>
              <dt className="text-slate-400">Heap JS (medição real)</dt>
              <dd className="text-right font-mono">{(mem.usedJSHeapSize / 1048576).toFixed(1)} MiB</dd>
            </>
          )}
        </dl>
      </Section>

      <Section title="Toque">
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-400">Último evento</dt>
          <dd data-testid="diag-coords" className="text-right font-mono">
            {t ? `${t.phase} (${t.x.toFixed(1)}, ${t.y.toFixed(1)})` : '—'}
          </dd>
          <dt className="text-slate-400">Fonte</dt>
          <dd className="text-right font-mono">{t?.source ?? '—'}</dd>
          <dt className="text-slate-400">Contatos rejeitados</dt>
          <dd data-testid="diag-rejected" className="text-right font-mono">
            {diag.rejectedTouches}
          </dd>
        </dl>
        <ol data-testid="diag-touch-history" className="max-h-40 space-y-0.5 overflow-auto rounded-md bg-slate-900 p-2 font-mono text-xs text-slate-300">
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
        <ol data-testid="diag-gesture-history" className="max-h-32 space-y-0.5 overflow-auto rounded-md bg-slate-900 p-2 font-mono text-xs text-slate-300">
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
        <ol data-testid="diag-state-history" className="max-h-32 space-y-0.5 overflow-auto rounded-md bg-slate-900 p-2 font-mono text-xs text-slate-300">
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
          <p className="text-xs text-amber-300">
            Transições inválidas ignoradas: {diag.invalidTransitions.map((x) => `${x.from}→${x.to}`).join(', ')}
          </p>
        )}
      </Section>

      <Section title="Memória gráfica estimada (orçamento de tela)">
        <table className="w-full text-xs">
          <tbody>
            {MEMORY_ESTIMATES.map((m) => (
              <tr key={m.label} className="border-b border-slate-800 last:border-0">
                <td className="py-1 pr-2 text-slate-300">
                  {m.label}
                  <span className="block font-mono text-slate-500">{m.formula}</span>
                </td>
                <td className="py-1 text-right font-mono">{fmtBytes(m.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-500">Estimativas matemáticas; não representam a memória total do ESP32-S3 (8 MB de PSRAM).</p>
      </Section>
    </div>
  );
}
