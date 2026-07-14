/**
 * Catalog-only preview shell — never mounts live template home, builder pages, or store nav.
 * Used by vendor-web /preview/draft?route=… iframe embeds.
 */
import { useEffect } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { VendorProvider } from '@/contexts/VendorContext'
import { StorefrontDisplayFieldsBridge } from '@/contexts/StorefrontDisplayFieldsBridge'
import { BuilderSitePreviewProvider } from '@/contexts/BuilderSiteContext'
import { BranchProvider } from '@/contexts/BranchContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import StorefrontBuAuthSync from '@/components/store/StorefrontBuAuthSync'
import {
  draftCatalogPathToEmbedRoute,
  rememberDraftCatalogPreviewTokenFromPath,
} from '@/lib/draftCatalogEmbed'
import { notifyDraftPreviewParentRoute } from '@/lib/draftEmbedPreview'

function DraftCatalogEmbedContent() {
  const { pathname } = useLocation()
  const { vendorSlug } = useParams<{ vendorSlug: string }>()

  useEffect(() => {
    rememberDraftCatalogPreviewTokenFromPath(pathname)
  }, [pathname])

  useEffect(() => {
    if (!vendorSlug) return
    const route = draftCatalogPathToEmbedRoute(pathname, vendorSlug)
    if (route) notifyDraftPreviewParentRoute(route)
  }, [pathname, vendorSlug])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}

export default function DraftCatalogEmbedShell() {
  return (
    <VendorProvider>
      <BuilderSitePreviewProvider>
        <BranchProvider>
          <StorefrontDisplayFieldsBridge>
            <ThemeProvider>
              <StorefrontBuAuthSync />
              <DraftCatalogEmbedContent />
            </ThemeProvider>
          </StorefrontDisplayFieldsBridge>
        </BranchProvider>
      </BuilderSitePreviewProvider>
    </VendorProvider>
  )
}
