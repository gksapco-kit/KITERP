import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { hasInlineHtml } from '@/lib/fieldTextStyles'
import { builderSectionContainerClass, builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { cn } from '@/lib/utils'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

export default function RichTextBlock({ props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const content = resolveBlockTextField(props, 'content')
  const showContent = !isBlockFieldHidden(props, 'content') && (content || isEditorCanvas)

  if (!showContent) return null

  if (blockId) {
    return (
      <section className={builderSectionContainerWithMax('max-w-4xl')}>
        <div className="rich-text-content">
          <BuilderTextField
            fieldKey="content"
            blockId={blockId}
            blockProps={props}
            value={content ?? ''}
            as="div"
            multiline
            className={cn('max-w-none', content && !hasInlineHtml(content) && 'whitespace-pre-wrap')}
            placeholder="Add your content"
          />
        </div>
      </section>
    )
  }

  return (
    <section className={builderSectionContainerWithMax('max-w-4xl')}>
      <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: content ?? '' }} />
    </section>
  )
}
