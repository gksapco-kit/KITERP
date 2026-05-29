import { Check } from 'lucide-react'
import { SectionHeading } from '../builder/SectionHeading'
import { clampPercent, PROGRESS_BAR_DEFAULTS } from '../../lib/progressBarDefaults'
import type { Block, ProgressBarItem } from '../../types/builder'

const HEIGHT_CLASS = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
} as const

interface ProgressBarBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

function Track({
  percent,
  color,
  height = 'md',
  className = '',
}: {
  percent: number
  color: string
  height?: keyof typeof HEIGHT_CLASS
  className?: string
}) {
  const pct = clampPercent(percent)
  return (
    <div
      className={`overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 ${HEIGHT_CLASS[height]} ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`${HEIGHT_CLASS[height]} rounded-full transition-all duration-500`}
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          boxShadow: `0 0 12px ${color}40`,
        }}
      />
    </div>
  )
}

function SimpleBarLayout({
  label,
  valueLabel,
  percent,
  showPercent,
  showValue,
  color,
  height,
}: {
  label?: string
  valueLabel?: string
  percent: number
  showPercent: boolean
  showValue: boolean
  color: string
  height: keyof typeof HEIGHT_CLASS
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900/50 sm:p-6">
      {(label || showPercent || showValue) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {label && <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>}
            {showValue && valueLabel && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{valueLabel}</p>
            )}
          </div>
          {showPercent && (
            <span className="shrink-0 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {clampPercent(percent)}%
            </span>
          )}
        </div>
      )}
      <Track percent={percent} color={color} height={height} />
    </div>
  )
}

function GoalLayout({
  current,
  target,
  percent,
  showPercent,
  color,
  height,
}: {
  current?: string
  target?: string
  percent: number
  showPercent: boolean
  color: string
  height: keyof typeof HEIGHT_CLASS
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-brand-50/50 via-white to-white p-6 shadow-sm dark:border-gray-700 dark:from-brand-950/20 dark:via-gray-900 dark:to-gray-900 sm:p-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        {current && target && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{current}</span>
            <span className="mx-1.5 text-gray-400">of</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{target}</span>
          </p>
        )}
        {showPercent && (
          <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
            {clampPercent(percent)}% complete
          </span>
        )}
      </div>
      <Track percent={percent} color={color} height={height} />
    </div>
  )
}

function StepsLayout({ items, color }: { items: ProgressBarItem[]; color: string }) {
  const steps = items.filter((s) => s.enabled !== false)
  const lastCompletedIndex = steps.reduce((acc, step, i) => (step.completed ? i : acc), -1)
  const progress = steps.length <= 1 ? 0 : (lastCompletedIndex / (steps.length - 1)) * 100

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/50 sm:p-8">
      <Track percent={progress} color={color} height="sm" className="mb-6" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => {
          const done = step.completed === true
          const active = !done && (i === 0 || steps[i - 1]?.completed)
          return (
            <div key={step.id ?? step.label} className="flex items-start gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? 'text-white shadow-md'
                    : active
                      ? 'border-2 bg-white dark:bg-gray-900'
                      : 'border border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800'
                }`}
                style={
                  done
                    ? { backgroundColor: color }
                    : active
                      ? { borderColor: color, color }
                      : undefined
                }
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={`text-sm font-semibold ${
                    done || active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {done ? 'Complete' : active ? 'In progress' : 'Pending'}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StackedLayout({
  items,
  color,
  height,
}: {
  items: ProgressBarItem[]
  color: string
  height: keyof typeof HEIGHT_CLASS
}) {
  const rows = items.filter((s) => s.enabled !== false)

  return (
    <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/50 sm:p-8">
      {rows.map((row) => {
        const pct = clampPercent(row.value ?? 0)
        return (
          <div key={row.id ?? row.label}>
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-gray-800 dark:text-gray-200">{row.label}</span>
              <span className="tabular-nums text-gray-500 dark:text-gray-400">{pct}%</span>
            </div>
            <Track percent={pct} color={color} height={height} />
          </div>
        )
      })}
    </div>
  )
}

export function ProgressBarBlock({ block, layoutStyle }: ProgressBarBlockProps) {
  const { props, styles } = block
  const layout = props.progressBarLayout ?? PROGRESS_BAR_DEFAULTS.progressBarLayout
  const height = props.progressBarHeight ?? PROGRESS_BAR_DEFAULTS.progressBarHeight
  const percent = props.progressPercent ?? PROGRESS_BAR_DEFAULTS.progressPercent
  const color = props.progressBarColor ?? styles.backgroundColor ?? PROGRESS_BAR_DEFAULTS.progressBarColor
  const showPercent = props.showProgressPercent !== false
  const showValue = props.showProgressValue !== false
  const items = props.progressItems ?? []

  return (
    <section style={layoutStyle} className="w-full">
      {(props.text || props.subtitle) && (
        <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6" />
      )}

      {layout === 'steps' ? (
        <StepsLayout items={items} color={color} />
      ) : layout === 'stacked' ? (
        <StackedLayout items={items} color={color} height={height} />
      ) : layout === 'goal' ? (
        <GoalLayout
          current={props.progressCurrent ?? PROGRESS_BAR_DEFAULTS.progressCurrent}
          target={props.progressTarget ?? PROGRESS_BAR_DEFAULTS.progressTarget}
          percent={percent}
          showPercent={showPercent}
          color={color}
          height={height}
        />
      ) : (
        <SimpleBarLayout
          label={props.progressLabel ?? PROGRESS_BAR_DEFAULTS.progressLabel}
          valueLabel={props.progressValueLabel ?? PROGRESS_BAR_DEFAULTS.progressValueLabel}
          percent={percent}
          showPercent={showPercent}
          showValue={showValue}
          color={color}
          height={height}
        />
      )}
    </section>
  )
}
