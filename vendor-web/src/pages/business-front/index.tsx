import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, ExternalLink, Globe, Layout, Palette, SlidersHorizontal,
  Sparkles, Newspaper, Link2, Monitor, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { vendorApi } from '@/api/vendor'
import { useSiteList } from '@/hooks/useWebsites'
import { useVendorStore } from '@/stores/vendorStore'
import { resolveBusinessFrontActiveTemplate } from '@/lib/businessFrontActiveTemplate'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'

type HubLink = {
  title: string
  description: string
  to: string
  icon: typeof Globe
  external?: boolean
  primary?: boolean
}

export default function BusinessFrontHubPage() {
  const vendor = useVendorStore(s => s.vendor)
  const { data: sites = [] } = useSiteList()
  const { data: config } = useQuery({
    queryKey: ['template-config'],
    queryFn: () => vendorApi.getTemplateConfig(),
  })
  const { data: presetsData } = useQuery({
    queryKey: ['template-presets'],
    queryFn: () => vendorApi.getTemplatePresets(),
  })

  const activeFront = resolveBusinessFrontActiveTemplate(
    config?.template,
    presetsData?.presets ?? [],
    sites,
  )
  const storeUrl = vendor?.slug ? getCustomerStorefrontBaseUrl(vendor.slug) : null
  const publishedSite = sites.find(s => s.is_published)

  const customizeLinks: HubLink[] = [
    {
      title: 'Website Builder',
      description: 'Design pages with blocks — hero, categories, products, nav, footer. Publish to replace the default store home.',
      to: publishedSite ? `/websites/${publishedSite.id}` : '/websites',
      icon: Layout,
      primary: true,
    },
    {
      title: 'Website Templates',
      description: 'Browse full-site layouts and default store themes. See which template is live on your business front.',
      to: '/websites/templates',
      icon: Sparkles,
    },
    {
      title: 'Store Template',
      description: 'Colors, fonts, header, product cards, and homepage section toggles for the classic business front (when no site is published).',
      to: '/template',
      icon: Palette,
    },
    {
      title: 'Business Front Display',
      description: 'Choose which product and service fields appear on cards and detail pages.',
      to: '/system/storefront-display',
      icon: SlidersHorizontal,
    },
    {
      title: 'Social & Web Links',
      description: 'Social profiles and links shown in the footer and customer-facing pages.',
      to: '/system/social-links',
      icon: Link2,
    },
    {
      title: 'Blog Manager',
      description: 'Posts and articles on your public storefront.',
      to: '/blog',
      icon: Newspaper,
    },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary mb-1">System Configuration</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Business Front</h1>
          <p className="text-sm text-gray-600 mt-2 max-w-2xl">
            Customize what customers see on your public store. The old Business Front Builder was replaced by these tools — same outcome, clearer workflow.
          </p>
        </div>
        {storeUrl && (
          <Button variant="outline" asChild className="shrink-0 gap-2">
            <a href={storeUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              View live store
            </a>
          </Button>
        )}
      </div>

      <Card className="border-primary/25 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="w-4 h-4 text-primary" />
            Live on your business front today
          </CardTitle>
          <CardDescription>
            <span className="font-semibold text-gray-900">{activeFront.name}</span>
            {' — '}
            {activeFront.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          {activeFront.kind === 'website_builder' ? (
            <p>
              Customers see your <strong>published Website Builder site</strong>. Edit it below or unpublish to use a classic store template instead.
            </p>
          ) : (
            <p>
              No published Website Builder site — customers see the <strong>classic store layout</strong>. Customize it under Store Template, or create and publish a site in Website Builder.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          Customize your storefront
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Features from the previous builder are grouped here by purpose.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {customizeLinks.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`group block rounded-xl border p-5 transition-all hover:shadow-md hover:border-primary/40 ${
                item.primary ? 'border-primary/30 bg-white ring-1 ring-primary/10' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-lg shrink-0 ${item.primary ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600 group-hover:bg-primary/10 group-hover:text-primary'}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                    {item.title}
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                  </p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where did the old builder features go?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-3">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            <p><span className="font-medium text-gray-800">Templates &amp; themes</span> → Website Templates, Store Template</p>
            <p><span className="font-medium text-gray-800">Sections &amp; page layout</span> → Website Builder</p>
            <p><span className="font-medium text-gray-800">Colors, fonts, header</span> → Store Template</p>
            <p><span className="font-medium text-gray-800">Product page layout</span> → Store Template</p>
            <p><span className="font-medium text-gray-800">Catalog display fields</span> → Business Front Display</p>
            <p><span className="font-medium text-gray-800">Blog &amp; social links</span> → Blog Manager, Social &amp; Web Links</p>
          </div>
          <p className="text-xs text-gray-500 pt-2 border-t">
            Need the full block editor with live preview? Open <Link to="/websites" className="text-primary font-medium hover:underline">Website Builder</Link> and click <strong>Preview in Browser</strong> on any site.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
