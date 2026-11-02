import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { imgUrl } from '@/lib/utils'
import { SilkAtelierLink, useSilkAtelierTheme } from './shared'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  blockId?: string
  isEditorCanvas?: boolean
}

/** Full-width festive banner: photo on one side, headline + offer on the other. */
export default function SilkAtelierHero({ style, props }: Props) {
  const theme = useSilkAtelierTheme(style, props)
  const image = imgUrl(props.image_url as string)
  const textRight = props.text_align !== 'left'
  const minHeight = Math.max(280, Math.min(720, Number(props.min_height) || 460))

  return (
    <section className="relative block w-full overflow-hidden leading-none" style={{ background: theme.primary, minHeight, fontFamily: theme.bodyFont }}>
      {image ? <img src={image} alt={String(props.image_alt || '')} className="absolute inset-0 h-full w-full object-cover object-left" /> : null}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: `linear-gradient(${textRight ? '90deg' : '270deg'}, transparent 30%, ${theme.primary}cc 78%, ${theme.primary} 100%)` }}
      />
      <div className="relative mx-auto flex max-w-[1400px] px-6 py-14 sm:px-10" style={{ minHeight, justifyContent: textRight ? 'flex-end' : 'flex-start', alignItems: 'center' }}>
        <div className="w-full max-w-lg text-center md:text-left" style={{ color: '#fff' }}>
          {props.eyebrow ? (
            <p className="text-[11px] font-semibold uppercase italic tracking-[0.32em]" style={{ color: theme.accent }}>{String(props.eyebrow)}</p>
          ) : null}
          <h1 className="mt-3 text-5xl leading-[1.02] sm:text-6xl" style={{ fontFamily: theme.headingFont }}>
            <span className="block" style={{ color: '#F2D58C' }}>{String(props.headline || '')}</span>
            {props.headline_accent ? <em className="block font-normal italic" style={{ color: '#fff' }}>{String(props.headline_accent)}</em> : null}
          </h1>
          {props.offer ? (
            <p className="mt-4 text-lg font-semibold uppercase tracking-[0.18em]" style={{ color: theme.accent }}>{String(props.offer)}</p>
          ) : null}
          {props.subtitle ? <p className="mt-3 text-[15px] text-white/80">{String(props.subtitle)}</p> : null}
          <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
            {props.cta_primary ? (
              <SilkAtelierLink
                to={String(props.cta_primary_url || '/products')}
                className="rounded-full px-7 py-3 text-sm font-semibold italic transition hover:opacity-90"
                style={{ background: theme.accent, color: theme.primary }}
              >
                {String(props.cta_primary)}
              </SilkAtelierLink>
            ) : null}
            {props.cta_secondary ? (
              <SilkAtelierLink
                to={String(props.cta_secondary_url || '/new-arrivals')}
                className="rounded-full border px-7 py-3 text-sm font-semibold italic transition hover:bg-white/10"
                style={{ borderColor: `${theme.accent}aa`, color: '#fff' }}
              >
                {String(props.cta_secondary)}
              </SilkAtelierLink>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
