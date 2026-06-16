/**
 * Live storefront home for website-builder catalog templates (portfolio, verde, …).
 * Loads the same PublicSite JSON as /template-browser/:id and renders via BlockRenderer.
 */
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import BlockRenderer from '@/components/builder/BlockRenderer'
import AnalyticsInjector from '@/components/builder/AnalyticsInjector'
import { useBranch } from '@/contexts/BranchContext'
import { publicSitesApi } from '@/api/publicSites'
import type { PublicPage, PublicSite } from '@/blocks/registry'

function pickHomePage(site: PublicSite): PublicPage | null {
  const pages = site.pages || []
  return pages.find(p => p.is_homepage) || pages[0] || null
}

type Props = {
  templateId: string
}

export default function WebsiteBuilderTemplateLiveHome({ templateId }: Props) {
  const { branchCode } = useBranch()
  const [site, setSite] = useState<PublicSite | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    publicSitesApi
      .getWebsiteTemplatePreview(templateId)
      .then(data => {
        if (!cancelled) setSite(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [templateId])

  const pageBg = (site?.style_config as { bg_color?: string } | undefined)?.bg_color

  useEffect(() => {
    if (!pageBg) return
    const prevBg = document.body.style.backgroundColor
    document.body.style.backgroundColor = pageBg
    return () => {
      document.body.style.backgroundColor = prevBg
    }
  }, [pageBg])

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (failed || !site) return null

  const page = pickHomePage(site)
  if (!page) return null

  return (
    <>
      <AnalyticsInjector site={site} />
      <BlockRenderer
        blocks={page.blocks || []}
        site={site}
        pageId={page.id}
        branchCode={branchCode}
      />
    </>
  )
}
