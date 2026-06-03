const SHAPE_SVG_PATHS: Record<string, string> = {
  wave: 'M0,32 C166,64 333,0 500,32 C666,64 833,0 1000,32 L1000,64 L0,64 Z',
  wave_soft: 'M0,48 C250,0 750,64 1000,48 L1000,64 L0,64 Z',
  curve: 'M0,64 Q500,0 1000,64 L1000,64 L0,64 Z',
  curve_deep: 'M0,64 Q500,-32 1000,64 L1000,64 L0,64 Z',
}

export default function SectionShapeDivider({
  shape,
  fillColor,
  position,
}: {
  shape: string
  fillColor: string
  position: 'top' | 'bottom'
}) {
  const path = SHAPE_SVG_PATHS[shape]
  if (!path) return null
  return (
    <div
      className="absolute left-0 right-0 pointer-events-none overflow-hidden z-10"
      style={{ height: 64, ...(position === 'bottom' ? { bottom: 0 } : { top: 0 }) }}
    >
      <svg
        viewBox="0 0 1000 64"
        preserveAspectRatio="none"
        className="w-full h-full"
        style={{ transform: position === 'top' ? 'scaleY(-1)' : undefined }}
        aria-hidden
      >
        <path d={path} fill={fillColor || '#ffffff'} />
      </svg>
    </div>
  )
}
