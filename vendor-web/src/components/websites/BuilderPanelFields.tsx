import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BuilderStepSlider } from '@/components/websites/BuilderStepSlider'
import { builderPanelUi } from '@/components/websites/builderPanelUi'
import { BG_STYLE_OPTIONS, SHADOW_PRESETS } from '@/lib/builderVisualPresets'

/** Slim label for grouped panel fields. */
export function PanelFieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('text-[11px] font-medium leading-tight text-foreground', className)}>
      {children}
    </span>
  )
}

/** Section eyebrow inside an accordion body. */
export function PanelGroupEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{children}</p>
  )
}

/** Label + numeric input + step slider — no duplicate value badge on the slider. */
export function PanelSliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  onPreview,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  hint?: string
  onPreview?: (n: number) => void
  onCommit: (n: number) => void
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  const apply = onPreview ?? onCommit

  return (
    <div className="min-w-0 space-y-1">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
        <PanelFieldLabel className="truncate">{label}</PanelFieldLabel>
        <label className="flex shrink-0 items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => onCommit(clamp(Number(e.target.value) || min))}
            className="w-9 bg-transparent text-center text-[11px] font-semibold tabular-nums text-foreground focus:outline-none"
          />
          {unit ? <span className="text-[9px] font-medium text-muted-foreground">{unit}</span> : null}
        </label>
      </div>
      <div className="min-w-0">
        <BuilderStepSlider
          aria-label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          showValue={false}
          sliderClassName="h-1"
          className="gap-0.5"
          onInput={onPreview}
          onChange={onCommit}
        />
      </div>
      {hint ? <p className={builderPanelUi.hint}>{hint}</p> : null}
    </div>
  )
}

export function PanelChip({
  active,
  onClick,
  children,
  title,
  className,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-md border px-2 py-1 text-[10px] font-semibold leading-tight transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Wrap chips — flows to new lines instead of horizontal scroll. */
export function PanelChipWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap gap-1', className)}>{children}</div>
}

/** Horizontal chip strip for long option lists (e.g. column counts). */
export function PanelChipScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto scrollbar-none pb-px -mx-0.5 px-0.5', className)}>
      {children}
    </div>
  )
}

export function PanelColorRow({
  label,
  hint,
  value,
  fallback,
  onChange,
  onReset,
}: {
  label: string
  hint?: string
  value: string
  fallback: string
  onChange: (color: string) => void
  onReset?: () => void
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/20 px-1.5 py-1"
      title={hint}
    >
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-medium text-foreground">{label}</div>
      </div>
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="shrink-0 text-[9px] font-semibold text-muted-foreground hover:text-destructive"
          title="Use page default"
        >
          Reset
        </button>
      ) : null}
    </div>
  )
}

const panelOptionBtnClass =
  'w-full rounded-md border px-2 py-1.5 text-[10px] font-semibold leading-tight transition-colors text-center'

/** Two-column option grid — fits narrow side panels without truncating labels. */
export function PanelBgStylePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {BG_STYLE_OPTIONS.map(opt => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            panelOptionBtnClass,
            value === opt.id
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** Shadow presets with isolated preview swatches (shadow on chip, not the whole button). */
export function PanelShadowPresetPicker({
  value,
  onChange,
  onPreview,
}: {
  value: string
  onChange: (shadow: string) => void
  onPreview?: (shadow: string) => void
}) {
  const select = (shadow: string) => {
    onPreview?.(shadow)
    onChange(shadow)
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {SHADOW_PRESETS.map(sh => {
        const active = value === sh.value
        return (
          <button
            key={sh.label}
            type="button"
            title={sh.label}
            onClick={() => select(sh.value)}
            className={cn(
              'flex min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition-colors',
              active
                ? 'border-primary bg-accent/80 ring-1 ring-primary/20'
                : 'border-border bg-background hover:border-primary/35',
            )}
          >
            <span
              aria-hidden
              className="h-5 w-5 shrink-0 rounded border border-border/80 bg-card"
              style={{ boxShadow: sh.value === 'none' ? undefined : sh.value }}
            />
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[10px] font-semibold leading-tight',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {sh.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
