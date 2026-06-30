import { Users } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { cn, imgUrl } from '@/lib/utils'
import {
  propMemberToLiveItem,
  resolveTeamGridMembers,
  teamPropMembers,
} from '@/lib/teamGridContent'
import { sectionGridColumnClass, iconBoxShapeClass, imageShapeFromProps, imageShapeRadiusClass } from '@/lib/sectionItemLayout'
import { arrayItemImageFrameStyle, arrayItemImageRenderStyle } from '@/lib/sectionImageStyle'
import {
  arrayImageDeleteFieldKey,
  isArrayItemHidden,
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
} from '@/lib/blockHiddenFields'

/** 1×1 transparent pixel — keeps an empty editable slot from rendering a broken-image / alt-text box. */
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

export default function TeamGridBlock({ style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = Boolean(builderCanvas?.isEditorCanvas && blockId)
  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'Our team'),
  })
  const description = resolveBlockTextField(props, 'description')
  const columns = Number(props.columns ?? 4)
  const itemGap = Number(props.item_gap ?? 24)
  const itemSize = Number(props.item_size ?? 160)
  const cardStyle = String(props.card_style ?? 'card')
  const isMinimal = cardStyle === 'minimal'
  const avatarSize = Math.round(itemSize * (isMinimal ? 0.45 : 0.55))
  const imageShape = imageShapeFromProps(props, 'circle')
  const avatarClass = imageShapeRadiusClass(imageShape)

  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const showDescription = !isBlockFieldHidden(props, 'description') && (description || isEditorCanvas)

  const { useLive, items: liveResolvedItems } = resolveTeamGridMembers(props, liveItems)
  const visibleEntries = useLive
    ? liveResolvedItems.map((item, index) => ({ item, memberIndex: index, rawMember: undefined as Record<string, unknown> | undefined }))
    : teamPropMembers(props)
        .map((member, index) => ({ member, index }))
        .filter(({ member, index }) => String(member?.name || '').trim() && !isArrayItemHidden(props, 'members', index))
        .map(({ member, index }) => ({
          item: propMemberToLiveItem(member, index),
          memberIndex: index,
          rawMember: member as Record<string, unknown>,
        }))
  const allowImageEditing = isEditorCanvas && !useLive

  if (visibleEntries.length === 0 && !showTitle && !showDescription && !isEditorCanvas) {
    return null
  }

  if (visibleEntries.length === 0) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title ?? 'Our team'}
        message="Your team will appear here once you add staff in People or edit the sample members in the builder."
        hint="Tip: double-click section text on the canvas to customize names and roles."
        icon={<Users className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {showTitle && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h2" className="text-3xl font-bold text-gray-900 mb-4 text-center" placeholder="Section title" />
      )}
      {showDescription && (
        <BuilderTextField fieldKey="description" blockId={blockId} blockProps={props} value={description ?? ''} as="p" multiline className="text-center text-sm text-gray-500 mb-10 max-w-2xl mx-auto" placeholder="Optional description" />
      )}
      <div
        className={`grid ${sectionGridColumnClass(columns)} mx-auto`}
        style={{ gap: `${itemGap}px`, maxWidth: columns >= 5 ? '100%' : '1000px' }}
      >
        {visibleEntries.map(({ item: member, memberIndex, rawMember }) => {
          const showAvatar = useLive || (
            !isNestedBlockFieldHidden(props, arrayImageDeleteFieldKey('members', memberIndex, 'avatar_url'))
            && !isNestedBlockFieldHidden(props, arrayImageDeleteFieldKey('members', memberIndex, 'image_url'))
          )
          const showName = useLive || !isNestedBlockFieldHidden(props, `members.${memberIndex}.name`)
          const showRole = useLive || !isNestedBlockFieldHidden(props, `members.${memberIndex}.role`)
          const showBio = useLive || !isNestedBlockFieldHidden(props, `members.${memberIndex}.bio`)

          return (
          <div
            key={member.id}
            className={`text-center ${!isMinimal ? 'p-4 rounded-2xl border border-gray-100 bg-white shadow-sm' : 'p-2'}`}
          >
            {showAvatar && allowImageEditing ? (
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
                  index={memberIndex}
                  itemField="avatar_url"
                  blockProps={props}
                  src={member.image_url ? imgUrl(member.image_url) : TRANSPARENT_PIXEL}
                  alt={member.image_url ? member.title : ''}
                  className={`${avatarClass} h-full w-full object-cover`}
                  empty={!member.image_url}
                />
              </div>
            ) : showAvatar && member.image_url ? (
              <img
                src={imgUrl(member.image_url)}
                alt={member.title}
                className={`${avatarClass} mx-auto mb-3 object-cover`}
                style={{ width: avatarSize, height: avatarSize, ...arrayItemImageRenderStyle(rawMember ?? {}, props) }}
                loading="lazy"
              />
            ) : showAvatar && showName ? (
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
            ) : null}
            {showName && (
              allowImageEditing ? (
                <BuilderTextField
                  fieldKey={`members.${memberIndex}.name`}
                  blockId={blockId}
                  blockProps={props}
                  value={member.title}
                  as="h3"
                  className="font-semibold text-gray-900 text-sm"
                  placeholder="Name"
                />
              ) : (
                <h3 className="font-semibold text-gray-900 text-sm">{member.title}</h3>
              )
            )}
            {showRole && member.subtitle && (
              allowImageEditing ? (
                <BuilderTextField
                  fieldKey={`members.${memberIndex}.role`}
                  blockId={blockId}
                  blockProps={props}
                  value={member.subtitle}
                  as="p"
                  className="text-sm text-gray-400 mt-0.5"
                  placeholder="Role"
                />
              ) : (
                <p className="text-sm text-gray-400 mt-0.5">{member.subtitle}</p>
              )
            )}
            {showBio && member.description && (
              allowImageEditing ? (
                <BuilderTextField
                  fieldKey={`members.${memberIndex}.bio`}
                  blockId={blockId}
                  blockProps={props}
                  value={member.description}
                  as="p"
                  multiline
                  className="text-xs text-gray-500 mt-1.5 max-w-xs mx-auto leading-relaxed"
                  placeholder="Bio"
                />
              ) : (
                <p className="text-xs text-gray-500 mt-1.5 max-w-xs mx-auto leading-relaxed">{member.description}</p>
              )
            )}
          </div>
          )
        })}
      </div>
    </section>
  )
}
