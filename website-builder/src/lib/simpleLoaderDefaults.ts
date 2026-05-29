export const SIMPLE_LOADER_DEFAULTS = {
  simpleLoaderStyle: 'spinner' as const,
  simpleLoaderSize: 'md' as const,
  simpleLoaderColor: '#4f46e5',
  simpleLoaderAlign: 'center' as const,
  showLoaderLabel: true,
}

export function defaultSimpleLoaderProps() {
  return {
    text: 'Loading...',
    ...SIMPLE_LOADER_DEFAULTS,
  }
}

export const SIMPLE_LOADER_SIZE = {
  sm: { box: 24, dot: 6, barW: 3, barH: 16, gap: 4, label: 'text-xs' },
  md: { box: 40, dot: 8, barW: 4, barH: 24, gap: 5, label: 'text-sm' },
  lg: { box: 56, dot: 10, barW: 5, barH: 32, gap: 6, label: 'text-base' },
} as const
