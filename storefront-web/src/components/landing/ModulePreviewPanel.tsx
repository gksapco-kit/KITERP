import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { LandingApp, LandingModule } from './landingData'
import { moduleCampaignPath } from './moduleCampaignContent'

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

export function ModulePreviewPanel({ module }: { module: LandingModule }) {
  return (
    <div
      key={module.id}
      className="kiterp-module-preview-panel kiterp-module-apps-panel p-3 sm:p-4 kiterp-module-apps-panel--themed"
      style={modulePanelStyle(module)}
      role="region"
      aria-label={`${module.title} apps`}
    >
      <div className="flex items-start gap-2.5 mb-3 pb-3 border-b kiterp-module-apps-panel-header">
        <div
          className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white"
          style={{ background: module.accent.iconBg }}
        >
          <module.icon className="w-[1.125rem] h-[1.125rem]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[#1e3d34] leading-snug">{module.title}</h3>
            <span className="text-[10px] font-semibold kiterp-module-apps-count">
              {module.apps.length} apps
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{module.description}</p>
        </div>
      </div>

      <div className="kiterp-module-apps-grid">
        {module.apps.map((app) => (
          <AppTile key={app.id} app={app} accent={module.accent.accent} />
        ))}
      </div>

      <Link to={moduleCampaignPath(module.id)} className="kiterp-module-preview-open-btn">
        Open {module.label} details →
      </Link>
    </div>
  )
}
