import { useState } from 'react'
import { BarChart3, Check } from 'lucide-react'
import { POLL_VOTING_DEFAULTS } from '../../lib/pollVotingDefaults'
import { SectionHeading } from '../builder/SectionHeading'
import type { Block, PollOptionItem } from '../../types/builder'

interface PollVotingBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
}

type Layout = 'bars' | 'cards' | 'list'
type Theme = 'light' | 'premium' | 'dark'

function totalVotes(options: PollOptionItem[], fallback: number) {
  const sum = options.reduce((a, o) => a + (o.votes ?? 0), 0)
  return sum > 0 ? sum : fallback
}

export function PollVotingBlock({ block, layoutStyle, interactive = false }: PollVotingBlockProps) {
  const { props, styles } = block
  const layout = (props.pollLayout ?? POLL_VOTING_DEFAULTS.pollLayout) as Layout
  const theme = (props.pollTheme ?? POLL_VOTING_DEFAULTS.pollTheme) as Theme
  const showResults = props.showPollResults !== false
  const showCounts = props.showPollVoteCount !== false
  const options = (props.pollOptions ?? []).filter((o) => o.enabled !== false)
  const total = totalVotes(options, props.pollTotalVotes ?? POLL_VOTING_DEFAULTS.pollTotalVotes)
  const [selected, setSelected] = useState<string | null>(null)

  const isDark = theme === 'dark'
  const shell = isDark
    ? 'border border-white/10 bg-gray-900/80'
    : theme === 'premium'
      ? 'border border-gray-200/80 bg-white shadow-lg ring-1 ring-gray-100 dark:border-gray-700 dark:bg-gray-900/50 dark:ring-gray-800'
      : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40'

  const renderOption = (opt: PollOptionItem, index: number) => {
    const pct = total > 0 ? Math.round(((opt.votes ?? 0) / total) * 100) : 0
    const isSelected = selected === (opt.id ?? String(index))
    const canVote = interactive && !showResults

    if (layout === 'cards') {
      return (
        <button
          key={opt.id ?? index}
          type="button"
          disabled={!canVote}
          onClick={() => canVote && setSelected(opt.id ?? String(index))}
          className={`w-full rounded-xl border p-4 text-left transition ${
            isSelected
              ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200 dark:bg-brand-950/40'
              : isDark
                ? 'border-white/10 bg-white/5 hover:bg-white/10'
                : 'border-gray-200 hover:border-brand-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{opt.label}</span>
            {isSelected && <Check className="h-5 w-5 shrink-0 text-brand-600" />}
          </div>
          {showResults && (
            <p className={`mt-2 text-sm ${isDark ? 'text-white/55' : 'text-gray-500'}`}>
              {pct}%{showCounts ? ` · ${opt.votes ?? 0} votes` : ''}
            </p>
          )}
        </button>
      )
    }

    return (
      <div key={opt.id ?? index} className="space-y-2">
        <button
          type="button"
          disabled={!canVote}
          onClick={() => canVote && setSelected(opt.id ?? String(index))}
          className={`flex w-full items-center justify-between gap-3 text-left ${canVote ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
            {opt.label}
          </span>
          {showResults && (
            <span className={`shrink-0 text-sm tabular-nums ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
              {pct}%{showCounts ? ` (${opt.votes ?? 0})` : ''}
            </span>
          )}
        </button>
        {showResults && layout === 'bars' && (
          <div className={`h-2.5 overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {layout === 'list' && showResults && (
          <div className={`h-1 overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    )
  }

  const inner = (
    <div className={`rounded-2xl p-6 sm:p-8 ${shell}`}>
      <div className="mb-6 flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isDark ? 'bg-brand-500/20 text-brand-300' : 'bg-brand-50 text-brand-600'}`}>
          <BarChart3 className="h-5 w-5" />
        </div>
        {showResults && (
          <p className={`text-sm ${isDark ? 'text-white/55' : 'text-gray-500'}`}>
            <span className="font-semibold tabular-nums text-brand-600 dark:text-brand-400">{total}</span> total votes
          </p>
        )}
      </div>

      <div className={layout === 'cards' ? 'grid gap-3 sm:grid-cols-2' : 'space-y-4'}>{options.map(renderOption)}</div>

      {props.buttonText && (
        <button
          type="button"
          disabled={!interactive}
          className="mt-6 w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto sm:px-8"
        >
          {props.buttonText}
        </button>
      )}
    </div>
  )

  if (isDark) {
    return (
      <section style={layoutStyle} className="w-full">
        <div className="rounded-2xl bg-gradient-to-br from-gray-950 via-gray-900 to-slate-950 px-4 py-10 sm:px-8">
          <div className="mx-auto max-w-2xl">
            {(props.text || props.subtitle) && (
              <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6 text-white [&_p]:text-white/65" />
            )}
            {inner}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-2xl">
        {(props.text || props.subtitle) && <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6" />}
        {inner}
      </div>
    </section>
  )
}
