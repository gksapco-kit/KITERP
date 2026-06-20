import { Layout, MousePointerClick, ImageIcon, Rocket, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BUILDER_WELCOME_KEY,
  dismissCoachMark,
  readCoachMarkDismissed,
} from '@/lib/builderCoachMarks'

export function readBuilderWelcomeDismissed(): boolean {
  return readCoachMarkDismissed(BUILDER_WELCOME_KEY)
}

export function dismissBuilderWelcome(): void {
  dismissCoachMark(BUILDER_WELCOME_KEY)
}

const STEPS = [
  {
    icon: Layout,
    title: 'Add a section',
    desc: 'Pick a section type from this panel, or use Templates for a full page layout.',
  },
  {
    icon: MousePointerClick,
    title: 'Click to edit',
    desc: 'Click any section on the page to change text, colors, and layout in the right panel.',
  },
  {
    icon: ImageIcon,
    title: 'Change photos',
    desc: 'Click a photo on the page, then use Media in the toolbar to replace it.',
  },
  {
    icon: Rocket,
    title: 'Go live',
    desc: 'When you are happy, click Publish store so customers see your site.',
  },
] as const

/** First-visit quick start — dismissible, stored in localStorage. */
export function BuilderWelcomePanel({
  dismissed,
  onDismiss,
  className,
}: {
  dismissed: boolean
  onDismiss: () => void
  className?: string
}) {
  if (dismissed) return null

  return (
    <div className={cn('mx-3 mt-3 mb-1 rounded-xl border border-primary/25 bg-gradient-to-br from-accent/80 to-white p-3 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-xs font-bold text-gray-900">Start here</p>
          <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">
            New to websites? Follow these four steps — no technical knowledge needed.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          aria-label="Dismiss quick start"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <ul className="space-y-2">
        {STEPS.map(({ icon: Icon, title, desc }, i) => (
          <li key={title} className="flex gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-gray-800 flex items-center gap-1">
                <Icon className="w-3 h-3 text-primary/80" />
                {title}
              </p>
              <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-semibold text-primary border border-primary/30 hover:bg-primary/5 transition-colors"
      >
        Got it — hide this guide
      </button>
    </div>
  )
}
