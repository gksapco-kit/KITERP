import { BadgeCheck, MapPin } from 'lucide-react'
import { blockThemeGradientStyle, themeUsesGradient } from '../../lib/themeGradientUtils'
import { USER_PROFILE_CARD_DEFAULTS } from '../../lib/userProfileCardDefaults'
import type { Block } from '../../types/builder'

interface UserProfileCardBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

export function UserProfileCardBlock({ block, layoutStyle }: UserProfileCardBlockProps) {
  const { props, styles } = block
  const layout = props.userProfileLayout ?? USER_PROFILE_CARD_DEFAULTS.userProfileLayout
  const theme = props.userProfileTheme ?? USER_PROFILE_CARD_DEFAULTS.userProfileTheme
  const showStats = props.showProfileStats !== false
  const showActions = props.showProfileActions !== false
  const showLocation = props.showProfileLocation !== false
  const showRole = props.showProfileRole !== false
  const showAvatar = props.showProfileAvatar !== false
  const showBadge = props.showProfileBadge !== false && !!props.profileBadge
  const stats = (props.profileStats ?? []).filter((s) => s.enabled !== false)
  const isDark = theme === 'dark'
  const isPremium = theme === 'premium'
  const useGradient = themeUsesGradient(theme)

  const shellClass = useGradient
    ? 'text-white border-transparent shadow-xl'
    : isDark
      ? 'border-white/10 bg-gray-950 text-white'
      : 'border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white'

  const shellStyle = useGradient ? { ...blockThemeGradientStyle(styles) } : undefined
  const mutedClass = useGradient ? 'text-white/75' : isDark ? 'text-white/60' : 'text-gray-500'

  const name = props.text ?? 'User Name'
  const username = props.profileUsername
  const role = props.profileRole
  const bio = props.profileBio
  const location = props.profileLocation ?? props.location

  const avatar = showAvatar && (
    <div className="relative shrink-0">
      {props.imageUrl ? (
        <img
          src={props.imageUrl}
          alt={name}
          className={`object-cover ring-4 ${
            layout === 'compact' ? 'h-14 w-14 rounded-xl' : 'h-24 w-24 rounded-full'
          } ${useGradient ? 'ring-white/30' : 'ring-white dark:ring-gray-800'}`}
        />
      ) : (
        <span
          className={`flex items-center justify-center bg-brand-600 font-bold text-white ${
            layout === 'compact' ? 'h-14 w-14 rounded-xl text-lg' : 'h-24 w-24 rounded-full text-2xl'
          }`}
        >
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
      {showBadge && (
        <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          <BadgeCheck className="h-3 w-3" />
          {props.profileBadge}
        </span>
      )}
    </div>
  )

  const statsRow = showStats && stats.length > 0 && (
    <div className={`flex divide-x ${useGradient ? 'divide-white/20' : 'divide-gray-200 dark:divide-gray-700'} ${layout === 'centered' ? 'justify-center' : ''}`}>
      {stats.map((stat) => (
        <div key={stat.id ?? stat.label} className={`px-4 text-center first:pl-0 last:pr-0 ${layout === 'horizontal' ? 'px-6' : ''}`}>
          <p className="text-lg font-bold tabular-nums">{stat.value}</p>
          <p className={`text-xs ${mutedClass}`}>{stat.label}</p>
        </div>
      ))}
    </div>
  )

  const actions = showActions && (
    <div className={`flex gap-2 ${layout === 'centered' ? 'justify-center' : ''}`}>
      <button type="button" className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
        {props.buttonText ?? 'Follow'}
      </button>
      <button
        type="button"
        className={`rounded-xl border px-5 py-2 text-sm font-semibold ${
          useGradient
            ? 'border-white/40 bg-white/10 text-white hover:bg-white/20'
            : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
        }`}
      >
        {props.buttonText2 ?? 'Message'}
      </button>
    </div>
  )

  const info = (
    <div className={layout === 'centered' ? 'text-center' : 'min-w-0 flex-1'}>
      <h3 className="text-xl font-bold">{name}</h3>
      {username && <p className={`mt-0.5 text-sm font-medium ${isPremium && !useGradient ? 'text-brand-600' : mutedClass}`}>{username}</p>}
      {showRole && role && <p className={`mt-1 text-sm font-medium ${mutedClass}`}>{role}</p>}
      {showLocation && location && (
        <p className={`mt-2 flex items-center gap-1 text-sm ${mutedClass} ${layout === 'centered' ? 'justify-center' : ''}`}>
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {location}
        </p>
      )}
      {bio && <p className={`mt-3 text-sm leading-relaxed ${mutedClass}`}>{bio}</p>}
    </div>
  )

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-md">
        <article className={`overflow-hidden rounded-2xl border p-6 ${shellClass}`} style={shellStyle}>
          {layout === 'horizontal' || layout === 'compact' ? (
            <div className={`flex gap-4 ${layout === 'compact' ? 'items-center' : 'items-start'}`}>
              {avatar}
              <div className="min-w-0 flex-1">
                {info}
                {layout === 'compact' && statsRow && <div className="mt-3">{statsRow}</div>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {avatar}
              <div className="mt-4 w-full">{info}</div>
            </div>
          )}

          {layout !== 'compact' && statsRow && <div className="mt-6">{statsRow}</div>}
          {actions && <div className="mt-6">{actions}</div>}
        </article>
      </div>
    </section>
  )
}
