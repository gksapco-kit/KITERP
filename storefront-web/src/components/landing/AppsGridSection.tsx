import { useState, type CSSProperties } from 'react'
import { LANDING_MODULES, type LandingApp, type LandingModule } from './landingData'
import { ModulesOrbitPanel } from './ModulesOrbitPanel'

function modulePanelStyle(module: LandingModule): CSSProperties {
  return {
    ['--module-accent' as string]: module.accent.accent,
    ['--module-glow' as string]: module.accent.glow,
    ['--module-panel-tint' as string]: module.accent.panelTint,
    ['--module-icon-bg' as string]: module.accent.iconBg,
  }
}

function AppTile({ app, accent }: { app: LandingApp; accent: string }) {
  const Icon = app.icon
  return (
    <div className="kiterp-app-tile-static flex flex-col items-center text-center group w-[4.25rem]">
      <div
        className="kiterp-app-icon w-[3rem] h-[3rem] rounded-xl flex items-center justify-center p-1.5"
        style={{
          background: `linear-gradient(145deg, #ffffff 0%, color-mix(in srgb, ${accent} 8%, white) 100%)`,
          border: `1px solid color-mix(in srgb, ${accent} 14%, #e4ece9)`,
          boxShadow: `0 1px 4px color-mix(in srgb, ${accent} 8%, transparent)`,
        }}
      >
        <Icon className="w-[1.125rem] h-[1.125rem]" style={{ color: accent }} strokeWidth={1.75} />
      </div>
      <p className="mt-1 text-[9px] leading-tight font-medium text-gray-600 px-0.5 line-clamp-2 group-hover:text-[#1e3d34] transition-colors">
        {app.label}
      </p>
    </div>
  )
}

export function AppsGridSection() {
  const [activeModuleId, setActiveModuleId] = useState(LANDING_MODULES[0]?.id ?? '')
  const activeModule = LANDING_MODULES.find((m) => m.id === activeModuleId) ?? LANDING_MODULES[0]

  if (!activeModule) return null

  return (
    <section id="apps" className="py-14 sm:py-20 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="font-kiterp-script text-4xl sm:text-5xl text-[#1e3d34]">
            Everything your business needs, in one orbit
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-[Manrope,sans-serif]">
            Tap a module to preview its apps.
          </p>
        </div>

        <div className="kiterp-apps-layout">
          <ModulesOrbitPanel
            activeModuleId={activeModuleId}
            onSelectModule={setActiveModuleId}
          />

          <div
            key={activeModule.id}
            className="kiterp-module-apps-panel p-3 sm:p-4 kiterp-module-apps-panel--themed"
            style={modulePanelStyle(activeModule)}
          >
            <div className="flex items-start gap-2.5 mb-3 pb-3 border-b kiterp-module-apps-panel-header">
              <div
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white"
                style={{ background: activeModule.accent.iconBg }}
              >
                <activeModule.icon className="w-[1.125rem] h-[1.125rem]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-[#1e3d34] leading-snug">{activeModule.title}</h3>
                  <span className="text-[10px] font-semibold kiterp-module-apps-count">
                    {activeModule.apps.length} apps
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{activeModule.description}</p>
              </div>
            </div>

            <div className="kiterp-module-apps-grid">
              {activeModule.apps.map((app) => (
                <AppTile key={app.id} app={app} accent={activeModule.accent.accent} />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-10 sm:mt-12 text-center font-kiterp-script text-2xl sm:text-3xl text-[#1e3d34] max-w-2xl mx-auto">
          We simplify everything, so you can achieve anything
        </p>
      </div>
    </section>
  )
}
