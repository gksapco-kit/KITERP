import { AtSign } from 'lucide-react'
import { getInitials, MENTIONS_TAGGING_DEFAULTS } from '../../lib/mentionsTaggingDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import type { Block, MentionItem } from '../../types/builder'

interface MentionsTaggingBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

type Layout = 'composer' | 'chips' | 'list'
type Theme = 'light' | 'premium' | 'dark'

function renderMentionSpan(handle: string, isDark: boolean) {
  return (
    <span
      key={handle}
      className={`rounded-md px-1 py-0.5 font-medium ${
        isDark ? 'bg-brand-500/25 text-brand-200' : 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
      }`}
    >
      @{handle}
    </span>
  )
}

function ComposerPreview({ text, items, isDark }: { text: string; items: MentionItem[]; isDark: boolean }) {
  const parts = text.split(/(@\w+)/g)
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
      }`}
    >
      <p className={`text-sm leading-relaxed ${isDark ? 'text-white/90' : 'text-gray-700 dark:text-gray-200'}`}>
        {parts.map((part, i) => {
          if (part.startsWith('@')) {
            const handle = part.slice(1)
            const user = items.find((m) => m.handle === handle)
            return (
              <span key={i} title={user?.name}>
                {renderMentionSpan(handle, isDark)}
              </span>
            )
          }
          return <span key={i}>{part}</span>
        })}
      </p>
      <p className={`mt-3 text-xs ${isDark ? 'text-white/45' : 'text-gray-400'}`}>Type @ to mention someone from your team</p>
    </div>
  )
}

export function MentionsTaggingBlock({ block, layoutStyle }: MentionsTaggingBlockProps) {
  const { props, styles } = block
  const layout = (props.mentionsLayout ?? MENTIONS_TAGGING_DEFAULTS.mentionsLayout) as Layout
  const theme = (props.mentionsTheme ?? MENTIONS_TAGGING_DEFAULTS.mentionsTheme) as Theme
  const showAvatars = props.showMentionAvatars !== false
  const items = (props.mentionItems ?? []).filter((m) => m.enabled !== false)
  const composerText = props.mentionComposerText ?? MENTIONS_TAGGING_DEFAULTS.mentionComposerText
  const isDark = theme === 'dark'

  const shell = isDark
    ? 'border border-white/10 bg-gray-900/60'
    : 'border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/40'

  const body =
    layout === 'composer' ? (
      <ComposerPreview text={composerText} items={items} isDark={isDark} />
    ) : layout === 'chips' ? (
      <div className="flex flex-wrap gap-2">
        {items.map((m, i) => (
          <span
            key={m.id ?? i}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
              isDark ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-700'
            }`}
          >
            {showAvatars && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-[10px] font-bold text-white">
                {getInitials(m.name)}
              </span>
            )}
            <AtSign className="h-3.5 w-3.5 text-brand-500" />
            {m.handle}
          </span>
        ))}
      </div>
    ) : (
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.map((m, i) => (
          <li key={m.id ?? i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            {showAvatars && (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-xs font-bold text-white">
                {getInitials(m.name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{m.name}</p>
              <p className={`text-sm ${isDark ? 'text-brand-300' : 'text-brand-600'}`}>@{m.handle}</p>
            </div>
            {m.role && <span className={`text-xs ${isDark ? 'text-white/45' : 'text-gray-400'}`}>{m.role}</span>}
          </li>
        ))}
      </ul>
    )

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-2xl">
        {(props.text || props.subtitle) && (
          <SectionHeading
            title={props.text}
            subtitle={props.subtitle}
            styles={styles}
            className={`mb-6 ${isDark ? 'text-white [&_p]:text-white/65' : ''}`}
          />
        )}
        <div className={`rounded-2xl p-6 sm:p-8 ${shell}`}>{body}</div>
      </div>
    </section>
  )
}
