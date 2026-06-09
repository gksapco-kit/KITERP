import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'

interface Props {
  site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null
  blockId?: string
}

export default function FaqBlock({ style, props, blockId }: Props) {
  const [open, setOpen] = useState<number | null>(0)
  const title = (props.title as string) || 'FAQ'
  const layout = String(props.layout ?? 'accordion')
  const faqs = (props.faqs as Array<{ question: string; answer: string }> | undefined) || []
  if (faqs.length === 0) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <BlockEmptyPlaceholder
          style={style}
          title={title}
          message="Add questions and answers in the builder so customers know what to expect before they buy."
        />
      </section>
    )
  }

  if (layout === 'grid' || layout === 'two-column') {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {(title || blockId) && (
          <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className="text-3xl font-bold text-gray-900 mb-10 text-center" />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqs.map((faq, i) => (
            <div key={i} className="builder-tile-card bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">{faq.question}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      {(title || blockId) && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className="text-3xl font-bold text-gray-900 mb-10 text-center" />
      )}
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="builder-tile-card bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-6 py-4 text-left">
              <span className="font-semibold text-gray-900">{faq.question}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">{faq.answer}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}
