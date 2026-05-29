import { Check, Minus, Sparkles, X } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import {
  PRICING_MATRIX_DEFAULTS,
  normalizeMatrixCells,
} from '../../lib/pricingMatrixDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import { useBuilderStore } from '../../store/useBuilderStore'
import { blockThemeGradientStyle, softThemeGradientShellStyle } from '../../lib/themeGradientUtils'
import type { Block, PricingMatrixPlan } from '../../types/builder'

interface PricingMatrixBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

type Layout = 'table' | 'cards' | 'compact'
type Theme = 'premium' | 'minimal' | 'dark'

function CellValue({ value, theme, compact }: { value: string; theme: Theme; compact?: boolean }) {
  const normalized = value.trim().toLowerCase()
  const size = compact ? 'h-6 w-6' : 'h-8 w-8'
  const icon = compact ? 'h-3.5 w-3.5' : 'h-4 w-4'

  if (normalized === 'yes' || normalized === 'true' || normalized === '✓') {
    return (
      <span className={`inline-flex ${size} items-center justify-center rounded-full ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-900/50'}`}>
        <Check className={icon} aria-hidden />
      </span>
    )
  }

  if (normalized === 'no' || normalized === 'false' || normalized === '✗') {
    return (
      <span className={`inline-flex ${size} items-center justify-center rounded-full ${theme === 'dark' ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
        <X className={icon} aria-hidden />
      </span>
    )
  }

  if (normalized === 'partial' || normalized === 'limited' || normalized === '~') {
    return (
      <span className={`inline-flex ${size} items-center justify-center rounded-full ${theme === 'dark' ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-600 ring-1 ring-amber-100'}`}>
        <Minus className={icon} aria-hidden />
      </span>
    )
  }

  return (
    <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} ${theme === 'dark' ? 'text-white/90' : 'text-gray-800 dark:text-gray-200'}`}>
      {value}
    </span>
  )
}

function PlanHeader({
  plan,
  theme,
  showCta,
  interactive,
  onNavigate,
  mode = 'table',
  compact = false,
}: {
  plan: PricingMatrixPlan
  theme: Theme
  showCta: boolean
  interactive?: boolean
  onNavigate?: (slug: string) => void
  mode?: 'table' | 'card'
  compact?: boolean
}) {
  const pages = useBuilderStore((s) => s.pages)
  const highlighted = plan.highlighted === true

  const click = (e: React.MouseEvent<HTMLButtonElement>) => {
    createLinkClickHandler({
      interactive: !!interactive,
      link: plan.buttonLink ?? '#',
      pages,
      onNavigate,
    })(e as unknown as React.MouseEvent<HTMLAnchorElement>)
  }

  const cardBg =
    mode === 'card' && highlighted
      ? 'bg-gradient-to-b from-brand-50/90 to-violet-50/50 dark:from-brand-950/50 dark:to-violet-950/30'
      : mode === 'card' && theme === 'dark'
        ? 'bg-white/[0.03]'
        : ''

  return (
    <div className={`flex h-full flex-col text-center ${compact ? 'px-3 py-3' : 'px-4 py-4 sm:px-5 sm:py-5'} ${cardBg}`}>
      <div className={`flex items-center justify-center ${compact ? 'mb-2 min-h-6' : 'mb-3 min-h-7'}`}>
        {highlighted && plan.badge ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
            {!compact && <Sparkles className="h-3 w-3 opacity-90" aria-hidden />}
            {plan.badge}
          </span>
        ) : null}
      </div>

      <p className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} ${theme === 'dark' ? 'text-white/80' : 'text-gray-500'}`}>{plan.name}</p>
      <div className={`flex items-end justify-center gap-0.5 ${compact ? 'mt-1' : 'mt-2'}`}>
        <span className={`font-bold tracking-tight ${compact ? 'text-2xl' : 'text-3xl sm:text-4xl'} ${theme === 'dark' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          {plan.price}
        </span>
        {plan.period && !compact && (
          <span className={`mb-1 text-sm ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>{plan.period}</span>
        )}
      </div>
      {plan.description && !compact && (
        <p className={`mt-2 text-xs leading-relaxed ${theme === 'dark' ? 'text-white/55' : 'text-gray-500'}`}>{plan.description}</p>
      )}
      {showCta && plan.buttonText && !compact && (
        <button
          type="button"
          onClick={click}
          className={`mt-auto w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 ${
            highlighted
              ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-md shadow-brand-500/20'
              : theme === 'dark'
                ? 'border border-white/20 bg-white/10 text-white hover:bg-white/15'
                : 'border border-gray-200 bg-white text-gray-800 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
          } ${mode === 'table' ? 'mt-4' : 'mt-5'}`}
        >
          {plan.buttonText}
        </button>
      )}
    </div>
  )
}

function columnTone(isHighlighted: boolean, theme: Theme, zebra?: boolean): string {
  if (isHighlighted) {
    return theme === 'dark' ? 'bg-brand-500/[0.08]' : 'bg-brand-50/35 dark:bg-brand-950/20'
  }
  if (zebra) {
    return theme === 'dark' ? 'bg-white/[0.02]' : 'bg-gray-50/60 dark:bg-gray-800/20'
  }
  return ''
}

export function PricingMatrixBlock({ block, layoutStyle, interactive, onNavigate }: PricingMatrixBlockProps) {
  const { props, styles } = block
  const layout = (props.pricingMatrixLayout ?? PRICING_MATRIX_DEFAULTS.pricingMatrixLayout) as Layout
  const theme = (props.pricingMatrixTheme ?? PRICING_MATRIX_DEFAULTS.pricingMatrixTheme) as Theme
  const showCta = props.showPricingMatrixCta !== false
  const compact = layout === 'compact'
  const plans = (props.pricingMatrixPlans ?? []).filter((p) => p.enabled !== false)
  const rows = (props.pricingMatrixRows ?? []).filter((r) => r.enabled !== false)

  if (plans.length === 0) {
    return (
      <section style={layoutStyle} className="w-full py-8 text-center text-sm text-gray-400">
        Add pricing plans in the properties panel
      </section>
    )
  }

  const highlightedIndex = plans.findIndex((p) => p.highlighted === true)
  const gridCols = { gridTemplateColumns: `minmax(9rem, 1.15fr) repeat(${plans.length}, minmax(8rem, 1fr))` }

  const isDarkTable = theme === 'dark'
  const shellClass = isDarkTable
    ? 'border border-white/10 bg-gray-950/90 backdrop-blur-sm'
    : theme === 'premium'
      ? 'border border-gray-200/80 bg-white shadow-[0_20px_60px_-24px_rgba(79,70,229,0.25)] ring-1 ring-gray-100 dark:border-gray-700 dark:bg-gray-900/50 dark:ring-gray-800'
      : 'border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900/40'

  const featureLabelClass = isDarkTable
    ? 'text-white/70'
    : 'text-gray-600 dark:text-gray-300'

  const matrix = (
    <div className="overflow-x-auto">
      <div
        className={`min-w-[640px] overflow-hidden rounded-2xl ${shellClass}`}
        style={{ borderRadius: styles.borderRadius ?? undefined }}
      >
        <div className="grid" style={gridCols}>
          {/* Header row */}
          <div
            className={`sticky left-0 z-20 flex flex-col justify-end border-b px-4 pb-4 pt-5 sm:px-6 ${
              isDarkTable ? 'border-white/10 bg-gray-900/95' : 'border-gray-100 bg-gray-50/95 dark:border-gray-700 dark:bg-gray-800/80'
            }`}
          >
            <div className={compact ? 'mb-2 min-h-6' : 'mb-3 min-h-7'} aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">Features</span>
          </div>

          {plans.map((plan, planIndex) => {
            const isHighlighted = planIndex === highlightedIndex
            return (
              <div
                key={plan.id ?? plan.name}
                className={`relative border-b ${isDarkTable ? 'border-white/10' : 'border-gray-100 dark:border-gray-700'} ${columnTone(isHighlighted, theme)}`}
              >
                <PlanHeader
                  plan={plan}
                  theme={theme}
                  showCta={showCta}
                  interactive={interactive}
                  onNavigate={onNavigate}
                  mode="table"
                  compact={compact}
                />
              </div>
            )
          })}

          {/* Feature rows */}
          {rows.map((row, rowIndex) => {
            const isLast = rowIndex === rows.length - 1
            return (
              <div key={row.id ?? row.feature} className="contents">
                <div
                  className={`sticky left-0 z-10 flex flex-col justify-center border-b px-4 py-4 sm:px-6 sm:py-5 ${
                    isLast ? 'border-b-0' : ''
                  } ${isDarkTable ? 'border-white/10 bg-gray-900/95' : 'border-gray-100 bg-gray-50/95 dark:border-gray-700 dark:bg-gray-800/80'} ${
                    rowIndex % 2 === 1 ? (isDarkTable ? 'bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/90') : ''
                  }`}
                >
                  <span className={`text-sm font-semibold ${featureLabelClass}`}>{row.feature}</span>
                  {row.hint && !compact && <p className="mt-1 text-xs opacity-60">{row.hint}</p>}
                </div>

                {normalizeMatrixCells(row.cells, plans.length).map((cell, cellIndex) => {
                  const isHighlighted = cellIndex === highlightedIndex
                  return (
                    <div
                      key={`${row.id ?? row.feature}-${cellIndex}`}
                      className={`flex items-center justify-center border-b px-3 py-4 sm:px-4 sm:py-5 ${
                        isLast ? 'border-b-0' : ''
                      } ${isDarkTable ? 'border-white/10' : 'border-gray-100 dark:border-gray-700'} ${columnTone(
                        isHighlighted,
                        theme,
                        !isHighlighted && rowIndex % 2 === 1,
                      )}`}
                    >
                      <CellValue value={cell} theme={theme} compact={compact} />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const cardsLayout = (
    <div className={`grid gap-5 ${plans.length >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>
      {plans.map((plan) => (
        <div
          key={plan.id ?? plan.name}
          className={`overflow-hidden rounded-2xl border transition-shadow ${
            plan.highlighted
              ? 'border-brand-200 shadow-lg shadow-brand-500/10 dark:border-brand-800'
              : isDarkTable
                ? 'border-white/10 bg-gray-950'
                : 'border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/40'
          }`}
        >
          <PlanHeader plan={plan} theme={theme} showCta={showCta} interactive={interactive} onNavigate={onNavigate} mode="card" />
          <ul className={`divide-y ${isDarkTable ? 'divide-white/10 border-t border-white/10' : 'divide-gray-100 border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700'}`}>
            {rows.map((row) => {
              const planIndex = plans.findIndex((p) => (p.id ?? p.name) === (plan.id ?? plan.name))
              const cell = normalizeMatrixCells(row.cells, plans.length)[planIndex] ?? '—'
              return (
                <li key={row.id ?? row.feature} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <span className={`text-sm ${isDarkTable ? 'text-white/75' : 'text-gray-600 dark:text-gray-300'}`}>{row.feature}</span>
                  <CellValue value={cell} theme={theme} />
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )

  const content = layout === 'cards' ? cardsLayout : matrix

  if (theme === 'dark' && layout !== 'cards') {
    return (
      <section style={layoutStyle} className="w-full">
        <div className="overflow-hidden rounded-2xl px-4 py-10 sm:px-8 sm:py-12" style={blockThemeGradientStyle(styles)}>
          <div className="relative mx-auto max-w-6xl">
            {(props.text || props.subtitle) && (
              <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8 text-center text-white [&_p]:text-white/65" />
            )}
            {content}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-6xl">
        {(props.text || props.subtitle) && (
          <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8 text-center" />
        )}
        {theme === 'premium' && layout !== 'cards' && (
          <div className="rounded-[1.35rem] p-1 sm:p-1.5" style={softThemeGradientShellStyle(styles, 0.14)}>
            {content}
          </div>
        )}
        {(theme !== 'premium' || layout === 'cards') && content}
      </div>
    </section>
  )
}
