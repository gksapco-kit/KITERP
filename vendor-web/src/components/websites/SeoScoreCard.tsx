import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  seoScoreColor,
  seoScoreLabelText,
  seoScoreRingColor,
  type SeoCheck,
  type SeoScoreResult,
} from '@/lib/seoScore'

function CheckIcon({ status }: { status: SeoCheck['status'] }) {
  if (status === 'good') return <span className="text-emerald-600 dark:text-emerald-400">✓</span>
  if (status === 'warn') return <span className="text-amber-600 dark:text-amber-400">!</span>
  if (status === 'bad') return <span className="text-destructive">✕</span>
  return <span className="text-muted-foreground">—</span>
}

function ScoreRing({ score, maxScore, label }: { score: number; maxScore: number; label: SeoScoreResult['label'] }) {
  const pct = maxScore > 0 ? Math.min(100, Math.round((score / maxScore) * 100)) : 0
  const r = 22
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c

  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" className="stroke-muted/50" strokeWidth="4" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          className={seoScoreRingColor(score, label)}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-sm font-bold leading-none', seoScoreColor(score, label))}>{score}</span>
        <span className="text-[9px] text-muted-foreground">/ {maxScore}</span>
      </div>
    </div>
  )
}

function statusHint(status: SeoCheck['status']): string {
  if (status === 'good') return 'Done'
  if (status === 'warn') return 'Could be better'
  if (status === 'bad') return 'Needs attention'
  return 'Not required'
}

export function SeoScoreCard({
  result,
  title = 'SEO score',
  subtitle,
  compact = false,
  defaultOpen = false,
}: {
  result: SeoScoreResult
  title?: string
  subtitle?: string
  compact?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const actionable = result.checks.filter(c => c.maxPoints > 0)
  const badCount = actionable.filter(c => c.status === 'bad').length
  const warnCount = actionable.filter(c => c.status === 'warn').length

  return (
    <div className="rounded-xl border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <ScoreRing score={result.score} maxScore={result.maxScore} label={result.label} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', {
              'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300': result.label === 'excellent',
              'bg-primary/15 text-primary': result.label === 'good',
              'bg-amber-500/15 text-amber-800 dark:text-amber-300': result.label === 'needs-work',
              'bg-destructive/15 text-destructive': result.label === 'poor',
              'bg-muted text-muted-foreground': result.label === 'hidden',
            })}
            >
              {seoScoreLabelText(result.label)}
            </span>
          </div>
          {subtitle && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{subtitle}</p>}
          {!compact && !open && (badCount > 0 || warnCount > 0) && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {badCount > 0
                ? `${badCount} item${badCount === 1 ? '' : 's'} need attention — tap to see what to fix`
                : `${warnCount} tip${warnCount === 1 ? '' : 's'} to improve — tap to view`}
            </p>
          )}
          {!compact && !open && badCount === 0 && warnCount === 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">Tap to see the checklist</p>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-2 border-t border-border px-3 py-3">
          <p className="text-[11px] text-muted-foreground">
            Checklist — green means good, amber means improve, red means missing.
          </p>
          {result.checks.map(check => (
            <div key={check.id} className="flex items-start gap-2 rounded-lg bg-background/60 px-2 py-1.5 text-[11px]">
              <span className="mt-px w-3 shrink-0 text-center font-bold"><CheckIcon status={check.status} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground">{check.label}</span>
                  <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                    {statusHint(check.status)}
                  </span>
                  {check.maxPoints > 0 && (
                    <span className="text-muted-foreground">({check.points}/{check.maxPoints} pts)</span>
                  )}
                </div>
                <p className="mt-0.5 leading-relaxed text-muted-foreground">{check.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SeoScoreBadge({ score, noindex }: { score: number; noindex?: boolean }) {
  if (noindex) {
    return <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">hidden</span>
  }
  return (
    <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums', {
      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300': score >= 90,
      'bg-primary/15 text-primary': score >= 70 && score < 90,
      'bg-amber-500/15 text-amber-800 dark:text-amber-300': score >= 45 && score < 70,
      'bg-destructive/15 text-destructive': score < 45,
    })}
    >
      {score}
    </span>
  )
}
