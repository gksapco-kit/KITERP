/** Image shape + layout helpers for features_alternating blocks. */

export function alternatingRowFlip(
  index: number,
  imagePosition: string,
  useIcons: boolean,
): boolean {
  if (useIcons) return index % 2 === 1
  if (imagePosition === 'right') return index % 2 === 0
  return index % 2 === 1
}

export function alternatingImageClassNames(opts: {
  imageShape: string
  useIcons: boolean
  compact?: boolean
  fullBleed?: boolean
}): string {
  const { imageShape, useIcons, compact, fullBleed } = opts
  if (useIcons) return ''
  if (imageShape === 'circle') {
    return compact
      ? 'w-40 h-40 sm:w-48 sm:h-48 object-cover rounded-full shadow-lg ring-4 ring-white/70 mx-auto lg:mx-0'
      : 'w-full max-w-xs sm:max-w-sm aspect-square object-cover rounded-full shadow-lg ring-4 ring-white/70 mx-auto lg:mx-0'
  }
  if (imageShape === 'square') {
    return fullBleed
      ? 'w-full aspect-[16/10] object-cover rounded-none shadow-md'
      : compact
        ? 'w-full max-h-44 aspect-square object-cover rounded-md shadow-md mx-auto lg:mx-0'
        : 'w-full max-w-md aspect-square object-cover rounded-lg shadow-md mx-auto lg:mx-0'
  }
  return fullBleed
    ? 'w-full aspect-[16/10] object-cover rounded-none shadow-lg'
    : compact
      ? 'w-full max-h-48 aspect-[4/3] object-cover rounded-xl shadow-lg mx-auto lg:max-w-none'
      : 'w-full aspect-[4/3] object-cover rounded-2xl shadow-[0_20px_50px_-20px_rgba(39,72,50,0.35)] mx-auto lg:max-w-none'
}
