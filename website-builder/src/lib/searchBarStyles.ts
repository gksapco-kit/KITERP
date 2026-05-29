import type { CSSProperties } from 'react'
import type { BlockStyles } from '../types/builder'

export function searchBarWrapperStyle(styles: BlockStyles): CSSProperties {
  return {
    padding: styles.padding,
    margin: styles.margin,
    width: styles.width,
    height: styles.height,
    maxWidth: styles.maxWidth,
  }
}

export function searchBarInputStyle(styles: BlockStyles): CSSProperties {
  return {
    borderWidth: styles.borderWidth,
    borderColor: styles.borderColor,
    borderStyle: styles.borderStyle as CSSProperties['borderStyle'],
    borderRadius: styles.borderRadius,
  }
}
