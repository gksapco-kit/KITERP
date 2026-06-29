import { useMemo, useState, type ElementType, type ReactNode } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { ModalBody, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { cn, searchFieldInnerInputClassName, searchFieldShellClassName, surfaceBorderClassName } from '@/lib/utils'
import {
  groupSidebarAppSections,
  isPinnedSidebarSection,
} from '@/layouts/sidebarNavApps'

const SUBMENU_CHIP_PREVIEW = 8

function appChipClassName(enabled: boolean) {
  return cn(
    'inline-flex max-w-full truncate rounded-full border-[1.5px] px-2.5 py-0.5 text-[11px] leading-snug',
    enabled
      ? 'border-primary/35 bg-primary/[0.08] text-foreground'
      : 'border-[color:var(--border-color)] bg-muted/20 text-muted-foreground',
  )
}

export type SidebarAppPickerSection = {
  id: string
  title: string
  titleTooltip?: string
  icon: ElementType
  itemCount: number
  description?: string
  submenuLabels: string[]
}

type SidebarAppsPickerModalProps = {
  open: boolean
  onClose: () => void
  sections: SidebarAppPickerSection[]
  enabledIds: string[]
  onEnabledChange: (ids: string[]) => void
}

function HeroHighlight({ children, onGreen }: { children: ReactNode; onGreen?: boolean }) {
  return (
    <span
      className="relative inline-block"
      style={{
        backgroundImage: onGreen
          ? 'linear-gradient(transparent 62%, rgba(255, 255, 255, 0.45) 62%, rgba(255, 255, 255, 0.45) 88%, transparent 88%)'
          : 'linear-gradient(transparent 62%, rgba(125, 211, 252, 0.55) 62%, rgba(125, 211, 252, 0.55) 88%, transparent 88%)',
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
      }}
    >
      {children}
    </span>
  )
}

export function SidebarAppsPickerModal({
  open,
  onClose,
  sections,
  enabledIds,
  onEnabledChange,
}: SidebarAppsPickerModalProps) {
  const [query, setQuery] = useState('')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set())

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections.filter((s) => {
      const title = s.title.toLowerCase()
      const tip = (s.titleTooltip ?? '').toLowerCase()
      const desc = (s.description ?? '').toLowerCase()
      const submenuHit = s.submenuLabels.some((label) => label.toLowerCase().includes(q))
      return title.includes(q) || tip.includes(q) || desc.includes(q) || s.id.includes(q) || submenuHit
    })
  }, [sections, query])

  const groupedSections = useMemo(() => groupSidebarAppSections(filtered), [filtered])
  const isSearchActive = query.trim().length > 0

  const enabledSet = useMemo(() => new Set(enabledIds), [enabledIds])
  const optionalSections = sections.filter((s) => !isPinnedSidebarSection(s.id))
  const enabledOptionalCount = optionalSections.filter((s) => enabledSet.has(s.id)).length
  const totalSubmenus = sections.reduce((sum, s) => sum + s.itemCount, 0)

  if (!open) return null

  const toggleSection = (sectionId: string, next: boolean) => {
    if (isPinnedSidebarSection(sectionId)) return
    const set = new Set(enabledIds)
    if (next) set.add(sectionId)
    else set.delete(sectionId)
    onEnabledChange(Array.from(set))
  }

  const showAll = () => onEnabledChange(sections.map((s) => s.id))

  const hideAllOptional = () => {
    onEnabledChange(sections.filter((s) => isPinnedSidebarSection(s.id)).map((s) => s.id))
  }

  const toggleCardExpanded = (sectionId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  const renderAppRow = (section: SidebarAppPickerSection) => {
    const pinned = isPinnedSidebarSection(section.id)
    const enabled = enabledSet.has(section.id)
    const SectionIcon = section.icon
    const expanded = expandedCards.has(section.id)
    const showAllSubmenus = expanded || section.submenuLabels.length <= SUBMENU_CHIP_PREVIEW
    const visibleLabels = showAllSubmenus
      ? section.submenuLabels
      : section.submenuLabels.slice(0, SUBMENU_CHIP_PREVIEW)
    const hiddenCount = section.submenuLabels.length - visibleLabels.length

    return (
      <article
        key={section.id}
        role="listitem"
        className={cn(
          'rounded-xl bg-card shadow-sm transition-[border-color,background-color] duration-150',
          surfaceBorderClassName,
          !enabled && 'hover:bg-muted/10',
        )}
      >
        <div className="flex items-start gap-3 p-3.5 sm:gap-4 sm:p-4">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11',
              surfaceBorderClassName,
              enabled
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'bg-muted/30 text-muted-foreground',
            )}
            aria-hidden
          >
            <SectionIcon className="h-5 w-5" strokeWidth={2} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h4 className="text-sm font-semibold text-foreground sm:text-base">{section.title}</h4>
                  <span
                    className={cn(
                      'rounded-full border-[1.5px] px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                      enabled
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-[color:var(--border-color)] bg-muted/40 text-muted-foreground',
                    )}
                  >
                    {section.itemCount} submenu{section.itemCount === 1 ? '' : 's'}
                  </span>
                  {pinned ? (
                    <span className="rounded-full border-[1.5px] border-[color:var(--border-color)] bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Always on
                    </span>
                  ) : enabled ? (
                    <span className="rounded-full border-[1.5px] border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      In sidebar
                    </span>
                  ) : null}
                </div>
                {section.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {section.description}
                  </p>
                ) : null}
              </div>

              <Switch
                checked={enabled}
                disabled={pinned}
                onCheckedChange={(checked) => toggleSection(section.id, checked)}
                className="shrink-0"
                aria-label={
                  pinned
                    ? `${section.title} is always shown`
                    : `${enabled ? 'Hide' : 'Show'} ${section.title} in sidebar`
                }
              />
            </div>

            {section.submenuLabels.length > 0 ? (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {visibleLabels.map((label, index) => (
                    <span key={`${section.id}-${index}`} className={appChipClassName(enabled)}>
                      {label}
                    </span>
                  ))}
                </div>
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleCardExpanded(section.id)}
                    className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                  >
                    {expanded ? 'Show fewer' : `Show ${hiddenCount} more submenu${hiddenCount === 1 ? '' : 's'}`}
                    <ChevronDown
                      className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
                      aria-hidden
                    />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  const listContent = isSearchActive ? (
    <div className="space-y-3 sm:space-y-4">{filtered.map((section) => renderAppRow(section))}</div>
  ) : (
    <div className="space-y-5 sm:space-y-6">
      {groupedSections.map(({ group, sections: groupSections }) => (
        <section key={group?.id ?? 'other'} className="space-y-2.5">
          <h3
            id={group ? `app-group-${group.id}` : undefined}
            className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
          >
            {group?.title ?? 'More apps'}
          </h3>
          <div className="space-y-3 sm:space-y-4">{groupSections.map((section) => renderAppRow(section))}</div>
        </section>
      ))}
    </div>
  )

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-3xl overflow-hidden bg-background text-foreground shadow-2xl">
        {/* Centered hero on green brand background */}
        <div
          className="relative px-5 py-4 text-center text-white sm:px-6 sm:py-5"
          style={{
            background:
              'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--hero-via)) 48%, hsl(var(--hero-to)) 100%)',
          }}
        >
          <button
            type="button"
            data-escape-close
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-1 text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:right-4 sm:top-3.5"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>

          <blockquote className="mx-auto max-w-xl">
            <h2
              className="text-[1.35rem] font-semibold leading-snug sm:text-[1.65rem]"
              style={{ fontFamily: "'Caveat', cursive" }}
            >
              <span
                className="mr-0.5 align-middle font-serif text-[1.25rem] leading-none text-white/40 sm:text-[1.5rem]"
                aria-hidden
              >
                &ldquo;
              </span>
              One <HeroHighlight onGreen>App</HeroHighlight> for Everything Your{' '}
              <HeroHighlight onGreen>Business</HeroHighlight> <HeroHighlight onGreen>Needs</HeroHighlight>.
              <span
                className="ml-0.5 align-middle font-serif text-[1.25rem] leading-none text-white/40 sm:text-[1.5rem]"
                aria-hidden
              >
                &rdquo;
              </span>
            </h2>
          </blockquote>

          <p className="mx-auto mt-2 max-w-md text-xs leading-snug text-white/88 sm:text-sm">
            Kit ERP apps — turn on a module to add it to your sidebar with every submenu listed below.
          </p>
          <p className="mt-1.5 text-[11px] text-white/70 sm:text-xs">
            <span className="font-semibold text-white">{sections.length}</span> apps
            <span className="mx-1.5 opacity-50">·</span>
            <span className="font-semibold text-white">{totalSubmenus}</span> submenu links
            <span className="mx-1.5 opacity-50">·</span>
            <span className="font-semibold text-white">
              {enabledOptionalCount}/{optionalSections.length}
            </span>
            in sidebar
          </p>
        </div>

        <div className="border-y border-[1.5px] border-[color:var(--border-color)] bg-muted/20 px-5 py-3 sm:px-6">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className={cn(searchFieldShellClassName, 'relative flex-1 px-3 py-0.5')}>
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search apps or submenu names…"
                className={cn(searchFieldInnerInputClassName, 'py-2 text-sm')}
                aria-label="Search apps"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn('h-9 bg-background text-xs', surfaceBorderClassName)}
                onClick={showAll}
              >
                Show all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn('h-9 bg-background text-xs', surfaceBorderClassName)}
                onClick={hideAllOptional}
              >
                Hide optional
              </Button>
            </div>
          </div>
        </div>

        <ModalBody className="px-6 py-4 sm:px-8">
          {filtered.length === 0 ? (
            <div
              className={cn(
                'rounded-xl border-dashed px-4 py-14 text-center text-sm text-muted-foreground',
                surfaceBorderClassName,
              )}
            >
              No apps match &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="max-h-[min(50vh,28rem)] overflow-y-auto pr-0.5" role="list">
              {listContent}
            </div>
          )}

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Use <span className="font-medium text-foreground">Reorder</span> in the sidebar to arrange modules, or{' '}
            <span className="font-medium text-foreground">Ctrl+K</span> to open any page.
          </p>
        </ModalBody>
      </ModalPanel>
    </ModalOverlay>
  )
}
