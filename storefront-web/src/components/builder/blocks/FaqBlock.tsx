import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface Props {
  site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null
}

export default function FaqBlock({ style, props }: Props) {
  const [open, setOpen] = useState<number | null>(null)
  const title = (props.title as string) || 'FAQ'
  const faqs = (props.faqs as Array<{ question: string; answer: string }> | undefined) || []
  if (faqs.length === 0) return null
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{title}</h2>}
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
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
