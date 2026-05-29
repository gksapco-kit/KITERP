import { v4 as uuid } from 'uuid'
import type { CommentItem } from '../types/builder'

export const COMMENTS_SECTION_DEFAULTS = {
  commentsLayout: 'stacked' as const,
  showCommentForm: true,
  showCommentAvatars: true,
  showCommentLikes: true,
  showReplyButton: true,
  commentFormPosition: 'top' as const,
  commentFormButtonText: 'Post comment',
  commentFormPlaceholder: 'Share your thoughts…',
}

export function createCommentItem(overrides: Partial<CommentItem> = {}): CommentItem {
  return {
    id: uuid(),
    author: 'Guest',
    body: 'Write your comment here.',
    date: 'Just now',
    likes: 0,
    enabled: true,
    ...overrides,
  }
}

export function defaultCommentItems(): CommentItem[] {
  return [
    {
      id: 'c1',
      author: 'Sarah Chen',
      avatarUrl: 'https://i.pravatar.cc/150?u=sarah-chen',
      date: '2 hours ago',
      body: 'Really helpful breakdown — the shipping section answered everything I was unsure about before ordering.',
      likes: 12,
      enabled: true,
      replies: [
        {
          id: 'c1-r1',
          author: 'Store Team',
          avatarUrl: 'https://i.pravatar.cc/150?u=store-team',
          date: '1 hour ago',
          body: 'Thanks Sarah! Glad the details were clear — we update policies whenever carriers change rates.',
          likes: 4,
          isAuthor: true,
          enabled: true,
        },
      ],
    },
    {
      id: 'c2',
      author: 'Marcus Webb',
      avatarUrl: 'https://i.pravatar.cc/150?u=marcus-webb',
      date: 'Yesterday',
      body: 'Quality exceeded expectations. Packaging was eco-friendly too, which I appreciate.',
      likes: 8,
      enabled: true,
    },
    {
      id: 'c3',
      author: 'Priya N.',
      avatarUrl: 'https://i.pravatar.cc/150?u=priya-n',
      date: '3 days ago',
      body: 'Would love a size comparison chart in the product gallery — otherwise flawless experience.',
      likes: 5,
      enabled: true,
    },
  ]
}

export function defaultCommentsSectionProps() {
  return {
    text: 'Comments',
    subtitle: 'Join the conversation — 3 comments',
    commentItems: defaultCommentItems(),
    ...COMMENTS_SECTION_DEFAULTS,
  }
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
] as const

export function avatarGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}
