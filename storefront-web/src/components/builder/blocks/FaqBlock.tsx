import { useState, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import {
  arrayImageDeleteFieldKey,
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
  visibleArrayEntries,
} from '@/lib/blockHiddenFields'
import { arrayItemImageFrameStyle } from '@/lib/sectionImageStyle'
import { cn, imgUrl } from '@/lib/utils'

interface Props {
  site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null
  blockId?: string
}

type FaqItem = { question: string; answer: string; image_url?: string }

function FaqItemImage({
  faq,
  index,
  blockId,
  blockProps,
  className,
  style,
}: {
  faq: FaqItem
  index: number
  blockId?: string
  blockProps: Record<string, unknown>
  className?: string
  style?: CSSProperties
}) {
  if (blockId && isBlockFieldHidden(blockProps, arrayImageDeleteFieldKey('faqs', index, 'image_url'))) {
    return null
  }
  if (!faq.image_url) return null
  const src = imgUrl(faq.image_url)
  const frameStyle = { ...style, ...arrayItemImageFrameStyle(faq as Record<string, unknown>) }
  if (blockId) {
    return (
      <div className={cn('relative overflow-hidden', className)} style={frameStyle}>
        <BuilderSectionImage
          blockId={blockId}
          field="image_url"
          arrayKey="faqs"
          index={index}
          itemField="image_url"
          blockProps={blockProps}
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    )
  }
  return <img src={src} alt="" className={className} style={frameStyle} loading="lazy" />
}

export default function FaqBlock({ style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const [open, setOpen] = useState<number | null>(0)

  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'FAQ'),
  })
  const layout = String(props.layout ?? 'accordion')
  const columns = Number(props.columns) || 2
  const isDark = props.bg_style === 'dark'
  const isCompact = props.compact === true
  const cardStyle = String(props.card_style ?? '')
  const showNumbers = props.show_numbers === true
  const isBordered = cardStyle === 'bordered'
  const isCard = cardStyle === 'card'

  const rawFaqs = (props.faqs as FaqItem[] | undefined) || []
  const visibleFaqs = visibleArrayEntries(rawFaqs, props, 'faqs')

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
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  const titleEl = showTitle ? (
    <BuilderTextField
      fieldKey="title"
      blockId={blockId}
      blockProps={props}
      value={title ?? ''}
      as="h2"
      className={titleClass}
      style={headingColor ? { color: headingColor } : undefined}
      placeholder="Section title"
    />
  ) : null

  const showQuestion = (i: number) =>
    !isNestedBlockFieldHidden(props, `faqs.${i}.question`)
  const showAnswer = (i: number) =>
    !isNestedBlockFieldHidden(props, `faqs.${i}.answer`)

  const questionField = (
    i: number,
    q: string,
    tag: 'h3' | 'span',
    className: string,
    fieldStyle?: CSSProperties,
    opts?: { embeddedInControl?: boolean },
  ) => {
    if (!showQuestion(i)) return null
    return (
      <BuilderTextField
        fieldKey={`faqs.${i}.question`}
        blockId={blockId}
        blockProps={props}
        value={q}
        as={tag}
        className={className}
        style={fieldStyle}
        skipPositionWrapper
        embeddedInControl={opts?.embeddedInControl}
        placeholder="Question"
      />
    )
  }

  const answerField = (i: number, a: string, className: string, fieldStyle?: CSSProperties) => {
    if (!showAnswer(i)) return null
    return (
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
  }

  const answerImageClass = 'mb-3 aspect-video w-full max-h-48 rounded-lg'
  const answerTextClass = `text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-gray-600'}`

  const faqImageEl = (faq: FaqItem, i: number, className: string) => (
    <FaqItemImage
      faq={faq}
      index={i}
      blockId={blockId}
      blockProps={props}
      className={className}
    />
  )

  const renderAnswerContent = (faq: FaqItem, i: number) => (
    <>
      {faqImageEl(faq, i, answerImageClass)}
      {answerField(i, faq.answer, answerTextClass, bodyColor ? { color: bodyColor } : undefined)}
    </>
  )

  const hasAnswerContent = (faq: FaqItem, i: number) =>
    showAnswer(i) || !!faq.image_url

  const renderFaqBody = (faq: FaqItem, i: number) => (
    <>
      {questionField(i, faq.question, 'h3', `font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`, headingColor ? { color: headingColor } : undefined)}
      {hasAnswerContent(faq, i) ? (
        <div className="mt-1">{renderAnswerContent(faq, i)}</div>
      ) : null}
    </>
  )

  if (rawFaqs.length === 0 || (visibleFaqs.length === 0 && !isEditorCanvas)) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto" style={{ backgroundColor: sectionBg }}>
        {titleEl}
        <BlockEmptyPlaceholder
          style={style}
          title={title ?? 'FAQ'}
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
          {visibleFaqs.map(({ item: faq, index: i }) => (
            <div key={i} className={`builder-tile-card ${itemShell} ${itemBg} p-6`}>
              {renderFaqBody(faq, i)}
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
          </div>
          <div className={stackGap}>
            {visibleFaqs.map(({ item: faq, index: i }) => (
              <div key={i} className={`builder-tile-card ${itemShell} ${itemBg} overflow-hidden`}>
                {(showQuestion(i) || isEditorCanvas) && (
                  <button
                    type="button"
                    onClick={() => setOpen(open === i ? null : i)}
                    className={`w-full flex items-center justify-between ${rowPad} text-left`}
                  >
                    {questionField(i, faq.question, 'span', `font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`, undefined, { embeddedInControl: true })}
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isDark ? 'text-slate-400' : 'text-gray-400'} ${open === i ? 'rotate-180' : ''}`} />
                  </button>
                )}
                {open === i && hasAnswerContent(faq, i) && (
                  <div className={isCompact ? 'px-4 pb-3' : 'px-6 pb-4'}>
                    {renderAnswerContent(faq, i)}
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
          {visibleFaqs.map(({ item: faq, index: i }) => (
            <div key={i} className={`builder-tile-card ${itemShell} ${itemBg} ${isCompact ? 'p-4' : 'p-6'}`}>
              <div className="flex gap-3 items-start">
                {showNumbers && (
                  <span className={`text-sm font-bold shrink-0`} style={{ color: style.primary_color }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {questionField(i, faq.question, 'h3', `font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`)}
                  {hasAnswerContent(faq, i) ? renderAnswerContent(faq, i) : null}
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
        {visibleFaqs.map(({ item: faq, index: i }) => (
          <div key={i} className={`builder-tile-card ${itemShell} ${itemBg} overflow-hidden`}>
            {(showQuestion(i) || isEditorCanvas) && (
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className={`w-full flex items-center justify-between ${rowPad} text-left`}
              >
                {questionField(i, faq.question, 'span', `font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`, undefined, { embeddedInControl: true })}
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isDark ? 'text-slate-400' : 'text-gray-400'} ${open === i ? 'rotate-180' : ''}`} />
              </button>
            )}
            {open === i && hasAnswerContent(faq, i) && (
              <div className={isCompact ? 'px-4 pb-3' : 'px-6 pb-4'}>
                {renderAnswerContent(faq, i)}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
