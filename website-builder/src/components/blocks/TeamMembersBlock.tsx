import { Copy, Link2, Mail, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { ContentSlider } from '../builder/ContentSlider'
import { SectionHeading } from '../builder/SectionHeading'
import { gridColumnClass } from '../../lib/blockUtils'
import {
  hasItemDescriptionStyle,
  hasItemTitleStyle,
  itemDescriptionStyle,
  itemTitleStyle,
} from '../../lib/itemContentStyle'
import { DEFAULT_SUBTITLE_CLASS, DEFAULT_TITLE_CLASS } from '../../lib/sectionTextStyles'
import { chunkIntoSlides, normalizeTeamLayout, sliderModeFromLayout } from '../../lib/sectionSlider'
import { resolveTeamMembers, TEAM_DISPLAY_DEFAULTS } from '../../lib/teamDefaults'
import type { Block, TeamMemberItem } from '../../types/builder'

interface TeamMembersBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  editable?: boolean
  onMembersChange?: (members: TeamMemberItem[]) => void
}

function MemberAvatar({ member }: { member: TeamMemberItem }) {
  if (member.imageUrl) {
    return (
      <img
        src={member.imageUrl}
        alt={member.name}
        className="h-32 w-32 rounded-full object-cover ring-4 ring-white shadow-lg dark:ring-gray-800"
      />
    )
  }
  const initial = member.name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-3xl font-bold text-white shadow-lg ring-4 ring-white dark:ring-gray-800">
      {initial}
    </span>
  )
}

function TeamMemberCard({
  member,
  index,
  showBio,
  showEmail,
  showSocial,
  editable,
  onDuplicate,
  onDelete,
}: {
  member: TeamMemberItem
  index: number
  showBio: boolean
  showEmail: boolean
  showSocial: boolean
  editable: boolean
  onDuplicate?: () => void
  onDelete?: () => void
}) {
  return (
    <article
      key={member.id ?? index}
      className="group relative flex h-full flex-col items-center rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <MemberAvatar member={member} />
      <h3
        className={`mt-5 text-lg font-bold ${hasItemTitleStyle(member.contentStyle) ? '' : DEFAULT_TITLE_CLASS}`}
        style={itemTitleStyle(member.contentStyle)}
      >
        {member.name}
      </h3>
      <p
        className={`mt-1 text-sm font-medium ${hasItemDescriptionStyle(member.contentStyle) ? '' : 'text-brand-600 dark:text-brand-400'}`}
        style={itemDescriptionStyle(member.contentStyle)}
      >
        {member.role}
      </p>
      {showBio && member.bio && (
        <p
          className={`mt-3 text-sm leading-relaxed ${hasItemDescriptionStyle(member.contentStyle) ? '' : DEFAULT_SUBTITLE_CLASS}`}
          style={itemDescriptionStyle(member.contentStyle)}
        >
          {member.bio}
        </p>
      )}
      {(showEmail && member.email) || (showSocial && member.socialLink) ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {showEmail && member.email && (
            <a
              href={`mailto:${member.email}`}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Mail className="h-3.5 w-3.5" />
              Email
            </a>
          )}
          {showSocial && member.socialLink && (
            <a
              href={member.socialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Link2 className="h-3.5 w-3.5" />
              Profile
            </a>
          )}
        </div>
      ) : null}

      {editable && onDuplicate && onDelete && (
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            title="Duplicate"
            onClick={onDuplicate}
            className="rounded-lg bg-white p-1.5 text-gray-600 shadow ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:ring-gray-600"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={onDelete}
            className="rounded-lg bg-white p-1.5 text-red-600 shadow ring-1 ring-gray-200 hover:bg-red-50 dark:bg-gray-800 dark:ring-gray-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </article>
  )
}

export function TeamMembersBlock({ block, layoutStyle, editable = false, onMembersChange }: TeamMembersBlockProps) {
  const { props } = block
  const members = resolveTeamMembers(props)
  const layout = normalizeTeamLayout(props.teamLayout ?? TEAM_DISPLAY_DEFAULTS.teamLayout)
  const sliderMode = sliderModeFromLayout(layout)
  const columns = props.columns ?? TEAM_DISPLAY_DEFAULTS.columns
  const showBio = props.showTeamBio ?? TEAM_DISPLAY_DEFAULTS.showTeamBio
  const showEmail = props.showTeamEmail ?? TEAM_DISPLAY_DEFAULTS.showTeamEmail
  const showSocial = props.showTeamSocial ?? TEAM_DISPLAY_DEFAULTS.showTeamSocial
  const colClass = gridColumnClass(columns, 'responsive')
  const intervalSeconds = props.sliderIntervalSeconds

  const updateMembers = (next: TeamMemberItem[]) => onMembersChange?.(next)

  const removeMember = (index: number) => {
    updateMembers(members.filter((_, i) => i !== index))
  }

  const duplicateMember = (index: number) => {
    const m = members[index]
    if (!m || !onMembersChange) return
    const copy = { ...m, id: uuid(), name: m.name ? `${m.name} (copy)` : '' }
    const next = [...members]
    next.splice(index + 1, 0, copy)
    updateMembers(next)
  }

  const slides = chunkIntoSlides(members, columns)

  const renderMember = (member: TeamMemberItem, slideLocalIndex: number) => {
    const index = members.findIndex((m) => m.id === member.id)
    const globalIndex = index >= 0 ? index : slideLocalIndex
    return (
      <TeamMemberCard
        member={member}
        index={index}
        showBio={showBio}
        showEmail={showEmail}
        showSocial={showSocial}
        editable={editable && !!onMembersChange}
        onDuplicate={() => duplicateMember(globalIndex)}
        onDelete={() => removeMember(globalIndex)}
      />
    )
  }

  const renderSlide = (slideIndex: number) => {
    const page = slides[slideIndex] ?? []
    return (
      <div className={`grid gap-8 ${colClass}`}>
        {page.map((member, i) => (
          <div key={member.id ?? i}>{renderMember(member, i)}</div>
        ))}
      </div>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <SectionHeading
        title={props.text}
        subtitle={props.subtitle}
        styles={block.styles}
        className="mb-10"
        titleClassName="text-3xl font-bold tracking-tight"
        subtitleClassName="mx-auto mt-3 max-w-2xl"
      />

      {members.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          No team members yet — add them in the properties panel
        </p>
      ) : sliderMode ? (
        <ContentSlider
          slideCount={slides.length}
          mode={sliderMode}
          intervalSeconds={intervalSeconds}
          renderSlide={renderSlide}
        />
      ) : (
        <div className={`grid gap-8 ${colClass}`}>
          {members.map((member, index) => renderMember(member, index))}
        </div>
      )}
    </section>
  )
}
