import { Users } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { cn, imgUrl } from '@/lib/utils'
import {
  resolveTeamGridMembers,
  teamGridColumnClass,
  teamPropMembers,
} from '@/lib/teamGridContent'
import { sectionGridColumnClass, iconBoxShapeClass, imageShapeFromProps, imageShapeRadiusClass } from '@/lib/sectionItemLayout'
import { arrayItemImageFrameStyle, arrayItemImageRenderStyle } from '@/lib/sectionImageStyle'

/** 1×1 transparent pixel — keeps an empty editable slot from rendering a broken-image / alt-text box. */
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

export default function TeamGridBlock({ style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = Boolean(builderCanvas?.isEditorCanvas && blockId)
  const title = (props.title as string) || 'Our team'
  const description = (props.description as string) || ''
  const columns = Number(props.columns ?? 4)
  const itemGap = Number(props.item_gap ?? 24)
  const itemSize = Number(props.item_size ?? 160)
  const cardStyle = String(props.card_style ?? 'card')
  const isMinimal = cardStyle === 'minimal'
  const avatarSize = Math.round(itemSize * (isMinimal ? 0.45 : 0.55))
  const imageShape = imageShapeFromProps(props, 'circle')
  const avatarClass = imageShapeRadiusClass(imageShape)

  const { useLive, items } = resolveTeamGridMembers(props, liveItems)
  // Map each rendered (named) member back to its props.members[] index so the
  // section-image toolbar (fit / zoom / focal) patches the right entry.
  const memberSourceIndices = !useLive
    ? teamPropMembers(props)
        .map((m, i) => ({ named: String(m?.name || '').trim().length > 0, i }))
        .filter(entry => entry.named)
        .map(entry => entry.i)
    : []
  // Manual members carry editable avatars; live ERP team photos are not editable here.
  const allowImageEditing = isEditorCanvas && !useLive

  if (items.length === 0) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title}
        message="Your team will appear here once you add staff in People or edit the sample members in the builder."
        hint="Tip: double-click section text on the canvas to customize names and roles."
        icon={<Users className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {(title || blockId) && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className="text-3xl font-bold text-gray-900 mb-4 text-center" />
      )}
      {(description || blockId) && (
        <BuilderTextField fieldKey="description" blockId={blockId} blockProps={props} value={description} as="p" multiline className="text-center text-sm text-gray-500 mb-10 max-w-2xl mx-auto" placeholder="Optional description" />
      )}
      <div
        className={`grid ${sectionGridColumnClass(columns)} mx-auto`}
        style={{ gap: `${itemGap}px`, maxWidth: columns >= 5 ? '100%' : '1000px' }}
      >
        {items.map((member, idx) => {
          const rawMember = !useLive
            ? (teamPropMembers(props)[memberSourceIndices[idx]] as Record<string, unknown> | undefined)
            : undefined
          return (
          <div
            key={member.id}
            className={`text-center ${!isMinimal ? 'p-4 rounded-2xl border border-gray-100 bg-white shadow-sm' : 'p-2'}`}
          >
            {allowImageEditing ? (
              <div
                className={cn(avatarClass, 'relative mx-auto mb-3 overflow-hidden')}
                style={{
                  width: avatarSize,
                  height: avatarSize,
                  backgroundColor: member.image_url ? undefined : `${style.primary_color}14`,
                  ...arrayItemImageFrameStyle(rawMember ?? {}),
                }}
              >
                <BuilderSectionImage
                  blockId={blockId}
                  field="avatar_url"
                  arrayKey="members"
                  index={memberSourceIndices[idx] ?? idx}
                  itemField="avatar_url"
                  blockProps={props}
                  src={member.image_url ? imgUrl(member.image_url) : TRANSPARENT_PIXEL}
                  alt={member.image_url ? member.title : ''}
                  className={`${avatarClass} h-full w-full object-cover`}
                  empty={!member.image_url}
                />
              </div>
            ) : member.image_url ? (
              <img
                src={imgUrl(member.image_url)}
                alt={member.title}
                className={`${avatarClass} mx-auto mb-3 object-cover`}
                style={{ width: avatarSize, height: avatarSize, ...arrayItemImageRenderStyle(rawMember ?? {}, props) }}
                loading="lazy"
              />
            ) : (
              <div
                className={`${iconBoxShapeClass(imageShape)} mx-auto mb-3 flex items-center justify-center text-white font-bold`}
                style={{
                  width: avatarSize,
                  height: avatarSize,
                  backgroundColor: style.primary_color,
                  fontSize: avatarSize * 0.35,
                }}
              >
                {(member.title || '?').charAt(0)}
              </div>
            )}
            <h3 className="font-semibold text-gray-900 text-sm">{member.title}</h3>
            {member.subtitle && <p className="text-sm text-gray-400 mt-0.5">{member.subtitle}</p>}
            {member.description && (
              <p className="text-xs text-gray-500 mt-1.5 max-w-xs mx-auto leading-relaxed">{member.description}</p>
            )}
          </div>
          )
        })}
      </div>
    </section>
  )
}
