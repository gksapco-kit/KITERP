import { useMemo } from 'react'
import BlockRenderer, { mergePageStyle } from '@storefront/components/builder/BlockRenderer'
import type { PublicSite, StyleConfig } from '@storefront/blocks/registry'
import { PreviewVendorProvider } from '@/components/websites/PreviewVendorProvider'
import type { PublicPreviewSite } from '@/lib/publicSitePreview'
import { findPublicPreviewPage } from '@/lib/publicSitePreview'

export function DraftPreviewRenderer({
  site,
  pageSlug,
  vendorSlug,
  previewToken,
}: {
  site: PublicPreviewSite
  pageSlug?: string | null
  vendorSlug: string
  previewToken: string
}) {
  const page = useMemo(() => findPublicPreviewPage(site, pageSlug), [site, pageSlug])
  const style = useMemo(
    () => mergePageStyle((site.style_config || {}) as Partial<StyleConfig>, page?.id),
    [site.style_config, page?.id],
  )

  if (!page) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-center text-gray-600">
        No page found for this preview.
      </div>
    )
  }

  const blocks = (page.blocks || []).filter(b => b.visible !== false)

  return (
    <PreviewVendorProvider slug={vendorSlug} siteName={site.name} previewToken={previewToken}>
      <BlockRenderer
        blocks={blocks as PublicSite['pages'][0]['blocks']}
        site={site as PublicSite}
        style={style}
      />
    </PreviewVendorProvider>
  )
}
