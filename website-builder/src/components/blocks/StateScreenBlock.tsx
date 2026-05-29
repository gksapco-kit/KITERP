import {
  AlertTriangle,
  CheckCircle2,
  FileQuestion,
  Inbox,
  LogOut,
  Sparkles,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import {
  isStateScreenType,
  STATE_SCREEN_ACCENT,
  STATE_SCREEN_DEFAULTS,
  type StateScreenType,
} from '../../lib/stateScreenConfig'
import { blockThemeGradientStyle } from '../../lib/themeGradientUtils'
import { subtitleColorStyle, subtitleWidthStyle } from '../../lib/sectionTextStyles'
import type { Block, Page } from '../../types/builder'

interface StateScreenBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
  pages: Pick<Page, 'slug'>[]
}

const ICONS: Record<StateScreenType, LucideIcon> = {
  emptyState: Inbox,
  errorState: AlertTriangle,
  successState: CheckCircle2,
  maintenanceScreen: Wrench,
  notFoundPage: FileQuestion,
  comingSoon: Sparkles,
  sessionExpired: LogOut,
}

type Layout = 'centered' | 'card' | 'split'
type Theme = 'light' | 'dark' | 'brand'

export function StateScreenBlock({ block, layoutStyle, interactive = false, onNavigate, pages }: StateScreenBlockProps) {
  const { props, styles, type } = block
  if (!isStateScreenType(type)) return null

  const layout = (props.stateScreenLayout ?? STATE_SCREEN_DEFAULTS.stateScreenLayout) as Layout
  const theme = (props.stateScreenTheme ?? STATE_SCREEN_DEFAULTS.stateScreenTheme) as Theme
  const showIcon = props.showStateIcon !== false
  const accent = STATE_SCREEN_ACCENT[type]
  const Icon = ICONS[type]

  const primaryClick = createLinkClickHandler({
    link: props.buttonLink,
    interactive: !!interactive,
    pages,
    onNavigate,
  })
  const secondaryClick = createLinkClickHandler({
    link: props.buttonLink2,
    interactive: !!interactive,
    pages,
    onNavigate,
  })

  const isDark = theme === 'dark'
  const isBrand = theme === 'brand'
  const gradientBgStyle = isDark || isBrand ? blockThemeGradientStyle(styles) : undefined

  const sectionBg =
    isDark || isBrand
      ? ''
      : layout === 'card'
        ? 'bg-gray-50 dark:bg-gray-950'
        : 'bg-white dark:bg-gray-950'

  const titleClass = isDark || isBrand ? 'text-white' : 'text-gray-900 dark:text-white'
  const subClass = isDark || isBrand ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
  const metaClass = isDark || isBrand ? 'text-white/55' : 'text-gray-400'

  const cardShell =
    layout === 'card'
      ? 'rounded-2xl border border-gray-200/80 bg-white p-8 shadow-xl ring-1 ring-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:ring-gray-800 sm:p-12'
      : layout === 'split'
        ? 'grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16'
        : ''

  const illustration = props.imageUrl ? (
    <div className={`overflow-hidden rounded-2xl ${layout === 'split' ? '' : 'mx-auto mt-8 max-w-sm'}`}>
      <img src={props.imageUrl} alt="" className="h-full w-full object-cover" />
    </div>
  ) : layout === 'split' ? (
    <div
      className={`hidden aspect-[4/3] overflow-hidden rounded-2xl lg:block ${
        isBrand ? 'bg-white/10 ring-1 ring-white/20' : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900'
      }`}
    >
      <div className="flex h-full items-center justify-center p-12">
        {showIcon && (
          <div className={`flex h-24 w-24 items-center justify-center rounded-3xl ring-1 ${isBrand ? 'bg-white/15 ring-white/25' : accent.wrap}`}>
            <Icon className={`h-12 w-12 ${isBrand ? 'text-white' : accent.icon}`} strokeWidth={1.5} />
          </div>
        )}
      </div>
    </div>
  ) : null

  const content = (
    <div className={layout === 'centered' ? 'mx-auto max-w-lg text-center' : layout === 'card' ? 'text-center' : ''}>
      {props.stateCode && (
        <p className={`mb-2 text-6xl font-black tracking-tight sm:text-7xl ${isBrand ? 'text-white/25' : accent.code}`}>
          {props.stateCode}
        </p>
      )}

      {showIcon && layout !== 'split' && (
        <div
          className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 sm:h-[4.5rem] sm:w-[4.5rem] ${
            isBrand ? 'bg-white/15 ring-white/25' : accent.wrap
          } ${layout === 'centered' ? 'mx-auto' : ''}`}
        >
          <Icon className={`h-8 w-8 sm:h-9 sm:w-9 ${isBrand ? 'text-white' : accent.icon}`} strokeWidth={1.75} />
        </div>
      )}

      {showIcon && layout === 'split' && (
        <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 lg:hidden ${isBrand ? 'bg-white/15' : accent.wrap}`}>
          <Icon className={`h-7 w-7 ${isBrand ? 'text-white' : accent.icon}`} />
        </div>
      )}

      {props.text && (
        <h2
          className={`text-2xl font-bold tracking-tight sm:text-3xl ${titleClass}`}
          style={styles.titleColor ? { color: styles.titleColor } : undefined}
        >
          {props.text}
        </h2>
      )}

      {props.subtitle && (
        <p
          className={`mt-3 text-sm leading-relaxed sm:text-base ${subClass}`}
          style={{
            ...subtitleColorStyle(styles),
            ...subtitleWidthStyle(styles, layout === 'centered' || layout === 'card'),
          }}
        >
          {props.subtitle}
        </p>
      )}

      {props.stateMeta && <p className={`mt-3 text-sm font-medium ${metaClass}`}>{props.stateMeta}</p>}

      {(props.buttonText || props.buttonText2) && (
        <div
          className={`mt-8 flex flex-col gap-3 sm:flex-row sm:items-center ${
            layout === 'centered' || layout === 'card' ? 'justify-center' : ''
          }`}
        >
          {props.buttonText && (
            <button
              type="button"
              onClick={(e) => primaryClick(e as unknown as React.MouseEvent<HTMLAnchorElement>)}
              className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isBrand
                  ? 'bg-white text-brand-700 hover:bg-white/95 focus:ring-white'
                  : 'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500'
              }`}
            >
              {props.buttonText}
            </button>
          )}
          {props.buttonText2 && (
            <button
              type="button"
              onClick={(e) => secondaryClick(e as unknown as React.MouseEvent<HTMLAnchorElement>)}
              className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isBrand
                  ? 'bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20 focus:ring-white/50'
                  : 'text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-800'
              }`}
            >
              {props.buttonText2}
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <section style={{ ...layoutStyle, ...gradientBgStyle }} className={`w-full ${sectionBg}`}>
      <div
        className={`mx-auto flex min-h-[320px] max-w-5xl flex-col justify-center px-6 py-16 sm:px-10 sm:py-20 ${
          layout === 'card' ? 'py-12 sm:py-16' : ''
        }`}
      >
        {layout === 'card' ? (
          <div className={cardShell}>
            {content}
            {illustration}
          </div>
        ) : (
          <div className={cardShell || undefined}>
            {layout === 'split' ? (
              <>
                <div>{content}</div>
                {illustration}
              </>
            ) : (
              <>
                {content}
                {illustration}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
