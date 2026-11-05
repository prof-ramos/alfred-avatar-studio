// Biblioteca de emoções e comportamentos espontâneos (PRD §6.2, RF-12, RF-13).
import { EMOTION_LABELS } from '../../domain/labels';
import { EMOTIONS } from '../../domain/types';
import { useSim, useStore } from '../context';
import { Button, FIELD, Section, Slider, Toggle } from '../controls';

export function EmotionPanel() {
  const { sim, snap } = useSim();
  const { store, state } = useStore();
  const user = snap.userEmotion;

  return (
    <div className="space-y-4">
      <Section title="Emoção">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Emoções">
          {EMOTIONS.map((id) => (
            <Button key={id} testId={`emotion-${id}`} pressed={user.id === id} onClick={() => sim.setEmotion({ id, intensity: user.intensity })}>
              {EMOTION_LABELS[id]}
            </Button>
          ))}
        </div>
        <Slider
          label="Intensidade"
          value={user.intensity}
          min={0}
          max={1}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => sim.setEmotion({ id: user.id, intensity: v })}
          testId="emotion-intensity"
        />
        {snap.scenarioId && snap.emotion.id !== user.id && (
          <p className="text-xs text-warning">
            O cenário em execução aplica temporariamente a emoção “{EMOTION_LABELS[snap.emotion.id]}”
          </p>
        )}
        <p className="text-xs text-fg-3">Estado e emoção são independentes: a emoção permanece ao trocar de estado</p>
      </Section>

      <Section title="Comportamento espontâneo">
        <Toggle label="Piscadas e micromovimentos" checked={snap.spontaneous} onChange={(v) => sim.setSpontaneous(v)} testId="spontaneous-toggle" />
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="seed" className="text-sm text-fg-2">
            Semente pseudoaleatória
          </label>
          <input
            id="seed"
            type="number"
            min={0}
            max={4294967295}
            value={state.project.runtime.randomSeed}
            data-testid="random-seed"
            onChange={(e) => {
              const v = Math.floor(Number(e.target.value));
              if (Number.isFinite(v) && v >= 0 && v <= 0xffffffff)
                store.update((d) => {
                  d.runtime.randomSeed = v;
                });
            }}
            className={`${FIELD} w-28 text-right font-mono tabular-nums`}
          />
        </div>
        <p className="text-xs text-fg-3">A mesma semente reproduz a mesma sequência de piscadas</p>
      </Section>
    </div>
  );
}
