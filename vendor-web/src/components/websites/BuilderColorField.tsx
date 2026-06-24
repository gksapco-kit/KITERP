import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

function normalizeHex(value: string): string | null {
  const v = value.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase()
  return null
}

type BuilderColorFieldProps = {
  label: string
  value: string
  onChange: (hex: string) => void
  className?: string
}

/** Swatch picker + pasteable hex field for builder style panels. */
export function BuilderColorField({ label, value, onChange, className }: BuilderColorFieldProps) {
  const hex = (value || '#000000').toLowerCase()
  const [draft, setDraft] = useState(hex)

  useEffect(() => {
    setDraft(hex)
  }, [hex])

  const commitDraft = () => {
    const next = normalizeHex(draft)
    if (next) {
      onChange(next)
      setDraft(next)
    } else {
      setDraft(hex)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-border/40 bg-background/60 px-1.5 py-1 transition-colors hover:border-primary/25 hover:bg-background',
        className,
      )}
    >
      <label className="relative shrink-0 cursor-pointer">
        <span
          className="block h-5 w-5 rounded border border-border bg-background shadow-sm"
          style={{ backgroundColor: hex }}
          aria-hidden
        />
        <input
          type="color"
          value={hex}
          onChange={e => onChange(e.target.value.toLowerCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`Pick ${label.toLowerCase()} color`}
        />
      </label>
      <div className="min-w-0 flex-1 leading-none">
        <span className="block text-[10px] font-medium text-foreground">{label}</span>
        <input
          type="text"
          value={draft}
          onChange={e => {
            const v = e.target.value
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setDraft(v)
          }}
          onBlur={commitDraft}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          onPaste={e => {
            const pasted = e.clipboardData.getData('text').trim()
            if (/^#[0-9A-Fa-f]{6}$/i.test(pasted)) {
              e.preventDefault()
              const next = pasted.toLowerCase()
              setDraft(next)
              onChange(next)
            }
          }}
          spellCheck={false}
          aria-label={`${label} hex color`}
          className="mt-0.5 w-full bg-transparent font-mono text-[9px] text-muted-foreground outline-none focus:text-foreground"
        />
      </div>
    </div>
  )
}

type HuePreviewPickerProps = {
  color: string
  onChange: (hex: string) => void
  compact?: boolean
}

/** Clickable preview swatch for the palette hue bar. */
export function HuePreviewPicker({ color, onChange, compact = false }: HuePreviewPickerProps) {
  const hex = (color || '#000000').toLowerCase()

  return (
    <label className="relative shrink-0 cursor-pointer">
      <span
        className={cn(
          'block rounded-full border-2 border-border bg-background shadow-sm ring-1 ring-black/[0.06]',
          compact ? 'h-7 w-7' : 'h-8 w-8',
        )}
        style={{ backgroundColor: hex }}
        title={hex}
        aria-hidden
      />
      <input
        type="color"
        value={hex}
        onChange={e => onChange(e.target.value.toLowerCase())}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label="Pick preview color"
      />
    </label>
  )
}
