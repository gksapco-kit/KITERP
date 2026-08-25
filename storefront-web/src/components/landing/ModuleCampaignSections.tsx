import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'
import type { LandingModule } from './landingData'
import type { ModuleCampaignContent } from './moduleCampaignContent'
import { ModuleCampaignAnimatedDemo } from './ModuleCampaignAnimatedDemo'
import { CampaignDemoSlot } from './CampaignDemoPlayer'

type HeroProps = { module: LandingModule; campaign: ModuleCampaignContent; moduleId: string }

export function ModuleCampaignHero({ module, campaign, moduleId }: HeroProps) {
  const Icon = module.icon
  const signupUrl = `${VENDOR_SIGNUP_PATH}?module=${encodeURIComponent(moduleId)}`

  return (
    <CampaignDemoSlot
      id={`${moduleId}-hero`}
      as="section"
      sectionId="overview"
      className="kiterp-campaign-hero scroll-mt-36"
    >
      {({ isActive }) => (
        <>
          <div className="kiterp-campaign-hero-atmosphere" aria-hidden>
            <span className="kiterp-campaign-hero-blob kiterp-campaign-hero-blob--a" />
            <span className="kiterp-campaign-hero-blob kiterp-campaign-hero-blob--b" />
          </div>

          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <nav className="kiterp-campaign-breadcrumb" aria-label="Breadcrumb">
              <Link to="/" className="kiterp-campaign-breadcrumb-link">Home</Link>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" aria-hidden />
              <Link to="/apps" className="kiterp-campaign-breadcrumb-link">Apps</Link>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" aria-hidden />
              <span className="kiterp-campaign-breadcrumb-current">{module.label}</span>
            </nav>

            <Link to="/apps" className="kiterp-campaign-back-link">
              <ArrowLeft className="w-4 h-4" aria-hidden />
              All modules
            </Link>

            <div className="kiterp-campaign-hero-grid">
              <div className="kiterp-campaign-hero-copy kiterp-reveal">
                <div className="kiterp-campaign-module-badge" style={{ background: module.accent.iconBg }}>
                  <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                  <span>{module.title}</span>
                  <span className="kiterp-campaign-module-badge-count">{module.apps.length} apps</span>
                </div>

                <h1 className="kiterp-campaign-hero-title">
                  {campaign.headline}{' '}
                  <span className="kiterp-campaign-hero-accent">{campaign.highlightPhrase}</span>
                </h1>

                <p className="kiterp-campaign-hero-sub">{campaign.subhead}</p>

                <div className="kiterp-campaign-hero-cta">
                  <a href={signupUrl} className="kiterp-btn-primary px-6 py-3 text-base">
                    Start now — ₹999/month
                  </a>
                  <Link to="/contact" className="kiterp-btn-secondary px-6 py-3 text-base">
                    Talk to us
                  </Link>
                </div>

                <p className="kiterp-campaign-hero-proof">{campaign.proofLine}</p>
                <p className="kiterp-campaign-hero-pricing">
                  <span className="kiterp-campaign-hero-pricing-amount">₹999</span>
                  <span>/ month · all modules included</span>
                </p>

                {campaign.proofBadge ? (
                  <div className="kiterp-campaign-proof-badge">
                    <span className="kiterp-campaign-proof-badge-label">{campaign.proofBadge.label}</span>
                    <span className="kiterp-campaign-proof-badge-detail">{campaign.proofBadge.detail}</span>
                  </div>
                ) : null}
              </div>

              <div className="kiterp-campaign-hero-visual kiterp-reveal">
                <ModuleCampaignAnimatedDemo
                  variant="dashboard"
                  module={module}
                  hero
                  isActive={isActive}
                  feature={{
                    id: 'module-overview',
                    eyebrow: 'Overview',
                    title: campaign.headline,
                    accentPhrase: campaign.highlightPhrase,
                    body: campaign.subhead,
                    bullets: campaign.benefits.map((b) => b.title),
                    mockup: 'dashboard',
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </CampaignDemoSlot>
  )
}

export function ModuleCampaignBenefits({ campaign }: { campaign: ModuleCampaignContent }) {
  return (
    <section className="kiterp-campaign-benefits">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="kiterp-campaign-benefits-grid">
          {campaign.benefits.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.title} className="kiterp-campaign-benefit-card kiterp-reveal">
                <span className="kiterp-campaign-benefit-icon">
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </span>
                <h2 className="kiterp-campaign-benefit-title">{item.title}</h2>
                <p className="kiterp-campaign-benefit-body">{item.body}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

type FeatureProps = {
  module: LandingModule
  moduleId: string
  feature: ModuleCampaignContent['features'][number]
  index: number
}

export function ModuleCampaignFeatureBand({ module, moduleId, feature, index }: FeatureProps) {
  const layoutClass = feature.reverse ? ' kiterp-campaign-feature--reverse' : ''
  const isFirst = index === 0

  return (
    <CampaignDemoSlot
      id={`${moduleId}-feature-${feature.id}`}
      as="section"
      sectionId={isFirst ? 'features' : undefined}
      className={`kiterp-campaign-feature${layoutClass}${isFirst ? ' scroll-mt-36' : ''}`}
    >
      {({ isActive }) => (
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="kiterp-campaign-feature-grid">
            <div className="kiterp-campaign-feature-copy kiterp-reveal">
              {feature.eyebrow ? (
                <p className="kiterp-campaign-feature-eyebrow">{feature.eyebrow}</p>
              ) : null}
              <h2 className="kiterp-campaign-feature-title">
                {feature.title}
                {feature.accentPhrase ? (
                  <> <span className="kiterp-campaign-hero-accent">{feature.accentPhrase}</span></>
                ) : null}
              </h2>
              <p className="kiterp-campaign-feature-body">{feature.body}</p>
              <ul className="kiterp-campaign-feature-list">
                {feature.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
            <div className="kiterp-campaign-feature-visual kiterp-reveal">
              <ModuleCampaignAnimatedDemo
                variant={feature.mockup}
                module={module}
                feature={feature}
                isActive={isActive}
              />
            </div>
          </div>
        </div>
      )}
    </CampaignDemoSlot>
  )
}

export function ModuleCampaignAppsSection({ module, moduleId }: { module: LandingModule; moduleId: string }) {
  const signupUrl = `${VENDOR_SIGNUP_PATH}?module=${encodeURIComponent(moduleId)}`
  const ModuleIcon = module.icon
  const gridDensity = module.apps.length >= 8 ? 'compact' : module.apps.length >= 5 ? 'cozy' : 'standard'

  return (
    <section className="kiterp-campaign-apps scroll-mt-36" id="apps-in-module">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="kiterp-campaign-apps-header">
          <div
            className="kiterp-campaign-apps-module-badge"
            style={{ background: module.accent.iconBg }}
          >
            <ModuleIcon className="w-3.5 h-3.5 text-white" strokeWidth={2} aria-hidden />
            <span>{module.title}</span>
            <span className="kiterp-campaign-apps-module-count">{module.apps.length} apps</span>
          </div>
          <h2 className="kiterp-campaign-apps-title">Everything in {module.label}</h2>
          <p className="kiterp-campaign-apps-lead">{module.description}</p>
          <span className="kiterp-campaign-apps-price-pill">₹999/month · all modules included</span>
        </div>

        <div
          className="kiterp-campaign-apps-panel"
          style={{
            ['--module-accent' as string]: module.accent.accent,
            ['--module-glow' as string]: module.accent.glow,
            ['--module-panel-tint' as string]: module.accent.panelTint,
            ['--module-icon-bg' as string]: module.accent.iconBg,
          }}
        >
          <div className="kiterp-campaign-apps-panel-accent" aria-hidden />

          <ul
            className="kiterp-campaign-apps-grid"
            data-count={module.apps.length}
            data-density={gridDensity}
          >
            {module.apps.map((app) => {
              const AppIcon = app.icon
              return (
                <li key={app.id} className="kiterp-campaign-app-card">
                  <span className="kiterp-campaign-app-icon" aria-hidden>
                    <AppIcon className="kiterp-campaign-app-icon-glyph" strokeWidth={1.75} />
                  </span>
                  <span className="kiterp-campaign-app-name">{app.label}</span>
                </li>
              )
            })}
          </ul>

          <div className="kiterp-campaign-apps-cta">
            <a href={signupUrl} className="kiterp-btn-primary kiterp-campaign-apps-cta-btn">
              Get started with {module.label}
              <ChevronRight className="w-4 h-4 shrink-0" aria-hidden />
            </a>
            <p className="kiterp-campaign-apps-cta-note">
              {module.apps.length} apps · one plan · setup in minutes
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
