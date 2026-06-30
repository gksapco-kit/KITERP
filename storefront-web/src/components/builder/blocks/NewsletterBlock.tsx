import { useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { publicSitesApi } from '@/api/publicSites'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

export default function NewsletterBlock({ site, style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'Stay in the Loop'),
  })
  const subtitle = resolveBlockTextField(props, 'subtitle', {
    fallback: () => (isEditorCanvas ? null : 'Get the latest updates delivered to your inbox.'),
  })
  const ctaLabel = resolveBlockTextField(props, 'cta_label', {
    fallback: () => (isEditorCanvas ? null : 'Subscribe'),
  })

  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const showSubtitle = !isBlockFieldHidden(props, 'subtitle') && (subtitle || isEditorCanvas)
  const showCta = !isBlockFieldHidden(props, 'cta_label') && (ctaLabel || isEditorCanvas)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!email) return
    setLoading(true)
    try { await publicSitesApi.submitNewsletter(site.id, email); setDone(true) }
    catch { alert('Subscription failed, please try again') }
    finally { setLoading(false) }
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: `${style.primary_color}10` }}>
      <div className="max-w-xl mx-auto text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: style.primary_color }}>
          <Mail className="w-6 h-6 text-white" />
        </div>
        {showTitle && (
          <BuilderTextField
            fieldKey="title"
            blockId={blockId}
            blockProps={props}
            value={title ?? ''}
            as="h2"
            className="text-2xl font-bold text-gray-900 mb-2"
          />
        )}
        {showSubtitle && (
          <BuilderTextField
            fieldKey="subtitle"
            blockId={blockId}
            blockProps={props}
            value={subtitle ?? ''}
            as="p"
            multiline
            className="text-gray-500 mb-6"
            placeholder="Newsletter description"
          />
        )}
        {showCta && (
          done ? (
            <p className="text-green-600 font-semibold">You're subscribed! 🎉</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2" />
              <button type="submit" disabled={loading || !ctaLabel} className="px-6 py-3 rounded-xl text-white font-semibold text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: style.primary_color }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (ctaLabel || 'Subscribe')}
              </button>
            </form>
          )
        )}
      </div>
    </section>
  )
}
