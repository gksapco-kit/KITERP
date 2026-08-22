import { Navigate, useParams } from 'react-router-dom'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingChatbot } from '@/components/landing/LandingChatbot'
import { GrowthCtaSection } from '@/components/landing/GrowthCtaSection'
import { PlatformAnalyticsBeacon } from '@/components/landing/PlatformAnalyticsBeacon'
import {
  ModuleCampaignAppsSection,
  ModuleCampaignBenefits,
  ModuleCampaignFeatureBand,
  ModuleCampaignHero,
} from '@/components/landing/ModuleCampaignSections'
import { CampaignDemoPlayerProvider } from '@/components/landing/CampaignDemoPlayer'
import {
  findLandingModule,
  getModuleCampaignContent,
  isValidModuleId,
} from '@/components/landing/moduleCampaignContent'
import { useDocumentSeo, PLATFORM_SEO } from '@/lib/documentSeo'
import { compactJsonLd, organizationJsonLd } from '@/lib/catalogSeo'
import '@/styles/kiterp-landing.css'

function ModuleCampaignContent({ moduleId }: { moduleId: string }) {
  const module = findLandingModule(moduleId)
  const campaign = getModuleCampaignContent(moduleId)

  useDocumentSeo({
    title: campaign?.seoTitle ?? 'KIT ERP Apps',
    description: campaign?.seoDescription ?? PLATFORM_SEO.defaultDescription,
    keywords: campaign?.seoKeywords ?? PLATFORM_SEO.defaultKeywords,
    canonicalPath: `/apps/${moduleId}`,
    ogImage: '/favicon-192.png',
    ogImageAlt: module ? `${module.title} — KIT ERP` : 'KIT ERP',
    ogType: 'website',
    jsonLd: campaign
      ? compactJsonLd([
          organizationJsonLd(),
          {
            '@type': 'WebPage',
            name: campaign.seoTitle,
            description: campaign.seoDescription,
            url: `/apps/${moduleId}`,
            isPartOf: { '@type': 'WebSite', name: 'KIT ERP' },
          },
        ])
      : null,
  })

  if (!module || !campaign) {
    return <Navigate to="/apps" replace />
  }

  return (
    <div
      className="kiterp-landing kiterp-campaign-page font-kiterp-body min-h-screen kiterp-page-shell"
      style={{
        ['--campaign-accent' as string]: module.accent.accent,
        ['--campaign-glow' as string]: module.accent.glow,
        ['--campaign-tint' as string]: module.accent.panelTint,
      }}
    >
      <PlatformAnalyticsBeacon />
      <LandingHeader variant="campaign" />
      <main>
        <CampaignDemoPlayerProvider defaultActiveId={`${moduleId}-hero`}>
          <ModuleCampaignHero module={module} campaign={campaign} moduleId={moduleId} />
          <ModuleCampaignBenefits campaign={campaign} />
          {campaign.features.map((feature, index) => (
            <ModuleCampaignFeatureBand
              key={feature.id}
              module={module}
              moduleId={moduleId}
              feature={feature}
              index={index}
            />
          ))}
        </CampaignDemoPlayerProvider>
        <ModuleCampaignAppsSection module={module} moduleId={moduleId} />
        <div id="pricing" className="scroll-mt-36">
          <GrowthCtaSection />
        </div>
      </main>
      <LandingFooter />
      <LandingChatbot />
    </div>
  )
}

export default function ModuleCampaignPage({ moduleId: moduleIdProp }: { moduleId?: string } = {}) {
  const { moduleId: moduleIdParam = '' } = useParams<{ moduleId: string }>()
  const moduleId = moduleIdProp ?? moduleIdParam
  if (!isValidModuleId(moduleId)) return <Navigate to="/apps" replace />
  return <ModuleCampaignContent moduleId={moduleId} />
}
