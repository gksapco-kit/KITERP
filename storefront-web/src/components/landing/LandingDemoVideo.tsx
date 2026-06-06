import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Pause, Play, Store } from 'lucide-react'
import {
  ClickSparkleLayer,
  HoverSparkleAtCursor,
  spawnSparkle,
  type SparkleBurst,
} from './ClickSparkle'
import { DEMO_SCENE_MS, KITERP_DEMO_SCENES } from './kiterpDemoScenes'
import { DemoSceneContent } from './KiterpDemoContent'
import { useDemoCursor } from './useDemoCursor'

const VIDEO_WEBM = '/landing/kiterp-homepage.webm'
const VIDEO_MP4 = '/landing/kiterp-homepage.mp4'

const TOP_NAV = [
  { label: 'Overview', sceneIndex: 0 },
  { label: 'CRM', sceneIndex: 1 },
  { label: 'Catalog', sceneIndex: 2 },
  { label: 'Sales', sceneIndex: 3 },
  { label: 'Storefront', sceneIndex: 4 },
  { label: 'POS', sceneIndex: 5 },
  { label: 'Finance', sceneIndex: 6 },
]

function ExplainerPopup({
  sceneId,
  icon: Icon,
  title,
  points,
}: {
  sceneId: string
  icon: typeof Store
  title: string
  points: string[]
}) {
  return (
    <div key={sceneId} className="kiterp-demo-popup" aria-hidden>
      <div className="kiterp-demo-popup-head">
        <span className="kiterp-demo-popup-icon"><Icon className="w-3.5 h-3.5" /></span>
        <span className="kiterp-demo-popup-title">{title}</span>
      </div>
      <ul className="kiterp-demo-popup-list">
        {points.map((p) => (
          <li key={p}>
            <Check className="w-3 h-3 shrink-0" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
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

function KiterpNavDemo({
  sceneIndex,
  playing,
  interactive,
  sparks,
  cursor,
  hovering,
  frameRef,
  navRefs,
  onNavHover,
  onNavClick,
  onTopNavHover,
  onTopNavClick,
}: {
  sceneIndex: number
  playing: boolean
  interactive: boolean
  sparks: SparkleBurst[]
  cursor: { x: number; y: number; pressing: boolean } | null
  hovering: boolean
  frameRef: React.RefObject<HTMLDivElement | null>
  navRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>
  onNavHover: (index: number, e: React.MouseEvent<HTMLButtonElement>) => void
  onNavClick: (index: number, e: React.MouseEvent<HTMLButtonElement>) => void
  onTopNavHover: (index: number, e: React.MouseEvent<HTMLButtonElement>) => void
  onTopNavClick: (index: number, e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const scene = KITERP_DEMO_SCENES[sceneIndex]

  return (
    <div
      ref={frameRef}
      className={`kiterp-demo-frame${interactive ? ' is-interactive' : ' is-playing'}`}
    >
      <div className="kiterp-demo-chrome">
        <span className="kiterp-demo-dot" />
        <span className="kiterp-demo-dot" />
        <span className="kiterp-demo-dot" />
        <span className="kiterp-demo-url">vendor.kiterp.com / {scene.navLabel.toLowerCase()}</span>
      </div>

      <div className="kiterp-demo-topnav">
        {TOP_NAV.map((tab) => (
          <button
            key={tab.label}
            type="button"
            tabIndex={interactive ? 0 : -1}
            className={`kiterp-demo-topnav-item${tab.sceneIndex === sceneIndex ? ' is-active' : ''}`}
            onMouseEnter={interactive ? (e) => onTopNavHover(tab.sceneIndex, e) : undefined}
            onClick={interactive ? (e) => onTopNavClick(tab.sceneIndex, e) : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="kiterp-demo-body">
        <aside className="kiterp-demo-sidebar">
          <div className="kiterp-demo-brand">
            <Store className="w-4 h-4" />
            <span>KITERP</span>
          </div>
          <nav className="kiterp-demo-nav">
            {KITERP_DEMO_SCENES.map((item, i) => {
              const Icon = item.navIcon
              const active = i === sceneIndex
              return (
                <button
                  key={item.id}
                  ref={(el) => { navRefs.current[i] = el }}
                  type="button"
                  tabIndex={interactive ? 0 : -1}
                  className={`kiterp-demo-nav-item${active ? ' is-active' : ''}`}
                  onMouseEnter={interactive ? (e) => onNavHover(i, e) : undefined}
                  onClick={interactive ? (e) => onNavClick(i, e) : undefined}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.navLabel}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div key={scene.id} className="kiterp-demo-main">
          <div className="kiterp-demo-breadcrumb">
            Home <span>/</span> {scene.navLabel}
          </div>
          <div className="kiterp-demo-main-head">
            <div>
              <h3>{scene.title}</h3>
              <p>{scene.subtitle}</p>
            </div>
            <div className="kiterp-demo-stat">
              <span>{scene.statLabel}</span>
              <strong>{scene.statValue}</strong>
            </div>
          </div>
          <div className="kiterp-demo-chips">
            {scene.chips.map((chip) => (
              <span key={chip} className="kiterp-demo-chip">{chip}</span>
            ))}
          </div>
          <DemoSceneContent key={scene.id} sceneId={scene.id} />
        </div>
      </div>

      {playing && <div key={`wipe-${scene.id}`} className="kiterp-demo-wipe" aria-hidden />}

      <ExplainerPopup
        sceneId={scene.id}
        icon={scene.navIcon}
        title={scene.popupTitle}
        points={scene.popupPoints}
      />

      <ClickSparkleLayer sparks={sparks} />

      {interactive && cursor && (
        <>
          <HoverSparkleAtCursor x={cursor.x} y={cursor.y} visible={hovering && sparks.length === 0} />
          <DemoCursor x={cursor.x} y={cursor.y} pressing={cursor.pressing} />
        </>
      )}

      {playing && cursor && !interactive && (
        <DemoCursor x={cursor.x} y={cursor.y} pressing={cursor.pressing} />
      )}

      {playing && (
        <div className="kiterp-demo-playing-badge">Auto tour playing…</div>
      )}

      {!playing && interactive && hovering && (
        <div className="kiterp-demo-paused">Hover menus to explore · Press play to resume tour</div>
      )}
    </div>
  )
}

export function LandingDemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const navRefs = useRef<(HTMLButtonElement | null)[]>([])
  const autoplayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastHoverBurstRef = useRef(0)
  const tourRafRef = useRef(0)
  const tourPosRef = useRef<{ x: number; y: number } | null>(null)
  const tourTargetRef = useRef<{ x: number; y: number } | null>(null)
  const tourMovingRef = useRef(false)
  const stepTimersRef = useRef<number[]>([])
  const activeSpotRef = useRef<HTMLElement | null>(null)

  const [hasVideoFile, setHasVideoFile] = useState<boolean | null>(null)
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [sparks, setSparks] = useState<SparkleBurst[]>([])
  const [tourCursor, setTourCursor] = useState<{ x: number; y: number; pressing: boolean } | null>(null)

  const interactive = !playing
  const { cursor: userCursor, hovering, setTarget, pulsePress, clearCursor } = useDemoCursor(
    frameRef,
    interactive && hasVideoFile === false,
  )

  const displayCursor = interactive ? userCursor : tourCursor

  /** Point the auto-tour cursor at a nav element; the rAF loop glides it there. */
  const moveTourTo = useCallback((el: HTMLElement | null) => {
    if (!el || !frameRef.current) return
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

  /** Clear any pending within-scene step timers and remove the active highlight. */
  const clearStepTimers = useCallback(() => {
    stepTimersRef.current.forEach((t) => window.clearTimeout(t))
    stepTimersRef.current = []
    if (activeSpotRef.current) {
      activeSpotRef.current.classList.remove('is-demo-spotlight')
      activeSpotRef.current = null
    }
  }, [])

  /** Glow the element the tour cursor is "using" right now. */
  const highlightSpot = useCallback((el: HTMLElement) => {
    if (activeSpotRef.current && activeSpotRef.current !== el) {
      activeSpotRef.current.classList.remove('is-demo-spotlight')
    }
    el.classList.add('is-demo-spotlight')
    activeSpotRef.current = el
  }, [])

  /** Walk the cursor through a scene: nav item first, then live content spots. */
  const runSceneTour = useCallback((idx: number) => {
    clearStepTimers()
    const frame = frameRef.current
    if (!frame) return

    const nav = navRefs.current[idx]
    const main = frame.querySelector('.kiterp-demo-main')
    const spots = main
      ? Array.from(
          main.querySelectorAll<HTMLElement>(
            '.democ-tile, .democ-crm-card, .democ-product, .democ-tr:not(.democ-thead), .democ-pos-btn, .democ-palette-item, .democ-pos-pay',
          ),
        ).slice(0, 3)
      : []

    const stops: { el: HTMLElement; spot: boolean }[] = []
    if (nav) stops.push({ el: nav, spot: false })
    spots.forEach((el) => stops.push({ el, spot: true }))
    if (stops.length === 0) return

    const per = DEMO_SCENE_MS / (stops.length + 0.6)
    stops.forEach((s, i) => {
      const t = window.setTimeout(() => {
        moveTourTo(s.el)
        if (s.spot) highlightSpot(s.el)
      }, Math.round(i * per))
      stepTimersRef.current.push(t)
    })
  }, [clearStepTimers, highlightSpot, moveTourTo])

  /** Animate the tour cursor step-by-step and emit a sparkle trail while moving. */
  useEffect(() => {
    if (hasVideoFile !== false || !playing) {
      cancelAnimationFrame(tourRafRef.current)
      return
    }

    const tick = () => {
      const pos = tourPosRef.current
      const target = tourTargetRef.current

      if (pos && target) {
        const dx = target.x - pos.x
        const dy = target.y - pos.y
        const dist = Math.hypot(dx, dy)

        if (dist > 1.2) {
          // Step toward the target (smooth, frame-by-frame).
          const speed = Math.min(0.5, 0.16 + dist * 0.006)
          pos.x += dx * speed
          pos.y += dy * speed
          tourMovingRef.current = true
          setTourCursor({ x: pos.x, y: pos.y, pressing: false })
        } else if (tourMovingRef.current) {
          // Just arrived — settle + a click-style burst.
          pos.x = target.x
          pos.y = target.y
          tourMovingRef.current = false
          spawnSparkle(setSparks, pos.x, pos.y)
          setTourCursor({ x: pos.x, y: pos.y, pressing: true })
          window.setTimeout(() => {
            setTourCursor((c) => (c ? { ...c, pressing: false } : c))
          }, 180)
        }
      }

      tourRafRef.current = requestAnimationFrame(tick)
    }

    tourRafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(tourRafRef.current)
  }, [hasVideoFile, playing])

  const goToScene = useCallback((index: number) => {
    const safe = Math.max(0, Math.min(KITERP_DEMO_SCENES.length - 1, index))
    setSceneIndex(safe)
    setProgress((safe / KITERP_DEMO_SCENES.length) * 100)
  }, [])

  const sparkleAtEvent = useCallback((e: React.MouseEvent, extraBurst = false) => {
    if (!interactive || !frameRef.current) return
    const f = frameRef.current.getBoundingClientRect()
    const x = e.clientX - f.left
    const y = e.clientY - f.top
    setTarget(x, y)
    if (extraBurst) {
      const now = Date.now()
      if (now - lastHoverBurstRef.current > 280) {
        lastHoverBurstRef.current = now
        spawnSparkle(setSparks, x, y)
      }
    }
    pulsePress(120)
  }, [interactive, setTarget, pulsePress])

  const hoverScene = useCallback((index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!interactive) return
    goToScene(index)
    sparkleAtEvent(e, true)
  }, [interactive, goToScene, sparkleAtEvent])

  const handleNavHover = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    hoverScene(index, e)
  }

  const handleTopNavHover = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    hoverScene(index, e)
  }

  const handleNavClick = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!interactive) return
    e.preventDefault()
    goToScene(index)
    sparkleAtEvent(e, true)
  }

  const handleTopNavClick = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!interactive) return
    e.preventDefault()
    goToScene(index)
    sparkleAtEvent(e, true)
  }

  useEffect(() => {
    if (playing) {
      clearCursor()
      setSparks([])
      tourPosRef.current = null
      tourTargetRef.current = null
      tourMovingRef.current = false
      setTourCursor(null)
    }
  }, [playing, clearCursor])

  /** Run the functionality walkthrough for the current scene (re-runs per scene). */
  useEffect(() => {
    if (hasVideoFile !== false || !playing) {
      clearStepTimers()
      return
    }
    // Wait a tick for the new scene's content to mount, then tour it.
    const t = window.setTimeout(() => runSceneTour(sceneIndex), 160)
    return () => {
      window.clearTimeout(t)
      clearStepTimers()
    }
  }, [hasVideoFile, playing, sceneIndex, runSceneTour, clearStepTimers])

  useEffect(() => {
    const video = document.createElement('video')
    const onCanPlay = () => setHasVideoFile(true)
    const onError = () => setHasVideoFile(false)
    video.addEventListener('canplaythrough', onCanPlay, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.src = VIDEO_MP4
    video.load()
    return () => {
      video.removeEventListener('canplaythrough', onCanPlay)
      video.removeEventListener('error', onError)
    }
  }, [])

  const syncVideoProgress = useCallback(() => {
    const video = videoRef.current
    if (!video?.duration) return
    setProgress((video.currentTime / video.duration) * 100)
  }, [])

  useEffect(() => {
    if (hasVideoFile !== false || !playing) {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current)
      return
    }

    autoplayTimerRef.current = setInterval(() => {
      setSceneIndex((prev) => {
        const next = (prev + 1) % KITERP_DEMO_SCENES.length
        setProgress((next / KITERP_DEMO_SCENES.length) * 100)
        return next
      })
    }, DEMO_SCENE_MS)

    return () => {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current)
    }
  }, [hasVideoFile, playing])

  useEffect(() => {
    const video = videoRef.current
    if (!video || hasVideoFile !== true) return
    if (playing) {
      void video.play().catch(() => setPlaying(false))
    } else {
      video.pause()
    }
  }, [playing, hasVideoFile])

  const togglePlay = () => setPlaying((p) => !p)

  const seek = (pct: number) => {
    setProgress(pct)
    if (hasVideoFile === true && videoRef.current?.duration) {
      videoRef.current.currentTime = (pct / 100) * videoRef.current.duration
    } else if (hasVideoFile === false) {
      const idx = Math.min(
        KITERP_DEMO_SCENES.length - 1,
        Math.floor((pct / 100) * KITERP_DEMO_SCENES.length),
      )
      goToScene(idx)
    }
  }

  const showLoader = hasVideoFile === null

  return (
    <div id="demo" className="kiterp-video-homepage kiterp-reveal scroll-mt-24">
      <div className="kiterp-video-shell">
        {showLoader && <div className="kiterp-video-loader">Loading demo…</div>}

        {hasVideoFile === true && (
          <video
            ref={videoRef}
            className="kiterp-video-player"
            autoPlay
            muted
            loop
            playsInline
            onTimeUpdate={syncVideoProgress}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          >
            <source src={VIDEO_WEBM} type="video/webm" />
            <source src={VIDEO_MP4} type="video/mp4" />
          </video>
        )}

        {hasVideoFile === false && (
          <KiterpNavDemo
            sceneIndex={sceneIndex}
            playing={playing}
            interactive={interactive}
            sparks={sparks}
            cursor={displayCursor}
            hovering={hovering}
            frameRef={frameRef}
            navRefs={navRefs}
            onNavHover={handleNavHover}
            onNavClick={handleNavClick}
            onTopNavHover={handleTopNavHover}
            onTopNavClick={handleTopNavClick}
          />
        )}

        {playing && (
          <div
            className="kiterp-demo-input-blocker"
            aria-hidden
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onPointerUp={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          />
        )}
      </div>

      <div className="kiterp-video-controls">
        <button
          type="button"
          className="kiterp-video-play-btn"
          onClick={togglePlay}
          aria-label={playing ? 'Pause demo' : 'Play demo'}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progress}
          onChange={(e) => seek(Number(e.target.value))}
          className="kiterp-video-progress"
          aria-label="Demo progress"
        />
        <span className="kiterp-video-hint hidden sm:inline">
          {playing
            ? 'Press pause to explore'
            : hasVideoFile === false
              ? `${KITERP_DEMO_SCENES[sceneIndex].navLabel} · hover to explore`
              : 'KITERP platform tour'}
        </span>
      </div>
    </div>
  )
}
