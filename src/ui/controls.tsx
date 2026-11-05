// Controles reutilizáveis da interface.
import { useId, type ReactNode } from 'react';

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-slate-800 pb-4 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
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
      <label htmlFor={id} className="text-sm text-slate-300">
        {label}
      </label>
      <output htmlFor={id} className="min-w-12 text-right font-mono text-xs text-slate-400">
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
        className="col-span-2 w-full accent-sky-400"
      />
    </div>
  );
}

export function Toggle({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-300">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        data-testid={testId}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-sky-400"
      />
    </label>
  );
}

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
      <label htmlFor={id} className="text-sm text-slate-300">
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
        className="max-w-[60%] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
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
      <label htmlFor={id} className="text-sm text-slate-300">
        {label}
      </label>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-slate-400">{value}</span>
        <input
          id={id}
          type="color"
          value={value.toLowerCase()}
          data-testid={testId}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-transparent"
        />
      </span>
    </div>
  );
}

type BtnVariant = 'default' | 'primary' | 'danger' | 'ghost';

const VARIANTS: Record<BtnVariant, string> = {
  default: 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700',
  primary: 'border-sky-500 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30',
  danger: 'border-red-500/60 bg-red-500/10 text-red-200 hover:bg-red-500/20',
  ghost: 'border-transparent bg-transparent text-slate-300 hover:bg-slate-800',
};

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
      disabled={disabled}
      title={title}
      className={`rounded-md border px-2.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        pressed ? 'border-sky-400 bg-sky-400/25 text-sky-100' : VARIANTS[variant]
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
    <div role="tablist" className="flex gap-1 border-b border-slate-800 px-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          data-testid={`${idPrefix}-${t.id}`}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${
            value === t.id ? 'border-sky-400 text-sky-200' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
