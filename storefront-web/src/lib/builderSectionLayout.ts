import { type ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

/** Shared max content width for nav, sections, and footer. */
export const BUILDER_SECTION_MAX_W = 'max-w-7xl'

/** Horizontal inset aligned across all builder sections. */
export const BUILDER_SECTION_INSET_X = 'px-4 sm:px-6 lg:px-8'

/** Break out of section inset while keeping inner content aligned. */
export const BUILDER_SECTION_BLEED_X = '-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8'

/** Standard builder content column (max width + horizontal inset). */
export function builderSectionContainerClass(...extra: ClassValue[]): string {
  return cn(BUILDER_SECTION_MAX_W, 'mx-auto w-full', BUILDER_SECTION_INSET_X, ...extra)
}

/** Same horizontal inset with a custom max width (e.g. narrow FAQ / timeline). */
export function builderSectionContainerWithMax(maxWidthClass: string, ...extra: ClassValue[]): string {
  return cn(maxWidthClass, 'mx-auto w-full', BUILDER_SECTION_INSET_X, ...extra)
}

/** Full-bleed band inside a section container — background can span edge-to-edge. */
export function builderSectionBleedClass(...extra: ClassValue[]): string {
  return cn(BUILDER_SECTION_BLEED_X, ...extra)
}

/** Horizontal inset only — for hero panels and nested columns. */
export function builderSectionInsetClass(...extra: ClassValue[]): string {
  return cn(BUILDER_SECTION_INSET_X, ...extra)
}
