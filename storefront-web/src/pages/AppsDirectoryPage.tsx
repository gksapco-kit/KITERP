import { Link } from 'react-router-dom'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingChatbot } from '@/components/landing/LandingChatbot'
import { GrowthCtaSection } from '@/components/landing/GrowthCtaSection'
import { PlatformAnalyticsBeacon } from '@/components/landing/PlatformAnalyticsBeacon'
import { LANDING_MODULES } from '@/components/landing/landingData'
import { moduleCampaignPath } from '@/components/landing/moduleCampaignContent'
import { useDocumentSeo } from '@/lib/documentSeo'
import { compactJsonLd, organizationJsonLd } from '@/lib/catalogSeo'
import '@/styles/kiterp-landing.css'

export default function AppsDirectoryPage() {
  useDocumentSeo({
    title: 'KIT ERP Apps — All Business Modules',
    description:
      'Explore every KIT ERP module: Finance, Sales, HR, CRM, Inventory, Website, Restaurant, Production, and more. One platform, ₹999/month.',
    keywords:
      'KIT ERP apps, ERP modules, finance, sales, HR, CRM, inventory, business software India',
    canonicalPath: '/apps',
    ogImage: '/favicon-192.png',
    ogImageAlt: 'KIT ERP Apps',
    ogType: 'website',
    jsonLd: compactJsonLd([
      organizationJsonLd(),
      {
        '@type': 'CollectionPage',
        name: 'KIT ERP Apps',
        description: 'All KIT ERP business modules in one platform.',
        url: '/apps',
      },
    ]),
  })

  return (
    <div className="kiterp-landing font-kiterp-body min-h-screen kiterp-page-shell">
      <PlatformAnalyticsBeacon />
      <LandingHeader variant="campaign" />
      <main>
        <section id="overview" className="kiterp-apps-directory-hero scroll-mt-36">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center kiterp-reveal">
            <nav className="kiterp-campaign-breadcrumb kiterp-campaign-breadcrumb--center" aria-label="Breadcrumb">
              <Link to="/" className="kiterp-campaign-breadcrumb-link">Home</Link>
              <span className="kiterp-campaign-breadcrumb-current">Apps</span>
            </nav>
            <h1 className="font-kiterp-script text-4xl sm:text-5xl text-[#1e3d34] leading-tight mt-6">
              Every module your business needs
            </h1>
            <p className="mt-4 text-sm sm:text-base text-[#1e3d34]/60 max-w-2xl mx-auto">
              Click any module to see what it includes, how it works, and why teams choose KIT ERP.
              All apps are included in one ₹999/month plan.
            </p>
          </div>
        </section>

        <section className="pb-12 sm:pb-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="kiterp-apps-directory-grid">
              {LANDING_MODULES.map((module) => {
                const Icon = module.icon
                const count = String(module.apps.length).padStart(2, '0')
                return (
                  <Link
                    key={module.id}
                    to={moduleCampaignPath(module.id)}
                    className="kiterp-apps-directory-tile kiterp-reveal group"
                    style={{
                      ['--tile-accent' as string]: module.accent.accent,
                      ['--tile-glow' as string]: module.accent.glow,
                      ['--tile-tint' as string]: module.accent.panelTint,
                    }}
                  >
                    <div className="kiterp-apps-directory-icon" style={{ background: module.accent.iconBg }}>
                      <Icon className="w-6 h-6 text-white" strokeWidth={2} />
                    </div>
                    <div className="kiterp-apps-directory-copy">
                      <h2 className="kiterp-apps-directory-title">{module.label}</h2>
                      <p className="kiterp-apps-directory-count">{count} apps</p>
                      <p className="kiterp-apps-directory-desc">{module.description}</p>
                    </div>
                    <span className="kiterp-apps-directory-cta">View details →</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <GrowthCtaSection />
      </main>
      <LandingFooter />
      <LandingChatbot />
    </div>
  )
}
