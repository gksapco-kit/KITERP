import { parseSizePx } from '../editor/useBlockSizeResize'

interface BlockSizeScalerProps {
  width?: string
  height?: string
  children: React.ReactNode
}

/**
 * Applies explicit width/height from the style panel or canvas resize.
 * Uses real layout (min-height) so live site matches editor preview — no scale transforms.
 */
export function BlockSizeScaler({ width, height, children }: BlockSizeScalerProps) {
  const targetW = parseSizePx(width)
  const targetH = parseSizePx(height)

  if (!targetW && !targetH) {
    return <>{children}</>
  }

  const outerStyle: React.CSSProperties = {
    width: targetW ?? undefined,
    maxWidth: '100%',
    minHeight: targetH ?? undefined,
    boxSizing: 'border-box',
  }

  return (
    <div style={outerStyle} data-block-size data-block-width={targetW ?? undefined} data-block-height={targetH ?? undefined}>
      {children}
    </div>
  )
}
