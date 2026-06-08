import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { imgUrl, cn } from '@/lib/utils'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { resolveSectionSurface } from '@/lib/navBlockLayout'

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
  const ctaSecondary = (props.cta_secondary as string) || null
  const ctaUrl = (props.cta_url as string) || '/products'
  const ctaSecUrl = (props.cta_secondary_url as string) || '/about'
  const layout = String(props.layout ?? 'centered')
  const compact = props.compact === true
  const bgStyle = String(props.bg_style ?? 'gradient')
  const surface = resolveSectionSurface(props, style)
  const bgImageRaw = props.bg_image_url as string | undefined
  const usesImageBg = !!bgImageRaw && (bgStyle === 'image' || !!props.overlay)

  const shellStyle: CSSProperties = usesImageBg
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.45)), url(${imgUrl(bgImageRaw)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#fff',
      }
    : {
        background: surface.background,
        color: surface.color,
      }

  const textLight = surface.isDark || usesImageBg || bgStyle !== 'light'
  const innerPad = compact ? 'p-8' : 'p-12'
  const isSplit = layout === 'split'
  const isCard = layout === 'card'

  const ctaButtons = (
    <div className={cn('flex gap-3 flex-wrap', isSplit ? 'shrink-0' : 'justify-center')}>
      <Link
        to={storePath(ctaUrl)}
        className="inline-flex items-center px-8 py-4 font-bold rounded-xl hover:opacity-90 transition-all text-base"
        style={{
          backgroundColor: textLight ? '#fff' : style.primary_color,
          color: textLight ? style.primary_color : '#fff',
        }}
      >
        {ctaLabel}
      </Link>
      {ctaSecondary && (
        <Link
          to={storePath(ctaSecUrl)}
          className="inline-flex items-center px-8 py-4 font-semibold rounded-xl border-2 hover:opacity-80 transition-all text-base"
          style={{
            borderColor: textLight ? 'rgba(255,255,255,0.5)' : `${style.text_color}66`,
            color: textLight ? '#fff' : style.text_color,
          }}
        >
          {ctaSecondary}
        </Link>
      )}
    </div>
  )

  return (
    <section className={cn('px-4 sm:px-6 lg:px-8', compact ? 'py-10' : 'py-16')}>
      <div
        className={cn(
          'max-w-5xl mx-auto rounded-3xl',
          innerPad,
          isSplit ? 'flex flex-col md:flex-row md:items-center md:justify-between gap-8 text-left' : 'text-center max-w-4xl',
          isCard && 'border-2 shadow-lg',
          isCard && !textLight && 'border-gray-200 bg-white',
        )}
        style={shellStyle}
      >
        <div className={isSplit ? 'flex-1 min-w-0' : undefined}>
          <h2 className={cn('font-bold mb-4', compact ? 'text-2xl' : 'text-3xl sm:text-4xl')} style={{ fontFamily: style.font_heading }}>
            {headline}
          </h2>
          {subtitle && (
            <p className={cn('text-lg mb-8 max-w-xl', !isSplit && 'mx-auto', textLight ? 'text-white/80' : 'opacity-80')}>
              {subtitle}
            </p>
          )}
          {!isSplit && ctaButtons}
        </div>
        {isSplit && ctaButtons}
        {Boolean(props.show_credit_card_note) && !isSplit && (
          <p className={`text-xs mt-3 ${textLight ? 'text-white/60' : 'text-gray-500'}`}>No credit card required</p>
        )}
      </div>
    </section>
  )
}
