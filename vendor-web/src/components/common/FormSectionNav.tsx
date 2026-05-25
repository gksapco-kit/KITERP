import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ElementType, ReactNode, ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { formatFormFieldError } from '@/lib/formFieldErrors'
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'
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
  pageGap: 'flex flex-col gap-1.5 sm:gap-2',
  cardBody: 'p-2.5 sm:p-3 space-y-1.5 sm:space-y-2',
  cardBodyTight: 'p-2 sm:p-2.5 space-y-1 sm:space-y-1.5',
  sectionHeader: 'flex items-center gap-1.5 mb-0.5',
  sectionHeaderIcon: 'h-3.5 w-3.5 shrink-0 text-muted-foreground',
  sectionHeaderTitle: 'text-xs font-semibold text-foreground sm:text-sm',
  fieldGrid:
    'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-2 sm:gap-x-3 gap-y-1 sm:gap-y-1.5',
  fieldGrid4:
    'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-2 sm:gap-x-3 gap-y-1 sm:gap-y-1.5',
  fieldGrid2:
    'grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-2 sm:gap-x-3 gap-y-1 sm:gap-y-1.5',
  scrollMarginView: 'scroll-mt-14 sm:scroll-mt-[4.5rem]',
  scrollMarginEdit: 'scroll-mt-[5.25rem] sm:scroll-mt-[7rem]',
  mediaDropzone:
    'w-full cursor-pointer rounded-md border-2 border-dashed p-2.5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/30 sm:p-3',
} as const

/** Create / edit form density — scales with viewport and zoom via rem + breakpoints. */
export const formEditLayout = {
  pageStack: formDisplayCompact.pageGap,
  formStack: 'w-full flex flex-col gap-1.5 sm:gap-2',
  sectionBody: 'space-y-1.5 pt-1 sm:space-y-2 sm:pt-1.5',
  fieldGrid: formDisplayCompact.fieldGrid2,
  fieldGridWide:
    'grid grid-cols-1 min-[400px]:grid-cols-2 min-[720px]:grid-cols-3 min-[960px]:grid-cols-4 gap-x-2 sm:gap-x-3 gap-y-1 sm:gap-y-1.5',
  mediaCard: 'p-2 sm:p-2.5',
  mediaTitle: 'mb-0.5 text-xs font-semibold sm:text-sm',
  mediaDrop:
    'w-full rounded-md border-2 border-dashed p-2.5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/30 sm:p-3',
  typeBanner: 'flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs leading-snug sm:text-sm',
  sectionHeaderBtn:
    'flex w-full items-center justify-between gap-1.5 px-2.5 py-1.5 text-left sm:px-3 sm:py-2',
  sectionContent: 'border-t px-2.5 pb-2 pt-0 sm:px-3 sm:pb-2.5',
  stickyBar:
    'sticky top-14 z-20 mb-1.5 border-b bg-white/95 px-2.5 py-1.5 shadow-sm backdrop-blur sm:mb-2 sm:px-3 sm:py-2',
  variantCard: 'space-y-1.5 rounded-lg border px-2.5 py-2 sm:space-y-2 sm:px-3 sm:py-2.5',
} as const

export const formSelectClass =
  'flex h-8 min-h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring sm:h-9 sm:px-2.5 sm:text-sm'

export const formTextareaClass =
  'flex w-full min-h-[3rem] resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[3.5rem] sm:px-2.5 sm:text-sm'

export const formFieldShellClass =
  'space-y-0.5 rounded-md border border-transparent px-1 py-0.5 -mx-1 transition-colors focus-within:border-primary/35 focus-within:bg-primary/[0.04] focus-within:ring-1 focus-within:ring-primary/25'

export const formLabelClass =
  'text-[0.6875rem] font-medium leading-tight text-muted-foreground sm:text-xs'

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
        invalid && 'border-red-300/80 bg-red-50/40 focus-within:border-red-400 focus-within:ring-red-200/80',
        className,
      )}
    >
      <Label className={formLabelClass}>
        {label}
        {required && ' *'}
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
  '[&_input:not([type=checkbox]):not([type=radio])]:h-8 [&_input:not([type=checkbox]):not([type=radio])]:min-h-8 [&_input:not([type=checkbox]):not([type=radio])]:py-1 [&_input:not([type=checkbox]):not([type=radio])]:text-xs sm:[&_input:not([type=checkbox]):not([type=radio])]:h-9 sm:[&_input:not([type=checkbox]):not([type=radio])]:text-sm'

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

// ── FormPageWithNav ──────────────────────────────────────────────────────────

type FormPageWithNavProps = {
  children: ReactNode
  nav: ReactNode
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
  onNavigate: (key: string) => void
  /** Called when scroll-spy changes the active section. */
  onActiveSectionChange?: (key: string | null) => void
  /** Pixels from viewport top to treat as the “reading line” (dashboard + optional form bar). */
  scrollOffset?: number
  /** Tailwind top class for sticky aside (view: top-14, edit with form bar: top-[7rem]). */
  stickyTopClass?: string
}

export function FormSectionNav({
  sections,
  openSections,
  visitedSections,
  completedSections,
  hasErrorSections,
  onNavigate,
  onActiveSectionChange,
  scrollOffset = 88,
  stickyTopClass = 'top-[7rem]',
}: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const onActiveRef = useRef(onActiveSectionChange)
  onActiveRef.current = onActiveSectionChange

  const publishActive = useCallback((key: string | null) => {
    setActiveKey((prev) => {
      if (prev !== key) onActiveRef.current?.(key)
      return key
    })
  }, [])

  const syncActive = useCallback(() => {
    const focusKey = resolveActiveFormSectionFromFocus(sections, document.activeElement)
    if (focusKey) {
      publishActive(focusKey)
      return
    }
    publishActive(resolveActiveFormSectionKey(sections, scrollOffset))
  }, [sections, scrollOffset, publishActive])

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current != null) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        syncActive()
      })
    }

    const onFocusOrPointer = (e: Event) => {
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
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('focusin', onFocusOrPointer, true)
      document.removeEventListener('pointerdown', onFocusOrPointer, true)
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
    }
  }, [syncActive, sections, publishActive])

  const visible = sections.filter((s) => s.visible !== false)
  const activeIndex = visible.findIndex((s) => s.key === activeKey)
  const positionLabel =
    activeIndex >= 0 ? `${activeIndex + 1} / ${visible.length}` : `– / ${visible.length}`
  const handleNavigate = (key: string) => {
    publishActive(key)
    onNavigate(key)
  }

  return (
    <aside
      className={cn(
        'sticky hidden max-h-[calc(100dvh-3.5rem)] w-[9.25rem] shrink-0 flex-col sm:w-40 lg:flex xl:w-44',
        stickyTopClass,
      )}
    >
      <div className="mb-1.5 flex shrink-0 items-center justify-between px-1.5">
        <p className="text-[0.58rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Quick Navigation
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
        className="relative flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overscroll-contain pr-0.5"
      >
        {visible.map((sec) => {
          const isCurrent = activeKey === sec.key
          const isOpen = !!openSections[sec.key]
          const isCompleted = completedSections.has(sec.key)
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
              title={!isCurrent ? sec.hint : undefined}
              className={cn(
                'group relative flex w-full flex-col rounded-md py-1 pl-2 pr-1.5 text-left text-[0.7rem] leading-tight transition-all sm:text-xs',
                isCurrent
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/30 ring-1 ring-primary/40'
                  : isOpen
                    ? 'bg-primary/5 text-foreground hover:bg-primary/10'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {isCurrent && (
                <span
                  aria-hidden
                  className="absolute -left-1 top-2 bottom-2 w-1 rounded-full bg-primary"
                />
              )}

              <span className="flex w-full items-center gap-1.5">
                <span className="shrink-0" aria-hidden>
                  {hasError ? (
                    <span
                      className={cn(
                        'flex h-3.5 w-3.5 items-center justify-center rounded-full',
                        isCurrent ? 'bg-white/20 text-white' : 'bg-red-100 text-red-500',
                      )}
                    >
                      <span className="text-[9px] font-bold">!</span>
                    </span>
                  ) : isCompleted ? (
                    <CheckCircle2
                      className={cn('h-3.5 w-3.5', isCurrent ? 'text-primary-foreground' : 'text-emerald-500')}
                    />
                  ) : isVisited ? (
                    <Circle
                      className={cn('h-3.5 w-3.5', isCurrent ? 'text-primary-foreground/80' : 'text-amber-400')}
                    />
                  ) : (
                    <Circle
                      className={cn('h-3.5 w-3.5', isCurrent ? 'text-primary-foreground/60' : 'text-border')}
                    />
                  )}
                </span>

                <Icon
                  className={cn(
                    'h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5',
                    isCurrent
                      ? 'text-primary-foreground'
                      : isOpen
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-foreground',
                  )}
                  strokeWidth={2}
                />

                <span className="min-w-0 flex-1 truncate leading-tight">{sec.label}</span>

                {isCurrent && <ChevronRight className="h-3 w-3 shrink-0" />}
              </span>

              {isCurrent && sec.hint && (
                <p
                  id={`form-nav-hint-${sec.key}`}
                  className={cn(
                    'mt-0.5 line-clamp-2 pl-[1.35rem] pr-0.5 text-[0.55rem] font-normal leading-snug sm:text-[0.58rem]',
                    isCurrent ? 'text-primary-foreground/90' : 'text-muted-foreground',
                  )}
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
            <span className="font-medium">Active</span>
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
