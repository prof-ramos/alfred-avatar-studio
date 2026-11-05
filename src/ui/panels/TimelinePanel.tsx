// Editor de animações: linha do tempo, quadros-chave e curvas (PRD §4.3, RF-14).
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CHANNEL_RANGES } from '../../domain/animation';
import { CHANNEL_LABELS, EASING_LABELS } from '../../domain/labels';
import { newId } from '../../domain/project';
import { ANIMATION_CHANNELS, EASINGS, type Animation, type AnimationChannel, type Easing, type PlaybackMode } from '../../domain/types';
import { Pause, Play, Plus, SkipBack, Square, StepBack, StepForward } from 'lucide-react';
import { useSim, useStore } from '../context';
import { Button, FIELD, Section, Select, Slider } from '../controls';

const ICON = { size: 16, strokeWidth: 1.5, 'aria-hidden': true } as const;

function Playhead({ duration }: { duration: number }) {
  const { sim } = useSim();
  const ref = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const pos = sim.animationPosition();
      if (ref.current) ref.current.style.left = `${(pos / duration) * 100}%`;
      if (label.current) label.current.textContent = `${Math.round(pos)} ms`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim, duration]);
  return (
    <>
      <div ref={ref} data-testid="tl-playhead" className="pointer-events-none absolute top-0 bottom-0 w-px bg-fg" />
      <span ref={label} data-testid="tl-position" className="absolute -bottom-5 right-0 font-mono text-xs text-fg-2" />
    </>
  );
}

export function TimelinePanel() {
  const { store, state } = useStore();
  const { sim, snap } = useSim();
  const animations = Object.values(state.project.animations);
  const anim: Animation | undefined = state.selectedAnimationId ? state.project.animations[state.selectedAnimationId] : undefined;
  const [selectedKf, setSelectedKf] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; pointerId: number } | null>(null);

  useEffect(() => {
    if (anim && !anim.keyframes.some((k) => k.id === selectedKf)) setSelectedKf(anim.keyframes[0]?.id ?? null);
  }, [anim, selectedKf]);

  const updateAnim = (fn: (a: Animation) => void) => {
    if (!anim) return;
    store.update((d) => {
      const a = d.animations[anim.id];
      if (a) {
        fn(a);
        a.keyframes.sort((x, y) => x.t - y.t);
      }
    });
  };

  const createAnimation = () => {
    const id = newId('anim');
    store.update((d) => {
      d.animations[id] = {
        id,
        name: `Animação ${Object.keys(d.animations).length + 1}`,
        durationMs: 1000,
        mode: 'once',
        keyframes: [
          { id: newId('k'), t: 0, easing: 'linear', values: { eyeOpen: 1 } },
          { id: newId('k'), t: 1000, easing: 'easeInOut', values: { eyeOpen: 1 } },
        ],
      };
    });
    store.selectAnimation(id);
  };

  const duplicateAnimation = () => {
    if (!anim) return;
    const id = newId('anim');
    store.update((d) => {
      d.animations[id] = { ...JSON.parse(JSON.stringify(anim)), id, name: `${anim.name} (cópia)`.slice(0, 80) };
    });
    store.selectAnimation(id);
  };

  const deleteAnimation = () => {
    if (!anim) return;
    const id = anim.id;
    store.update((d) => {
      delete d.animations[id];
      d.bindings = d.bindings.map((b) => (b.action === `animation:${id}` ? { ...b, action: 'none' } : b));
    });
    sim.stop();
    store.selectAnimation(Object.keys(store.project.animations)[0] ?? null);
  };

  const timeFromClientX = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || !anim) return 0;
    const r = bar.getBoundingClientRect();
    return Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * anim.durationMs);
  };

  const addKeyframeAt = (t: number) => {
    if (!anim) return;
    const id = newId('k');
    updateAnim((a) => {
      a.keyframes.push({ id, t: Math.min(a.durationMs, Math.max(0, Math.round(t))), easing: 'easeInOut', values: {} });
    });
    setSelectedKf(id);
  };

  const onMarkerDown = (e: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    setSelectedKf(id);
    drag.current = { id, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMarkerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return;
    const t = timeFromClientX(e.clientX);
    const id = drag.current.id;
    updateAnim((a) => {
      const k = a.keyframes.find((x) => x.id === id);
      if (k) k.t = t;
    });
  };
  const onMarkerUp = () => {
    drag.current = null;
  };

  const kf = anim?.keyframes.find((k) => k.id === selectedKf);

  return (
    <div className="space-y-4">
      <Section title="Animação">
        <Select
          label="Selecionada"
          value={anim?.id ?? ''}
          options={[{ value: '', label: '— nenhuma —' }, ...animations.map((a) => ({ value: a.id, label: a.name }))]}
          onChange={(v) => store.selectAnimation(v || null)}
          testId="tl-animation-select"
        />
        <div className="flex flex-wrap gap-2">
          <Button testId="tl-new" onClick={createAnimation}>
            Nova
          </Button>
          <Button testId="tl-duplicate" onClick={duplicateAnimation} disabled={!anim}>
            Duplicar
          </Button>
          <Button testId="tl-delete" variant="danger" onClick={deleteAnimation} disabled={!anim}>
            Excluir
          </Button>
        </div>
        {anim && (
          <>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="tl-name" className="text-sm text-fg-2">
                Nome
              </label>
              <input
                id="tl-name"
                value={anim.name}
                maxLength={80}
                data-testid="tl-name"
                onChange={(e) => {
                  const v = e.target.value.replace(/[<>\u0000-\u001f]/g, '');
                  if (v.trim()) updateAnim((a) => (a.name = v));
                }}
                className={`${FIELD} w-40`}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="tl-duration" className="text-sm text-fg-2">
                Duração (ms)
              </label>
              <input
                id="tl-duration"
                type="number"
                min={100}
                max={60000}
                step={50}
                value={anim.durationMs}
                data-testid="tl-duration"
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value));
                  if (v >= 100 && v <= 60000)
                    updateAnim((a) => {
                      a.durationMs = v;
                      for (const k of a.keyframes) k.t = Math.min(k.t, v);
                    });
                }}
                className={`${FIELD} w-24 text-right font-mono tabular-nums`}
              />
            </div>
            <Select<PlaybackMode>
              label="Repetição"
              value={anim.mode}
              options={[
                { value: 'loop', label: 'Em loop' },
                { value: 'once', label: 'Execução única' },
              ]}
              onChange={(v) => updateAnim((a) => (a.mode = v))}
              testId="tl-loop-mode"
            />
          </>
        )}
      </Section>

      {anim && (
        <Section title="Linha do tempo">
          <div className="flex flex-wrap gap-2">
            <Button testId="tl-rewind" title="Voltar ao início" onClick={() => sim.rewind()}>
              <SkipBack {...ICON} />
            </Button>
            <Button testId="tl-step-back" title="Quadro anterior" onClick={() => sim.step(-1)}>
              <StepBack {...ICON} />
            </Button>
            <Button testId="tl-play" pressed={snap.playback.playing} title="Reproduzir" onClick={() => sim.play(anim.id)}>
              <Play {...ICON} />
            </Button>
            <Button testId="tl-pause" title="Pausar" onClick={() => sim.pause()}>
              <Pause {...ICON} />
            </Button>
            <Button testId="tl-stop" title="Parar" onClick={() => sim.stop()}>
              <Square {...ICON} />
            </Button>
            <Button testId="tl-step" title="Próximo quadro" onClick={() => sim.step(1)}>
              <StepForward {...ICON} />
            </Button>
          </div>
          <div className="relative h-12 rounded-lg border border-line bg-sink">
            {/* Trilha recuada 12 px para os marcadores das pontas caberem na barra. */}
            <div
              ref={barRef}
              data-testid="timeline"
              className="absolute inset-y-0 right-3 left-3 cursor-pointer"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) sim.seek(timeFromClientX(e.clientX));
              }}
              onDoubleClick={(e) => {
                if (e.target === e.currentTarget) addKeyframeAt(timeFromClientX(e.clientX));
              }}
            >
              {anim.keyframes.map((k, i) => (
                <button
                  key={k.id}
                  type="button"
                  data-testid={`keyframe-${i}`}
                  data-t={k.t}
                  aria-label={`Quadro-chave em ${k.t} ms`}
                  aria-pressed={k.id === selectedKf}
                  onPointerDown={(e) => onMarkerDown(e, k.id)}
                  onPointerMove={onMarkerMove}
                  onPointerUp={onMarkerUp}
                  className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border ${
                    k.id === selectedKf ? 'border-accent bg-accent' : 'border-fg-2 bg-raised-2'
                  }`}
                  style={{ left: `${(k.t / anim.durationMs) * 100}%`, touchAction: 'none' }}
                />
              ))}
              {snap.playback.animId === anim.id && snap.playback.active && <Playhead duration={anim.durationMs} />}
            </div>
          </div>
          <div className="h-2" />
          <div className="flex flex-wrap gap-2">
            <Button testId="tl-add-keyframe" onClick={() => addKeyframeAt(snap.playback.animId === anim.id ? sim.animationPosition() : 0)}>
              <Plus {...ICON} />
              Quadro-chave na agulha
            </Button>
            <Button
              testId="tl-delete-keyframe"
              variant="danger"
              disabled={!kf || anim.keyframes.length <= 1}
              onClick={() => kf && updateAnim((a) => (a.keyframes = a.keyframes.filter((x) => x.id !== kf.id)))}
            >
              Remover quadro-chave
            </Button>
          </div>
          <p className="text-xs text-fg-3">Arraste os marcadores para mover. Clique na barra para posicionar a agulha e dê duplo clique para adicionar um quadro-chave.</p>
        </Section>
      )}

      {anim && kf && (
        <Section title="Quadro-chave selecionado">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="kf-time" className="text-sm text-fg-2">
              Instante (ms)
            </label>
            <input
              id="kf-time"
              type="number"
              min={0}
              max={anim.durationMs}
              value={kf.t}
              data-testid="kf-time"
              onChange={(e) => {
                const v = Math.round(Number(e.target.value));
                if (v >= 0 && v <= anim.durationMs)
                  updateAnim((a) => {
                    const k = a.keyframes.find((x) => x.id === kf.id);
                    if (k) k.t = v;
                  });
              }}
              className={`${FIELD} w-24 text-right font-mono tabular-nums`}
            />
          </div>
          <Select<Easing>
            label="Curva de chegada"
            value={kf.easing}
            options={EASINGS.map((e) => ({ value: e, label: EASING_LABELS[e] }))}
            onChange={(v) =>
              updateAnim((a) => {
                const k = a.keyframes.find((x) => x.id === kf.id);
                if (k) k.easing = v;
              })
            }
            testId="kf-easing"
          />
          <div className="space-y-3">
            {ANIMATION_CHANNELS.map((ch: AnimationChannel) => {
              const range = CHANNEL_RANGES[ch];
              const v = kf.values[ch];
              const on = v !== undefined;
              return (
                <div key={ch} className="rounded-lg border border-line p-3">
                  <label className="flex items-center gap-2 text-sm text-fg-2">
                    <input
                      type="checkbox"
                      checked={on}
                      data-testid={`kf-channel-${ch}`}
                      onChange={(e) =>
                        updateAnim((a) => {
                          const k = a.keyframes.find((x) => x.id === kf.id);
                          if (!k) return;
                          if (e.target.checked) k.values[ch] = range.neutral;
                          else delete k.values[ch];
                        })
                      }
                     
                    />
                    {CHANNEL_LABELS[ch]}
                  </label>
                  {on && (
                    <Slider
                      label="Valor"
                      value={v}
                      min={range.min}
                      max={range.max}
                      step={range.step}
                      format={(x) => (range.step < 1 ? x.toFixed(2) : String(x))}
                      onChange={(x) =>
                        updateAnim((a) => {
                          const k = a.keyframes.find((y) => y.id === kf.id);
                          if (k) k.values[ch] = x;
                        })
                      }
                      testId={`kf-value-${ch}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
