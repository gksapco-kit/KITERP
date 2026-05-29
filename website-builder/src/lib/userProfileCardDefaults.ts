import { v4 as uuid } from 'uuid'
import type { ProfileStatItem } from '../types/builder'

const AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80'

export const USER_PROFILE_CARD_DEFAULTS = {
  userProfileLayout: 'centered' as const,
  userProfileTheme: 'light' as const,
  showProfileStats: true,
  showProfileActions: true,
  showProfileLocation: true,
  showProfileRole: true,
  showProfileAvatar: true,
  showProfileBadge: true,
}

export function createProfileStat(overrides: Partial<ProfileStatItem> = {}): ProfileStatItem {
  return { id: uuid(), label: 'Stat', value: '0', enabled: true, ...overrides }
}

export function defaultProfileStats(): ProfileStatItem[] {
  return [
    createProfileStat({ label: 'Posts', value: '128' }),
    createProfileStat({ label: 'Followers', value: '2.4k' }),
    createProfileStat({ label: 'Following', value: '312' }),
  ]
}

export function defaultUserProfileCardProps() {
  return {
    text: 'Alex Morgan',
    profileUsername: '@alexmorgan',
    profileRole: 'Product Designer',
    profileBio: 'Building thoughtful digital experiences. Coffee enthusiast and weekend photographer.',
    profileLocation: 'San Francisco, CA',
    profileBadge: 'Verified',
    imageUrl: AVATAR,
    buttonText: 'Follow',
    buttonText2: 'Message',
    profileStats: defaultProfileStats(),
    ...USER_PROFILE_CARD_DEFAULTS,
  }
}
