import type { Block } from '../../types/builder'
import {
  blockOuterMarginStyle,
  blockPagePositionClass,
  blockShellStyle,
  getAnimationClass,
  isBlockVisible,
  isInlineBlockType,
  responsiveClass,
  type PageLayoutOptions,
} from '../../lib/blockUtils'
import { parseSizePx } from '../editor/useBlockSizeResize'
import { BlockSizeScaler } from './BlockSizeScaler'

interface BlockShellProps {
  block: Block
  darkMode?: boolean
  children: React.ReactNode
  className?: string
  nestedInContainer?: boolean
}

export function BlockShell({ block, darkMode, children, className = '', nestedInContainer }: BlockShellProps) {
  if (!isBlockVisible(block)) {
    return (
      <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-700">
        Hidden — enable visibility in properties
      </div>
    )
  }

  const layoutOptions: PageLayoutOptions = { nestedInContainer }
  const style = blockShellStyle(block, darkMode, layoutOptions)
  const responsive = responsiveClass(block.styles)
  const animClass = getAnimationClass(block.styles.animation)
  const dark = darkMode || block.styles.backgroundColor === '#111827'
  const inline = isInlineBlockType(block.type)
  const fixedWidth = block.styles.width?.trim()
  const fixedHeight = block.styles.height?.trim()
  const parsedWidth = parseSizePx(fixedWidth)
  const pagePositionClass = blockPagePositionClass(block)

  const shellStyle: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
  }

  const sizedOuter =
    parsedWidth || inline ? (
      <div
        className={`max-w-full ${inline && !parsedWidth ? 'w-fit' : ''} ${pagePositionClass}`}
        style={
          parsedWidth
            ? {
                width: fixedWidth,
                maxWidth: `min(100%, ${fixedWidth})`,
                boxSizing: 'border-box',
                ...blockOuterMarginStyle(block.styles),
              }
            : inline
              ? { width: 'fit-content', maxWidth: '100%', boxSizing: 'border-box' }
              : undefined
        }
      >
        <BlockSizeScaler width={fixedWidth || undefined} height={fixedHeight || undefined}>
          <div className={`${inline ? 'w-fit max-w-full' : 'w-full min-w-0'} ${className}`}>
            <div
              className={`builder-block w-full min-w-0 ${className} ${responsive} ${animClass} ${dark ? 'dark-block text-gray-100' : ''}`}
              style={shellStyle}
              data-block-type={block.type}
              data-hide-shadow={block.styles.hideShadow ? '' : undefined}
            >
              {children}
            </div>
          </div>
        </BlockSizeScaler>
      </div>
    ) : (
      <BlockSizeScaler width={undefined} height={fixedHeight || undefined}>
        <div className={`w-full min-w-0 ${className}`}>
          <div
            className={`builder-block w-full min-w-0 ${className} ${responsive} ${animClass} ${dark ? 'dark-block text-gray-100' : ''}`}
            style={shellStyle}
            data-block-type={block.type}
            data-hide-shadow={block.styles.hideShadow ? '' : undefined}
          >
            {children}
          </div>
        </div>
      </BlockSizeScaler>
    )

  return sizedOuter
}
