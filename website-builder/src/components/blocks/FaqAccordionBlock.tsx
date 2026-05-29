import { useState } from 'react'
import { ChevronDown, MessageCircle } from 'lucide-react'
import { PAGE_CONTENT_PADDING, PAGE_MAX_WIDTH_CLASS } from '../../lib/pageLayout'
import type { Block, FaqItem } from '../../types/builder'
import { SectionHeading } from '../builder/SectionHeading'

interface FaqAccordionBlockProps {
  block: Block
  items: FaqItem[]
  layoutStyle: React.CSSProperties
}

export function FaqAccordionBlock({ block, items, layoutStyle }: FaqAccordionBlockProps) {
  const { props } = block
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? '0')

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  const contentRowClass = `mx-auto w-full min-w-0 ${PAGE_MAX_WIDTH_CLASS} ${PAGE_CONTENT_PADDING}`

  return (
    <section style={layoutStyle} className="w-full min-w-0 overflow-x-clip">
      <div className={contentRowClass}>
        <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-14 xl:gap-16">
          <header className="mb-10 text-center lg:mb-0 lg:sticky lg:top-8 lg:text-left">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              FAQ
            </span>
            <SectionHeading
              title={props.text}
              subtitle={props.subtitle}
              styles={block.styles}
              className="mb-0"
              centered={false}
              titleClassName="text-3xl font-bold tracking-tight sm:text-4xl"
              subtitleClassName="mt-4 max-w-md text-base leading-relaxed lg:max-w-none"
            />
          </header>

          <div className="min-w-0">
            {items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-14 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-400">
                No questions yet — add FAQ items in the properties panel.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-gray-100 dark:border-gray-700/80 dark:bg-gray-900/50 dark:shadow-none dark:ring-gray-800">
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((item, i) => {
                    const itemId = item.id ?? String(i)
                    const isOpen = openId === itemId
                    const panelId = `faq-panel-${itemId}`
                    const buttonId = `faq-button-${itemId}`

                    return (
                      <li key={itemId} className={isOpen ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''}>
                        <button
                          id={buttonId}
                          type="button"
                          className="flex w-full items-start gap-4 px-5 py-5 text-left transition-colors hover:bg-gray-50/80 sm:px-6 sm:py-5 dark:hover:bg-gray-800/40"
                          onClick={() => toggle(itemId)}
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums transition ${
                              isOpen
                                ? 'bg-brand-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                            aria-hidden
                          >
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="min-w-0 flex-1 pt-0.5">
                            <span className="block text-base font-semibold leading-snug text-gray-900 sm:text-[1.05rem] dark:text-white">
                              {item.question}
                            </span>
                          </span>
                          <span
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
                              isOpen
                                ? 'rotate-180 border-brand-200 bg-white text-brand-600 dark:border-brand-800 dark:bg-gray-900'
                                : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                            aria-hidden
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
                        </button>
                        <div
                          id={panelId}
                          role="region"
                          aria-labelledby={buttonId}
                          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          }`}
                        >
                          <div className="overflow-hidden">
                            <p className="border-t border-brand-100/80 px-5 pb-6 pl-[4.25rem] pr-6 pt-1 text-sm leading-relaxed text-gray-600 sm:px-6 sm:pl-[4.5rem] dark:border-brand-900/40 dark:text-gray-300">
                              {item.answer}
                            </p>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
