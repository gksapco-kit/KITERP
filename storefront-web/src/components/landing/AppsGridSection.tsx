import { useEffect, useRef, useState } from 'react'
import { LANDING_MODULES } from './landingData'
import { ModulesOrbitPanel } from './ModulesOrbitPanel'
import { ModulePreviewPanel } from './ModulePreviewPanel'
import { useModuleHoverPreview } from './useModuleHoverPreview'

export function AppsGridSection() {
  const interactiveRef = useRef<HTMLDivElement>(null)
  const orbitStageRef = useRef<HTMLDivElement>(null)
  const [orbitInView, setOrbitInView] = useState(false)
  const {
    highlightedId,
    previewId,
    hoverModule,
    selectModule,
    keepPreview,
    leaveInteractive,
    dismissPreview,
  } = useModuleHoverPreview()
  const previewModule = previewId ? LANDING_MODULES.find((m) => m.id === previewId) : null

  useEffect(() => {
    if (!previewId) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      // Keep detail open when switching circle apps; only close on outside click.
      if (
        target.closest('.kiterp-orbit-node-hit') ||
        target.closest('.kiterp-module-preview-panel')
      ) {
        return
      }

      dismissPreview()
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [previewId, dismissPreview])

  useEffect(() => {
    const el = orbitStageRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setOrbitInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -5% 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="apps" className="pt-2 pb-6 sm:pt-4 sm:pb-8 scroll-mt-20">
      <div className="kiterp-apps-shell max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="font-kiterp-script text-4xl sm:text-5xl text-[#1e3d34] leading-tight">
            Everything your business needs, in one orbit
          </h2>
          <p className="mt-3 text-sm sm:text-[0.95rem] text-[#1e3d34]/55 font-medium tracking-wide">
            Hover a module to preview its apps
          </p>
        </div>

        <div
          ref={interactiveRef}
          className="kiterp-apps-interactive"
          onMouseLeave={leaveInteractive}
        >
          <div
            ref={orbitStageRef}
            className={`kiterp-apps-orbit-stage kiterp-orbit-scroll-target${orbitInView ? ' kiterp-orbit-scroll-target--in' : ''}`}
          >
            <ModulesOrbitPanel
              highlightedModuleId={highlightedId}
              onHoverModule={hoverModule}
              onSelectModule={selectModule}
            />
          </div>

          <div className="kiterp-module-preview-dock" onMouseEnter={keepPreview}>
            {previewModule ? <ModulePreviewPanel module={previewModule} /> : null}
          </div>
        </div>

        <p className="mt-8 sm:mt-10 text-center font-kiterp-script text-2xl sm:text-3xl text-[#1e3d34] max-w-2xl mx-auto">
          We simplify everything, so you can achieve anything
        </p>
      </div>
    </section>
  )
}
