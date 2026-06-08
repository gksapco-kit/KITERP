import type { LiveItem } from '@/blocks/registry'

export type TeamMemberProp = {
  name?: string
  role?: string
  bio?: string
  avatar_url?: string
}

export function isLiveTeamDataSource(props: Record<string, unknown>): boolean {
  const ds = props.data_source as { type?: string } | undefined
  const t = typeof ds?.type === 'string' ? ds.type.replace(/^internal_/, '') : ''
  return t === 'team'
}

export function teamPropMembers(props: Record<string, unknown>): TeamMemberProp[] {
  return Array.isArray(props.members) ? (props.members as TeamMemberProp[]) : []
}

/** Match builder canvas: prefer manual members when the owner has curated a list. */
export function shouldUseLiveTeam(props: Record<string, unknown>, liveItems: LiveItem[]): boolean {
  if (props.use_manual_members === true) return false
  if (liveItems.length === 0) return false

  const propsMembers = teamPropMembers(props)
  if (propsMembers.some(m => !!m?.avatar_url)) return false

  const named = propsMembers.filter(m => String(m?.name || '').trim())
  // More than the default starter pair → treat as a custom list the owner is editing.
  if (named.length > 2) return false

  return isLiveTeamDataSource(props) || named.length === 0
}

export function propMemberToLiveItem(m: TeamMemberProp, index: number): LiveItem {
  return {
    id: `member-${index}`,
    title: m.name || 'Team member',
    subtitle: m.role || null,
    description: m.bio || null,
    image_url: m.avatar_url || null,
    price: null,
    price_formatted: null,
    rating: null,
    url: null,
    meta: {},
  }
}

export function liveItemToPropMember(item: LiveItem): TeamMemberProp {
  return {
    name: item.title,
    role: item.subtitle || '',
    bio: item.description || '',
    avatar_url: item.image_url || '',
  }
}

export function resolveTeamGridMembers(
  props: Record<string, unknown>,
  liveItems: LiveItem[],
): { useLive: boolean; items: LiveItem[] } {
  const useLive = shouldUseLiveTeam(props, liveItems)
  if (useLive) return { useLive: true, items: liveItems }

  const propsMembers = teamPropMembers(props).filter(m => String(m?.name || '').trim())
  return {
    useLive: false,
    items: propsMembers.map(propMemberToLiveItem),
  }
}

export function teamGridColumnClass(columns: number): string {
  const cols = Math.min(Math.max(Number(columns) || 4, 1), 6)
  const map: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }
  return map[cols] || map[4]
}
