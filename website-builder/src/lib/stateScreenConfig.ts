import type { BlockProps, BlockType } from '../types/builder'

export const STATE_SCREEN_TYPES = [
  'emptyState',
  'errorState',
  'successState',
  'maintenanceScreen',
  'notFoundPage',
  'comingSoon',
  'sessionExpired',
] as const

export type StateScreenType = (typeof STATE_SCREEN_TYPES)[number]

export function isStateScreenType(type: BlockType): type is StateScreenType {
  return (STATE_SCREEN_TYPES as readonly string[]).includes(type)
}

export const STATE_SCREEN_PALETTE: Record<
  StateScreenType,
  { label: string; icon: string; category: 'sections' }
> = {
  emptyState: { label: 'Empty State', icon: 'Inbox', category: 'sections' },
  errorState: { label: 'Error State', icon: 'AlertTriangle', category: 'sections' },
  successState: { label: 'Success State', icon: 'CheckCircle2', category: 'sections' },
  maintenanceScreen: { label: 'Maintenance Screen', icon: 'Wrench', category: 'sections' },
  notFoundPage: { label: '404 Page', icon: 'FileQuestion', category: 'sections' },
  comingSoon: { label: 'Coming Soon Page', icon: 'Sparkles', category: 'sections' },
  sessionExpired: { label: 'Session Expired', icon: 'LogOut', category: 'sections' },
}

export const STATE_SCREEN_DEFAULTS = {
  stateScreenLayout: 'centered' as const,
  stateScreenTheme: 'light' as const,
  showStateIcon: true,
}

export function defaultStateScreenProps(type: StateScreenType): BlockProps {
  const base = { ...STATE_SCREEN_DEFAULTS, visible: true }

  switch (type) {
    case 'emptyState':
      return {
        ...base,
        text: 'Nothing here yet',
        subtitle: 'When you add items, they will appear in this list. Get started by creating your first one.',
        buttonText: 'Create item',
        buttonLink: '#',
        buttonText2: 'Learn more',
        buttonLink2: '#',
      }
    case 'errorState':
      return {
        ...base,
        text: 'Something went wrong',
        subtitle: 'We could not complete your request. Please try again or contact support if the problem persists.',
        buttonText: 'Try again',
        buttonLink: '#',
        buttonText2: 'Contact support',
        buttonLink2: '#',
        stateScreenTheme: 'light',
      }
    case 'successState':
      return {
        ...base,
        text: 'All done!',
        subtitle: 'Your changes have been saved successfully. You can continue or return to the dashboard.',
        buttonText: 'Continue',
        buttonLink: '#',
        buttonText2: 'View details',
        buttonLink2: '#',
        stateScreenTheme: 'brand',
      }
    case 'maintenanceScreen':
      return {
        ...base,
        text: "We'll be back soon",
        subtitle: 'Our site is temporarily down for scheduled maintenance. Thank you for your patience.',
        stateMeta: 'Expected back by 2:00 AM UTC',
        buttonText: 'Check status',
        buttonLink: '#',
        stateScreenTheme: 'dark',
      }
    case 'notFoundPage':
      return {
        ...base,
        stateCode: '404',
        text: 'Page not found',
        subtitle: "The page you're looking for doesn't exist, was moved, or the link may be incorrect.",
        buttonText: 'Go to homepage',
        buttonLink: '/',
        buttonText2: 'Browse products',
        buttonLink2: '#products',
        stateScreenLayout: 'card',
      }
    case 'comingSoon':
      return {
        ...base,
        text: 'Coming soon',
        subtitle: "We're putting the finishing touches on something great. Be the first to know when we launch.",
        stateMeta: 'Launching Spring 2026',
        buttonText: 'Notify me',
        buttonLink: '#',
        stateScreenTheme: 'brand',
        stateScreenLayout: 'split',
      }
    case 'sessionExpired':
      return {
        ...base,
        text: 'Session expired',
        subtitle: 'For your security, you have been signed out due to inactivity. Please sign in again to continue.',
        buttonText: 'Sign in again',
        buttonLink: '#login',
        buttonText2: 'Go to homepage',
        buttonLink2: '/',
      }
  }
}

export const STATE_SCREEN_ACCENT: Record<
  StateScreenType,
  { wrap: string; icon: string; code: string }
> = {
  emptyState: {
    wrap: 'bg-gray-100 text-gray-600 ring-gray-200/80 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
    icon: 'text-gray-600 dark:text-gray-300',
    code: 'text-gray-400',
  },
  errorState: {
    wrap: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/50',
    icon: 'text-rose-600 dark:text-rose-400',
    code: 'text-rose-500',
  },
  successState: {
    wrap: 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/50',
    icon: 'text-emerald-600 dark:text-emerald-400',
    code: 'text-emerald-500',
  },
  maintenanceScreen: {
    wrap: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900/50',
    icon: 'text-amber-700 dark:text-amber-400',
    code: 'text-amber-600',
  },
  notFoundPage: {
    wrap: 'bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:ring-indigo-900/50',
    icon: 'text-indigo-600 dark:text-indigo-400',
    code: 'text-indigo-500',
  },
  comingSoon: {
    wrap: 'bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-400 dark:ring-violet-900/50',
    icon: 'text-violet-600 dark:text-violet-400',
    code: 'text-violet-500',
  },
  sessionExpired: {
    wrap: 'bg-orange-50 text-orange-600 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:ring-orange-900/50',
    icon: 'text-orange-600 dark:text-orange-400',
    code: 'text-orange-500',
  },
}
