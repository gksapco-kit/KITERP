import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { imgUrl } from '@/lib/utils'
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
  const bgStyle = String(props.bg_style ?? 'gradient')
  const bgImageRaw = props.bg_image_url as string | undefined
  const usesImageBg = !!bgImageRaw && (bgStyle === 'image' || !!props.overlay)
  const gradientFrom = props.gradient_from as string | undefined
  const gradientTo = props.gradient_to as string | undefined
  const gradientDir = (props.gradient_dir as string) || '135deg'
  const brandGrad =
    gradientFrom && gradientTo
      ? `linear-gradient(${gradientDir}, ${gradientFrom}, ${gradientTo})`
      : `linear-gradient(135deg, ${style.primary_color}, ${style.secondary_color})`

  const shellStyle: CSSProperties =
    bgStyle === 'dark'
      ? { background: '#0f172a', color: '#fff' }
      : bgStyle === 'light'
        ? { background: style.surface_color || '#f9fafb', color: style.text_color }
        : usesImageBg
          ? {
              backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.45)), url(${imgUrl(bgImageRaw)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: '#fff',
            }
          : {
              background: brandGrad,
              color: '#fff',
            }

  const textLight = bgStyle !== 'light'

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center rounded-3xl p-12" style={shellStyle}>
        <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: style.font_heading }}>
          {headline}
        </h2>
        {subtitle && (
          <p className={`text-lg mb-8 max-w-xl mx-auto ${textLight ? 'text-white/80' : ''}`} style={textLight ? undefined : { color: `${style.text_color}99` }}>
            {subtitle}
          </p>
        )}
        <Link
          to={storePath(ctaUrl)}
          className="inline-flex items-center px-8 py-4 font-bold rounded-xl hover:opacity-90 transition-all hover:scale-105 text-base"
          style={{
            backgroundColor: textLight ? '#fff' : style.primary_color,
            color: textLight ? style.primary_color : '#fff',
          }}
        >
          {ctaLabel}
        </Link>
        {Boolean(props.show_credit_card_note) && (
          <p className={`text-xs mt-3 ${textLight ? 'text-white/60' : 'text-gray-500'}`}>No credit card required</p>
        )}
      </div>
    </section>
  )
}
