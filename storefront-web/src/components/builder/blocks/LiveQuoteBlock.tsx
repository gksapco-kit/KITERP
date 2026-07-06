import { useMemo, useState } from 'react'
import { Calculator, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { LiveItem, PublicSite, StyleConfig } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'
import { builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { cn } from '@/lib/utils'
import { storeApi } from '@/api/store'

/** Mirrors the shared `GENERIC_SPACING_PRESETS` layout keys so the section-style picker's
 * 10 default options ("Standard", "Spacious", "Compact", …) each render distinctly here. */
type QuoteLayout = 'standard' | 'spacious' | 'compact' | 'centered' | 'wide' | 'narrow' | 'split' | 'card' | 'minimal' | 'statement'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

interface QuoteRow {
  product_id: string
  name: string
  price: number
  qty: number
}

/**
 * Live Quote Widget — lets a visitor build a multi-line quote from the
 * vendor's catalog and shoot the request to the existing
 * `/store/orders/quote-request` endpoint, which creates a CRM lead and a
 * draft order on the backend.
 *
 * UX choices:
 *  - Catalog comes from the same `products` live feed every other ecom block
 *    uses, so it picks up branch / store filtering automatically.
 *  - Subtotal updates live as quantities change.
 *  - Pre-submit fields are deliberately small (name + email/phone + notes) so
 *    the form feels like a "get a quote" form, not a checkout form.
 */
export default function LiveQuoteBlock({ site, style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const title = resolveBlockTextField(props, 'title')
  const ctaLabel = resolveBlockTextField(props, 'cta_label')
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const showCta = !isBlockFieldHidden(props, 'cta_label') && (ctaLabel || isEditorCanvas)

  const layout = (String(props.layout ?? 'standard') as QuoteLayout)
  const isDark = layout === 'statement' || props.bg_style === 'dark'
  const isCard = layout === 'card' || props.card_style === 'elevated'
  const isMinimal = layout === 'minimal'
  const isLeftAlign = props.align === 'left'
  const isStacked = layout === 'narrow' || layout === 'centered'
  const catalogAsList = layout === 'compact' || layout === 'narrow' || layout === 'centered'

  const maxWidth =
    layout === 'wide' || props.max_width === 'full' ? 'max-w-7xl'
      : layout === 'narrow' || props.max_width === 'prose' ? 'max-w-xl'
        : layout === 'centered' ? 'max-w-2xl'
          : layout === 'compact' ? 'max-w-3xl'
            : 'max-w-5xl'
  const sectionBg = isDark ? '#0f172a' : undefined
  const headingColor = isDark ? '#f8fafc' : undefined
  const mutedTextClass = isDark ? 'text-slate-400' : 'text-gray-500'
  const catalogItemClass = isMinimal
    ? 'border-transparent hover:bg-gray-50'
    : isDark
      ? 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/60'
      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
  const panelClass = isMinimal
    ? 'border-transparent bg-transparent'
    : isDark
      ? 'border-slate-700 bg-slate-800/60'
      : 'border-gray-200 bg-white'
  const inputClass = isDark
    ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
    : 'bg-white border-gray-200'

  const [rows, setRows] = useState<QuoteRow[]>([])
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const subtotal = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.price || 0) * (r.qty || 0), 0),
    [rows],
  )

  const addProduct = (item: LiveItem) => {
    if (!item.id) return
    const productId = String(item.id)
    setRows(prev => {
      const existing = prev.find(r => r.product_id === productId)
      if (existing) {
        return prev.map(r => (r.product_id === productId ? { ...r, qty: r.qty + 1 } : r))
      }
      return [
        ...prev,
        { product_id: productId, name: item.title, price: Number(item.price || 0), qty: 1 },
      ]
    })
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setRows(prev => prev.filter(r => r.product_id !== productId))
      return
    }
    setRows(prev => prev.map(r => (r.product_id === productId ? { ...r, qty } : r)))
  }

  const submit = async () => {
    if (rows.length === 0) {
      toast.error('Add at least one product to your quote.')
      return
    }
    if (!name.trim() || !contact.trim()) {
      toast.error('Please share your name and contact info.')
      return
    }
    setSubmitting(true)
    try {
      const message = [
        `Quote request:`,
        ...rows.map(r => `- ${r.name} × ${r.qty} @ ${site.currency_symbol}${r.price}`),
        `Estimated total: ${site.currency_symbol}${subtotal.toLocaleString()}`,
        notes ? `\nNotes: ${notes}` : '',
      ].join('\n')

      // Send the first row as the primary product so backend ties the lead
      // to a real catalog item; full breakdown rides in `message`.
      await storeApi.requestQuote({
        item_type: 'product',
        product_id: rows[0].product_id,
        product_name: rows[0].name,
        message,
        form_data: {
          name: name.trim(),
          contact: contact.trim(),
          line_count: String(rows.length),
          estimated_total: String(subtotal),
        },
      })
      toast.success('Quote request sent! We will contact you soon.')
      setRows([])
      setName('')
      setContact('')
      setNotes('')
    } catch {
      toast.error('Could not send quote request — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const catalogPanel = (
    <div>
      <h3 className={cn('text-xs font-bold uppercase tracking-wide mb-3', mutedTextClass)}>Catalog</h3>
      {liveItems.length === 0 ? (
        <p className={cn('text-sm', mutedTextClass)}>No products available yet.</p>
      ) : catalogAsList ? (
        <ul className="space-y-2 list-none p-0 m-0">
          {liveItems.map(item => (
            <li key={item.id || item.title}>
              <button
                type="button"
                onClick={() => addProduct(item)}
                className={cn('w-full text-left p-2.5 border rounded-xl transition-colors flex items-center gap-3', catalogItemClass)}
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {item.image_url && <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />}
                </div>
                <p className="text-sm font-medium truncate flex-1">{item.title}</p>
                {item.price_formatted && (
                  <span className={cn('text-xs shrink-0 tabular-nums', mutedTextClass)}>{item.price_formatted}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0 m-0">
          {liveItems.map(item => (
            <li key={item.id || item.title}>
              <button
                type="button"
                onClick={() => addProduct(item)}
                className={cn('w-full text-left p-3 border rounded-xl transition-colors flex gap-3', catalogItemClass)}
              >
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {item.image_url && <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.price_formatted && (
                    <p className={cn('text-xs mt-0.5', mutedTextClass)}>{item.price_formatted}</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const quotePanel = (
    <div className={cn('border rounded-2xl p-4 space-y-4', panelClass, !isStacked && 'self-start')}>
      <h3 className={cn('text-xs font-bold uppercase tracking-wide', mutedTextClass)}>Your Quote</h3>
      {rows.length === 0 ? (
        <p className={cn('text-sm', mutedTextClass)}>No items selected yet.</p>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {rows.map(r => (
            <li key={r.product_id} className="flex items-center gap-2">
              <span className="text-sm flex-1 truncate">{r.name}</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={r.qty}
                onChange={e => updateQty(r.product_id, Number(e.target.value) || 0)}
                className={cn('w-14 px-2 py-1 border rounded text-sm tabular-nums', inputClass)}
              />
              <span className={cn('text-xs w-20 text-right tabular-nums', mutedTextClass)}>
                {site.currency_symbol}
                {(r.price * r.qty).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className={cn('border-t pt-3 flex justify-between font-bold', isDark && 'border-slate-700')}>
        <span className="text-sm">Estimated total</span>
        <span style={{ color: style.primary_color }}>
          {site.currency_symbol}
          {subtotal.toLocaleString()}
        </span>
      </div>

      <div className="space-y-2 pt-2">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          className={cn('w-full px-3 py-2 text-sm border rounded-lg', inputClass)}
        />
        <input
          type="text"
          placeholder="Email or phone"
          value={contact}
          onChange={e => setContact(e.target.value)}
          className={cn('w-full px-3 py-2 text-sm border rounded-lg', inputClass)}
        />
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className={cn('w-full px-3 py-2 text-sm border rounded-lg resize-none', inputClass)}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={submitting || rows.length === 0}
        className="w-full py-2.5 text-sm font-semibold rounded-lg text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ backgroundColor: style.primary_color }}
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {isEditorCanvas && showCta ? (
          <BuilderTextField fieldKey="cta_label" blockId={blockId} blockProps={props} value={ctaLabel ?? ''} as="span" embeddedInControl placeholder="Button label" />
        ) : (
          ctaLabel
        )}
      </button>
    </div>
  )

  const body = isStacked ? (
    <div className="space-y-6">
      {catalogPanel}
      {quotePanel}
    </div>
  ) : (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
      {catalogPanel}
      {quotePanel}
    </div>
  )

  return (
    <div className="w-full" style={sectionBg ? { background: sectionBg } : undefined}>
      <section className={builderSectionContainerWithMax(maxWidth)} aria-label={title ?? undefined}>
        <header className={cn('mb-8 flex flex-col', isLeftAlign ? 'items-start text-left' : 'items-center text-center')}>
          <Calculator className={cn('w-8 h-8 mb-3', !isLeftAlign && 'mx-auto')} style={{ color: style.primary_color }} aria-hidden="true" />
          {showTitle && (
            <BuilderTextField
              fieldKey="title"
              blockId={blockId}
              blockProps={props}
              value={title ?? ''}
              as="h2"
              className="text-2xl sm:text-3xl font-bold"
              style={{ fontFamily: style.font_heading, color: headingColor ?? style.text_color }}
              placeholder="Section title"
            />
          )}
          <p className={cn('text-sm mt-2 max-w-lg', mutedTextClass, !isLeftAlign && 'mx-auto')}>
            Pick the items you're interested in, set quantities, and we'll get back with a tailored quote.
          </p>
        </header>

        {isCard ? (
          <div className={cn('rounded-2xl border p-5 sm:p-6 shadow-sm', panelClass)}>{body}</div>
        ) : (
          body
        )}
      </section>
    </div>
  )
}
