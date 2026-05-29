import { Check } from 'lucide-react'
import { STEPPER_DEFAULTS } from '../../lib/stepperDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import type { Block } from '../../types/builder'

interface StepperBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
}

type Layout = 'horizontal' | 'vertical' | 'dots' | 'progress'
type Theme = 'light' | 'premium' | 'dark'

export function StepperBlock({ block, layoutStyle, interactive = false }: StepperBlockProps) {
  const { props, styles } = block
  const layout = (props.stepperLayout ?? STEPPER_DEFAULTS.stepperLayout) as Layout
  const theme = (props.stepperTheme ?? STEPPER_DEFAULTS.stepperTheme) as Theme
  const showLabels = props.showStepperLabels !== false
  const showDescriptions = props.showStepperDescriptions !== false
  const steps = (props.stepperSteps ?? []).filter((s) => s.enabled !== false)
  const current = Math.min(Math.max(props.stepperCurrentStep ?? 0, 0), Math.max(steps.length - 1, 0))
  const isDark = theme === 'dark'

  const doneClass = isDark ? 'bg-emerald-500 text-white' : 'bg-brand-600 text-white'
  const activeClass = isDark ? 'bg-white text-gray-900 ring-4 ring-white/20' : 'bg-brand-600 text-white ring-4 ring-brand-100'
  const idleClass = isDark ? 'bg-white/15 text-white/50' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'

  const progressPct = steps.length > 1 ? ((current + 1) / steps.length) * 100 : 100

  const renderStep = (index: number) => {
    const step = steps[index]
    const done = index < current
    const active = index === current
    const last = index === steps.length - 1

    if (layout === 'dots') {
      return (
        <li key={step.id ?? index} className="flex flex-col items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${done ? 'bg-brand-600' : active ? 'bg-brand-600 ring-4 ring-brand-200' : 'bg-gray-300'}`} />
          {showLabels && (
            <span className={`max-w-[5rem] truncate text-center text-xs font-medium ${active ? 'text-brand-600' : 'text-gray-400'}`}>
              {step.title}
            </span>
          )}
        </li>
      )
    }

    return (
      <li key={step.id ?? index} className={`flex flex-1 items-start ${layout === 'vertical' ? 'gap-4' : 'flex-col items-center'}`}>
        <div className={`flex items-center ${layout === 'horizontal' ? 'w-full flex-col' : ''}`}>
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              done ? doneClass : active ? activeClass : idleClass
            }`}
          >
            {done ? <Check className="h-4 w-4" /> : index + 1}
          </span>
          {!last && layout === 'horizontal' && (
            <div
              className={`mx-2 mt-4 hidden h-0.5 flex-1 sm:block ${done ? (isDark ? 'bg-emerald-500/60' : 'bg-brand-300') : isDark ? 'bg-white/15' : 'bg-gray-200'}`}
            />
          )}
        </div>
        {(showLabels || showDescriptions) && (
          <div className={layout === 'horizontal' ? 'mt-3 text-center' : 'min-w-0 flex-1 pb-8'}>
            {showLabels && (
              <p className={`text-sm font-semibold ${active ? (isDark ? 'text-white' : 'text-gray-900') : isDark ? 'text-white/50' : 'text-gray-400'}`}>
                {step.title}
              </p>
            )}
            {showDescriptions && step.description && (
              <p className={`mt-0.5 text-xs ${isDark ? 'text-white/45' : 'text-gray-500'}`}>{step.description}</p>
            )}
          </div>
        )}
        {!last && layout === 'vertical' && (
          <div className={`absolute left-[18px] top-9 h-[calc(100%-2rem)] w-0.5 ${isDark ? 'bg-white/15' : 'bg-gray-200'}`} />
        )}
      </li>
    )
  }

  const stepperUi =
    layout === 'progress' ? (
      <div>
        <div className={`mb-2 flex justify-between text-sm ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
          <span>
            Step {current + 1} of {steps.length}
          </span>
          <span className="font-medium tabular-nums">{Math.round(progressPct)}%</span>
        </div>
        <div className={`h-2 overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        {showLabels && steps[current] && (
          <p className={`mt-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{steps[current].title}</p>
        )}
        {showDescriptions && steps[current]?.description && (
          <p className={`mt-1 text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{steps[current].description}</p>
        )}
      </div>
    ) : (
      <ol
        className={
          layout === 'vertical'
            ? 'relative space-y-0'
            : layout === 'dots'
              ? 'flex justify-between gap-2'
              : 'flex items-start justify-between gap-2'
        }
      >
        {steps.map((_, i) => renderStep(i))}
      </ol>
    )

  const shell = isDark
    ? 'border border-white/10 bg-gray-900/60'
    : theme === 'premium'
      ? 'border border-gray-200/80 bg-white shadow-md ring-1 ring-gray-100 dark:border-gray-700 dark:bg-gray-900/50'
      : 'border border-gray-200 bg-white dark:border-gray-700'

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-3xl">
        {(props.text || props.subtitle) && <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6" />}
        <div className={`rounded-2xl p-6 sm:p-8 ${shell}`}>
          {stepperUi}
          {interactive && steps.length > 1 && (
            <p className={`mt-4 text-center text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
              Adjust current step in the properties panel
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
