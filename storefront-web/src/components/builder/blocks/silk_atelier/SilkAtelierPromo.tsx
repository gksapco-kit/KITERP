import { useState } from 'react'
import { Gift } from 'lucide-react'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { imgUrl, cn } from '@/lib/utils'
import { SilkAtelierLink, asStringList, useSilkAtelierTheme } from './shared'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  blockId?: string
  isEditorCanvas?: boolean
}

/** Festive promo / gift-card band with selectable amount chips. */
export default function SilkAtelierPromo({ style, props }: Props) {
  const theme = useSilkAtelierTheme(style, props)
  const amounts = asStringList(props.amounts)
  const [picked, setPicked] = useState(0)
  const bgImage = imgUrl(props.bg_image as string)

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        background: `linear-gradient(120deg, ${theme.primary} 0%, #7A1650 100%)`,
        fontFamily: theme.bodyFont,
        color: '#fff',
      }}
    >
      {bgImage ? <img src={bgImage} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-25" /> : null}
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-8 px-4 py-12 sm:px-8 sm:py-16 md:grid-cols-[1.3fr_1fr]">
        <div>
          {props.eyebrow ? (
            <p className="text-[11px] font-semibold uppercase italic tracking-[0.28em]" style={{ color: theme.accent }}>{String(props.eyebrow)}</p>
          ) : null}
          <h2 className="mt-3 text-3xl leading-tight sm:text-4xl" style={{ fontFamily: theme.headingFont }}>
            {String(props.title_before || '')}{' '}
            <em className="font-normal italic" style={{ color: '#F2D58C' }}>{String(props.title_accent || '')}</em>{' '}
            {String(props.title_after || '')}
          </h2>
          {props.subtitle ? <p className="mt-3 max-w-lg text-[15px] text-white/80">{String(props.subtitle)}</p> : null}
        </div>
        <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm" style={{ border: `1px solid ${theme.accent}66` }}>
          {amounts.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>{String(props.amounts_label || 'Choose a value')}</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {amounts.map((a, i) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setPicked(i)}
                    aria-pressed={picked === i}
                    className={cn('rounded-full px-4 py-2 text-sm font-bold transition')}
                    style={picked === i ? { background: theme.accent, color: theme.primary } : { background: 'transparent', color: '#fff', border: `1px solid ${theme.accent}99` }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </>
          )}
          <SilkAtelierLink
            to={String(props.cta_url || '/contact')}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold italic"
            style={{ color: theme.primary }}
          >
            <Gift className="h-4 w-4" aria-hidden /> {String(props.cta_label || 'Gift a card')}
          </SilkAtelierLink>
        </div>
      </div>
    </section>
  )
}
