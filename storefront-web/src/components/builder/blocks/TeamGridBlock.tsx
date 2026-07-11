import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { cn, imgUrl } from '@/lib/utils'
import { builderSectionContainerClass } from '@/lib/builderSectionLayout'
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

function MemberAvatar({
  member,
  memberIndex,
  rawMember,
  blockId,
  blockProps,
  style,
  avatarSize,
  avatarClass,
  imageShape,
  allowImageEditing,
  showAvatar,
}: {
  member: LiveItem
  memberIndex: number
  rawMember?: Record<string, unknown>
  blockId?: string
  blockProps: Record<string, unknown>
  style: StyleConfig
  avatarSize: number
  avatarClass: string
  imageShape: ReturnType<typeof imageShapeFromProps>
  allowImageEditing: boolean
  showAvatar: boolean
}) {
  const [broken, setBroken] = useState(false)
  const imageSrc = member.image_url ? imgUrl(member.image_url) : ''

  useEffect(() => {
    setBroken(false)
    if (!imageSrc) return
    const probe = new window.Image()
    probe.onload = () => setBroken(false)
    probe.onerror = () => setBroken(true)
    probe.src = imageSrc
    return () => {
      probe.onload = null
      probe.onerror = null
    }
  }, [imageSrc])

  if (!showAvatar) return null

  const hasImage = Boolean(imageSrc) && !broken
  const frameStyle = {
    width: avatarSize,
    height: avatarSize,
    backgroundColor: hasImage ? undefined : `${style.primary_color}14`,
    ...(rawMember ? arrayItemImageFrameStyle(rawMember) : {}),
  }

  if (allowImageEditing) {
    return (
      <div
        className={cn(avatarClass, 'relative mx-auto shrink-0 overflow-hidden')}
        style={frameStyle}
      >
        <BuilderSectionImage
          blockId={blockId}
          field="avatar_url"
          arrayKey="members"
          index={memberIndex}
          itemField="avatar_url"
          blockProps={blockProps}
          src={hasImage ? imageSrc : TRANSPARENT_PIXEL}
          alt={hasImage ? (member.title || '') : ''}
          className={`${avatarClass} h-full w-full object-cover`}
          empty={!hasImage}
        />
      </div>
    )
  }

  if (hasImage) {
    return (
      <img
        src={imageSrc}
        alt={member.title || ''}
        className={cn(avatarClass, 'mx-auto shrink-0 object-cover')}
        style={{ width: avatarSize, height: avatarSize, ...arrayItemImageRenderStyle(rawMember ?? {}, blockProps) }}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    )
  }

  return (
    <div
      className={cn(iconBoxShapeClass(imageShape), 'mx-auto flex shrink-0 items-center justify-center text-white font-bold')}
      style={{
        width: avatarSize,
        height: avatarSize,
        backgroundColor: style.primary_color,
        fontSize: avatarSize * 0.35,
      }}
      aria-hidden
    >
      {(member.title || '?').charAt(0).toUpperCase()}
    </div>
  )
}

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
    <section className={builderSectionContainerClass()}>
      {(showTitle || showDescription) && (
        <div className="mb-10 flex w-full flex-col items-center text-center">
          {showTitle && (
            <BuilderTextField
              fieldKey="title"
              blockId={blockId}
              blockProps={props}
              value={title ?? ''}
              as="h2"
              className="text-3xl font-bold text-gray-900"
              placeholder="Section title"
            />
          )}
          {showDescription && (
            <BuilderTextField
              fieldKey="description"
              blockId={blockId}
              blockProps={props}
              value={description ?? ''}
              as="p"
              multiline
              className={cn('mt-3 max-w-2xl text-sm text-gray-500', !description && isEditorCanvas && 'opacity-60')}
              placeholder="Optional description"
            />
          )}
        </div>
      )}
      <div
        className={cn('mx-auto grid w-full items-start', sectionGridColumnClass(columns))}
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
          const roleValue = member.subtitle || ''
          const bioValue = member.description || ''
          const showRoleField = showRole && (roleValue || isEditorCanvas)
          const showBioField = showBio && (bioValue || isEditorCanvas)

          return (
            <div
              key={member.id}
              className={cn(
                'flex h-full min-w-0 flex-col items-center text-center',
                !isMinimal ? 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm' : 'p-2',
              )}
            >
              {showAvatar && (
                <div className="mb-3 flex w-full justify-center">
                  <MemberAvatar
                    member={member}
                    memberIndex={memberIndex}
                    rawMember={rawMember}
                    blockId={blockId}
                    blockProps={props}
                    style={style}
                    avatarSize={avatarSize}
                    avatarClass={avatarClass}
                    imageShape={imageShape}
                    allowImageEditing={allowImageEditing}
                    showAvatar={showAvatar}
                  />
                </div>
              )}

              <div className="flex w-full min-w-0 flex-col items-center gap-0.5">
                {showName && (
                  allowImageEditing ? (
                    <BuilderTextField
                      fieldKey={`members.${memberIndex}.name`}
                      blockId={blockId}
                      blockProps={props}
                      value={member.title}
                      as="h3"
                      className="w-full text-center text-sm font-semibold text-gray-900"
                      placeholder="Name"
                    />
                  ) : (
                    <h3 className="w-full text-center text-sm font-semibold text-gray-900">{member.title}</h3>
                  )
                )}
                {showRoleField && (
                  allowImageEditing ? (
                    <BuilderTextField
                      fieldKey={`members.${memberIndex}.role`}
                      blockId={blockId}
                      blockProps={props}
                      value={roleValue}
                      as="p"
                      className={cn('w-full text-center text-sm text-gray-400', !roleValue && 'opacity-60')}
                      placeholder="Role"
                    />
                  ) : (
                    <p className="w-full text-center text-sm text-gray-400">{roleValue}</p>
                  )
                )}
                {showBioField && (
                  allowImageEditing ? (
                    <BuilderTextField
                      fieldKey={`members.${memberIndex}.bio`}
                      blockId={blockId}
                      blockProps={props}
                      value={bioValue}
                      as="p"
                      multiline
                      className={cn(
                        'mt-1 w-full max-w-[16rem] text-center text-xs leading-relaxed text-gray-500',
                        !bioValue && 'opacity-60',
                      )}
                      placeholder="Bio"
                    />
                  ) : (
                    <p className="mt-1 w-full max-w-[16rem] text-center text-xs leading-relaxed text-gray-500">{bioValue}</p>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
