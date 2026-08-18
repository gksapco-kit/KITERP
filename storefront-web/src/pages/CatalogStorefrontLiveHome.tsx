/**
 * Live storefront home when the published wb site was created from a storefront_*
 * catalog template — matches /template-browser/:id (React shell + theme).
 */
import { lazy, Suspense, useMemo, type ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { useEffectiveVendor } from '@/hooks/useEffectiveVendor'
import { StorefrontProvider } from '@/storefront/StorefrontContext'
import { vendorCatalogAdapter } from '@/storefront/adapters/vendorCatalog'
import { buildStorefrontConfigFromSiteStyle } from '@/storefront/buildStorefrontConfigFromSite'
import type { StorefrontConfig } from '@/storefront/theming'

const FashionTemplate = lazy(() =>
  import('@/storefront/templates/FashionTemplate').then((m) => ({ default: m.FashionTemplate })),
)
const ElectronicsTemplate = lazy(() =>
  import('@/storefront/templates/ElectronicsTemplate').then((m) => ({ default: m.ElectronicsTemplate })),
)
const RestaurantTemplate = lazy(() =>
  import('@/storefront/templates/RestaurantTemplate').then((m) => ({ default: m.RestaurantTemplate })),
)
const ServicesTemplate = lazy(() =>
  import('@/storefront/templates/ServicesTemplate').then((m) => ({ default: m.ServicesTemplate })),
)

const LIVE_TEMPLATES: Record<
  string,
  ComponentType<{ config?: StorefrontConfig; basePath?: string; liveCatalog?: boolean }>
> = {
  storefront_fashion: FashionTemplate,
  storefront_electronics: ElectronicsTemplate,
  storefront_restaurant: RestaurantTemplate,
  storefront_services: ServicesTemplate,
}

interface Props {
  catalogTemplateId: string
}

export default function CatalogStorefrontLiveHome({ catalogTemplateId }: Props) {
  const { vendorSlug = '' } = useParams<{ vendorSlug: string }>()
  const vendor = useEffectiveVendor()
  const { builderSite } = useBuilderSite()
  const Template = LIVE_TEMPLATES[catalogTemplateId]

  const basePath = `/${vendorSlug}`
  const rawKey = catalogTemplateId.replace(/^storefront_/, '')

  const config = useMemo(
    () =>
      buildStorefrontConfigFromSiteStyle(
        rawKey,
        vendor?.display_name || builderSite?.name || 'Store',
        (builderSite?.style_config || {}) as Record<string, unknown>,
      ),
    [rawKey, vendor?.display_name, builderSite?.name, builderSite?.style_config],
  )

  if (!Template) return null

  return (
    <StorefrontProvider adapter={vendorCatalogAdapter}>
      <Suspense
        fallback={
          <div className="min-h-[50vh] flex items-center justify-center bg-white">
            <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
          </div>
        }
      >
        <Template config={config} basePath={basePath} liveCatalog />
      </Suspense>
    </StorefrontProvider>
  )
}
