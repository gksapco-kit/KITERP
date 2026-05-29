import { resolveMapEmbedSrc } from '../../lib/mapUtils'
import type { Block } from '../../types/builder'
import { SectionHeading } from '../builder/SectionHeading'

interface MapEmbedBlockProps {
  block: Block
  layoutStyle: React.CSSProperties
}

export function MapEmbedBlock({ block, layoutStyle }: MapEmbedBlockProps) {
  const { props } = block
  const embedSrc = resolveMapEmbedSrc(props.location, props.mapEmbedUrl)
  const height = props.mapHeight ?? '400px'

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-4xl">
        <SectionHeading
          title={props.text}
          subtitle={props.subtitle}
          styles={block.styles}
          className="mb-6"
          titleClassName="text-3xl font-bold tracking-tight"
          subtitleClassName="mx-auto mt-2 max-w-xl"
        />

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="relative w-full bg-gray-100 dark:bg-gray-900" style={{ height }}>
            <iframe
              title={props.text ?? 'Map'}
              src={embedSrc}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  )
}
