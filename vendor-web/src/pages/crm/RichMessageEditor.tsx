import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { MERGE_TAGS } from './crmMarketingForms'
import { RICH_FORMAT_CHIPS, insertAtCursor, wrapSelection } from './marketingTemplateRich'

export function RichMessageEditor({
  value, onChange, placeholder, rows = 14,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const applyWrap = (wrap: [string, string]) => {
    const el = ref.current
    if (!el) return
    const { value: next, cursor } = wrapSelection(value, wrap, el.selectionStart, el.selectionEnd)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  const applyPrefix = (prefix: string) => {
    const el = ref.current
    if (!el) return
    const lineStart = value.lastIndexOf('\n', el.selectionStart - 1) + 1
    const { value: next, cursor } = insertAtCursor(value, prefix, lineStart, lineStart)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  const insertTag = (tag: string) => {
    const el = ref.current
    if (!el) return
    const { value: next, cursor } = insertAtCursor(value, tag, el.selectionStart, el.selectionEnd)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {RICH_FORMAT_CHIPS.map(chip => (
          <button
            key={chip.label}
            type="button"
            title={chip.hint || chip.label}
            onClick={() => chip.wrap ? applyWrap(chip.wrap as [string, string]) : applyPrefix(chip.prefix || '')}
            className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-medium"
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {MERGE_TAGS.map(m => (
          <button key={m.tag} type="button" onClick={() => insertTag(m.tag)}
            className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700">
            {m.label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="flex w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed font-sans resize-y min-h-[200px] focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none"
      />
      <p className="text-[11px] text-gray-400">
        Use *bold*, _italic_, and ✅ lines for offer lists — like WhatsApp marketing messages.
      </p>
    </div>
  )
}

export function LoadPromoSampleButton({ onLoad }: { onLoad: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onLoad}>
      Load promo sample
    </Button>
  )
}
