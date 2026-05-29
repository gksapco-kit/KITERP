export const SKELETON_LOADER_DEFAULTS = {
  skeletonLoaderLayout: 'card' as const,
  skeletonLineCount: 3,
  skeletonRowCount: 4,
  skeletonColumnCount: 3,
  skeletonAnimation: 'shimmer' as const,
  skeletonRounded: 'md' as const,
}

export function defaultSkeletonLoaderProps() {
  return {
    text: 'Loading preview',
    subtitle: 'Placeholder content while data loads',
    ...SKELETON_LOADER_DEFAULTS,
  }
}

export const SKELETON_ROUNDED_CLASS = {
  sm: 'rounded-md',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
} as const

export const SKELETON_LINE_WIDTHS = ['w-full', 'w-11/12', 'w-4/5', 'w-3/5', 'w-2/5']
