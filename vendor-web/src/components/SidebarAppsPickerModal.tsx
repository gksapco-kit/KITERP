import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react'
import { ChevronRight, Link2, PackageMinus, PackagePlus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { ModalBody, ModalFooter, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { cn, searchFieldInnerInputClassName, searchFieldShellClassName, surfaceBorderClassName } from '@/lib/utils'
import {
  isPinnedSidebarSection,
  SIDEBAR_APPS_ADMIN_ONLY_MESSAGE,
  type SidebarAppSubmenuExport,
} from '@/layouts/sidebarNavApps'
import { useIsVendorAdmin } from '@/hooks/usePermissions'

export type SidebarAppPickerSubmenuItem = SidebarAppSubmenuExport & {
  icon?: ElementType
}

export type SidebarAppPickerSection = {
  id: string
  title: string
  titleTooltip?: string
  icon: ElementType
  itemCount: number
  description?: string
  submenuLabels: string[]
  submenuItems: SidebarAppPickerSubmenuItem[]
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

function SubmenuBubble({
  item,
  installed,
  title,
}: {
  item: SidebarAppPickerSubmenuItem
  installed: boolean
  title?: string
}) {
  const Icon = item.icon ?? Link2
  return (
    <span
      title={title ?? item.label}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2',
        installed
          ? 'border-primary/30 bg-primary/[0.08] text-foreground'
          : 'border-[color:var(--border-color)] bg-muted/25 text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          installed ? 'bg-primary/15 text-primary' : 'bg-muted/50 text-muted-foreground',
        )}
        aria-hidden
      >
        <Icon className="h-2.5 w-2.5" strokeWidth={2} />
      </span>
      <span className="truncate text-[10px] font-medium leading-none">{item.label}</span>
    </span>
  )
}

type AppGridCardProps = {
  section: SidebarAppPickerSection
  installed: boolean
  pinned: boolean
  expanded: boolean
  onToggleExpand: () => void
  onInstall: () => void
  onUninstall: () => void
}

function AppGridCard({
  section,
  installed,
  pinned,
  expanded,
  onToggleExpand,
  onInstall,
  onUninstall,
}: AppGridCardProps) {
  const SectionIcon = section.icon
  const hasSubmenus = section.submenuItems.length > 0

  return (
    <article
      role="listitem"
      tabIndex={hasSubmenus ? 0 : undefined}
      onClick={() => {
        if (hasSubmenus) onToggleExpand()
      }}
      onKeyDown={(e) => {
        if (!hasSubmenus) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggleExpand()
        }
      }}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl bg-card transition-[box-shadow,border-color,transform] duration-200',
        'border border-[color:var(--border-color)]',
        expanded && 'z-10 border-primary/60 shadow-md ring-1 ring-primary/15',
        installed && !expanded && 'border-primary/30 bg-primary/[0.02]',
        !expanded && 'hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md',
        hasSubmenus && 'cursor-pointer',
      )}
      aria-expanded={hasSubmenus ? expanded : undefined}
    >
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              surfaceBorderClassName,
              installed
                ? 'border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 text-primary'
                : 'bg-muted/40 text-muted-foreground group-hover:bg-muted/60',
            )}
            aria-hidden
          >
            <SectionIcon className="h-5 w-5" strokeWidth={1.75} />
          </span>

          {hasSubmenus ? (
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors',
                surfaceBorderClassName,
                expanded && 'border-primary/30 bg-primary/10 text-primary',
              )}
              aria-hidden
            >
              <ChevronRight
                className={cn('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-90')}
              />
            </span>
          ) : null}
        </div>

        <div className="mt-3 min-w-0 flex-1">
          <h4 className="text-[0.8125rem] font-semibold leading-snug tracking-tight text-foreground">
            {section.title}
          </h4>
          <p className={cn('mt-1 text-[11px] font-medium', installed ? 'text-primary' : 'text-muted-foreground')}>
            {section.itemCount} menu item{section.itemCount === 1 ? '' : 's'}
            {installed ? ' · Installed' : ''}
          </p>
          {!expanded && section.description ? (
            <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
              {section.description}
            </p>
          ) : null}
        </div>

        {expanded && hasSubmenus ? (
          <div className="mt-3 border-t border-[color:var(--border-color)] pt-3">
            <div className="flex flex-wrap gap-1.5">
              {section.submenuItems.map((item, index) => (
                <SubmenuBubble
                  key={`${section.id}-${item.path}-${index}`}
                  item={item}
                  installed={installed}
                  title={item.external ? `${item.label} (external)` : item.label}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div
          className="mt-3.5"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {pinned ? (
            <span className="inline-flex w-full items-center justify-center rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-2 text-[11px] font-medium text-primary">
              Always installed
            </span>
          ) : installed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('h-8 w-full gap-1.5 text-[11px]', surfaceBorderClassName)}
              onClick={onUninstall}
            >
              <PackageMinus className="h-3.5 w-3.5" aria-hidden />
              Uninstall
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-8 w-full gap-1.5 text-[11px]"
              onClick={onInstall}
            >
              <PackagePlus className="h-3.5 w-3.5" aria-hidden />
              Install
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

export function SidebarAppsPickerModal({
  open,
  onClose,
  sections,
  enabledIds,
  onEnabledChange,
}: SidebarAppsPickerModalProps) {
  const isVendorAdmin = useIsVendorAdmin()
  const [query, setQuery] = useState('')
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections.filter((s) => {
      const title = s.title.toLowerCase()
      const tip = (s.titleTooltip ?? '').toLowerCase()
      const desc = (s.description ?? '').toLowerCase()
      const submenuHit = s.submenuLabels.some((label) => label.toLowerCase().includes(q))
      const pathHit = s.submenuItems.some((item) => item.path.toLowerCase().includes(q))
      return title.includes(q) || tip.includes(q) || desc.includes(q) || s.id.includes(q) || submenuHit || pathHit
    })
  }, [sections, query])

  const enabledSet = useMemo(() => new Set(enabledIds), [enabledIds])
  const installedCount = sections.filter((s) => enabledSet.has(s.id)).length
  const totalSubmenus = sections.reduce((sum, s) => sum + s.itemCount, 0)

  useEffect(() => {
    if (expandedSectionId && !filtered.some((s) => s.id === expandedSectionId)) {
      setExpandedSectionId(null)
    }
  }, [filtered, expandedSectionId])

  if (!open) return null

  const toggleExpanded = (sectionId: string) => {
    setExpandedSectionId((prev) => (prev === sectionId ? null : sectionId))
  }

  const installSection = (section: SidebarAppPickerSection) => {
    if (!isVendorAdmin) {
      toast.error(SIDEBAR_APPS_ADMIN_ONLY_MESSAGE)
      return
    }
    if (enabledSet.has(section.id)) return
    onEnabledChange([...enabledIds, section.id])
    setExpandedSectionId(section.id)
    toast.success(`${section.title} installed in sidebar`)
  }

  const uninstallSection = (section: SidebarAppPickerSection) => {
    if (!isVendorAdmin) {
      toast.error(SIDEBAR_APPS_ADMIN_ONLY_MESSAGE)
      return
    }
    if (isPinnedSidebarSection(section.id) || !enabledSet.has(section.id)) return
    onEnabledChange(enabledIds.filter((id) => id !== section.id))
    toast.success(`${section.title} removed from sidebar`)
  }

  return (
    <ModalOverlay onClose={onClose} className="overflow-hidden overscroll-none">
      <ModalPanel className="max-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden bg-background text-foreground shadow-2xl">
        <div
          className="relative shrink-0 px-5 py-5 text-center text-white sm:px-8 sm:py-6"
          style={{
            background:
              'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--hero-via)) 48%, hsl(var(--hero-to)) 100%)',
          }}
        >
          <button
            type="button"
            data-escape-close
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:right-4 sm:top-4"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>

          <blockquote className="mx-auto max-w-xl">
            <h2
              className="text-[1.4rem] font-semibold leading-snug sm:text-[1.75rem]"
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

          <p className="mx-auto mt-2.5 max-w-md text-xs leading-relaxed text-white/90 sm:text-sm">
            {isVendorAdmin
              ? 'Tap a card to show menu bubbles. Install or uninstall apps in your sidebar.'
              : 'Tap a card to browse menu items. Installing apps requires owner or admin access.'}
          </p>
          <p className="mt-2 text-[11px] tracking-wide text-white/70 sm:text-xs">
            <span className="font-semibold text-white">{sections.length}</span> apps
            <span className="mx-1.5 opacity-50">·</span>
            <span className="font-semibold text-white">{totalSubmenus}</span> menu items
            <span className="mx-1.5 opacity-50">·</span>
            <span className="font-semibold text-white">{installedCount}</span> installed
          </p>
        </div>

        <div className="shrink-0 border-b border-[color:var(--border-color)] bg-muted/15 px-5 py-3.5 sm:px-8">
          <div className={cn(searchFieldShellClassName, 'relative px-3.5 py-0.5')}>
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search apps, pages, or routes…"
              className={cn(searchFieldInnerInputClassName, 'py-2.5 text-sm')}
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
        </div>

        <ModalBody className="overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
          {filtered.length === 0 ? (
            <div
              className={cn(
                'rounded-2xl border-dashed px-4 py-16 text-center text-sm text-muted-foreground',
                surfaceBorderClassName,
              )}
            >
              No apps match &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div
              className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5"
              role="list"
            >
              {filtered.map((section) => (
                <AppGridCard
                  key={section.id}
                  section={section}
                  installed={enabledSet.has(section.id)}
                  pinned={isPinnedSidebarSection(section.id)}
                  expanded={expandedSectionId === section.id}
                  onToggleExpand={() => toggleExpanded(section.id)}
                  onInstall={() => installSection(section)}
                  onUninstall={() => uninstallSection(section)}
                />
              ))}
            </div>
          )}
        </ModalBody>

        <ModalFooter className="justify-center border-t border-[color:var(--border-color)] bg-muted/10 py-3">
          <p className="text-center text-[11px] text-muted-foreground">
            Use <span className="font-medium text-foreground">Reorder</span> in the sidebar to arrange modules, or{' '}
            <span className="font-medium text-foreground">Ctrl+K</span> to open any page.
          </p>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}
