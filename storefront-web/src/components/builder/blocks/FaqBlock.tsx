import { useState, type CSSProperties } from 'react'
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
  const columns = Number(props.columns) || 2
  const isDark = props.bg_style === 'dark'
  const isCompact = props.compact === true
  const cardStyle = String(props.card_style ?? '')
  const showNumbers = props.show_numbers === true
  const isBordered = cardStyle === 'bordered'
  const isCard = cardStyle === 'card'

  const faqs = (props.faqs as Array<{ question: string; answer: string }> | undefined) || []

  const sectionBg = isDark ? '#0f172a' : undefined
  const headingColor = isDark ? '#f8fafc' : undefined
  const bodyColor = isDark ? '#cbd5e1' : undefined
  const itemShell = isCard
    ? 'rounded-2xl border border-gray-100 shadow-sm'
    : isBordered
      ? 'rounded-xl border-2 border-gray-200'
      : 'rounded-2xl border border-gray-100'
  const itemBg = isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white'
  const rowPad = isCompact ? 'px-4 py-3' : 'px-6 py-4'
  const stackGap = isCompact ? 'space-y-2' : 'space-y-3'
  const gridCols =
    columns >= 3
      ? 'md:grid-cols-3'
      : columns === 2
        ? 'md:grid-cols-2'
        : 'md:grid-cols-1'

  const titleClass = `text-3xl font-bold text-center ${isDark ? 'text-white' : 'text-gray-900'}`

  const titleEl = (title || blockId) ? (
    <BuilderTextField
      fieldKey="title"
      blockId={blockId}
      blockProps={props}
      value={title}
      as="h2"
      className={titleClass}
      style={headingColor ? { color: headingColor } : undefined}
    />
  ) : null

  const questionField = (i: number, q: string, tag: 'h3' | 'span', className: string, fieldStyle?: CSSProperties) => (
    <BuilderTextField
      fieldKey={`faqs.${i}.question`}
      blockId={blockId}
      blockProps={props}
      value={q}
      as={tag}
      className={className}
      style={fieldStyle}
      skipPositionWrapper
      placeholder="Question"
    />
  )

  const answerField = (i: number, a: string, className: string, fieldStyle?: CSSProperties) => (
    <BuilderTextField
      fieldKey={`faqs.${i}.answer`}
      blockId={blockId}
      blockProps={props}
      value={a}
      as="p"
      multiline
      className={className}
      style={fieldStyle}
      skipPositionWrapper
      placeholder="Answer"
    />
  )

  if (faqs.length === 0) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto" style={{ backgroundColor: sectionBg }}>
        <BlockEmptyPlaceholder
          style={style}
          title={title}
          message="Add questions and answers in the builder so customers know what to expect before they buy."
        />
      </section>
    )
  }

  if (layout === 'grid' || layout === 'two-col' || layout === 'two-column') {
    return (
      <section
        className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto"
        style={{ backgroundColor: sectionBg }}
      >
        {titleEl && <div className="mb-10">{titleEl}</div>}
        <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
          {faqs.map((faq, i) => (
            <div key={i} className={`builder-tile-card ${itemShell} ${itemBg} p-6`}>
              {questionField(i, faq.question, 'h3', `font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`, headingColor ? { color: headingColor } : undefined)}
              {answerField(i, faq.answer, `text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-gray-600'}`, bodyColor ? { color: bodyColor } : undefined)}
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (layout === 'split') {
    return (
      <section
        className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto"
        style={{ backgroundColor: sectionBg }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="lg:pr-6">
            {titleEl ? <div className="mb-0 text-left">{titleEl}</div> : null}
            <p className={`text-sm leading-relaxed mt-4 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
              Answers to the questions customers ask most often.
            </p>
          </div>
          <div className={stackGap}>
            {faqs.map((faq, i) => (
              <div key={i} className={`builder-tile-card ${itemShell} ${itemBg} overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  className={`w-full flex items-center justify-between ${rowPad} text-left`}
                >
                  {questionField(i, faq.question, 'span', `font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`)}
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isDark ? 'text-slate-400' : 'text-gray-400'} ${open === i ? 'rotate-180' : ''}`} />
                </button>
                {open === i && (
                  <div className="px-6 pb-4">
                    {answerField(i, faq.answer, `text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-gray-600'}`)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (layout === 'list') {
    return (
      <section
        className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto"
        style={{ backgroundColor: sectionBg }}
      >
        {titleEl && <div className="mb-10">{titleEl}</div>}
        <div className={stackGap}>
          {faqs.map((faq, i) => (
            <div key={i} className={`builder-tile-card ${itemShell} ${itemBg} ${isCompact ? 'p-4' : 'p-6'}`}>
              <div className="flex gap-3 items-start">
                {showNumbers && (
                  <span className={`text-sm font-bold shrink-0 ${isDark ? 'text-primary' : 'text-primary'}`} style={{ color: style.primary_color }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                )}
                <div>
                  {questionField(i, faq.question, 'h3', `font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`)}
                  {answerField(i, faq.answer, `text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-gray-600'}`)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto"
      style={{ backgroundColor: sectionBg }}
    >
      {titleEl && <div className="mb-10">{titleEl}</div>}
      <div className={stackGap}>
        {faqs.map((faq, i) => (
          <div key={i} className={`builder-tile-card ${itemShell} ${itemBg} overflow-hidden`}>
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className={`w-full flex items-center justify-between ${rowPad} text-left`}
            >
              {questionField(i, faq.question, 'span', `font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`)}
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isDark ? 'text-slate-400' : 'text-gray-400'} ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className={isCompact ? 'px-4 pb-3' : 'px-6 pb-4'}>
                {answerField(i, faq.answer, `text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-gray-600'}`)}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
