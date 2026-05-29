import { FileText, Scale, Shield } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Block } from '../../types/builder'

interface LegalDocumentBlockProps {
  block: Block
  layoutStyle?: CSSProperties
  darkMode?: boolean
}

export function LegalDocumentBlock({ block, layoutStyle, darkMode }: LegalDocumentBlockProps) {
  const title = block.props.text?.trim() || 'Legal'
  const lastUpdated = block.props.subtitle?.trim()
  const html = block.props.html ?? ''
  const variant = block.props.legalVariant ?? 'privacy'
  const isPrivacy = variant === 'privacy'

  const Icon = isPrivacy ? Shield : Scale
  const badge = isPrivacy ? 'Privacy' : 'Terms'

  return (
    <article
      style={layoutStyle}
      className={`legal-document w-full ${darkMode ? 'legal-document--dark' : ''}`}
    >
      <header className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-6 py-14 text-white sm:px-10 sm:py-16 lg:px-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(99,102,241,0.35), transparent 45%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.2), transparent 40%)',
          }}
        />
        <div className="relative mx-auto flex max-w-4xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-100 backdrop-blur-sm">
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {badge}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
              {title}
            </h1>
            {lastUpdated ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                <FileText className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span>Last updated: {lastUpdated}</span>
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-12 lg:px-10">
        <div
          className={`legal-document__body rounded-2xl border px-6 py-8 shadow-xl sm:px-10 sm:py-10 ${
            darkMode
              ? 'border-slate-700/80 bg-slate-900/60 shadow-black/20'
              : 'border-slate-200/90 bg-white shadow-slate-200/60'
          }`}
        >
          <div
            className={`legal-document__prose prose max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-h2:mt-10 prose-h2:border-b prose-h2:pb-2 prose-h2:text-lg prose-h2:first:mt-0 sm:prose-h2:text-xl ${
              darkMode
                ? 'prose-invert prose-headings:text-gray-100 prose-p:text-gray-300 prose-li:text-gray-300 prose-a:text-indigo-300 prose-h2:border-slate-700'
                : 'prose-gray prose-headings:text-slate-900 prose-p:text-slate-600 prose-li:text-slate-600 prose-a:text-indigo-600 prose-h2:border-slate-100'
            } prose-a:no-underline hover:prose-a:underline`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </article>
  )
}
