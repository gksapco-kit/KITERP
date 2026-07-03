import { LANDING_MODULES, type LandingModule } from './landingData'
import type { CSSProperties } from 'react'

/** 14 modules evenly spaced on one ring. Labels fan out radially so they never overlap. */
const ORBIT_MODULE_COUNT = LANDING_MODULES.length
/** Keep icons inset enough that radial labels fit inside the rounded panel. */
const ORBIT_RADIUS_PERCENT = 27
const ORBIT_VIEW_SIZE = 400
const ORBIT_RING_RADIUS = (ORBIT_RADIUS_PERCENT / 100) * ORBIT_VIEW_SIZE

function moduleOrbitStyle(module: LandingModule, angle: number): CSSProperties {
  const { accent } = module
  return {
    ['--orbit-accent' as string]: accent.accent,
    ['--orbit-glow' as string]: accent.glow,
    ['--orbit-c' as string]: Math.cos(angle).toFixed(4),
    ['--orbit-s' as string]: Math.sin(angle).toFixed(4),
  }
}

function OrbitalModuleNode({
  module,
  isActive,
  onSelect,
}: {
  module: LandingModule
  isActive: boolean
  onSelect: () => void
}) {
  const Icon = module.icon
  const count = String(module.apps.length).padStart(2, '0')

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`${module.label}, ${count} apps`}
      className={`kiterp-orbit-node-btn${isActive ? ' kiterp-orbit-node-btn--active' : ''}`}
    >
      <span className="kiterp-orbit-node-icon" aria-hidden>
        <Icon className="w-full h-full" strokeWidth={2} />
      </span>
    </button>
  )
}

function OrbitCore() {
  return (
    <div className="kiterp-orbit-core" aria-hidden>
      <p className="kiterp-orbit-core-label">KIT ERP</p>
    </div>
  )
}

type Props = {
  activeModuleId: string
  onSelectModule: (id: string) => void
}

export function ModulesOrbitPanel({ activeModuleId, onSelectModule }: Props) {
  const total = ORBIT_MODULE_COUNT

  return (
    <div className="kiterp-modules-orbit-wrap">
      <div className="kiterp-modules-orbit">
        <div className="kiterp-orbit-bg" aria-hidden />
        <svg className="kiterp-orbit-rings" viewBox={`0 0 ${ORBIT_VIEW_SIZE} ${ORBIT_VIEW_SIZE}`} aria-hidden>
          {LANDING_MODULES.map((module, index) => {
            const angle = (index / ORBIT_MODULE_COUNT) * Math.PI * 2 - Math.PI / 2
            const cx = ORBIT_VIEW_SIZE / 2
            const cy = ORBIT_VIEW_SIZE / 2
            return (
              <line
                key={`spoke-${module.id}`}
                x1={cx}
                y1={cy}
                x2={cx + Math.cos(angle) * ORBIT_RING_RADIUS}
                y2={cy + Math.sin(angle) * ORBIT_RING_RADIUS}
                className="kiterp-orbit-spoke"
              />
            )
          })}
        </svg>

        <OrbitCore />

        {LANDING_MODULES.map((module, index) => {
          const angle = (index / total) * Math.PI * 2 - Math.PI / 2
          const left = `${50 + Math.cos(angle) * ORBIT_RADIUS_PERCENT}%`
          const top = `${50 + Math.sin(angle) * ORBIT_RADIUS_PERCENT}%`
          const isActive = module.id === activeModuleId
          const count = String(module.apps.length).padStart(2, '0')
          const cos = Math.cos(angle)
          /** Fan labels away from the icon instead of centering on it, so long names never overlap their node. */
          const labelZone = cos > 0.35 ? ' kiterp-orbit-node-label--right' : cos < -0.35 ? ' kiterp-orbit-node-label--left' : ''
          return (
            <div
              key={module.id}
              className="kiterp-orbit-node-wrap"
              style={{
                left,
                top,
                zIndex: isActive ? 20 : 5,
                ...moduleOrbitStyle(module, angle),
              }}
            >
              <OrbitalModuleNode
                module={module}
                isActive={isActive}
                onSelect={() => onSelectModule(module.id)}
              />
              <span className={`kiterp-orbit-node-label${labelZone}`} aria-hidden>
                <span className="kiterp-orbit-node-title">{module.label}</span>
                <span className="kiterp-orbit-node-count">{count} apps</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
