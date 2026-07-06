import { useState, type CSSProperties, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { imgUrl, cn } from '@/lib/utils'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { publicSitesApi } from '@/api/publicSites'
import { resolveSectionSurface } from '@/lib/navBlockLayout'
import { readSectionImageFocal } from '@/lib/sectionImageStyle'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderCtaButton } from '@/components/builder/BuilderCtaButton'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { builderSectionContainerClass } from '@/lib/builderSectionLayout'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

export default function CtaBlock({ site, style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const headline = resolveBlockTextField(props, 'headline', {
    fallback: () => (isEditorCanvas ? null : 'Ready to Get Started?'),
  })
  const subtitle = resolveBlockTextField(props, 'subtitle')
  const ctaLabel = resolveBlockTextField(props, 'cta_label', {
    fallback: () => (isEditorCanvas ? null : 'Get Started'),
  })
  const ctaSecondary = resolveBlockTextField(props, 'cta_secondary')
  const ctaUrl = (props.cta_url as string) || '/products'
  const ctaSecUrl = (props.cta_secondary_url as string) || '/about'
  const layout = String(props.layout ?? 'centered')
  const compact = props.compact === true
  const bgStyle = String(props.bg_style ?? 'gradient')
  const surface = resolveSectionSurface(props, style)
  const bgImageHidden = isBlockFieldHidden(props, 'bg_image_url')
  const bgImageRaw = bgImageHidden ? undefined : (props.bg_image_url as string | undefined)
  const usesImageBg = !!bgImageRaw
  const bgImageUrl = bgImageRaw ? imgUrl(bgImageRaw) : undefined
  const focal = readSectionImageFocal('bg_image_url', props)

  const shellStyle: CSSProperties = usesImageBg
    ? isEditorCanvas
      ? { color: '#fff' }
      : {
          backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.45)), url(${bgImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: `${focal.x}% ${focal.y}%`,
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

  const showEmail = props.show_email === true
  const [email, setEmail] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !site?.id) return
    setSubscribing(true)
    try {
      await publicSitesApi.submitNewsletter(site.id, email)
      setSubscribed(true)
    } catch {
      alert('Subscription failed, please try again')
    } finally {
      setSubscribing(false)
    }
  }

  const emailForm = showEmail ? (
    subscribed ? (
      <p className={cn('text-sm font-semibold', textLight ? 'text-white' : 'text-green-600')}>
        You&apos;re subscribed! 🎉
      </p>
    ) : (
      <form
        onSubmit={handleSubscribe}
        className={cn('flex flex-wrap gap-2 w-full', isSplit ? 'max-w-sm shrink-0' : 'max-w-md mx-auto')}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className={cn(
            'flex-1 min-w-[10rem] px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 border',
            textLight
              ? 'bg-white/10 border-white/30 text-white placeholder:text-white/60'
              : 'bg-white border-gray-200 text-gray-900',
          )}
        />
        <button
          type="submit"
          disabled={subscribing}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-base hover:opacity-90 transition-all disabled:opacity-60"
          style={{
            backgroundColor: textLight ? '#fff' : style.primary_color,
            color: textLight ? style.primary_color : '#fff',
          }}
        >
          {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : ctaLabel || 'Subscribe'}
        </button>
      </form>
    )
  ) : null

  const showPrimary = !showEmail && ctaLabel && !isBlockFieldHidden(props, 'cta_label')
  const showSecondary = !showEmail && ctaSecondary && !isBlockFieldHidden(props, 'cta_secondary')

  const ctaButtons = (showPrimary || showSecondary) ? (
    <div className={cn('flex gap-3 flex-wrap', isSplit ? 'shrink-0' : 'justify-center')}>
      {showPrimary && (
        <BuilderCtaButton
          fieldKey="cta_label"
          blockId={blockId}
          blockProps={props}
          label={ctaLabel!}
          href={ctaUrl}
          allowElementDelete={isEditorCanvas}
          className="inline-flex items-center px-8 py-4 font-bold rounded-xl hover:opacity-90 transition-all text-base"
          style={{
            backgroundColor: textLight ? '#fff' : style.primary_color,
            color: textLight ? style.primary_color : '#fff',
          }}
        />
      )}
      {showSecondary && (
        <BuilderCtaButton
          fieldKey="cta_secondary"
          blockId={blockId}
          blockProps={props}
          label={ctaSecondary!}
          href={ctaSecUrl}
          allowElementDelete={isEditorCanvas}
          className="inline-flex items-center px-8 py-4 font-semibold rounded-xl border-2 hover:opacity-80 transition-all text-base"
          style={{
            borderColor: textLight ? 'rgba(255,255,255,0.5)' : `${style.text_color}66`,
            color: textLight ? '#fff' : style.text_color,
          }}
        />
      )}
    </div>
  ) : null

  const showHeadline = !isBlockFieldHidden(props, 'headline') && (headline || isEditorCanvas)
  const showSubtitle = !isBlockFieldHidden(props, 'subtitle') && (subtitle || isEditorCanvas)

  return (
    <section className={builderSectionContainerClass()}>
      <div
        className={cn(
          'max-w-5xl mx-auto builder-site-card rounded-3xl',
          innerPad,
          isSplit ? 'flex flex-col md:flex-row md:items-center md:justify-between gap-8 text-left' : 'text-center max-w-4xl',
          isCard && 'border-2 shadow-lg',
          isCard && !textLight && 'border-gray-200 bg-white',
          usesImageBg && 'relative overflow-hidden',
        )}
        style={shellStyle}
      >
        {isEditorCanvas && usesImageBg && bgImageUrl ? (
          <div className="absolute inset-0 z-0">
            <BuilderSectionImage
              blockId={blockId}
              field="bg_image_url"
              blockProps={props}
              src={bgImageUrl}
              className="absolute inset-0 h-full w-full"
            />
          </div>
        ) : null}
        {usesImageBg && props.overlay !== false ? (
          <div className="pointer-events-none absolute inset-0 z-[1] bg-black/45" aria-hidden />
        ) : null}
        <div className={cn(isSplit ? 'flex-1 min-w-0' : undefined, usesImageBg && 'relative z-[2]')}>
          {showHeadline && (
            <BuilderTextField
              fieldKey="headline"
              blockId={blockId}
              blockProps={props}
              value={headline ?? ''}
              as="h2"
              className={cn('font-bold mb-4', compact ? 'text-2xl' : 'text-3xl sm:text-4xl')}
              style={{ fontFamily: style.font_heading }}
            />
          )}
          {showSubtitle && (
            <BuilderTextField
              fieldKey="subtitle"
              blockId={blockId}
              blockProps={props}
              value={subtitle ?? ''}
              as="p"
              multiline
              className={cn('text-lg mb-8 max-w-xl', !isSplit && 'mx-auto', textLight ? 'text-white/80' : 'opacity-80')}
              placeholder="Add a subtitle"
            />
          )}
          {!isSplit && (showEmail ? emailForm : ctaButtons)}
        </div>
        {isSplit && (showEmail || ctaButtons) ? (
          <div className={usesImageBg ? 'relative z-[2]' : undefined}>{showEmail ? emailForm : ctaButtons}</div>
        ) : null}
        {Boolean(props.show_credit_card_note) && !isSplit && (
          <p className={cn('text-xs mt-3', usesImageBg && 'relative z-[2]', textLight ? 'text-white/60' : 'text-gray-500')}>
            No credit card required
          </p>
        )}
      </div>
    </section>
  )
}
