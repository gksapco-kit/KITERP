import { v4 as uuid } from 'uuid'
import type { FabActionItem } from '../types/builder'

export const FAB_DEFAULTS = {
  fabPosition: 'bottom-right' as const,
  fabVariant: 'icon' as const,
  fabIcon: 'plus' as const,
  fabTheme: 'brand' as const,
  showFabMenu: true,
}

export function createFabAction(overrides: Partial<FabActionItem> = {}): FabActionItem {
  return { id: uuid(), label: 'Action', link: '#', enabled: true, ...overrides }
}

export function defaultFabActions(): FabActionItem[] {
  return [
    createFabAction({ label: 'New item', link: '#' }),
    createFabAction({ label: 'Share', link: '#' }),
    createFabAction({ label: 'Help', link: '#' }),
  ]
}

export function defaultFabProps() {
  return {
    buttonText: 'Quick actions',
    fabActions: defaultFabActions(),
    ...FAB_DEFAULTS,
  }
}

export const FAB_POSITION_CLASS: Record<string, string> = {
  'bottom-right': 'bottom-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
}
