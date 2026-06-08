import { Users } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import {
  resolveTeamGridMembers,
  teamGridColumnClass,
} from '@/lib/teamGridContent'
import { sectionGridColumnClass, iconBoxShapeClass, imageShapeFromProps } from '@/lib/sectionItemLayout'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function TeamGridBlock({ style, props, liveItems }: Props) {
  const title = (props.title as string) || 'Our team'
  const description = (props.description as string) || ''
  const columns = Number(props.columns ?? 4)
  const itemGap = Number(props.item_gap ?? 24)
  const itemSize = Number(props.item_size ?? 160)
  const cardStyle = String(props.card_style ?? 'card')
  const isMinimal = cardStyle === 'minimal'
  const avatarSize = Math.round(itemSize * (isMinimal ? 0.45 : 0.55))
  const imageShape = imageShapeFromProps(props, 'circle')
  const avatarClass = imageShape === 'circle'
    ? 'rounded-full'
    : imageShape === 'square'
      ? 'rounded-sm'
      : 'rounded-xl'

  const { items } = resolveTeamGridMembers(props, liveItems)

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
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">{title}</h2>}
      {description && (
        <p className="text-center text-sm text-gray-500 mb-10 max-w-2xl mx-auto">{description}</p>
      )}
      <div
        className={`grid ${sectionGridColumnClass(columns)} mx-auto`}
        style={{ gap: `${itemGap}px`, maxWidth: columns >= 5 ? '100%' : '1000px' }}
      >
        {items.map(member => (
          <div
            key={member.id}
            className={`text-center ${!isMinimal ? 'p-4 rounded-2xl border border-gray-100 bg-white shadow-sm' : 'p-2'}`}
          >
            {member.image_url ? (
              <img
                src={member.image_url}
                alt={member.title}
                className={`${avatarClass} mx-auto mb-3 object-cover`}
                style={{ width: avatarSize, height: avatarSize }}
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
                {member.title.charAt(0)}
              </div>
            )}
            <h3 className="font-semibold text-gray-900 text-sm">{member.title}</h3>
            {member.subtitle && <p className="text-sm text-gray-400 mt-0.5">{member.subtitle}</p>}
            {member.description && (
              <p className="text-xs text-gray-500 mt-1.5 max-w-xs mx-auto leading-relaxed">{member.description}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
