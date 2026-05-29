import type { BlockStyles } from '../../types/builder'
import { blockTypographyStyle } from '../../lib/blockUtils'
import {
  DEFAULT_SUBTITLE_CLASS,
  DEFAULT_TITLE_CLASS,
  hasCustomSubtitleColor,
  hasCustomTitleColor,
  subtitleColorStyle,
  subtitleWidthStyle,
  titleColorStyle,
} from '../../lib/sectionTextStyles'

interface SectionHeadingProps {
  title?: string
  subtitle?: string
  styles: BlockStyles
  className?: string
  titleClassName?: string
  subtitleClassName?: string
  centered?: boolean
  titleTag?: 'h1' | 'h2' | 'h3'
}

export function SectionHeading({
  title,
  subtitle,
  styles,
  className = 'mb-8',
  titleClassName = 'font-bold',
  subtitleClassName = 'mt-2',
  centered = true,
  titleTag: TitleTag = 'h2',
}: SectionHeadingProps) {
  if (!title && !subtitle) return null

  const titleTypo = blockTypographyStyle(styles, 'title')
  const bodyTypo = blockTypographyStyle(styles, 'body')

  return (
    <header className={`${className} ${centered ? 'text-center' : ''}`}>
      {title && (
        <TitleTag
          className={`${titleClassName} ${hasCustomTitleColor(styles) ? '' : DEFAULT_TITLE_CLASS}`}
          style={{ ...titleColorStyle(styles), ...titleTypo }}
        >
          {title}
        </TitleTag>
      )}
      {subtitle && (
        <p
          className={`${subtitleClassName} ${hasCustomSubtitleColor(styles) ? '' : DEFAULT_SUBTITLE_CLASS}`}
          style={{ ...subtitleColorStyle(styles), ...subtitleWidthStyle(styles, centered), ...bodyTypo }}
        >
          {subtitle}
        </p>
      )}
    </header>
  )
}
