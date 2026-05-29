import { v4 as uuid } from 'uuid'
import type { TeamMemberItem } from '../types/builder'

const PHOTOS = [
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80',
]

export function createDefaultTeamMember(overrides: Partial<TeamMemberItem> = {}): TeamMemberItem {
  return {
    id: uuid(),
    name: 'Team Member',
    role: 'Role',
    bio: 'Short bio about this team member.',
    imageUrl: PHOTOS[0],
    email: '',
    socialLink: '',
    ...overrides,
  }
}

export function defaultTeamMembers(): TeamMemberItem[] {
  return [
    createDefaultTeamMember({ name: 'Alex Morgan', role: 'CEO & Founder', bio: 'Leads strategy and vision with 15+ years in the industry.', imageUrl: PHOTOS[0] }),
    createDefaultTeamMember({ name: 'Sam Rivera', role: 'CTO', bio: 'Builds products that scale and delight users every day.', imageUrl: PHOTOS[1] }),
    createDefaultTeamMember({ name: 'Jordan Lee', role: 'Head of Design', bio: 'Crafts beautiful experiences across web and mobile.', imageUrl: PHOTOS[2] }),
    createDefaultTeamMember({ name: 'Taylor Kim', role: 'Customer Success', bio: 'Ensures every client gets the support they deserve.', imageUrl: PHOTOS[3] }),
  ]
}

export const TEAM_DISPLAY_DEFAULTS = {
  showTeamBio: true,
  showTeamEmail: false,
  showTeamSocial: true,
  columns: 4,
  teamLayout: 'grid' as const,
}

export function defaultTeamBlockProps() {
  return {
    text: 'Meet Our Team',
    subtitle: 'The people behind our success',
    ...TEAM_DISPLAY_DEFAULTS,
    teamMembers: defaultTeamMembers(),
  }
}

/** Legacy blocks used cards[] with title/description */
export function resolveTeamMembers(props: {
  teamMembers?: TeamMemberItem[]
  cards?: { id?: string; title: string; description?: string; imageUrl?: string; link?: string; role?: string }[]
}): TeamMemberItem[] {
  if (props.teamMembers?.length) return props.teamMembers
  if (props.cards?.length) {
    return props.cards.map((c) => ({
      id: c.id ?? uuid(),
      name: c.title,
      role: c.role ?? c.description ?? '',
      bio: c.description && c.role ? c.description : '',
      imageUrl: c.imageUrl,
      socialLink: c.link,
    }))
  }
  return []
}
