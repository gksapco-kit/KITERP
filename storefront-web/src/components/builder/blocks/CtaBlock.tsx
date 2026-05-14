import { Link } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

export default function CtaBlock({ style, props }: Props) {
  const { storePath } = useVendor()
  const headline = (props.headline as string) || 'Ready to Get Started?'
  const subtitle = (props.subtitle as string) || ''
  const ctaLabel = (props.cta_label as string) || 'Get Started'
  const ctaUrl = (props.cta_url as string) || '/products'

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-primary to-emerald-800 rounded-3xl p-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{headline}</h2>
        {subtitle && <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">{subtitle}</p>}
        <Link
          to={storePath(ctaUrl)}
          className="inline-flex items-center px-8 py-4 bg-white font-bold rounded-xl hover:bg-gray-50 transition-all hover:scale-105 text-base"
          style={{ color: style.primary_color }}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  )
}
