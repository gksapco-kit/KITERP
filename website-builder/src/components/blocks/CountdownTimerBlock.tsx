import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Timer } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import {
  COUNTDOWN_TIMER_DEFAULTS,
  getCountdownParts,
  padCountdown,
} from '../../lib/countdownTimerDefaults'
import { blockThemeGradientStyle, themeGradientTextStyle } from '../../lib/themeGradientUtils'
import { SectionHeading } from '../builder/SectionHeading'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'

interface CountdownTimerBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

type Layout = 'cards' | 'inline' | 'banner' | 'compact'
type Theme = 'premium' | 'minimal' | 'dark'

interface Unit {
  key: string
  value: number
  label: string
}

function UnitCard({
  unit,
  theme,
  layout,
  isSeconds,
  gradientTextStyle,
}: {
  unit: Unit
  theme: Theme
  layout: Layout
  isSeconds?: boolean
  gradientTextStyle?: React.CSSProperties
}) {
  const valueStr = layout === 'compact' ? String(unit.value) : padCountdown(unit.value)

  if (layout === 'inline') {
    return (
      <div className="flex flex-col items-center px-2 sm:px-4">
        <span
          className={`text-3xl font-bold tabular-nums sm:text-4xl md:text-5xl ${
            theme === 'dark' ? 'text-white' : theme === 'premium' ? '' : 'text-gray-900 dark:text-white'
          } ${isSeconds ? 'animate-[tickPulse_1s_ease-in-out_infinite]' : ''}`}
          style={theme === 'premium' ? gradientTextStyle : undefined}
        >
          {valueStr}
        </span>
        <span className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${theme === 'dark' ? 'text-white/60' : 'text-gray-400'}`}>
          {unit.label}
        </span>
      </div>
    )
  }

  if (layout === 'compact') {
    return (
      <div
        className={`flex min-w-[4.5rem] flex-col items-center rounded-xl px-3 py-2 ${
          theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
        }`}
      >
        <span className={`text-xl font-bold tabular-nums ${isSeconds ? 'animate-[tickPulse_1s_ease-in-out_infinite]' : ''}`}>{valueStr}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider opacity-60">{unit.label}</span>
      </div>
    )
  }

  const cardClass =
    theme === 'premium'
      ? 'border border-white/60 bg-white/80 shadow-lg shadow-brand-500/10 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/60'
      : theme === 'dark'
        ? 'border border-white/10 bg-white/5 backdrop-blur-sm'
        : 'border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/50'

  const valueClass =
    theme === 'premium' ? '' : theme === 'dark' ? 'text-white' : 'text-gray-900 dark:text-white'

  return (
    <div className={`flex flex-1 flex-col items-center rounded-2xl px-4 py-5 sm:px-6 sm:py-6 ${cardClass}`}>
      <span
        className={`text-4xl font-bold tabular-nums sm:text-5xl md:text-6xl ${valueClass} ${isSeconds ? 'animate-[tickPulse_1s_ease-in-out_infinite]' : ''}`}
        style={theme === 'premium' ? gradientTextStyle : undefined}
      >
        {valueStr}
      </span>
      <span className={`mt-2 text-xs font-semibold uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-white/65' : 'text-gray-500'}`}>
        {unit.label}
      </span>
    </div>
  )
}

function Separator({ theme }: { theme: Theme }) {
  return (
    <span className={`pb-5 text-3xl font-light sm:text-4xl ${theme === 'dark' ? 'text-white/35' : 'text-gray-300'}`} aria-hidden>
      :
    </span>
  )
}

export function CountdownTimerBlock({ block, layoutStyle, interactive, onNavigate }: CountdownTimerBlockProps) {
  const pages = useBuilderStore((s) => s.pages)
  const { props, styles } = block
  const layout = (props.countdownLayout ?? COUNTDOWN_TIMER_DEFAULTS.countdownLayout) as Layout
  const theme = (props.countdownTheme ?? COUNTDOWN_TIMER_DEFAULTS.countdownTheme) as Theme
  const target = props.countdownTargetDate ?? ''
  const expiredText = props.countdownExpiredText ?? COUNTDOWN_TIMER_DEFAULTS.countdownExpiredText

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const parts = useMemo(() => getCountdownParts(target, now), [target, now])

  const units = useMemo(() => {
    const list: Unit[] = []
    if (props.showCountdownDays !== false) {
      list.push({ key: 'days', value: parts.days, label: props.countdownDayLabel ?? COUNTDOWN_TIMER_DEFAULTS.countdownDayLabel })
    }
    if (props.showCountdownHours !== false) {
      list.push({ key: 'hours', value: parts.hours, label: props.countdownHourLabel ?? COUNTDOWN_TIMER_DEFAULTS.countdownHourLabel })
    }
    if (props.showCountdownMinutes !== false) {
      list.push({ key: 'minutes', value: parts.minutes, label: props.countdownMinuteLabel ?? COUNTDOWN_TIMER_DEFAULTS.countdownMinuteLabel })
    }
    if (props.showCountdownSeconds !== false) {
      list.push({ key: 'seconds', value: parts.seconds, label: props.countdownSecondLabel ?? COUNTDOWN_TIMER_DEFAULTS.countdownSecondLabel })
    }
    return list
  }, [parts, props])

  const ctaClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    createLinkClickHandler({
      interactive: !!interactive,
      link: props.buttonLink ?? '#',
      pages,
      onNavigate,
    })(e as unknown as React.MouseEvent<HTMLAnchorElement>)
  }

  const effectiveTheme = layout === 'banner' ? 'dark' : theme
  const gradientTextStyle = themeGradientTextStyle(styles)
  const gradientBgStyle = blockThemeGradientStyle(styles)

  const timerContent = parts.expired ? (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl px-6 py-10 text-center ${
        effectiveTheme === 'dark' ? 'bg-white/5 text-white' : 'border border-dashed border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
      }`}
    >
      <Timer className="mb-3 h-8 w-8 opacity-50" aria-hidden />
      <p className="text-lg font-semibold">{expiredText}</p>
    </div>
  ) : (
    <div
      className={
        layout === 'cards'
          ? `grid gap-3 sm:gap-4 ${units.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`
          : layout === 'inline'
            ? 'flex flex-wrap items-center justify-center'
            : layout === 'compact'
              ? 'flex flex-wrap items-center justify-center gap-2'
              : 'grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4'
      }
      role="timer"
      aria-live="polite"
    >
      {units.map((unit, index) => (
        <div key={unit.key} className={layout === 'inline' ? 'flex items-center' : layout === 'cards' ? 'contents' : ''}>
          {layout === 'inline' && index > 0 && <Separator theme={effectiveTheme} />}
          <UnitCard
            unit={unit}
            theme={effectiveTheme}
            layout={layout}
            isSeconds={unit.key === 'seconds'}
            gradientTextStyle={gradientTextStyle}
          />
        </div>
      ))}
    </div>
  )

  const inner = (
    <>
      <style>{`
        @keyframes tickPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>

      {(props.text || props.subtitle) && (
        <SectionHeading
          title={props.text}
          subtitle={props.subtitle}
          styles={styles}
          className={`mb-8 ${layout === 'banner' ? 'text-white [&_*]:text-white [&_p]:text-white/75' : ''}`}
        />
      )}

      {timerContent}

      {props.buttonText && !parts.expired && (
        <div className={`mt-8 flex justify-center ${layout === 'banner' ? '' : ''}`}>
          <button
            type="button"
            onClick={ctaClick}
            className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-lg transition hover:opacity-90 ${
              layout === 'banner' || effectiveTheme === 'dark'
                ? 'bg-white text-gray-900 hover:bg-gray-100'
                : effectiveTheme === 'premium'
                  ? 'text-white'
                  : 'bg-brand-600 text-white'
            }`}
            style={effectiveTheme === 'premium' && layout !== 'banner' ? gradientBgStyle : undefined}
          >
            {props.buttonText}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </>
  )

  if (layout === 'banner') {
    return (
      <section style={layoutStyle} className="w-full overflow-hidden rounded-2xl">
        <div className="relative px-6 py-12 text-white sm:px-10 sm:py-14" style={gradientBgStyle}>
          <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-3xl text-center">{inner}</div>
        </div>
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-4xl text-center">{inner}</div>
    </section>
  )
}
