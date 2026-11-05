// Controles reutilizáveis da interface.
import { useId, type ReactNode } from 'react';

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line pb-6 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  testId,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  testId?: string;
  format?: (v: number) => string;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
      <label htmlFor={id} className="text-sm text-fg-2">
        {label}
      </label>
      <output htmlFor={id} className="min-w-12 text-right font-mono text-xs tabular-nums text-fg-3">
        {format ? format(value) : value}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        data-testid={testId}
        onChange={(e) => onChange(Number(e.target.value))}
        className="col-span-2 w-full"
      />
    </div>
  );
}

export function Toggle({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-fg-2">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} data-testid={testId} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}

export const FIELD = 'h-8 rounded-lg border border-line bg-raised px-2 text-sm text-fg transition-colors duration-150 hover:border-line-2';

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-fg-2">
        {label}
      </label>
      <select
        id={id}
        value={String(value)}
        data-testid={testId}
        onChange={(e) => {
          const opt = options.find((o) => String(o.value) === e.target.value);
          if (opt) onChange(opt.value);
        }}
        className={`${FIELD} max-w-[60%]`}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ColorInput({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-fg-2">
        {label}
      </label>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-fg-3">{value}</span>
        <input
          id={id}
          type="color"
          value={value.toLowerCase()}
          data-testid={testId}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-8 w-10 cursor-pointer rounded-lg border border-line bg-transparent"
        />
      </span>
    </div>
  );
}

type BtnVariant = 'default' | 'primary' | 'danger' | 'ghost';

const VARIANTS: Record<BtnVariant, string> = {
  default: 'border-line bg-raised text-fg hover:bg-raised-2',
  // Botão principal em fundo escuro: branco suave da escala com texto escuro.
  primary: 'border-transparent bg-fg text-page hover:bg-white',
  danger: 'border-line bg-transparent text-negative hover:bg-raised',
  ghost: 'border-transparent bg-transparent text-fg-2 hover:bg-raised hover:text-fg',
};

/** Estado ligado: um degrau de superfície com realce no topo, sem cor de destaque. */
const PRESSED = 'border-line-2 bg-raised-2 text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]';

export function Button({
  children,
  onClick,
  testId,
  variant = 'default',
  pressed,
  disabled,
  title,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  testId?: string;
  variant?: BtnVariant;
  pressed?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={pressed}
      aria-label={title}
      disabled={disabled}
      title={title}
      className={`inline-flex min-h-8 items-center justify-center gap-2 rounded-lg border ${/(^|\s)px-/.test(className) ? '' : 'px-3'} py-1 text-sm transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
        pressed ? PRESSED : VARIANTS[variant]
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  idPrefix,
}: {
  tabs: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  idPrefix: string;
}) {
  return (
    <div role="tablist" className="flex h-12 items-end gap-1 border-b border-line px-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          data-testid={`${idPrefix}-${t.id}`}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b px-2 pb-3 text-sm transition-colors duration-150 ${
            value === t.id ? 'border-fg text-fg' : 'border-transparent text-fg-3 hover:text-fg-2'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Texto de apoio curto, sem ponto final. */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-fg-3">{children}</p>;
}
