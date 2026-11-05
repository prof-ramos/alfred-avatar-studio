// Editor paramétrico do rosto (PRD §4.2).
import type { AvatarParameters, EyeShape, MouthStyle, Project } from '../../domain/types';
import { useStore } from '../context';
import { ColorInput, Section, Select, Slider, Toggle } from '../controls';

const EYE_SHAPES: ReadonlyArray<{ value: EyeShape; label: string }> = [
  { value: 'rounded', label: 'Arredondado' },
  { value: 'elliptic', label: 'Elíptico' },
  { value: 'softRect', label: 'Retangular suave' },
];

const MOUTH_STYLES: ReadonlyArray<{ value: MouthStyle; label: string }> = [
  { value: 'curve', label: 'Linha curva' },
  { value: 'segment', label: 'Segmento dinâmico' },
  { value: 'oval', label: 'Oval' },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function AvatarEditor() {
  const { store, state } = useStore();
  const { avatar } = state.project;
  const p = avatar.parameters;

  const setParam = <G extends keyof AvatarParameters, K extends keyof AvatarParameters[G]>(group: G, key: K, value: AvatarParameters[G][K]) =>
    store.update((d) => {
      d.avatar.parameters[group][key] = value;
    });
  const setAvatar = (fn: (a: Project['avatar']) => void) => store.update((d) => fn(d.avatar));

  return (
    <div className="space-y-4">
      <Section title="Olhos">
        <Select label="Formato" value={p.eyes.shape} options={EYE_SHAPES} onChange={(v) => setParam('eyes', 'shape', v)} testId="param-eyes-shape" />
        <Slider label="Largura" value={p.eyes.width} min={8} max={100} onChange={(v) => setParam('eyes', 'width', v)} testId="param-eyes-width" />
        <Slider label="Altura" value={p.eyes.height} min={4} max={100} onChange={(v) => setParam('eyes', 'height', v)} testId="param-eyes-height" />
        <Slider label="Espaçamento" value={p.eyes.spacing} min={0} max={120} onChange={(v) => setParam('eyes', 'spacing', v)} testId="param-eyes-spacing" />
        <Slider label="Posição vertical" value={p.eyes.offsetY} min={-60} max={60} onChange={(v) => setParam('eyes', 'offsetY', v)} testId="param-eyes-offsetY" />
        <Slider
          label="Abertura das pálpebras"
          value={p.eyes.eyelidOpen}
          min={0}
          max={1}
          step={0.01}
          format={pct}
          onChange={(v) => setParam('eyes', 'eyelidOpen', v)}
          testId="param-eyes-eyelidOpen"
        />
      </Section>

      <Section title="Sobrancelhas">
        <Slider label="Espessura" value={p.eyebrows.thickness} min={0} max={12} onChange={(v) => setParam('eyebrows', 'thickness', v)} testId="param-eyebrows-thickness" />
        <Slider label="Inclinação (°)" value={p.eyebrows.tilt} min={-45} max={45} onChange={(v) => setParam('eyebrows', 'tilt', v)} testId="param-eyebrows-tilt" />
        <Slider
          label="Curvatura"
          value={p.eyebrows.curvature}
          min={-1}
          max={1}
          step={0.05}
          onChange={(v) => setParam('eyebrows', 'curvature', v)}
          testId="param-eyebrows-curvature"
        />
        <Slider label="Elevação" value={p.eyebrows.elevation} min={-20} max={30} onChange={(v) => setParam('eyebrows', 'elevation', v)} testId="param-eyebrows-elevation" />
      </Section>

      <Section title="Boca">
        <Select label="Estilo" value={p.mouth.style} options={MOUTH_STYLES} onChange={(v) => setParam('mouth', 'style', v)} testId="param-mouth-style" />
        <Slider label="Largura" value={p.mouth.width} min={0} max={160} onChange={(v) => setParam('mouth', 'width', v)} testId="param-mouth-width" />
        <Slider label="Altura" value={p.mouth.height} min={0} max={80} onChange={(v) => setParam('mouth', 'height', v)} testId="param-mouth-height" />
        <Slider
          label="Abertura"
          value={p.mouth.openness}
          min={0}
          max={1}
          step={0.01}
          format={pct}
          onChange={(v) => setParam('mouth', 'openness', v)}
          testId="param-mouth-openness"
        />
        <Slider
          label="Curvatura"
          value={p.mouth.curvature}
          min={-1}
          max={1}
          step={0.05}
          onChange={(v) => setParam('mouth', 'curvature', v)}
          testId="param-mouth-curvature"
        />
        <Slider label="Posição vertical" value={p.mouth.offsetY} min={-60} max={80} onChange={(v) => setParam('mouth', 'offsetY', v)} testId="param-mouth-offsetY" />
      </Section>

      <Section title="Cores, brilho e contorno">
        <ColorInput label="Cor primária" value={avatar.primaryColor} onChange={(v) => setAvatar((a) => (a.primaryColor = v))} testId="color-primary" />
        <ColorInput label="Cor de destaque" value={avatar.accentColor} onChange={(v) => setAvatar((a) => (a.accentColor = v))} testId="color-accent" />
        <ColorInput label="Cor de fundo" value={avatar.background} onChange={(v) => setAvatar((a) => (a.background = v))} testId="color-background" />
        <Slider label="Espessura do traço" value={avatar.strokeWidth} min={1} max={12} onChange={(v) => setAvatar((a) => (a.strokeWidth = v))} testId="param-strokeWidth" />
        <Toggle label="Brilho suave (glow)" checked={avatar.glow} onChange={(v) => setAvatar((a) => (a.glow = v))} testId="param-glow" />
      </Section>
    </div>
  );
}
