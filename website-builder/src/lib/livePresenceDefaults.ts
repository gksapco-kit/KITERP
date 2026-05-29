import { v4 as uuid } from 'uuid'
import type { PresenceUserItem } from '../types/builder'

export const LIVE_PRESENCE_DEFAULTS = {
  presenceLayout: 'stack' as const,
  presenceTheme: 'premium' as const,
  showPresencePulse: true,
  presenceStatusText: '3 teammates viewing this page',
}

export function createPresenceUser(overrides: Partial<PresenceUserItem> = {}): PresenceUserItem {
  return {
    id: uuid(),
    name: 'User',
    status: 'online',
    enabled: true,
    ...overrides,
  }
}

export function defaultPresenceUsers(): PresenceUserItem[] {
  return [
    createPresenceUser({ name: 'Sarah Chen', status: 'online' }),
    createPresenceUser({ name: 'Marcus Webb', status: 'online' }),
    createPresenceUser({ name: 'Priya N.', status: 'away' }),
    createPresenceUser({ name: 'Jamie Lee', status: 'busy' }),
    createPresenceUser({ name: 'Alex Rivera', status: 'online' }),
  ]
}

export function defaultLivePresenceProps() {
  const users = defaultPresenceUsers()
  return {
    text: 'Live presence',
    subtitle: 'See who is online and collaborating right now',
    presenceUsers: users,
    presenceOnlineCount: users.filter((u) => u.status === 'online').length,
    ...LIVE_PRESENCE_DEFAULTS,
  }
}

export function presenceStatusColor(status?: PresenceUserItem['status']) {
  switch (status) {
    case 'away':
      return 'bg-amber-400 ring-white dark:ring-gray-900'
    case 'busy':
      return 'bg-rose-500 ring-white dark:ring-gray-900'
    case 'offline':
      return 'bg-gray-400 ring-white dark:ring-gray-900'
    default:
      return 'bg-emerald-500 ring-white dark:ring-gray-900'
  }
}
