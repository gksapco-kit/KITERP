import type { ElementType } from 'react'
import { Button } from '@/components/ui/button'

export type DashboardQuickAction = {
  label: string
  icon: ElementType
  to: string
  color: string
}

type DashboardWelcomeBannerProps = {
  greeting: string
  title: string
  description: string
  actions: DashboardQuickAction[]
  onNavigate: (to: string) => void
}

/** Soft dot grid over the hero gradient */
function HeroDotPattern() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="hero-dots" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="white" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hero-dots)" />
    </svg>
  )
}

export function DashboardWelcomeBanner({
  greeting,
  title,
  description,
  actions,
  onNavigate,
}: DashboardWelcomeBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-[linear-gradient(270deg,hsl(var(--primary))_0%,hsl(var(--hero-via))_42%,hsl(var(--hero-to))_100%)] px-3 py-4 text-white shadow-lg shadow-black/15 sm:py-5 lg:px-5 lg:py-6">
      <HeroDotPattern />

      {/* White accent orb — left, on dark gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-1 left-0 z-0 h-28 w-28 -translate-x-[18%] rounded-full bg-white/[0.12] sm:bottom-2 sm:h-32 sm:w-32 sm:-translate-x-[22%] lg:bottom-3 lg:h-36 lg:w-36 lg:-translate-x-[28%]"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-[12%] z-0 h-28 w-28 rounded-full bg-white/[0.08] sm:h-32 sm:w-32"
      />

      <div className="relative z-[1] flex w-full flex-col gap-2 text-left sm:gap-2.5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0 max-w-xl space-y-1 lg:space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-white/85">{greeting}</p>
          <h1 className="text-lg font-bold leading-tight text-white drop-shadow-sm sm:text-xl lg:text-2xl">
            {title}
          </h1>
          <p className="max-w-lg text-xs leading-snug text-white/80 sm:text-xs sm:leading-normal">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-0.5 lg:flex-nowrap lg:justify-end lg:gap-2 lg:pt-0">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.to}
                size="xs"
                className={`${action.color} gap-1 text-white shadow-md shadow-black/15 backdrop-blur-sm`}
                onClick={() => onNavigate(action.to)}
              >
                <Icon className="h-3 w-3 shrink-0" />
                {action.label}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
