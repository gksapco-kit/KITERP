import { Award } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { arrayItemImageFrameStyle, arrayItemImageRenderStyle } from '@/lib/sectionImageStyle'
import { sectionGridColumnClass } from '@/lib/sectionItemLayout'
import { cn, imgUrl } from '@/lib/utils'
import {
  arrayImageDeleteFieldKey,
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
  visibleArrayEntries,
} from '@/lib/blockHiddenFields'

/** 1×1 transparent pixel — keeps an empty editable slot from rendering a broken-image / alt-text box. */
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

type LogoProp = { image_url?: string | null; name?: string | null; url?: string | null }

type Renderable = {
  key: string | number
  src: string
  alt: string
  hasImage: boolean
  item?: Record<string, unknown>
  editIndex?: number
}

const hasLogoImage = (logo?: LogoProp | null): boolean =>
  typeof logo?.image_url === 'string' && logo.image_url.trim().length > 0

export default function TrustLogosBlock({ style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = Boolean(builderCanvas?.isEditorCanvas && blockId)
  const title = resolveBlockTextField(props, 'title')
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  // ── Layout variant props (driven by the layout picker presets) ──────────────
  const layout = String(props.layout ?? 'strip')
  const isDark = props.bg_style === 'dark'
  const grayscale = props.grayscale !== false
  const compact = props.compact === true
  const size = props.size === 'large' ? 'large' : compact ? 'compact' : 'normal'
  const columns = Math.min(Math.max(Number(props.columns ?? 4) || 4, 2), 6)

  // Logo tint / treatment. On a dark strip logos read best knocked out to white.
  const filterClass = isDark
    ? 'brightness-0 invert opacity-80 hover:opacity-100 transition-all'
    : grayscale
      ? 'grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all'
      : 'opacity-90 hover:opacity-100 transition-all'
  const heightClass = size === 'large' ? 'h-16' : size === 'compact' ? 'h-8' : 'h-10'
  const wrapperClass = size === 'large' ? 'h-16 w-44' : size === 'compact' ? 'h-8 w-24' : 'h-12 w-32'
  const gapClass = compact ? 'gap-6' : layout === 'marquee' ? 'gap-12' : 'gap-8'

  const manualLogosRaw = Array.isArray(props.logos) ? (props.logos as LogoProp[]) : []
  const manualLogos = visibleArrayEntries(manualLogosRaw, props, 'logos').map(({ item: logo, index }) => ({ logo, index }))
  const hasManualImages = manualLogosRaw.some(logo => hasLogoImage(logo))
  const liveLogos = liveItems.filter(i => i.image_url)
  // Manual logos win over the live media source and are editable. In the editor show every
  // manual slot (even empty) so they stay clickable to add a photo.
  const useManual = hasManualImages || (isEditorCanvas && manualLogosRaw.length > 0)

  if (!useManual && liveLogos.length === 0) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title ?? undefined}
        message="Partner and trust logos will show here. Add logos in Section Edit, or connect this section to your media library."
        icon={<Award className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }

  const renderables: Renderable[] = useManual
    ? (isEditorCanvas ? manualLogos : manualLogos.filter(entry => hasLogoImage(entry.logo))).map(
        ({ logo, index }) => ({
          key: index,
          editIndex: index,
          item: logo as Record<string, unknown>,
          src: hasLogoImage(logo) ? imgUrl(logo.image_url as string) : TRANSPARENT_PIXEL,
          alt: hasLogoImage(logo) ? logo.name || 'Logo' : '',
          hasImage: hasLogoImage(logo) && !isBlockFieldHidden(props, arrayImageDeleteFieldKey('logos', index, 'image_url')),
        }),
      )
    : liveLogos.map(l => ({
        key: l.id,
        src: imgUrl(l.image_url as string),
        alt: l.title,
        hasImage: true,
      }))

  const renderLogo = (r: Renderable) => {
    const showImage = r.hasImage || (isEditorCanvas && r.editIndex != null && !isNestedBlockFieldHidden(props, arrayImageDeleteFieldKey('logos', r.editIndex, 'image_url')))
    const showName = r.editIndex != null && !isNestedBlockFieldHidden(props, `logos.${r.editIndex}.name`)

    if (isEditorCanvas && r.editIndex != null) {
      return (
        <div key={r.key} className="flex flex-col items-center gap-2 shrink-0">
          {showImage && (
            <div
              className={cn('relative overflow-hidden rounded-md shrink-0', wrapperClass)}
              style={{
                backgroundColor: r.hasImage ? undefined : `${style.primary_color}10`,
                ...(r.item ? arrayItemImageFrameStyle(r.item) : {}),
              }}
            >
              <BuilderSectionImage
                blockId={blockId}
                field="image_url"
                arrayKey="logos"
                index={r.editIndex}
                itemField="image_url"
                blockProps={props}
                src={r.src}
                alt={r.alt}
                className={cn('absolute inset-0 h-full w-full', filterClass)}
                empty={!r.hasImage}
              />
            </div>
          )}
          {showName && (
            <BuilderTextField
              fieldKey={`logos.${r.editIndex}.name`}
              blockId={blockId}
              blockProps={props}
              value={String(r.item?.name ?? '')}
              as="span"
              className="text-xs text-gray-400 text-center max-w-[8rem] truncate"
              placeholder="Brand name"
              skipPositionWrapper
            />
          )}
        </div>
      )
    }
    return (
      <img
        key={r.key}
        src={r.src}
        alt={r.alt}
        className={cn(heightClass, 'w-auto shrink-0 object-contain', filterClass)}
        style={r.item ? arrayItemImageRenderStyle(r.item, props) : undefined}
        loading="lazy"
        onError={e => {
          // Hide a logo whose URL no longer resolves instead of showing a broken-image glyph.
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }

  const strip = (
    <div className={cn('flex flex-wrap justify-center items-center', gapClass)}>
      {renderables.map(renderLogo)}
    </div>
  )

  let content: JSX.Element = strip
  if (layout === 'grid') {
    content = (
      <div className={cn('grid items-center justify-items-center', gapClass, sectionGridColumnClass(columns))}>
        {renderables.map(renderLogo)}
      </div>
    )
  } else if (layout === 'card') {
    content = (
      <div className={cn('rounded-2xl border bg-white shadow-sm', isDark ? 'border-white/10' : 'border-gray-200', compact ? 'p-6' : 'p-8')}>
        {strip}
      </div>
    )
  } else if (layout === 'marquee' && !isEditorCanvas) {
    // Seamless auto-scroll: duplicate the row so the -50% keyframe loops without a jump.
    content = (
      <div className="overflow-hidden">
        <div className={cn('sf-marquee-track items-center', gapClass)}>
          {renderables.map(r => renderLogo({ ...r, key: `m-${r.key}`, editIndex: undefined }))}
          {renderables.map(r => renderLogo({ ...r, key: `d-${r.key}`, editIndex: undefined }))}
        </div>
      </div>
    )
  }

  return (
    <section className={cn('px-4 sm:px-6 lg:px-8', compact ? 'py-8' : 'py-12', isDark && 'bg-gray-900')}>
      <div className="max-w-6xl mx-auto">
        {(showTitle) && (
          <BuilderTextField
            fieldKey="title"
            blockId={blockId}
            blockProps={props}
            value={title ?? ''}
            as="p"
            className={cn('text-center text-sm font-semibold uppercase tracking-widest mb-8', isDark ? 'text-gray-500' : 'text-gray-400')}
            placeholder="Section title"
          />
        )}
        {content}
      </div>
    </section>
  )
}
