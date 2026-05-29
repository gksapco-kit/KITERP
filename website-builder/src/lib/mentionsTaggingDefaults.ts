import { v4 as uuid } from 'uuid'
import type { MentionItem } from '../types/builder'

export const MENTIONS_TAGGING_DEFAULTS = {
  mentionsLayout: 'composer' as const,
  mentionsTheme: 'light' as const,
  showMentionAvatars: true,
  mentionComposerText: 'Great work @sarah — can you loop in @marcus on the API changes?',
}

export function createMentionItem(overrides: Partial<MentionItem> = {}): MentionItem {
  return {
    id: uuid(),
    name: 'User',
    handle: 'user',
    enabled: true,
    ...overrides,
  }
}

export function defaultMentionItems(): MentionItem[] {
  return [
    createMentionItem({ name: 'Sarah Chen', handle: 'sarah', role: 'Design lead' }),
    createMentionItem({ name: 'Marcus Webb', handle: 'marcus', role: 'Engineering' }),
    createMentionItem({ name: 'Priya N.', handle: 'priya', role: 'Product' }),
    createMentionItem({ name: 'Alex Rivera', handle: 'alex', role: 'Marketing' }),
  ]
}

export function defaultMentionsTaggingProps() {
  return {
    text: 'Mentions & tagging',
    subtitle: 'Notify teammates with @mentions in comments and posts',
    mentionItems: defaultMentionItems(),
    ...MENTIONS_TAGGING_DEFAULTS,
  }
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
