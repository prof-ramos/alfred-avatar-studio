// Simulador de conversação, estados, status do dispositivo, gestos e som (PRD §4.4–4.6).
import { ACTION_LABELS, GESTURE_LABELS, STATE_LABELS } from '../../domain/labels';
import { SCENARIOS } from '../../domain/stateMachine';
import { GESTURES, OPERATIONAL_STATES, type BindingAction } from '../../domain/types';
import { useSim, useStore } from '../context';
import { Button, Section, Select, Slider, Toggle } from '../controls';

const SCENARIO_IDS = ['dialog', 'task', 'failure', 'connectOk', 'connectFail'] as const;

export function SimulationPanel() {
  const { sim, snap } = useSim();
  const { store, state } = useStore();
  const { runtime, device, bindings, animations } = state.project;

  const actionOptions: Array<{ value: BindingAction; label: string }> = [
    ...(Object.keys(ACTION_LABELS) as BindingAction[]).map((a) => ({ value: a, label: ACTION_LABELS[a] })),
    ...Object.values(animations).map((a) => ({ value: `animation:${a.id}` as BindingAction, label: `Animação: ${a.name}` })),
  ];

  return (
    <div className="space-y-4">
      <Section title="Cenários de conversação">
        <div className="grid grid-cols-2 gap-1.5">
          {SCENARIO_IDS.map((id) => (
            <Button key={id} testId={`scenario-${id}`} pressed={snap.scenarioId === id} onClick={() => sim.runScenario(id)}>
              {SCENARIOS[id].label}
            </Button>
          ))}
          <Button testId="scenario-cancel" variant="danger" disabled={!snap.scenarioId} onClick={() => sim.cancelScenario()}>
            Cancelar cenário
          </Button>
        </div>
      </Section>

      <Section title="Forçar estado operacional">
        <div className="grid grid-cols-3 gap-1.5">
          {OPERATIONAL_STATES.map((s) => (
            <Button key={s} testId={`state-${s}`} pressed={snap.state === s} onClick={() => sim.forceState(s)}>
              {STATE_LABELS[s]}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Status do dispositivo">
        <Toggle label="Wi-Fi conectado" checked={snap.status.wifi} onChange={(v) => sim.setStatus({ wifi: v })} testId="status-wifi-toggle" />
        <Toggle label="Carregando (USB-C)" checked={snap.status.charging} onChange={(v) => sim.setStatus({ charging: v })} testId="status-charging-toggle" />
        <Toggle label="Microfone mudo" checked={snap.status.micMuted} onChange={(v) => sim.setStatus({ micMuted: v })} testId="status-mic-toggle" />
        <Slider label="Bateria" value={snap.status.battery} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => sim.setStatus({ battery: v })} testId="status-battery-slider" />
      </Section>

      <Section title="Som sintético">
        <Toggle
          label="Som ativado"
          checked={runtime.soundEnabled}
          onChange={(v) =>
            store.update((d) => {
              d.runtime.soundEnabled = v;
            })
          }
          testId="sound-toggle"
        />
        <Slider
          label="Volume"
          value={runtime.volume}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) =>
            store.update((d) => {
              d.runtime.volume = v;
            })
          }
          testId="volume-slider"
        />
      </Section>

      <Section title="Gestos e ações">
        {GESTURES.map((g) => {
          const current = bindings.find((b) => b.gesture === g)?.action ?? 'none';
          return (
            <Select<BindingAction>
              key={g}
              label={GESTURE_LABELS[g]}
              value={current}
              options={actionOptions}
              onChange={(v) =>
                store.update((d) => {
                  d.bindings = [...d.bindings.filter((b) => b.gesture !== g), { gesture: g, action: v }];
                })
              }
              testId={`binding-${g}`}
            />
          );
        })}
        <p className="text-xs text-slate-500">Botão físico (GPIO 0): clique no botão BOOT do robô ou segure a tecla B ou a barra de espaço.</p>
      </Section>

      <Section title="Limiares de gesto">
        <Slider
          label="Toque prolongado (ms)"
          value={device.gestureThresholds.longPressMs}
          min={200}
          max={2000}
          step={50}
          onChange={(v) =>
            store.update((d) => {
              d.device.gestureThresholds.longPressMs = v;
            })
          }
          testId="threshold-longpress"
        />
        <Slider
          label="Tolerância de movimento (px)"
          value={device.gestureThresholds.movementTolerancePx}
          min={1}
          max={20}
          onChange={(v) =>
            store.update((d) => {
              d.device.gestureThresholds.movementTolerancePx = v;
            })
          }
          testId="threshold-tolerance"
        />
        <Slider
          label="Distância mínima de swipe (px)"
          value={device.gestureThresholds.swipeMinDistancePx}
          min={10}
          max={120}
          onChange={(v) =>
            store.update((d) => {
              d.device.gestureThresholds.swipeMinDistancePx = v;
            })
          }
          testId="threshold-swipe"
        />
      </Section>
    </div>
  );
}
