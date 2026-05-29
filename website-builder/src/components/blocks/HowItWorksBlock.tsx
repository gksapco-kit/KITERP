import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SectionHeading } from '../builder/SectionHeading'
import { HOW_IT_WORKS_DEFAULTS } from '../../lib/howItWorksDefaults'
import type { Block, HowItWorksStep } from '../../types/builder'

const STEP_ICONS: Record<string, LucideIcon> = {
  search: Search,
  cart: ShoppingCart,
  'credit-card': CreditCard,
  truck: Truck,
  package: Package,
  check: CheckCircle2,
  user: User,
  settings: Settings,
}

type StepTheme = {
  panel: string
  iconWrap: string
  icon: string
  ring: string
  accent: string
  connector: string
  ghost: string
}

const STEP_THEMES: Record<string, StepTheme> = {
  search: {
    panel: 'bg-gradient-to-br from-sky-50/90 via-white to-white dark:from-sky-950/30 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-sky-500 shadow-lg shadow-sky-500/30',
    icon: 'text-white',
    ring: 'ring-sky-100 dark:ring-sky-900/50',
    accent: 'text-sky-600 dark:text-sky-400',
    connector: 'from-sky-400 to-sky-200 dark:from-sky-600 dark:to-sky-900/40',
    ghost: 'text-sky-100 dark:text-sky-950/60',
  },
  cart: {
    panel: 'bg-gradient-to-br from-violet-50/90 via-white to-white dark:from-violet-950/30 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-violet-500 shadow-lg shadow-violet-500/30',
    icon: 'text-white',
    ring: 'ring-violet-100 dark:ring-violet-900/50',
    accent: 'text-violet-600 dark:text-violet-400',
    connector: 'from-violet-400 to-violet-200 dark:from-violet-600 dark:to-violet-900/40',
    ghost: 'text-violet-100 dark:text-violet-950/60',
  },
  'credit-card': {
    panel: 'bg-gradient-to-br from-emerald-50/90 via-white to-white dark:from-emerald-950/25 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-emerald-600 shadow-lg shadow-emerald-600/30',
    icon: 'text-white',
    ring: 'ring-emerald-100 dark:ring-emerald-900/50',
    accent: 'text-emerald-600 dark:text-emerald-400',
    connector: 'from-emerald-400 to-emerald-200 dark:from-emerald-600 dark:to-emerald-900/40',
    ghost: 'text-emerald-100 dark:text-emerald-950/60',
  },
  truck: {
    panel: 'bg-gradient-to-br from-indigo-50/90 via-white to-white dark:from-indigo-950/30 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-indigo-500 shadow-lg shadow-indigo-500/30',
    icon: 'text-white',
    ring: 'ring-indigo-100 dark:ring-indigo-900/50',
    accent: 'text-indigo-600 dark:text-indigo-400',
    connector: 'from-indigo-400 to-indigo-200 dark:from-indigo-600 dark:to-indigo-900/40',
    ghost: 'text-indigo-100 dark:text-indigo-950/60',
  },
  package: {
    panel: 'bg-gradient-to-br from-amber-50/90 via-white to-white dark:from-amber-950/25 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-amber-500 shadow-lg shadow-amber-500/30',
    icon: 'text-white',
    ring: 'ring-amber-100 dark:ring-amber-900/50',
    accent: 'text-amber-700 dark:text-amber-400',
    connector: 'from-amber-400 to-amber-200 dark:from-amber-600 dark:to-amber-900/40',
    ghost: 'text-amber-100 dark:text-amber-950/60',
  },
  check: {
    panel: 'bg-gradient-to-br from-teal-50/90 via-white to-white dark:from-teal-950/25 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-teal-500 shadow-lg shadow-teal-500/30',
    icon: 'text-white',
    ring: 'ring-teal-100 dark:ring-teal-900/50',
    accent: 'text-teal-600 dark:text-teal-400',
    connector: 'from-teal-400 to-teal-200 dark:from-teal-600 dark:to-teal-900/40',
    ghost: 'text-teal-100 dark:text-teal-950/60',
  },
  user: {
    panel: 'bg-gradient-to-br from-rose-50/90 via-white to-white dark:from-rose-950/25 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-rose-500 shadow-lg shadow-rose-500/30',
    icon: 'text-white',
    ring: 'ring-rose-100 dark:ring-rose-900/50',
    accent: 'text-rose-600 dark:text-rose-400',
    connector: 'from-rose-400 to-rose-200 dark:from-rose-600 dark:to-rose-900/40',
    ghost: 'text-rose-100 dark:text-rose-950/60',
  },
  settings: {
    panel: 'bg-gradient-to-br from-slate-50/90 via-white to-white dark:from-slate-900/50 dark:via-gray-900 dark:to-gray-900',
    iconWrap: 'bg-slate-600 shadow-lg shadow-slate-500/30',
    icon: 'text-white',
    ring: 'ring-slate-200 dark:ring-slate-700',
    accent: 'text-slate-600 dark:text-slate-400',
    connector: 'from-slate-400 to-slate-200 dark:from-slate-600 dark:to-slate-800',
    ghost: 'text-slate-100 dark:text-slate-900/60',
  },
}

const DEFAULT_THEME = STEP_THEMES.check

function getTheme(icon?: string): StepTheme {
  return STEP_THEMES[icon ?? 'check'] ?? DEFAULT_THEME
}

function getIcon(icon?: string): LucideIcon {
  return STEP_ICONS[icon ?? 'check'] ?? CheckCircle2
}

interface HowItWorksBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

function StepNumberPill({
  index,
  showNumbers,
  theme,
}: {
  index: number
  showNumbers: boolean
  theme: StepTheme
}) {
  if (!showNumbers) return null
  return (
    <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${theme.accent}`}>
      Step {index + 1}
    </span>
  )
}

function StepIcon({ step, size = 'md' }: { step: HowItWorksStep; size?: 'md' | 'lg' }) {
  const Icon = getIcon(step.icon)
  const theme = getTheme(step.icon)
  const dim = size === 'lg' ? 'h-14 w-14' : 'h-12 w-12'
  const iconDim = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl ring-4 ${dim} ${theme.iconWrap} ${theme.icon} ${theme.ring}`}
    >
      <Icon className={iconDim} aria-hidden />
    </div>
  )
}

function StepConnector({ theme }: { theme: StepTheme }) {
  return (
    <div className="hidden flex-1 items-center px-2 md:flex">
      <div className={`h-0.5 flex-1 bg-gradient-to-r ${theme.connector}`} />
      <ArrowRight className="mx-1 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" aria-hidden />
    </div>
  )
}

function HorizontalStep({
  step,
  index,
  showNumbers,
  isLast,
}: {
  step: HowItWorksStep
  index: number
  showNumbers: boolean
  isLast: boolean
}) {
  const theme = getTheme(step.icon)

  return (
  <>
      <div className="flex min-w-0 flex-1 flex-col items-center px-2 text-center sm:px-4">
        <StepIcon step={step} size="lg" />
        <StepNumberPill index={index} showNumbers={showNumbers} theme={theme} />
        <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">{step.title}</h3>
        {step.description && (
          <p className="mt-2 max-w-[11rem] text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {step.description}
          </p>
        )}
      </div>
      {!isLast && <StepConnector theme={theme} />}
    </>
  )
}

function VerticalStep({
  step,
  index,
  showNumbers,
  isLast,
}: {
  step: HowItWorksStep
  index: number
  showNumbers: boolean
  isLast: boolean
}) {
  const theme = getTheme(step.icon)

  return (
    <div className="relative flex gap-5 pb-8 last:pb-0">
      {!isLast && (
        <div
          className={`absolute left-7 top-[4.5rem] h-[calc(100%-4.5rem)] w-0.5 bg-gradient-to-b ${theme.connector}`}
        />
      )}
      <div className="relative z-10 shrink-0">
        <StepIcon step={step} size="lg" />
      </div>
      <article
        className={`relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-gray-100/80 p-5 shadow-sm dark:border-gray-700/60 ${theme.panel}`}
      >
        {showNumbers && (
          <span
            className={`pointer-events-none absolute -right-1 -top-2 select-none text-6xl font-black leading-none ${theme.ghost}`}
            aria-hidden
          >
            {index + 1}
          </span>
        )}
        <StepNumberPill index={index} showNumbers={showNumbers} theme={theme} />
        <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{step.title}</h3>
        {step.description && (
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{step.description}</p>
        )}
      </article>
    </div>
  )
}

function CardStep({
  step,
  index,
  showNumbers,
}: {
  step: HowItWorksStep
  index: number
  showNumbers: boolean
}) {
  const theme = getTheme(step.icon)

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100/80 p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700/60 ${theme.panel}`}
    >
      {showNumbers && (
        <span
          className={`pointer-events-none absolute -right-1 top-2 select-none text-7xl font-black leading-none ${theme.ghost}`}
          aria-hidden
        >
          {index + 1}
        </span>
      )}
      <StepIcon step={step} />
      <StepNumberPill index={index} showNumbers={showNumbers} theme={theme} />
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{step.title}</h3>
      {step.description && (
        <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{step.description}</p>
      )}
    </article>
  )
}

function MinimalStep({
  step,
  index,
  showNumbers,
  isLast,
}: {
  step: HowItWorksStep
  index: number
  showNumbers: boolean
  isLast: boolean
}) {
  const theme = getTheme(step.icon)
  const Icon = getIcon(step.icon)

  return (
    <div className="relative">
      {!isLast && (
        <div className="absolute left-[1.15rem] top-12 h-[calc(100%-0.5rem)] w-px bg-gray-200 dark:bg-gray-700" />
      )}
      <div className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
        {showNumbers ? (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${theme.iconWrap}`}
          >
            {index + 1}
          </span>
        ) : (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${theme.iconWrap} ${theme.icon}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          {showNumbers && (
            <p className={`text-[11px] font-bold uppercase tracking-wider ${theme.accent}`}>Step {index + 1}</p>
          )}
          <h3 className={`font-semibold text-gray-900 dark:text-gray-100 ${showNumbers ? 'mt-0.5' : ''}`}>
            {step.title}
          </h3>
          {step.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{step.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function HowItWorksBlock({ block, layoutStyle }: HowItWorksBlockProps) {
  const { props, styles } = block
  const layout = props.howItWorksLayout ?? HOW_IT_WORKS_DEFAULTS.howItWorksLayout
  const showNumbers = props.showStepNumbers !== false
  const steps = (props.howItWorksSteps ?? []).filter((s) => s.enabled !== false)

  const gridCols =
    steps.length <= 2
      ? 'sm:grid-cols-2'
      : steps.length === 3
        ? 'sm:grid-cols-3'
        : 'sm:grid-cols-2 lg:grid-cols-4'

  if (steps.length === 0) {
    return (
      <section style={layoutStyle} className="w-full py-8 text-center text-sm text-gray-400">
        Add steps in the properties panel
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      {(props.text || props.subtitle) && (
        <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-10" />
      )}

      {layout === 'vertical' ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-100 bg-white/50 p-6 shadow-sm dark:border-gray-700/60 dark:bg-gray-900/30 sm:p-8">
          {steps.map((step, i) => (
            <VerticalStep
              key={step.id ?? step.title}
              step={step}
              index={i}
              showNumbers={showNumbers}
              isLast={i === steps.length - 1}
            />
          ))}
        </div>
      ) : layout === 'cards' ? (
        <div className={`grid gap-4 sm:gap-5 ${gridCols}`}>
          {steps.map((step, i) => (
            <CardStep key={step.id ?? step.title} step={step} index={i} showNumbers={showNumbers} />
          ))}
        </div>
      ) : layout === 'minimal' ? (
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          {steps.map((step, i) => (
            <MinimalStep
              key={step.id ?? step.title}
              step={step}
              index={i}
              showNumbers={showNumbers}
              isLast={i === steps.length - 1}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50/80 to-white shadow-sm dark:border-gray-700/60 dark:from-gray-900/50 dark:to-gray-900">
          <div className="flex flex-col gap-10 px-4 py-8 sm:px-8 sm:py-10 md:flex-row md:items-start md:gap-0">
            {steps.map((step, i) => (
              <HorizontalStep
                key={step.id ?? step.title}
                step={step}
                index={i}
                showNumbers={showNumbers}
                isLast={i === steps.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
