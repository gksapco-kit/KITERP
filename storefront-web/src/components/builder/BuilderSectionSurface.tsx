import type { CSSProperties, ReactNode } from 'react'
import { cn, type ClassValue } from '@/lib/utils'
import { builderSectionContainerClass, builderSectionContainerWithMax } from '@/lib/builderSectionLayout'

type SurfaceStyle = {
  background?: string
  backgroundColor?: string
  color?: string
}

/** Full-width section background with aligned inner content column. */
export function BuilderSectionSurface({
  surface,
  maxWidth,
  className,
  children,
}: {
  surface: SurfaceStyle
  maxWidth?: string
  className?: ClassValue
  children: ReactNode
}) {
  const bg = surface.backgroundColor ?? surface.background
  const shellStyle: CSSProperties = {
    ...(bg ? { background: bg } : {}),
    ...(surface.color ? { color: surface.color } : {}),
  }
  const sectionClass = maxWidth
    ? builderSectionContainerWithMax(maxWidth, className)
    : builderSectionContainerClass(className)

  return (
    <div className="w-full" style={shellStyle}>
      <section className={sectionClass}>{children}</section>
    </div>
  )
}
