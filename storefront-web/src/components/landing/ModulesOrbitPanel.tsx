import { Link } from 'react-router-dom'
import { LANDING_MODULES, type LandingModule } from './landingData'
import { moduleCampaignPath } from './moduleCampaignContent'
import type { CSSProperties } from 'react'

/** 14 modules evenly spaced on one ring. Labels fan out radially so they never overlap. */
const ORBIT_MODULE_COUNT = LANDING_MODULES.length
/** Wider ring = more arc space between neighboring app circles. */
const ORBIT_RADIUS_PERCENT = 38
const ORBIT_VIEW_SIZE = 400
const ORBIT_RING_RADIUS = (ORBIT_RADIUS_PERCENT / 100) * ORBIT_VIEW_SIZE

function moduleOrbitStyle(module: LandingModule, angle: number, index: number): CSSProperties {
  const { accent } = module
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    ['--orbit-accent' as string]: accent.accent,
    ['--orbit-glow' as string]: accent.glow,
    ['--orbit-c' as string]: cos.toFixed(4),
    ['--orbit-s' as string]: sin.toFixed(4),
    ['--orbit-node-delay' as string]: `${0.2 + index * 0.035}s`,
  }
}

function OrbitCore() {
  return (
    <div className="kiterp-orbit-core" aria-hidden>
      <p className="kiterp-orbit-core-label">KIT ERP</p>
    </div>
  )
}

type Props = {
  highlightedModuleId?: string | null
  onHoverModule: (id: string | null) => void
}

export function ModulesOrbitPanel({
  highlightedModuleId = null,
  onHoverModule,
}: Props) {
  const total = ORBIT_MODULE_COUNT

  return (
    <div className="kiterp-modules-orbit-wrap">
      <div className="kiterp-modules-orbit">
        <svg className="kiterp-orbit-rings" viewBox={`0 0 ${ORBIT_VIEW_SIZE} ${ORBIT_VIEW_SIZE}`} aria-hidden>
          {LANDING_MODULES.map((module, index) => {
            const angle = (index / ORBIT_MODULE_COUNT) * Math.PI * 2 - Math.PI / 2
            const cx = ORBIT_VIEW_SIZE / 2
            const cy = ORBIT_VIEW_SIZE / 2
            const isHighlighted = module.id === highlightedModuleId
            return (
              <line
                key={`spoke-${module.id}`}
                x1={cx}
                y1={cy}
                x2={cx + Math.cos(angle) * ORBIT_RING_RADIUS}
                y2={cy + Math.sin(angle) * ORBIT_RING_RADIUS}
                className={`kiterp-orbit-spoke${isHighlighted ? ' kiterp-orbit-spoke--active' : ''}`}
                style={isHighlighted ? { stroke: module.accent.accent } : undefined}
              />
            )
          })}
        </svg>

        <OrbitCore />

        {LANDING_MODULES.map((module, index) => {
          const angle = (index / total) * Math.PI * 2 - Math.PI / 2
          const left = `${50 + Math.cos(angle) * ORBIT_RADIUS_PERCENT}%`
          const top = `${50 + Math.sin(angle) * ORBIT_RADIUS_PERCENT}%`
          const isHighlighted = module.id === highlightedModuleId
          const count = String(module.apps.length).padStart(2, '0')
          const cos = Math.cos(angle)
          const labelZone =
            cos > 0.35 ? ' kiterp-orbit-node-label--right' : cos < -0.35 ? ' kiterp-orbit-node-label--left' : ''
          const Icon = module.icon

          return (
            <div
              key={module.id}
              className="kiterp-orbit-node-wrap"
              style={{
                left,
                top,
                zIndex: isHighlighted ? 20 : 5,
                ...moduleOrbitStyle(module, angle, index),
              }}
            >
              <Link
                to={moduleCampaignPath(module.id)}
                className={`kiterp-orbit-node-hit${isHighlighted ? ' kiterp-orbit-node-hit--active' : ''}`}
                onMouseEnter={() => onHoverModule(module.id)}
                onFocus={() => onHoverModule(module.id)}
                aria-current={isHighlighted ? 'true' : undefined}
                aria-label={`${module.label}, ${count} apps`}
              >
                <span className="kiterp-orbit-node-btn" aria-hidden>
                  <span className="kiterp-orbit-node-icon">
                    <Icon className="w-full h-full" strokeWidth={2} />
                  </span>
                </span>
                <span className={`kiterp-orbit-node-label${labelZone}`} aria-hidden>
                  <span className="kiterp-orbit-node-title">{module.label}</span>
                  <span className="kiterp-orbit-node-count">{count} apps</span>
                </span>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
