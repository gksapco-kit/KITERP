import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  TEMPLATE_COLORS,
  getTemplateColorLabel,
} from '@/lib/invoiceTemplates'
import {
  closestShadeIndex,
  generateHueShades,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  HUE_SPECTRUM_GRADIENT,
  barRatioFromHue,
  hueFromBarRatio,
} from '@/lib/colorPickerUtils'

function clamp(n: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, n))
}

export function InvoiceAccentColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  const hex = normalizeHex(value)
  const hsv = useMemo(() => hexToHsv(hex), [hex])
  const shades = useMemo(() => generateHueShades(hsv.h, 11), [hsv.h])
  const shadeIndex = useMemo(() => closestShadeIndex(shades, hex), [shades, hex])

  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [hexDraft, setHexDraft] = useState(hex)

  useEffect(() => {
    setHexDraft(hex)
  }, [hex])

  const pureHueHex = hsvToHex(hsv.h, 100, 100)

  const updateFromSv = useCallback((clientX: number, clientY: number) => {
    const el = svRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const s = clamp((clientX - rect.left) / rect.width) * 100
    const v = clamp(1 - (clientY - rect.top) / rect.height) * 100
    onChange(hsvToHex(hsv.h, s, v))
  }, [hsv.h, onChange])

  const updateFromHue = useCallback((clientX: number) => {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    const ratio = clamp((clientX - rect.left) / rect.width)
    const h = hueFromBarRatio(ratio)
    onChange(hsvToHex(h, hsv.s, hsv.v))
  }, [hsv.s, hsv.v, onChange])

  const bindDrag = useCallback((
    move: (x: number, y: number) => void,
    needsY = false,
  ) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      move(e.clientX, needsY ? e.clientY : 0)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      move(e.clientX, needsY ? e.clientY : 0)
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.currentTarget.releasePointerCapture(e.pointerId)
    },
  }), [])

  const copyHex = async () => {
    try {
      await navigator.clipboard.writeText(hex.toUpperCase())
      setCopied(true)
      toast.success('Colour copied')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy colour')
    }
  }

  const commitHex = () => {
    const next = normalizeHex(hexDraft, hex)
    if (next !== hex) onChange(next)
    setHexDraft(next)
  }

  const selectedLabel = getTemplateColorLabel(hex)
  const isPreset = TEMPLATE_COLORS.some(c => c.value.toLowerCase() === hex.toLowerCase())

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-gray-700">Color palette</p>
        <p className="text-[11px] text-gray-500 mt-0.5">Pick a shade, fine-tune saturation, or set a hex code.</p>
      </div>

      {/* Shade strip — light → vivid → dark */}
      <div
        className="flex h-7 w-full overflow-hidden rounded-full border border-gray-200 shadow-inner"
        role="listbox"
        aria-label="Colour shades"
      >
        {shades.map((shade, i) => (
          <button
            key={`${shade}-${i}`}
            type="button"
            role="option"
            aria-selected={shadeIndex === i}
            title={shade}
            onClick={() => onChange(shade)}
            className="relative flex-1 h-full min-w-0 transition-opacity hover:opacity-90"
            style={{ backgroundColor: shade }}
          >
            {shadeIndex === i && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-900 ring-2 ring-white shadow-sm" />
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Saturation × brightness */}
      <div
        ref={svRef}
        className="relative h-32 w-full rounded-lg cursor-crosshair overflow-hidden border border-gray-200"
        style={{
          background: `
            linear-gradient(to bottom, transparent, #000),
            linear-gradient(to right, #fff, ${pureHueHex})
          `,
        }}
        {...bindDrag((x, y) => updateFromSv(x, y), true)}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: hex,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.25)',
          }}
          aria-hidden
        />
      </div>

      {/* Hue spectrum */}
      <div
        ref={hueRef}
        role="slider"
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        tabIndex={0}
        className="relative h-3 w-full cursor-pointer rounded-full border border-gray-300"
        style={{ background: HUE_SPECTRUM_GRADIENT }}
        onClick={e => updateFromHue(e.clientX)}
        onKeyDown={e => {
          const step = e.shiftKey ? 15 : 5
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            onChange(hsvToHex((hsv.h - step + 360) % 360, hsv.s, hsv.v))
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            onChange(hsvToHex((hsv.h + step) % 360, hsv.s, hsv.v))
          }
        }}
        {...bindDrag(x => updateFromHue(x))}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
          style={{
            left: `${barRatioFromHue(hsv.h) * 100}%`,
            backgroundColor: pureHueHex,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
          }}
          aria-hidden
        />
      </div>

      {/* Preview + hex + copy */}
      <div className="flex items-center gap-2">
        <span
          className="h-9 w-9 shrink-0 rounded-full border border-gray-200 shadow-sm"
          style={{ backgroundColor: hex }}
          aria-hidden
        />
        <Input
          value={hexDraft}
          onChange={e => {
            const v = e.target.value
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setHexDraft(v)
          }}
          onBlur={commitHex}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitHex()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className="flex-1 text-xs font-mono h-9 uppercase"
          maxLength={7}
          spellCheck={false}
          aria-label="Hex colour code"
        />
        <button
          type="button"
          onClick={copyHex}
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          title="Copy hex code"
          aria-label="Copy hex code"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <p className="text-[11px] text-gray-500">
        <span className="font-medium text-gray-700">{selectedLabel}</span>
        {!isPreset && <span className="text-gray-400"> · custom</span>}
      </p>

      {/* Quick preset swatches */}
      <div>
        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Quick picks</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_COLORS.map(c => {
            const selected = c.value.toLowerCase() === hex.toLowerCase()
            return (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => onChange(c.value)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  selected ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ background: c.value }}
              >
                {selected && <Check className="w-3 h-3 text-white mx-auto" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
