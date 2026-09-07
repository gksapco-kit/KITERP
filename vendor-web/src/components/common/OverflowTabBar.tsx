import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ElementType } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'

export type OverflowTabItem<K extends string = string> = {
  key: K
  label: string
  icon?: ElementType
  group?: string
}

function tabButtonClass(active: boolean) {
  return cn(
    'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
    active
      ? 'border-primary text-primary'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  )
}

/**
 * Single-row tab list. Tabs that do not fit are moved into a More menu
 * pinned to the right — no horizontal scrollbar.
 */
export function OverflowTabBar<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: OverflowTabItem<K>[]
  value: K
  onChange: (key: K) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(tabs.length)
  const [moreOpen, setMoreOpen] = useState(false)

  const recalcVisible = useCallback(() => {
    const row = rowRef.current
    const measure = measureRef.current
    if (!row || !measure) return

    const tabEls = measure.querySelectorAll<HTMLElement>('[data-tab-measure]')
    const moreEl = measure.querySelector<HTMLElement>('[data-more-measure]')
    if (!tabEls.length) {
      setVisibleCount(tabs.length)
      return
    }

    const available = row.clientWidth
    const moreW = moreEl?.offsetWidth ?? 88
    const gap = 2
    let total = 0
    tabEls.forEach((el, i) => {
      total += el.offsetWidth + (i > 0 ? gap : 0)
    })

    if (total <= available) {
      setVisibleCount(tabs.length)
      return
    }

    const widths = Array.from(tabEls, (el) => el.offsetWidth)
    const space = Math.max(0, available - moreW - gap)

    const countFromStart = (limit: number, maxIdx = widths.length) => {
      let used = 0
      let count = 0
      for (let i = 0; i < maxIdx; i++) {
        const w = widths[i] + (count > 0 ? gap : 0)
        if (used + w > limit && count > 0) break
        used += w
        count++
      }
      return count
    }

    let count = Math.max(1, Math.min(countFromStart(space), tabs.length - 1))
    const selectedIndex = tabs.findIndex((t) => t.key === value)
    // Keep the open report in the visible row even when it would otherwise sit in More.
    if (selectedIndex >= count) {
      const selectedW = widths[selectedIndex] ?? 0
      const headSpace = Math.max(0, available - moreW - gap - selectedW - gap)
      const head = Math.min(countFromStart(headSpace, selectedIndex), Math.max(0, count - 1))
      count = Math.max(1, head + 1)
    }
    setVisibleCount(count)
  }, [tabs, value])

  useLayoutEffect(() => {
    recalcVisible()
    const row = rowRef.current
    if (!row) return
    const ro = new ResizeObserver(() => recalcVisible())
    ro.observe(row)
    return () => ro.disconnect()
  }, [recalcVisible])

  useEffect(() => {
    if (!moreOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [moreOpen])

  useEscapeToClose(() => setMoreOpen(false), moreOpen)

  const { visible, overflow } = useMemo(() => {
    const selectedIndex = tabs.findIndex((t) => t.key === value)
    if (visibleCount >= tabs.length) {
      return { visible: tabs, overflow: [] as OverflowTabItem<K>[] }
    }
    if (selectedIndex >= visibleCount) {
      const head = tabs.slice(0, Math.max(0, visibleCount - 1))
      const selected = tabs[selectedIndex]
      const visibleTabs = selected ? [...head, selected] : head
      const visibleKeys = new Set(visibleTabs.map((t) => t.key))
      return {
        visible: visibleTabs,
        overflow: tabs.filter((t) => !visibleKeys.has(t.key)),
      }
    }
    return {
      visible: tabs.slice(0, visibleCount),
      overflow: tabs.slice(visibleCount),
    }
  }, [tabs, value, visibleCount])
  const selectedInOverflow = overflow.some((t) => t.key === value)
  const selectedTab = tabs.find((t) => t.key === value)
  const moreLabel = selectedInOverflow && selectedTab ? selectedTab.label : 'More'
  const MoreIcon = selectedInOverflow ? selectedTab?.icon : undefined

  const renderTab = (item: OverflowTabItem<K>) => {
    const Icon = item.icon
    return (
      <button
        type="button"
        title={item.label}
        aria-current={item.key === value ? 'page' : undefined}
        onClick={() => onChange(item.key)}
        className={tabButtonClass(item.key === value)}
      >
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
        {item.label}
      </button>
    )
  }

  return (
    <div className="relative min-w-0">
      <div
        ref={measureRef}
        className="pointer-events-none invisible absolute flex items-center gap-0.5"
        aria-hidden
      >
        {tabs.map((item, idx) => {
          const prevGroup = idx > 0 ? tabs[idx - 1].group : null
          const showSep =
            prevGroup !== null && item.group !== prevGroup && item.group !== ''
          const Icon = item.icon
          return (
            <div key={item.key} className="flex items-center" data-tab-measure="">
              {showSep && <div className="mx-1 h-5 w-px bg-border" />}
              <span className={tabButtonClass(false)}>
                {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
                {item.label}
              </span>
            </div>
          )
        })}
        <span data-more-measure="" className={tabButtonClass(false)}>
          More
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </span>
      </div>

      <div ref={rowRef} className="flex min-w-0 items-center border-b">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
          {visible.map((item, idx) => {
            const prevGroup = idx > 0 ? visible[idx - 1].group : null
            const showSep =
              prevGroup !== null && item.group !== prevGroup && item.group !== ''
            return (
              <div key={item.key} className="flex shrink-0 items-center">
                {showSep && <div className="mx-1 h-5 w-px bg-border" />}
                {renderTab(item)}
              </div>
            )
          })}
        </div>

        {overflow.length > 0 ? (
          <div ref={moreRef} className="relative shrink-0">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-label={selectedInOverflow ? `More reports, current: ${moreLabel}` : 'More reports'}
              title={selectedInOverflow ? moreLabel : 'More reports'}
              onClick={() => setMoreOpen((open) => !open)}
              className={tabButtonClass(selectedInOverflow)}
            >
              {MoreIcon ? <MoreIcon className="h-3.5 w-3.5 shrink-0" /> : null}
              {moreLabel}
              <ChevronDown
                className={cn('h-3.5 w-3.5 shrink-0 transition-transform', moreOpen && 'rotate-180')}
              />
            </button>
            {moreOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 min-w-[13rem] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
              >
                {overflow.map((item, idx) => {
                  const prev = overflow[idx - 1]
                  const showGroup =
                    item.group && item.group !== prev?.group
                  const Icon = item.icon
                  const active = item.key === value
                  return (
                    <div key={item.key}>
                      {showGroup ? (
                        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {item.group}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onChange(item.key)
                          setMoreOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                          active ? 'font-medium text-primary' : 'text-foreground',
                        )}
                      >
                        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
                        <span className="min-w-0 flex-1">{item.label}</span>
                        {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
