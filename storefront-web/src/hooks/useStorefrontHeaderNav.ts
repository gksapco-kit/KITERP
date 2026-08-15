import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { useBranch } from '@/contexts/BranchContext'
import { useVendor } from '@/contexts/VendorContext'
import { useEffectiveVendor } from '@/hooks/useEffectiveVendor'
import { useAssignedStorefrontTemplateId } from '@/hooks/useAssignedStorefrontTemplateId'
import { publicSitesApi } from '@/api/publicSites'
import {
  isWebsiteBuilderBlockTemplateId,
  isStorefrontCatalogTemplateId,
} from '@/lib/storefrontTemplateAssignment'
import {
  resolveStorefrontHeaderCta,
  resolveStorefrontHeaderNavLinks,
} from '@/lib/siteNavPages'
import { isVendorBlogEnabled, isVendorRentalsEnabled } from '@/lib/catalogNavCapabilities'
import type { NavLinkItem } from '@/kit/types'

export function useStorefrontHeaderNav(): {
  links: NavLinkItem[]
  cta?: { label: string; href: string }
  isLoading: boolean
} {
  const { pathname } = useLocation()
  const { storePath } = useBranch()
  const { vendor } = useVendor()
  const effectiveVendor = useEffectiveVendor()
  const { builderSite } = useBuilderSite()
  const assignedTemplateId = useAssignedStorefrontTemplateId()

  const needsTemplatePreview = !builderSite && !!assignedTemplateId && (
    isWebsiteBuilderBlockTemplateId(assignedTemplateId)
    || isStorefrontCatalogTemplateId(assignedTemplateId)
  )

  const { data: templateSite, isLoading } = useQuery({
    queryKey: ['storefront-header-nav-template', assignedTemplateId],
    queryFn: () => publicSitesApi.getWebsiteTemplatePreview(assignedTemplateId!),
    enabled: needsTemplatePreview,
    staleTime: 5 * 60 * 1000,
  })

  const site = builderSite ?? templateSite ?? null
  const offeringVendor = effectiveVendor ?? vendor

  const links = useMemo(
    () => resolveStorefrontHeaderNavLinks(site, storePath, pathname, {
      offeringType: offeringVendor?.offering_type,
      settings: offeringVendor?.settings,
      blogEnabled: isVendorBlogEnabled(offeringVendor?.settings),
      rentalsEnabled: isVendorRentalsEnabled(offeringVendor?.settings),
    }),
    [site, storePath, pathname, offeringVendor?.offering_type, offeringVendor?.settings],
  )

  const cta = useMemo(
    () => resolveStorefrontHeaderCta(site, storePath),
    [site, storePath],
  )

  return { links, cta, isLoading: needsTemplatePreview && isLoading }
}
