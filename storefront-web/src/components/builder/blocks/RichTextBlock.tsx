import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function RichTextBlock({ props }: Props) {
  const content = (props.content as string) || ''
  if (!content) return null
  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
    </section>
  )
}
