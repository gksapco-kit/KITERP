import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'

/** Minimum score before a slot can take focus (0–1). */
const MIN_SCORE = 0.12
/** New slot must beat the current one by this margin to switch (reduces jitter while scrolling). */
const SWITCH_MARGIN = 0.08

type PlayerContextValue = {
  reportScore: (id: string, score: number) => void
  activeId: string
}

const CampaignDemoPlayerContext = createContext<PlayerContextValue | null>(null)

function computeVisibilityScore(entry: IntersectionObserverEntry): number {
  if (!entry.isIntersecting) return 0

  const rect = entry.boundingClientRect
  const viewportHeight = window.innerHeight || 1
  const viewportCenter = viewportHeight / 2
  const elementCenter = rect.top + rect.height / 2
  const distance = Math.abs(viewportCenter - elementCenter)
  const maxDistance = viewportHeight * 0.52
  const centerScore = Math.max(0, 1 - distance / maxDistance)

  return Math.min(1, entry.intersectionRatio * 0.35 + centerScore * 0.65)
}

type ProviderProps = {
  defaultActiveId: string
  children: ReactNode
}

export function CampaignDemoPlayerProvider({ defaultActiveId, children }: ProviderProps) {
  const [scores, setScores] = useState<Record<string, number>>({})
  const stickyActiveRef = useRef(defaultActiveId)

  const reportScore = useCallback((id: string, score: number) => {
    setScores((prev) => {
      const rounded = Math.round(score * 1000) / 1000
      if (prev[id] === rounded) return prev
      return { ...prev, [id]: rounded }
    })
  }, [])

  const activeId = useMemo(() => {
    const entries = Object.entries(scores).filter(([, score]) => score >= MIN_SCORE)
    if (entries.length === 0) return stickyActiveRef.current || defaultActiveId

    let bestId = entries[0][0]
    let bestScore = entries[0][1]
    for (const [id, score] of entries) {
      if (score > bestScore) {
        bestScore = score
        bestId = id
      }
    }

    const current = stickyActiveRef.current
    const currentScore = scores[current] ?? 0

    if (
      current &&
      current !== bestId &&
      currentScore >= MIN_SCORE &&
      bestScore - currentScore < SWITCH_MARGIN
    ) {
      return current
    }

    stickyActiveRef.current = bestId
    return bestId
  }, [scores, defaultActiveId])

  useEffect(() => {
    stickyActiveRef.current = defaultActiveId
  }, [defaultActiveId])

  const value = useMemo(
    () => ({ reportScore, activeId }),
    [reportScore, activeId],
  )

  return (
    <CampaignDemoPlayerContext.Provider value={value}>
      {children}
    </CampaignDemoPlayerContext.Provider>
  )
}

type SlotProps = {
  id: string
  className?: string
  as?: 'div' | 'section'
  sectionId?: string
  children: (state: { isActive: boolean }) => ReactNode
}

/** Tracks scroll — only the section nearest the viewport center plays its short. */
export function CampaignDemoSlot({ id, className = '', as = 'div', sectionId, children }: SlotProps) {
  const ctx = useContext(CampaignDemoPlayerContext)
  const ref = useRef<HTMLDivElement | null>(null)
  const isActive = ctx ? ctx.activeId === id : true
  const Tag = as

  useEffect(() => {
    if (!ctx) return
    const el = ref.current
    if (!el) return

    const report = (entry: IntersectionObserverEntry | undefined) => {
      ctx.reportScore(id, entry ? computeVisibilityScore(entry) : 0)
    }

    const observer = new IntersectionObserver(
      ([entry]) => report(entry),
      {
        threshold: [0, 0.08, 0.15, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
        rootMargin: '-6% 0px -6% 0px',
      },
    )

    observer.observe(el)

    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const viewportHeight = window.innerHeight || 1
      const visibleTop = Math.max(0, rect.top)
      const visibleBottom = Math.min(viewportHeight, rect.bottom)
      const visibleHeight = Math.max(0, visibleBottom - visibleTop)
      const ratio = visibleHeight / Math.max(rect.height, 1)

      if (ratio <= 0) {
        ctx.reportScore(id, 0)
        return
      }

      const viewportCenter = viewportHeight / 2
      const elementCenter = rect.top + rect.height / 2
      const distance = Math.abs(viewportCenter - elementCenter)
      const centerScore = Math.max(0, 1 - distance / (viewportHeight * 0.52))
      ctx.reportScore(id, Math.min(1, ratio * 0.35 + centerScore * 0.65))
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ctx.reportScore(id, 0)
    }
  }, [ctx, id])

  return (
    <Tag
      ref={ref as Ref<HTMLElement>}
      id={sectionId}
      data-campaign-demo-slot={id}
      className={`${className}${isActive ? ' is-campaign-demo-active' : ' is-campaign-demo-paused'}`.trim()}
    >
      {children({ isActive })}
    </Tag>
  )
}
