/**
 * ContactOrBuilder — `/contact` on vendor storefronts.
 * When the published website builder has a Contact page with blocks, render it;
 * otherwise fall back to the legacy contact form + settings address.
 */
import { Loader2 } from 'lucide-react'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { shouldRenderBuilderStaticPage } from '@/lib/builderStaticPageRoute'
import BuilderPage from '@/pages/BuilderPage'
import ContactPage from '@/pages/Contact'

export default function ContactOrBuilder() {
  const { builderSite, isLoading } = useBuilderSite()

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (shouldRenderBuilderStaticPage(builderSite, 'contact')) {
    return <BuilderPage slug="contact" />
  }

  return <ContactPage />
}
