import { LIVE_PRESENCE_DEFAULTS, presenceStatusColor } from '../../lib/livePresenceDefaults'
import { getInitials } from '../../lib/mentionsTaggingDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import type { Block, PresenceUserItem } from '../../types/builder'

interface LivePresenceBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

type Layout = 'stack' | 'list' | 'compact'
type Theme = 'light' | 'premium' | 'dark'

function Avatar({ user, showPulse }: { user: PresenceUserItem; showPulse: boolean }) {
  return (
    <span className="relative inline-block">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-900" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-xs font-bold text-white ring-2 ring-white dark:ring-gray-900">
          {getInitials(user.name)}
        </span>
      )}
      <span
        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ${presenceStatusColor(user.status)} ${
          showPulse && user.status === 'online' ? 'animate-pulse' : ''
        }`}
      />
    </span>
  )
}

export function LivePresenceBlock({ block, layoutStyle }: LivePresenceBlockProps) {
  const { props, styles } = block
  const layout = (props.presenceLayout ?? LIVE_PRESENCE_DEFAULTS.presenceLayout) as Layout
  const theme = (props.presenceTheme ?? LIVE_PRESENCE_DEFAULTS.presenceTheme) as Theme
  const showPulse = props.showPresencePulse !== false
  const users = (props.presenceUsers ?? []).filter((u) => u.enabled !== false)
  const onlineCount = props.presenceOnlineCount ?? users.filter((u) => u.status === 'online').length
  const statusText = props.presenceStatusText ?? LIVE_PRESENCE_DEFAULTS.presenceStatusText
  const isDark = theme === 'dark'

  const shell = isDark
    ? 'border border-white/10 bg-gray-900/60'
    : theme === 'premium'
      ? 'border border-brand-100/80 bg-gradient-to-br from-brand-50/50 to-white shadow-sm dark:border-gray-700 dark:from-brand-950/20 dark:to-gray-900/40'
      : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40'

  const stack = (
    <div className="flex items-center">
      <div className="flex -space-x-3">
        {users.slice(0, 6).map((u, i) => (
          <div key={u.id ?? i} style={{ zIndex: 10 - i }}>
            <Avatar user={u} showPulse={showPulse} />
          </div>
        ))}
      </div>
      {users.length > 6 && (
        <span className={`ml-3 text-sm font-medium ${isDark ? 'text-white/70' : 'text-gray-500'}`}>+{users.length - 6}</span>
      )}
    </div>
  )

  const list = (
    <ul className="space-y-3">
      {users.map((u, i) => (
        <li key={u.id ?? i} className="flex items-center gap-3">
          <Avatar user={u} showPulse={showPulse} />
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{u.name}</p>
            <p className={`text-xs capitalize ${isDark ? 'text-white/50' : 'text-gray-400'}`}>{u.status ?? 'online'}</p>
          </div>
        </li>
      ))}
    </ul>
  )

  const compact = (
    <div className="flex flex-wrap items-center gap-2">
      {users.map((u, i) => (
        <span
          key={u.id ?? i}
          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${
            isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${presenceStatusColor(u.status).split(' ')[0]}`} />
          {u.name.split(' ')[0]}
        </span>
      ))}
    </div>
  )

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-xl">
        {(props.text || props.subtitle) && (
          <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6" />
        )}
        <div className={`rounded-2xl p-5 sm:p-6 ${shell}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <span className="text-emerald-600 dark:text-emerald-400">{onlineCount}</span> online now
            </p>
            {statusText && <p className={`text-xs ${isDark ? 'text-white/45' : 'text-gray-400'}`}>{statusText}</p>}
          </div>
          {layout === 'list' ? list : layout === 'compact' ? compact : stack}
        </div>
      </div>
    </section>
  )
}
