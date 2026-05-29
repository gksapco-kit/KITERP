import { createLinkClickHandler } from '../../lib/buttonNavigation'
import {
  heroContentFlexClasses,
  resolveHeroContentAlignX,
  resolveHeroContentAlignY,
  resolveBlockSectionHeight,
} from '../../lib/heroSectionLayout'
import { BANNER_CONTENT_ROW_CLASS } from '../../lib/pageLayout'
import type { Block } from '../../types/builder'
import { SectionHeading } from '../builder/SectionHeading'
import { useBuilderStore } from '../../store/useBuilderStore'

interface HeroSplitBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

function HeroButton({
  text,
  link,
  interactive,
  onNavigate,
}: {
  text?: string
  link?: string
  interactive: boolean
  onNavigate?: (slug: string) => void
}) {
  const pages = useBuilderStore((s) => s.pages)
  const click = createLinkClickHandler({ interactive, link: link ?? '#', pages, onNavigate })
  if (!text) return null
  return (
    <a
      href={link || '#'}
      onClick={click}
      className="inline-block rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
    >
      {text}
    </a>
  )
}

export function HeroSplitBlock({ block, layoutStyle, interactive = false, onNavigate }: HeroSplitBlockProps) {
  const { props } = block
  const imageOnLeft = props.splitImageSide === 'left'
  const sectionHeight = resolveBlockSectionHeight(block)
  const alignX = resolveHeroContentAlignX(block)
  const alignY = resolveHeroContentAlignY(block)
  const textFlex = heroContentFlexClasses(alignX, alignY)

  const textColumn = (
    <div className={`flex min-h-full flex-col py-4 ${textFlex}`} style={{ minHeight: sectionHeight }}>
      <SectionHeading
        title={props.text}
        subtitle={props.subtitle}
        styles={block.styles}
        className="mb-0"
        centered={false}
        titleTag="h1"
        titleClassName="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
        subtitleClassName="mt-4 text-lg leading-relaxed"
      />
      {props.buttonText && (
        <div className="mt-8">
          <HeroButton text={props.buttonText} link={props.buttonLink} interactive={interactive} onNavigate={onNavigate} />
        </div>
      )}
    </div>
  )

  const imageColumn = (
    <div className="relative overflow-hidden rounded-none bg-gray-100 dark:bg-gray-800" style={{ minHeight: sectionHeight }}>
      {props.imageUrl ? (
        <img src={props.imageUrl} alt={props.imageAlt || props.text || 'Hero'} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-full min-h-[inherit] items-center justify-center text-sm text-gray-400">Add an image in properties</div>
      )}
    </div>
  )

  return (
    <section style={layoutStyle} className="w-full rounded-none">
      <div className={BANNER_CONTENT_ROW_CLASS}>
        <div className="grid items-stretch gap-8 md:grid-cols-2 md:gap-12">
          {imageOnLeft ? (
            <>
              {imageColumn}
              {textColumn}
            </>
          ) : (
            <>
              {textColumn}
              {imageColumn}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
