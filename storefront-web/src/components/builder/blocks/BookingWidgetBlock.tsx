import { Link } from 'react-router-dom'
import { Clock, ArrowRight } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderCtaButton } from '@/components/builder/BuilderCtaButton'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { builderSectionContainerClass, builderSectionContainerWithMax } from '@/lib/builderSectionLayout'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

export default function BookingWidgetBlock({ style, props, liveItems, blockId }: Props) {
  const { storePath } = useVendor()
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId

  const title = resolveBlockTextField(props, 'title')
  const subtitle = resolveBlockTextField(props, 'subtitle')
  const ctaLabel = resolveBlockTextField(props, 'cta_label')
  const ctaUrl = String(props.cta_url ?? '/services').trim() || '/services'

  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const showSubtitle = !isBlockFieldHidden(props, 'subtitle') && (subtitle || isEditorCanvas)
  const showCta = !isBlockFieldHidden(props, 'cta_label') && (ctaLabel || isEditorCanvas)

  const services = liveItems.slice(0, 6)

  return (
    <section className={builderSectionContainerWithMax('max-w-4xl')}>
      {(showTitle || showSubtitle) && (
        <div className="text-center mb-10">
          {showTitle && (
            <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h2" className="text-3xl font-bold text-gray-900 mb-2" placeholder="Section title" />
          )}
          {showSubtitle && (
            <BuilderTextField fieldKey="subtitle" blockId={blockId} blockProps={props} value={subtitle ?? ''} as="p" multiline className="text-gray-500" placeholder="Section subtitle" />
          )}
        </div>
      )}
      {services.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(svc => (
            <div key={svc.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow max-h-[90vh] overflow-y-auto">
              <h3 className="font-semibold text-gray-900 mb-1">{svc.title}</h3>
              {!!svc.meta?.duration_minutes && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mb-2"><Clock className="w-3 h-3" />{Number(svc.meta.duration_minutes)} min</p>
              )}
              {svc.price_formatted && <p className="font-bold mb-3" style={{ color: style.primary_color }}>{svc.price_formatted}</p>}
              <Link to={svc.url ? storePath(svc.url) : storePath('/services')} className="text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all" style={{ color: style.primary_color }}>
                Book <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      ) : showCta ? (
        <div className="text-center">
          {isEditorCanvas ? (
            <BuilderCtaButton
              fieldKey="cta_label"
              blockId={blockId}
              blockProps={props}
              label={ctaLabel ?? ''}
              href={ctaUrl}
              allowElementDelete={isEditorCanvas}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold hover:opacity-90 transition-all"
              style={{ backgroundColor: style.primary_color }}
            />
          ) : (
            <Link to={storePath(ctaUrl)} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold hover:opacity-90 transition-all" style={{ backgroundColor: style.primary_color }}>
              {ctaLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      ) : null}
    </section>
  )
}
