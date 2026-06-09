import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { hasInlineHtml } from '@/lib/fieldTextStyles'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

export default function RichTextBlock({ props, blockId }: Props) {
  const content = (props.content as string) || ''
  if (!content && !blockId) return null

  if (blockId && hasInlineHtml(content)) {
    return (
      <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="prose prose-gray max-w-none">
          <BuilderTextField
            fieldKey="content"
            blockId={blockId}
            blockProps={props}
            value={content}
            as="div"
            multiline
            className="max-w-none"
          />
        </div>
      </section>
    )
  }

  if (blockId) {
    return (
      <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <BuilderTextField
          fieldKey="content"
          blockId={blockId}
          blockProps={props}
          value={content}
          as="div"
          multiline
          className="prose prose-gray max-w-none whitespace-pre-wrap"
          placeholder="Add your content"
        />
      </section>
    )
  }

  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
    </section>
  )
}
