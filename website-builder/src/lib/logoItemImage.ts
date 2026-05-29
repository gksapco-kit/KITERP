import type { LogoItem } from '../types/builder'

/** Single brand visual — imageUrl, or legacy background fields. */
export function resolveBrandImage(item: LogoItem): string {
  return (item.imageUrl?.trim() || item.backgroundImage?.trim() || item.tileBackgroundImage?.trim() || '')
}
