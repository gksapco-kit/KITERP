import { TIMELINE_DEFAULTS } from '../../lib/timelineDefaults'
import { blockThemeGradientStyle, softThemeGradientShellStyle } from '../../lib/themeGradientUtils'
import { SectionHeading } from '../builder/SectionHeading'
import type { Block, TimelineEventItem } from '../../types/builder'

interface TimelineBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

type Layout = 'vertical' | 'alternating' | 'horizontal' | 'compact'
type Theme = 'light' | 'premium' | 'dark'

function EventCard({
  event,
  showDates,
  showTags,
  theme,
  compact,
}: {
  event: TimelineEventItem
  showDates: boolean
  showTags: boolean
  theme: Theme
  compact?: boolean
}) {
  const isDark = theme === 'dark'
  const cardClass = isDark
    ? 'border border-white/10 bg-white/[0.04] backdrop-blur-sm'
    : 'border border-gray-200/80 bg-white shadow-sm ring-1 ring-gray-100 dark:border-gray-700 dark:bg-gray-900/60 dark:ring-gray-800'

  return (
    <article className={`overflow-hidden rounded-xl ${cardClass} ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      {event.imageUrl && (
        <div className={`-mx-5 -mt-5 mb-4 sm:-mx-6 sm:-mt-6 ${compact ? '-mx-4 -mt-4 mb-3' : ''}`}>
          <img src={event.imageUrl} alt="" className={`w-full object-cover ${compact ? 'h-28' : 'h-40 sm:h-44'}`} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {showDates && event.date && (
          <time
            className={`text-xs font-bold uppercase tracking-wider ${
              isDark ? 'text-brand-300' : 'text-brand-600 dark:text-brand-400'
            }`}
          >
            {event.date}
          </time>
        )}
        {showTags && event.tag && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isDark ? 'bg-white/10 text-white/70' : 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
            }`}
          >
            {event.tag}
          </span>
        )}
      </div>
      <h3 className={`mt-2 font-semibold ${compact ? 'text-base' : 'text-lg'} ${isDark ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
        {event.title}
      </h3>
      {event.description && (
        <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-white/65' : 'text-gray-600 dark:text-gray-300'}`}>
          {event.description}
        </p>
      )}
    </article>
  )
}

function Dot({ theme, active }: { theme: Theme; active?: boolean }) {
  const isDark = theme === 'dark'
  return (
    <span
      className={`relative z-10 flex shrink-0 items-center justify-center rounded-full ring-4 ${
        active
          ? isDark
            ? 'h-4 w-4 bg-brand-400 ring-gray-950'
            : 'h-4 w-4 bg-brand-600 ring-white dark:ring-gray-950'
          : isDark
            ? 'h-3 w-3 bg-white/30 ring-gray-950'
            : 'h-3 w-3 bg-gray-300 ring-white dark:bg-gray-600 dark:ring-gray-950'
      }`}
    />
  )
}

export function TimelineBlock({ block, layoutStyle }: TimelineBlockProps) {
  const { props, styles } = block
  const layout = (props.timelineLayout ?? TIMELINE_DEFAULTS.timelineLayout) as Layout
  const theme = (props.timelineTheme ?? TIMELINE_DEFAULTS.timelineTheme) as Theme
  const showDates = props.showTimelineDates !== false
  const showConnector = props.showTimelineConnector !== false
  const showTags = props.showTimelineTags !== false

  const events = (props.timelineEvents ?? []).filter((e) => e.enabled !== false)
  const isDark = theme === 'dark'
  const lineClass = isDark ? 'bg-gradient-to-b from-brand-500/50 via-white/20 to-brand-500/30' : 'bg-gradient-to-b from-brand-300 via-brand-100 to-brand-200 dark:from-brand-700 dark:via-gray-700 dark:to-brand-900'

  if (events.length === 0) {
    return (
      <section style={layoutStyle} className="w-full py-12 text-center text-sm text-gray-400">
        Add timeline events in the properties panel
      </section>
    )
  }

  const renderVertical = () => (
    <div className="relative mx-auto max-w-2xl">
      {showConnector && <div className={`absolute bottom-2 left-[7px] top-2 w-0.5 ${lineClass}`} />}
      <ul className="space-y-8">
        {events.map((event, i) => (
          <li key={event.id ?? i} className="relative flex gap-5 pl-0">
            <div className="flex w-4 shrink-0 justify-center pt-1.5">
              <Dot theme={theme} active={i === 0} />
            </div>
            <div className="min-w-0 flex-1">
              <EventCard event={event} showDates={showDates} showTags={showTags} theme={theme} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )

  const renderAlternating = () => (
    <div className="relative mx-auto max-w-4xl">
      {showConnector && (
        <div className={`absolute bottom-0 left-1/2 top-0 hidden w-0.5 -translate-x-1/2 md:block ${lineClass}`} />
      )}
      <ul className="space-y-10 md:space-y-12">
        {events.map((event, i) => {
          const isRight = i % 2 === 1
          return (
            <li key={event.id ?? i} className="relative">
              <div className="flex gap-4 md:hidden">
                <div className="flex w-4 shrink-0 justify-center pt-2">
                  <Dot theme={theme} active={i === 0} />
                </div>
                <div className="min-w-0 flex-1">
                  <EventCard event={event} showDates={showDates} showTags={showTags} theme={theme} />
                </div>
              </div>
              <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-start md:gap-8">
                <div className={isRight ? 'md:col-start-3' : 'md:col-start-1 md:text-right'}>
                  <EventCard event={event} showDates={showDates} showTags={showTags} theme={theme} />
                </div>
                <div className="flex justify-center md:col-start-2 md:pt-8">
                  <Dot theme={theme} active={i === 0} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )

  const renderHorizontal = () => (
    <div className="overflow-x-auto pb-4">
      <div className="relative flex min-w-max gap-0 px-2">
        {showConnector && (
          <div
            className={`absolute left-8 right-8 top-[18px] h-0.5 ${
              isDark ? 'bg-white/15' : 'bg-brand-200 dark:bg-gray-700'
            }`}
          />
        )}
        {events.map((event, i) => (
          <div key={event.id ?? i} className="relative w-64 shrink-0 px-4 sm:w-72">
            <div className="mb-4 flex justify-center">
              <Dot theme={theme} active={i === 0} />
            </div>
            <EventCard event={event} showDates={showDates} showTags={showTags} theme={theme} compact />
          </div>
        ))}
      </div>
    </div>
  )

  const renderCompact = () => (
    <div className="mx-auto max-w-2xl divide-y divide-gray-100 dark:divide-gray-800">
      {events.map((event, i) => (
        <div key={event.id ?? i} className="flex gap-4 py-5 first:pt-0 last:pb-0">
          <div className="flex w-20 shrink-0 flex-col items-end gap-1 pt-0.5">
            {showDates && (
              <span className={`text-xs font-bold ${isDark ? 'text-brand-300' : 'text-brand-600'}`}>{event.date}</span>
            )}
            <Dot theme={theme} />
          </div>
          <div className="min-w-0 flex-1 border-l border-gray-100 pl-4 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{event.title}</h3>
              {showTags && event.tag && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{event.tag}</span>
              )}
            </div>
            {event.description && (
              <p className={`mt-1 text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{event.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  const body =
    layout === 'horizontal'
      ? renderHorizontal()
      : layout === 'compact'
        ? renderCompact()
        : layout === 'alternating'
          ? renderAlternating()
          : renderVertical()

  const content = (
    <>
      {(props.text || props.subtitle) && (
        <SectionHeading
          title={props.text}
          subtitle={props.subtitle}
          styles={styles}
          className={`mb-10 md:mb-12 ${isDark ? 'text-white [&_p]:text-white/65' : ''}`}
        />
      )}
      {body}
    </>
  )

  if (isDark) {
    return (
      <section style={layoutStyle} className="w-full">
        <div className="rounded-2xl px-4 py-12 sm:px-8 sm:py-16" style={blockThemeGradientStyle(styles)}>
          <div className="mx-auto max-w-5xl">{content}</div>
        </div>
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-5xl px-1">
        {theme === 'premium' ? (
          <div className="rounded-[1.25rem] p-1 sm:p-2" style={softThemeGradientShellStyle(styles)}>
            <div className="rounded-2xl bg-white/80 px-4 py-10 backdrop-blur-sm dark:bg-gray-900/40 sm:px-8 sm:py-12">
              {content}
            </div>
          </div>
        ) : (
          <div className="py-4">{content}</div>
        )}
      </div>
    </section>
  )
}
