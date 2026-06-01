import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const VARIANT_ACCENT_PALETTE = [
  '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6',
]

const LIGHT_ACCENT_FALLBACK = '#94A3B8'

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  const c = color.trim()
  if (!c.startsWith('#')) return null
  const hex = c.length === 4
    ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
    : c
  if (hex.length < 7) return null
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  if ([r, g, b].some(n => Number.isNaN(n))) return null
  return { r, g, b }
}

export function normalizeHexColorInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null
  return `#${hex.toUpperCase()}`
}

export function colorPickerHexValue(raw: string | undefined | null): string {
  return normalizeHexColorInput(raw || '') || '#FFFFFF'
}

export function isLightAccentColor(color: string): boolean {
  const c = color.trim().toLowerCase()
  if (c === 'white') return true
  const rgb = parseHexColor(c.startsWith('#') ? c : `#${c}`)
  if (!rgb) return false
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return lum >= 0.9
}

export function variantUiAccentColor(color: string, index: number): string {
  void index
  if (isLightAccentColor(color)) return LIGHT_ACCENT_FALLBACK
  return color
}

export function resolveVariantAccentColor(raw: string | undefined | null, index: number): string {
  const c = raw?.trim()
  if (c) {
    if (c.startsWith('#')) return c
    if (/^[0-9A-Fa-f]{6}$/.test(c)) return `#${c}`
    return c
  }
  return VARIANT_ACCENT_PALETTE[index % VARIANT_ACCENT_PALETTE.length]
}

function variantAccentBarGradient(color: string, active: boolean): string {
  if (!active) return 'linear-gradient(to bottom, #9ca3af 0%, #d1d5db 100%)'
  const ui = variantUiAccentColor(color, 0)
  if (isLightAccentColor(color)) {
    return 'linear-gradient(to bottom, #64748b 0%, #94a3b8 50%, #cbd5e1 100%)'
  }
  if (ui.startsWith('#') && ui.length >= 7) {
    const r = parseInt(ui.slice(1, 3), 16)
    const g = parseInt(ui.slice(3, 5), 16)
    const b = parseInt(ui.slice(5, 7), 16)
    return `linear-gradient(to bottom, rgb(${r},${g},${b}) 0%, rgba(${r},${g},${b},0.55) 50%, rgba(${r},${g},${b},0.18) 100%)`
  }
  return `linear-gradient(to bottom, ${ui} 0%, color-mix(in srgb, ${ui} 35%, white) 100%)`
}

function variantPanelSurface(color: string, active: boolean): string {
  if (!active) return 'linear-gradient(to bottom, rgb(243 244 246) 0%, white 100%)'
  if (isLightAccentColor(color)) {
    return 'linear-gradient(to bottom, rgb(241 245 249) 0%, rgb(248 250 252) 30%, white 100%)'
  }
  if (color.startsWith('#') && color.length >= 7) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `linear-gradient(to bottom, rgba(${r},${g},${b},0.14) 0%, rgba(${r},${g},${b},0.06) 28%, rgba(255,255,255,0.98) 72%, white 100%)`
  }
  return `linear-gradient(to bottom, color-mix(in srgb, ${color} 14%, white) 0%, color-mix(in srgb, ${color} 5%, white) 28%, white 100%)`
}

export const variantFormUi = {
  body: 'space-y-1 [&_label]:font-semibold [&_label]:text-gray-700',
  grid: 'gap-1.5',
  sectionRule: 'pt-1.5 border-t border-gray-200/90',
  sectionHeading: 'text-[11px] font-semibold uppercase tracking-wide text-gray-800',
  mediaHeading: 'text-[11px] font-semibold uppercase tracking-wide text-indigo-900 flex items-center gap-1.5',
  mediaHint: 'font-normal normal-case tracking-normal text-gray-500',
} as const

export function FormTintPanel({
  accentColor,
  active = true,
  title,
  hint,
  icon: Icon,
  header,
  headerAccentOnly = false,
  children,
  className,
}: {
  accentColor: string
  active?: boolean
  title?: string
  hint?: string
  icon?: React.ElementType
  header?: ReactNode
  headerAccentOnly?: boolean
  children?: ReactNode
  className?: string
}) {
  if (headerAccentOnly && header) {
    return (
      <div className={cn('flex overflow-hidden rounded-lg border-0 shadow-none', !active && 'opacity-85', className)}>
        <div
          className="w-1 shrink-0 self-stretch min-h-full"
          style={{ background: variantAccentBarGradient(accentColor, active) }}
          aria-hidden
        />
        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{ background: variantPanelSurface(accentColor, active) }}
        >
          {header}
          {children ? (
            <div className="px-2 pb-1.5 pt-0 sm:px-2.5">{children}</div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex overflow-hidden rounded-lg border-0 shadow-none', !active && 'opacity-80', className)}>
      <div
        className="w-1 shrink-0 self-stretch min-h-full"
        style={{ background: variantAccentBarGradient(accentColor, active) }}
        aria-hidden
      />
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{ background: variantPanelSurface(accentColor, active) }}
      >
        {header ?? ((title || Icon) && (
          <div className="mb-0.5 flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5">
            {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: accentColor }} />}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {title && <h4 className="text-sm font-semibold text-foreground">{title}</h4>}
              {hint && (
                <span className="text-[0.625rem] font-medium uppercase tracking-wide" style={{ color: accentColor }}>
                  {hint}
                </span>
              )}
            </div>
          </div>
        ))}
        <div className="px-2 pb-1.5 pt-0 sm:px-2.5">{children}</div>
      </div>
    </div>
  )
}

export function InputWithSuffix({ suffix, className, ...props }: React.ComponentProps<typeof Input> & { suffix: string }) {
  return (
    <div className="relative">
      <Input className={cn('w-full pr-7', className)} {...props} />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">{suffix}</span>
    </div>
  )
}

export function InputWithPrefix({ prefix, className, ...props }: React.ComponentProps<typeof Input> & { prefix: string }) {
  return (
    <div className="relative">
      <Input className={cn('w-full pl-7', className)} {...props} />
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">{prefix}</span>
    </div>
  )
}
