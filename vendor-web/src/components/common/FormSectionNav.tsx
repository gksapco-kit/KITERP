import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ElementType, ReactNode, ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { formatFormFieldError } from '@/lib/formFieldErrors'
import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { useFormContext, type FieldErrors } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

// ── Active-section context (used by Section components inside FormPageWithNav) ──

const ActiveSectionCtx = createContext<string | null>(null)

/** Returns the key of the section currently scrolled into view. */
export function useFormActiveSection(): string | null {
  return useContext(ActiveSectionCtx)
}

/** Responsive compact spacing for form view/edit pages (fits more sections on screen). */
export const formDisplayCompact = {
  pageGap: 'flex flex-col gap-1 sm:gap-1.5',
  cardBody: 'p-2 space-y-1 sm:space-y-1.5',
  cardBodyTight: 'p-1.5 sm:p-2 space-y-0.5 sm:space-y-1',
  sectionHeader: 'flex items-center gap-1.5 mb-0.5',
  sectionHeaderIcon: 'h-3.5 w-3.5 shrink-0 text-muted-foreground',
  sectionHeaderTitle: 'text-xs font-semibold text-foreground sm:text-sm',
  fieldGrid:
    'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2 gap-y-1',
  fieldGrid4:
    'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-2 gap-y-1',
  fieldGrid2:
    'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-2 gap-y-1',
  fieldGrid3:
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-2 gap-y-1',
  scrollMarginView: 'scroll-mt-14 sm:scroll-mt-[4.5rem]',
  scrollMarginEdit: 'scroll-mt-[5.25rem] sm:scroll-mt-[7rem]',
  mediaDropzone:
    'w-full cursor-pointer rounded-md border-2 border-dashed p-2 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/30 sm:p-2.5',
} as const

/** Create / edit form density — compact grids, minimal vertical gaps. */
export const formEditLayout = {
  pageStack: formDisplayCompact.pageGap,
  formStack: 'w-full flex flex-col gap-1',
  sectionBody: 'space-y-1 pt-0.5',
  fieldGrid: formDisplayCompact.fieldGrid2,
  fieldGridWide:
    'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-2 gap-y-1',
  fieldGrid3: formDisplayCompact.fieldGrid3,
  mediaCard: 'p-1.5 sm:p-2',
  mediaTitle: 'mb-0.5 text-xs font-semibold',
  mediaDrop:
    'w-full rounded-md border-2 border-dashed p-2 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/30',
  typeBanner: 'flex items-start gap-2 rounded-md border px-2 py-1 text-xs leading-snug',
  sectionHeaderBtn:
    'flex w-full items-center justify-between gap-1.5 px-2 py-1 text-left sm:px-2.5',
  sectionContent: 'border-t px-2 pb-1.5 pt-0 sm:px-2.5',
  stickyBar:
    'sticky top-14 z-20 mb-1 border-b border-border bg-card/95 px-2 py-1 text-foreground shadow-sm backdrop-blur sm:px-2.5',
  variantCard: 'space-y-1 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5',
} as const

export const formSelectClass =
  'form-select flex h-8 min-h-8 w-full items-center px-2 py-0 text-xs focus:outline-none focus:ring-2 focus:ring-ring sm:h-10 sm:px-2.5 sm:text-sm [color-scheme:light] dark:[color-scheme:dark]'

/** @deprecated Prefer `Select` from `@/components/ui/select` — native fallback only */
export const nativeFormSelectClass = formSelectClass

/** Compact filter / toolbar native selects — prefer `Select` from `@/components/ui/select` */
export const filterSelectClass =
  'form-select inline-flex h-10 w-full min-w-0 items-center px-2.5 py-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark]'

export { Select, selectOptionsWithBlank, type SelectOption } from '@/components/ui/select'

export const formTextareaClass =
  'flex w-full min-h-[2.25rem] resize-y rounded-md border border-input bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[2.5rem] sm:px-2.5 sm:text-sm'

export const formFieldShellClass =
  'space-y-1 min-w-0 rounded-md border border-transparent transition-colors'

export const formLabelClass =
  'block text-[0.6875rem] font-medium leading-snug text-muted-foreground sm:text-xs mb-0.5'

/** Red border on inputs inside a field that failed validation. */
export const formFieldInvalidChildClass =
  '[&_input]:border-red-400 [&_input]:focus-visible:ring-red-300 [&_select]:border-red-400 [&_select]:focus-visible:ring-red-300 [&_textarea]:border-red-400 [&_textarea]:focus-visible:ring-red-300'

/** Resolve a react-hook-form error message from a dotted/bracket field path. */
export function resolveFormFieldError(errors: FieldErrors, name: string): string | undefined {
  const segments = name.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  let cur: unknown = errors
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  if (cur && typeof cur === 'object' && 'message' in cur && (cur as { message?: unknown }).message) {
    return String((cur as { message: unknown }).message)
  }
  return undefined
}

/** First invalid field path (depth-first), e.g. `name` or `variants.0.price`. */
export function findFirstFormErrorPath(errors: FieldErrors): string | undefined {
  const walk = (node: unknown, prefix: string): string | undefined => {
    if (!node || typeof node !== 'object') return undefined
    if ('message' in node && (node as { message?: unknown }).message) {
      return prefix || undefined
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const hit = walk(node[i], prefix ? `${prefix}.${i}` : String(i))
        if (hit) return hit
      }
      return undefined
    }
    for (const key of Object.keys(node)) {
      if (key === 'message' || key === 'type' || key === 'ref' || key === 'root') continue
      const next = prefix ? `${prefix}.${key}` : key
      const hit = walk((node as Record<string, unknown>)[key], next)
      if (hit) return hit
    }
    return undefined
  }
  return walk(errors, '')
}

function findRegisteredFieldName(node: ReactNode): string | undefined {
  const items = Children.toArray(node)
  for (const item of items) {
    if (!isValidElement(item)) continue
    const props = item.props as { name?: string; children?: ReactNode }
    if (typeof props.name === 'string' && props.name) return props.name
    if (props.children) {
      const nested = findRegisteredFieldName(props.children)
      if (nested) return nested
    }
  }
  return undefined
}

/** Label + control with inline error under the field (reads errors from FormProvider). */
export function FormField({
  label,
  name,
  required,
  error: errorOverride,
  children,
  className,
}: {
  label: string
  name?: string
  required?: boolean
  error?: string
  children: ReactNode
  className?: string
}) {
  const { formState: { errors } } = useFormContext()
  const fieldName = name ?? findRegisteredFieldName(children)
  const rawError = errorOverride ?? (fieldName ? resolveFormFieldError(errors, fieldName) : undefined)
  const error = rawError ? formatFormFieldError(rawError, label) : undefined
  const invalid = !!error

  const enhancedChild = (() => {
    if (!invalid) return children
    const only = Children.only(children)
    if (!isValidElement(only)) return children
    return cloneElement(only as ReactElement<{ className?: string }>, {
      className: cn((only.props as { className?: string }).className, 'border-red-400 focus-visible:ring-red-300'),
    })
  })()

  return (
    <div
      data-field={fieldName}
      className={cn(
        formFieldShellClass,
        invalid && 'rounded-md border border-red-300/80 bg-red-50/40 dark:bg-red-950/25 dark:border-red-800/80 px-2 py-1.5 focus-within:border-red-400',
        className,
      )}
    >
      <Label className={formLabelClass} required={required}>
        {label}
      </Label>
      <div className={cn(invalid && formFieldInvalidChildClass)}>{enhancedChild}</div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** Scroll to the first invalid field; optional toast + callback (e.g. open form section). */
export function handleFormInvalid(
  errors: FieldErrors,
  options?: {
    toast?: boolean
    onFieldPath?: (path: string) => void
  },
) {
  const path = findFirstFormErrorPath(errors)
  if (path) {
    options?.onFieldPath?.(path)
    const el =
      document.querySelector(`[data-field="${path}"]`) ??
      document.querySelector(`[name="${path}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const focusable = el?.querySelector('input,select,textarea') as HTMLElement | null
    focusable?.focus({ preventScroll: true })
  }
  if (options?.toast !== false) {
    toast.error('Please fix the highlighted fields before saving.')
  }
}

/** Shrinks default Input heights inside a form column without touching every field. */
export const formInputScopeClass =
  '[&_input:not([type=checkbox]):not([type=radio])]:h-8 [&_input:not([type=checkbox]):not([type=radio])]:min-h-8 [&_input:not([type=checkbox]):not([type=radio])]:py-1 [&_input:not([type=checkbox]):not([type=radio])]:text-xs sm:[&_input:not([type=checkbox]):not([type=radio])]:h-9 sm:[&_input:not([type=checkbox]):not([type=radio])]:text-sm [&_[data-phone-input]_button]:h-8 [&_[data-phone-input]_input]:h-8 sm:[&_[data-phone-input]_button]:h-9 sm:[&_[data-phone-input]_input]:h-9'

/** CSS class to highlight a section card when it is the active scroll target. */
export function formSectionSurfaceClass(active: boolean): string {
  return active
    ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background border-l-[3px] border-l-primary shadow-md shadow-primary/10'
    : ''
}

/** Pick the section whose top edge is at or above the scroll line (classic scroll-spy). */
export function resolveActiveFormSectionKey(
  sections: FormSectionDef[],
  scrollOffset: number,
): string | null {
  const visible = sections.filter((s) => s.visible !== false)
  const positioned = visible
    .map((s) => {
      const el = document.getElementById(`form-section-${s.key}`)
      if (!el) return null
      const top = el.getBoundingClientRect().top + window.scrollY
      return { key: s.key, top }
    })
    .filter((x): x is { key: string; top: number } => x != null)
    .sort((a, b) => a.top - b.top)

  if (positioned.length === 0) return null

  const scrollLine = window.scrollY + scrollOffset
  let active = positioned[0].key

  for (const { key, top } of positioned) {
    if (top <= scrollLine + 8) active = key
  }

  const nearBottom =
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 32

  if (nearBottom) {
    active = positioned[positioned.length - 1].key
  }

  return active
}

/** Section key when focus or click is inside a `form-section-*` element. */
export function resolveActiveFormSectionFromFocus(
  sections: FormSectionDef[],
  target: EventTarget | null,
): string | null {
  const el = target as HTMLElement | null
  if (!el?.closest) return null
  const sectionEl = el.closest('[id^="form-section-"]') as HTMLElement | null
  if (!sectionEl?.id) return null
  const key = sectionEl.id.replace(/^form-section-/, '')
  const visible = sections.filter((s) => s.visible !== false)
  return visible.some((s) => s.key === key) ? key : null
}

// ── FormSectionTabs ────────────────────────────────────────────────────────────

type FormSectionTabsProps = {
  sections: FormSectionDef[]
  activeKey: string
  onChange: (key: string) => void
  completedSections?: Set<string>
  hasErrorSections?: Set<string>
  className?: string
}

/** Horizontal scrollable tabs for product/service forms (replaces stacked accordions). */
export function FormSectionTabs({
  sections,
  activeKey,
  onChange,
  completedSections,
  hasErrorSections,
  className,
}: FormSectionTabsProps) {
  const visible = sections.filter((s) => s.visible !== false)
  const activeSection = visible.find((s) => s.key === activeKey)

  return (
    <div className={cn('space-y-1', className)}>
      <div
        className="sticky top-[calc(3.5rem+2.25rem)] z-10 -mx-2 rounded-lg border border-border bg-background/95 px-0.5 py-0.5 shadow-sm backdrop-blur sm:-mx-2.5"
        role="tablist"
        aria-label="Form sections"
      >
        <div className="flex gap-0.5 overflow-x-auto overscroll-x-contain pb-px scrollbar-thin">
          {visible.map((sec) => {
            const isActive = activeKey === sec.key
            const hasError = hasErrorSections?.has(sec.key)
            const isCompleted = completedSections?.has(sec.key)
            const Icon = sec.icon

            return (
              <button
                key={sec.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(sec.key)}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-colors sm:px-2.5 sm:text-xs',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  hasError && !isActive && 'text-red-600 hover:text-red-700',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={isActive ? 2.25 : 2} />
                <span className="whitespace-nowrap">{sec.label}</span>
                {hasError ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">!</span>
                ) : isCompleted && !isActive ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {activeSection?.hint ? (
        <p className="px-0.5 text-[0.6875rem] leading-snug text-muted-foreground">{activeSection.hint}</p>
      ) : null}
    </div>
  )
}

// ── FormPageWithNav ──────────────────────────────────────────────────────────

type FormPageWithNavProps = {
  children: ReactNode
  nav?: ReactNode
  /** Controlled active key (pass from parent); nav updates via scroll-spy. */
  activeSectionKey?: string | null
}

/**
 * Layout wrapper: sticky nav on the left, form content on the right.
 * Provides ActiveSectionCtx so nested Section components can highlight themselves.
 */
export function FormPageWithNav({ children, nav, activeSectionKey }: FormPageWithNavProps) {
  return (
    <ActiveSectionCtx.Provider value={activeSectionKey ?? null}>
      <div className="mx-auto w-full max-w-[96rem] pb-6 sm:pb-8">
        <div className="flex items-start gap-2 sm:gap-2.5 lg:gap-3">
          {nav}
          <div className={cn('min-w-0 flex-1', formEditLayout.pageStack, formInputScopeClass)}>
            {children}
          </div>
        </div>
      </div>
    </ActiveSectionCtx.Provider>
  )
}

// ── FormSectionDef ───────────────────────────────────────────────────────────

export type FormSectionDef = {
  key: string
  label: string
  icon: ElementType
  /** Whether this section is currently visible/applicable */
  visible?: boolean
  /** Short guide shown under the nav when this section is active */
  hint?: string
}

// ── FormSectionNav ───────────────────────────────────────────────────────────

type Props = {
  sections: FormSectionDef[]
  openSections: Record<string, boolean>
  visitedSections: Set<string>
  completedSections: Set<string>
  hasErrorSections: Set<string>
  /** Amber clock — submitted but awaiting external action (e.g. domain verification). */
  pendingSections?: Set<string>
  onNavigate: (key: string) => void
  /** Called when scroll-spy changes the active section. */
  onActiveSectionChange?: (key: string | null) => void
  /** Pixels from viewport top to treat as the “reading line” (dashboard + optional form bar). */
  scrollOffset?: number
  /** Tailwind top class for sticky aside (view: top-14, edit with form bar: top-[7rem]). */
  stickyTopClass?: string
  /** Sidebar heading (default: Quick Navigation). */
  navTitle?: string
  /** When false, active-section hint is omitted from the sidebar (show in main content instead). */
  showActiveHintInNav?: boolean
  /**
   * Controlled nav highlight (e.g. accordion open key). When provided, scroll-spy is disabled
   * so the highlight does not flicker during programmatic scroll.
   */
  highlightKey?: string | null
}

export function FormSectionNav({
  sections,
  openSections,
  visitedSections,
  completedSections,
  hasErrorSections,
  pendingSections,
  onNavigate,
  onActiveSectionChange,
  scrollOffset = 88,
  stickyTopClass = 'top-[7rem]',
  navTitle = 'Quick Navigation',
  showActiveHintInNav = true,
  highlightKey,
}: Props) {
  const isControlledHighlight = highlightKey !== undefined
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const navigatingToRef = useRef<string | null>(null)
  const scrollIdleTimerRef = useRef<number | null>(null)
  const navigationFallbackTimerRef = useRef<number | null>(null)
  const onActiveRef = useRef(onActiveSectionChange)
  onActiveRef.current = onActiveSectionChange

  const publishActive = useCallback((key: string | null) => {
    setActiveKey((prev) => {
      if (prev !== key) onActiveRef.current?.(key)
      return key
    })
  }, [])

  const clearNavigationLock = useCallback(() => {
    navigatingToRef.current = null
    if (scrollIdleTimerRef.current != null) {
      window.clearTimeout(scrollIdleTimerRef.current)
      scrollIdleTimerRef.current = null
    }
    if (navigationFallbackTimerRef.current != null) {
      window.clearTimeout(navigationFallbackTimerRef.current)
      navigationFallbackTimerRef.current = null
    }
  }, [])

  const syncActive = useCallback(() => {
    const pinned = navigatingToRef.current
    if (pinned) {
      publishActive(pinned)
      return
    }
    const focusKey = resolveActiveFormSectionFromFocus(sections, document.activeElement)
    if (focusKey) {
      publishActive(focusKey)
      return
    }
    publishActive(resolveActiveFormSectionKey(sections, scrollOffset))
  }, [sections, scrollOffset, publishActive])

  const lockNavigation = useCallback((key: string) => {
    navigatingToRef.current = key
    publishActive(key)
    if (navigationFallbackTimerRef.current != null) {
      window.clearTimeout(navigationFallbackTimerRef.current)
    }
    navigationFallbackTimerRef.current = window.setTimeout(() => {
      navigatingToRef.current = null
      syncActive()
    }, 1200)
  }, [publishActive, syncActive])

  useEffect(() => {
    if (isControlledHighlight) return

    const onScroll = () => {
      const pinned = navigatingToRef.current
      if (pinned) {
        publishActive(pinned)
        if (scrollIdleTimerRef.current != null) window.clearTimeout(scrollIdleTimerRef.current)
        scrollIdleTimerRef.current = window.setTimeout(() => {
          navigatingToRef.current = null
          if (navigationFallbackTimerRef.current != null) {
            window.clearTimeout(navigationFallbackTimerRef.current)
            navigationFallbackTimerRef.current = null
          }
          syncActive()
        }, 140)
        return
      }

      if (rafRef.current != null) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        syncActive()
      })
    }

    const onFocusOrPointer = (e: Event) => {
      if (navigatingToRef.current) return
      const key = resolveActiveFormSectionFromFocus(sections, e.target)
      if (key) publishActive(key)
    }

    syncActive()
    const t = window.setTimeout(syncActive, 120)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    document.addEventListener('focusin', onFocusOrPointer, true)
    document.addEventListener('pointerdown', onFocusOrPointer, true)

    return () => {
      window.clearTimeout(t)
      clearNavigationLock()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('focusin', onFocusOrPointer, true)
      document.removeEventListener('pointerdown', onFocusOrPointer, true)
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
    }
  }, [syncActive, sections, publishActive, clearNavigationLock, isControlledHighlight])

  const resolvedActiveKey = isControlledHighlight ? highlightKey : activeKey
  const visible = sections.filter((s) => s.visible !== false)
  const activeIndex = visible.findIndex((s) => s.key === resolvedActiveKey)
  const positionLabel =
    activeIndex >= 0 ? `${activeIndex + 1} / ${visible.length}` : `– / ${visible.length}`
  const handleNavigate = (key: string) => {
    if (!isControlledHighlight) lockNavigation(key)
    onNavigate(key)
  }

  return (
    <aside
      className={cn(
        'sticky z-20 hidden max-h-[calc(100dvh-4rem)] w-[9.25rem] shrink-0 self-start flex-col rounded-lg border border-border bg-muted/25 p-2 shadow-sm backdrop-blur-sm sm:w-40 lg:flex xl:w-44',
        stickyTopClass,
      )}
    >
      <div className="mb-1.5 flex shrink-0 items-center justify-between px-0.5">
        <p className="text-[0.58rem] font-semibold uppercase tracking-widest text-muted-foreground">
          {navTitle}
        </p>
        <span
          className="rounded-full bg-primary/10 px-1 py-px text-[0.55rem] font-semibold tabular-nums text-primary"
          title="Current section in the list"
        >
          {positionLabel}
        </span>
      </div>

      <nav
        aria-label="Form sections"
        className="relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-0.5"
      >
        {visible.map((sec) => {
          const isCurrent = resolvedActiveKey === sec.key
          const isOpen = !isControlledHighlight && !!openSections[sec.key]
          const isCompleted = completedSections.has(sec.key)
          const isPending = pendingSections?.has(sec.key) ?? false
          const hasError = hasErrorSections.has(sec.key)
          const isVisited = visitedSections.has(sec.key)
          const Icon = sec.icon

          return (
            <button
              key={sec.key}
              type="button"
              onClick={() => handleNavigate(sec.key)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-describedby={isCurrent && sec.hint ? `form-nav-hint-${sec.key}` : undefined}
              title={
                !isCurrent
                  ? (isPending ? 'Waiting for verification' : sec.hint)
                  : undefined
              }
              className={cn(
                'group relative flex w-full flex-col rounded-lg py-1.5 pl-2.5 pr-2 text-left text-[0.7rem] leading-tight sm:text-xs',
                isCurrent
                  ? 'form-section-nav-active font-medium text-foreground'
                  : isOpen
                    ? 'text-foreground hover:bg-muted/50'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              )}
            >
              <span className="relative z-[1] flex w-full items-center gap-1.5">
                {!isCurrent ? (
                  <span className="shrink-0" aria-hidden>
                    {hasError ? (
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-950/60 dark:text-red-300">
                        <span className="text-[9px] font-bold">!</span>
                      </span>
                    ) : isCompleted ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : isPending ? (
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                    ) : isVisited ? (
                      <Circle className="h-3.5 w-3.5 text-amber-400" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-border" />
                    )}
                  </span>
                ) : null}

                <Icon
                  className={cn(
                    'h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5',
                    isCurrent
                      ? 'text-primary'
                      : isOpen
                        ? 'text-primary/80'
                        : 'text-muted-foreground group-hover:text-foreground',
                  )}
                  strokeWidth={isCurrent ? 2.25 : 2}
                />

                <span className={cn('min-w-0 flex-1 truncate leading-tight', isCurrent && 'text-foreground')}>
                  {sec.label}
                </span>
              </span>

              {showActiveHintInNav && isCurrent && sec.hint && (
                <p
                  id={`form-nav-hint-${sec.key}`}
                  className="relative z-[1] mt-0.5 line-clamp-2 pl-[1.35rem] pr-0.5 text-[0.55rem] font-normal leading-snug text-muted-foreground sm:text-[0.58rem]"
                >
                  {sec.hint}
                </p>
              )}
            </button>
          )
        })}
      </nav>

      <div
        className="mt-1.5 shrink-0 border-t border-border/60 pt-1.5"
        aria-label="Section status guide"
      >
        <p className="mb-1 px-0.5 text-[0.5rem] font-semibold uppercase tracking-widest text-muted-foreground/90">
          Status key
        </p>
        <ul className="grid grid-cols-2 gap-0.5 text-[0.5rem] leading-tight sm:text-[0.52rem]">
          <li className="flex items-center gap-1 rounded bg-emerald-500/12 px-1 py-0.5 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
            <span className="font-medium">Done</span>
          </li>
          <li className="flex items-center gap-1 rounded bg-amber-500/12 px-1 py-0.5 text-amber-900 dark:text-amber-200">
            <Circle className="h-3 w-3 shrink-0 text-amber-500" aria-hidden />
            <span className="font-medium">Opened</span>
          </li>
          <li className="flex items-center gap-1 rounded bg-amber-500/10 px-1 py-0.5 text-amber-900 dark:text-amber-200">
            <Clock className="h-3 w-3 shrink-0 text-amber-500" aria-hidden />
            <span className="font-medium">Waiting</span>
          </li>
          <li className="flex items-center gap-1 rounded bg-slate-500/10 px-1 py-0.5 text-slate-600 dark:text-slate-300">
            <Circle className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            <span className="font-medium">New</span>
          </li>
          <li className="flex items-center gap-1 rounded bg-red-500/12 px-1 py-0.5 text-red-800 dark:text-red-300">
            <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-red-500 text-[7px] font-bold text-white">
              !
            </span>
            <span className="font-medium">Error</span>
          </li>
        </ul>
      </div>
    </aside>
  )
}
