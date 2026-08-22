import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { CampaignMockupVariant, ModuleCampaignFeature } from './moduleCampaignContent'
import type { LandingModule } from './landingData'
import { getCampaignSceneDisplay, getSceneNavConfig, resolveCampaignDemoScene } from './campaignDemoScenes'
import { CampaignDemoShell, getDemoUrlPath } from './CampaignDemoShell'
import { DemoSceneContent } from './KiterpDemoContent'
import { ClickSparkleLayer, spawnSparkle, type SparkleBurst } from './ClickSparkle'
import { isDemoNavElement, readDemoNavItem } from './campaignDemoNav'

const TOUR_MS = 5200
const TOUR_START_DELAY_MS = 320

const TOUR_SPOT_SELECTOR = [
  '.kiterp-campaign-demo-nav-item',
  '.kiterp-campaign-demo-topnav-item',
  '.kiterp-campaign-demo-mobile-tab',
  '.democ-tile',
  '.democ-crm-card',
  '.democ-product',
  '.democ-tr:not(.democ-thead)',
  '.democ-pos-btn',
  '.democ-palette-item',
  '.democ-pos-pay',
  '.democ-bar',
  '.democ-inbox-item',
  '.democ-workspace-tile',
  '.democ-form-row',
  '.democ-inbox-btn',
  '.democ-block',
  '.democ-seo-post',
  '.democ-seo-preview',
  '.democ-storefront-product',
  '.democ-hr-row',
  '.democ-analytics-row',
  '.democ-production-card',
  '.democ-settings-row',
  '.democ-settings-module',
  '.democ-pages-row',
  '.democ-publish-btn',
].join(', ')

function panelStyle(module: LandingModule): CSSProperties {
  return {
    ['--module-accent' as string]: module.accent.accent,
    ['--module-glow' as string]: module.accent.glow,
    ['--module-panel-tint' as string]: module.accent.panelTint,
  }
}

function DemoCursor({ x, y, pressing }: { x: number; y: number; pressing: boolean }) {
  return (
    <div
      className={`kiterp-demo-cursor${pressing ? ' is-pressing' : ''}`}
      style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
      aria-hidden
    >
      <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
        <path
          d="M2 2 L2 18 L6.5 13.5 L10 20 L12.5 18.5 L9 12 L15 11 Z"
          fill="#1e3d34"
          stroke="#fff"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function ExplainerPopup({
  icon: Icon,
  title,
  points,
}: {
  icon: LucideIcon
  title: string
  points: string[]
}) {
  return (
    <div className="kiterp-demo-popup kiterp-campaign-demo-popup" aria-hidden>
      <div className="kiterp-demo-popup-head">
        <span className="kiterp-demo-popup-icon">
          <Icon className="w-3.5 h-3.5" />
        </span>
        <span className="kiterp-demo-popup-title">{title}</span>
      </div>
      <ul className="kiterp-demo-popup-list">
        {points.map((p) => (
          <li key={p}>
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

type Props = {
  module: LandingModule
  variant: CampaignMockupVariant
  feature?: Pick<ModuleCampaignFeature, 'id' | 'eyebrow' | 'title' | 'accentPhrase' | 'body' | 'bullets' | 'mockup'>
  hero?: boolean
  isActive?: boolean
}

export function ModuleCampaignAnimatedDemo({
  module,
  variant,
  feature,
  hero = false,
  isActive = true,
}: Props) {
  const sceneId = resolveCampaignDemoScene(module.id, variant, { hero, feature })
  const display = getCampaignSceneDisplay(sceneId, module, feature)
  const navConfig = getSceneNavConfig(sceneId, module, display.navLabel)
  const SceneIcon = display.icon
  const layoutKey = `${sceneId}-${feature?.id ?? 'hero'}`

  const [activeMenuItem, setActiveMenuItem] = useState(navConfig.active)
  const urlPath = getDemoUrlPath(sceneId, module, display.navLabel, activeMenuItem)

  const frameRef = useRef<HTMLDivElement>(null)
  const tourRafRef = useRef(0)
  const tourPosRef = useRef<{ x: number; y: number } | null>(null)
  const tourTargetRef = useRef<{ x: number; y: number } | null>(null)
  const tourMovingRef = useRef(false)
  const stepTimersRef = useRef<number[]>([])
  const loopTimerRef = useRef<number | null>(null)
  const activeSpotRef = useRef<HTMLElement | null>(null)
  const tourGenerationRef = useRef(0)
  const isActiveRef = useRef(isActive)

  const [sparks, setSparks] = useState<SparkleBurst[]>([])
  const [tourCursor, setTourCursor] = useState<{ x: number; y: number; pressing: boolean } | null>(null)
  const [playGeneration, setPlayGeneration] = useState(0)

  isActiveRef.current = isActive

  const selectMenuItem = useCallback((item: string) => {
    setActiveMenuItem(item)
  }, [])

  useEffect(() => {
    setActiveMenuItem(navConfig.active)
  }, [sceneId, feature?.id, navConfig.active])

  const applyNavFromElement = useCallback((el: HTMLElement) => {
    const item = readDemoNavItem(el)
    if (item) selectMenuItem(item)
  }, [selectMenuItem])

  const clearStepTimers = useCallback(() => {
    stepTimersRef.current.forEach((t) => window.clearTimeout(t))
    stepTimersRef.current = []
    if (activeSpotRef.current) {
      activeSpotRef.current.classList.remove('is-demo-spotlight')
      activeSpotRef.current = null
    }
  }, [])

  const clearLoopTimer = useCallback(() => {
    if (loopTimerRef.current !== null) {
      window.clearInterval(loopTimerRef.current)
      loopTimerRef.current = null
    }
  }, [])

  const resetTourVisuals = useCallback(() => {
    tourPosRef.current = null
    tourTargetRef.current = null
    tourMovingRef.current = false
    setTourCursor(null)
    setSparks([])
    clearStepTimers()
    clearLoopTimer()
  }, [clearLoopTimer, clearStepTimers])

  const moveTourTo = useCallback((el: HTMLElement | null) => {
    if (!el || !frameRef.current || !isActiveRef.current) return
    const r = el.getBoundingClientRect()
    const f = frameRef.current.getBoundingClientRect()
    const x = r.left - f.left + r.width * 0.52 + 3
    const y = r.top - f.top + r.height * 0.5 + 1
    tourTargetRef.current = { x, y }
    if (!tourPosRef.current) {
      tourPosRef.current = { x, y }
      setTourCursor({ x, y, pressing: false })
    }
    tourMovingRef.current = true
  }, [])

  const highlightSpot = useCallback((el: HTMLElement) => {
    if (activeSpotRef.current && activeSpotRef.current !== el) {
      activeSpotRef.current.classList.remove('is-demo-spotlight')
    }
    el.classList.add('is-demo-spotlight')
    activeSpotRef.current = el
  }, [])

  const collectTourStops = useCallback((frame: HTMLElement): HTMLElement[] => {
    const stops: HTMLElement[] = []
    const seen = new Set<HTMLElement>()

    const add = (el: HTMLElement | null) => {
      if (!el || seen.has(el)) return
      seen.add(el)
      stops.push(el)
    }

    frame.querySelectorAll<HTMLElement>('.kiterp-campaign-demo-topnav-item').forEach((tab) => add(tab))
    frame.querySelectorAll<HTMLElement>('.kiterp-campaign-demo-nav-item').forEach((tab) => add(tab))
    frame.querySelectorAll<HTMLElement>('.kiterp-campaign-demo-mobile-tab').forEach((tab) => add(tab))

    const navSpot = frame.querySelector<HTMLElement>(
      '.kiterp-campaign-demo-nav-item.is-active, .kiterp-campaign-demo-mobile-tab.is-active',
    )
    add(navSpot)

    Array.from(frame.querySelectorAll<HTMLElement>(TOUR_SPOT_SELECTOR))
      .filter((el) => !el.classList.contains('is-active'))
      .slice(0, 4)
      .forEach((el) => add(el))

    return stops.slice(0, 6)
  }, [])

  const runSceneTour = useCallback(() => {
    if (!isActiveRef.current) return
    clearStepTimers()

    const frame = frameRef.current
    if (!frame) return

    const stops = collectTourStops(frame)
    if (stops.length === 0) return

    const per = TOUR_MS / (stops.length + 0.4)
    stops.forEach((el, index) => {
      const timer = window.setTimeout(() => {
        if (!isActiveRef.current) return
        moveTourTo(el)
        highlightSpot(el)
        if (isDemoNavElement(el)) {
          window.setTimeout(() => applyNavFromElement(el), Math.round(per * 0.72))
        }
      }, Math.round(index * per))
      stepTimersRef.current.push(timer)
    })
  }, [applyNavFromElement, clearStepTimers, collectTourStops, highlightSpot, moveTourTo])

  const startTourLoop = useCallback(async () => {
    if (!isActiveRef.current) return

    tourGenerationRef.current += 1
    const generation = tourGenerationRef.current
    resetTourVisuals()

    await waitForLayout()
    if (generation !== tourGenerationRef.current || !isActiveRef.current) return

    runSceneTour()

    loopTimerRef.current = window.setInterval(() => {
      if (generation !== tourGenerationRef.current || !isActiveRef.current) return
      runSceneTour()
    }, TOUR_MS + 500)
  }, [resetTourVisuals, runSceneTour])

  useEffect(() => {
    if (!isActive) {
      resetTourVisuals()
      return
    }

    const tick = () => {
      if (!isActiveRef.current) return

      const pos = tourPosRef.current
      const target = tourTargetRef.current

      if (pos && target) {
        const dx = target.x - pos.x
        const dy = target.y - pos.y
        const dist = Math.hypot(dx, dy)

        if (dist > 1.2) {
          const speed = Math.min(0.55, 0.18 + dist * 0.007)
          pos.x += dx * speed
          pos.y += dy * speed
          tourMovingRef.current = true
          setTourCursor({ x: pos.x, y: pos.y, pressing: false })
        } else if (tourMovingRef.current) {
          pos.x = target.x
          pos.y = target.y
          tourMovingRef.current = false
          spawnSparkle(setSparks, pos.x, pos.y)
          setTourCursor({ x: pos.x, y: pos.y, pressing: true })
          window.setTimeout(() => {
            setTourCursor((current) => (current ? { ...current, pressing: false } : current))
          }, 200)
        }
      }

      tourRafRef.current = requestAnimationFrame(tick)
    }

    tourRafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(tourRafRef.current)
  }, [isActive, resetTourVisuals])

  useEffect(() => {
    if (!isActive) {
      resetTourVisuals()
      return
    }

    const startTimer = window.setTimeout(() => {
      setPlayGeneration((g) => g + 1)
    }, TOUR_START_DELAY_MS)

    return () => {
      window.clearTimeout(startTimer)
    }
  }, [sceneId, feature?.id, isActive, resetTourVisuals])

  useEffect(() => {
    if (!isActive || playGeneration === 0) return
    startTourLoop()
    return () => {
      tourGenerationRef.current += 1
      resetTourVisuals()
    }
  }, [isActive, playGeneration, startTourLoop, resetTourVisuals])

  const useMobileDevice = variant === 'mobile' || sceneId === 'workspace'

  const frame = (
    <div
      ref={frameRef}
      className={`kiterp-demo-frame kiterp-campaign-demo-frame${isActive ? ' is-playing' : ' is-paused'}${useMobileDevice ? ' kiterp-campaign-demo-frame--mobile' : ''}`}
    >
      <div className="kiterp-demo-chrome">
        <span className="kiterp-demo-dot" />
        <span className="kiterp-demo-dot" />
        <span className="kiterp-demo-dot" />
        <span className="kiterp-demo-url">app.kiterp.com / {urlPath}</span>
      </div>

      <div className="kiterp-campaign-demo-body">
        <CampaignDemoShell
          sceneId={sceneId}
          module={module}
          navLabel={display.navLabel}
          pageTitle={feature ? display.title : undefined}
          layoutKey={layoutKey}
          activeMenuItem={activeMenuItem}
          onMenuItemChange={selectMenuItem}
          interactive={isActive}
        >
          <div className="kiterp-campaign-demo-view">
            <DemoSceneContent sceneId={sceneId} activeMenuItem={activeMenuItem} />
          </div>
        </CampaignDemoShell>
      </div>

      {playGeneration > 0 ? (
        <div key={`wipe-${layoutKey}-${playGeneration}`} className="kiterp-demo-wipe kiterp-campaign-demo-wipe" aria-hidden />
      ) : null}

      <ExplainerPopup icon={SceneIcon} title={display.popupTitle} points={display.popupPoints} />
      {isActive ? <ClickSparkleLayer sparks={sparks} /> : null}
      {isActive && tourCursor ? (
        <DemoCursor x={tourCursor.x} y={tourCursor.y} pressing={tourCursor.pressing} />
      ) : null}
      <div className="kiterp-demo-playing-badge">{isActive ? 'Live preview' : 'Scroll to play'}</div>
    </div>
  )

  return (
    <div
      className={`kiterp-campaign-demo-shell${useMobileDevice ? ' kiterp-campaign-demo-shell--mobile' : ''}`}
      style={panelStyle(module)}
    >
      {useMobileDevice ? <div className="kiterp-campaign-demo-mobile-device">{frame}</div> : frame}
    </div>
  )
}
