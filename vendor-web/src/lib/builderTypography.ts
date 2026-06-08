import type { BlockProps } from '@/types/websites'

/** Pixel presets for the numeric dropdown (Figma/Word-style). */
export const FONT_SIZE_PX_CHOICES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72] as const
export const FONT_SIZE_PX_MIN = 8
export const FONT_SIZE_PX_MAX = 72
export const FONT_SIZE_PX_STEP = 1
export const FONT_SIZE_PX_FALLBACK = 16

const TEXT_CASE_CSS = ['uppercase', 'lowercase', 'capitalize'] as const
type TextCaseCss = (typeof TEXT_CASE_CSS)[number]
export type TextCaseMenuId = 'default' | 'sentence' | TextCaseCss | 'toggle'

export function toSentenceCase(s: string): string {
  const t = s.trim().toLowerCase()
  if (!t) return s
  return t.replace(/(^|[.!?]\s+)(\w)/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
}

export function toToggleCase(s: string): string {
  return [...s].map(c => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).join('')
}

const TEXT_CASE_SKIP_KEYS = new Set([
  'data_source', 'overlays', 'nav_links', 'social_links', 'form_fields', 'html',
  'gradient_preset',
])

function shouldSkipStringCase(val: string, key: string): boolean {
  const t = val.trim()
  if (!t) return true
  if (/^https?:\/\//i.test(t) || /^www\./i.test(t)) return true
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return true
  const lk = key.toLowerCase()
  if ((lk.includes('url') || lk.endsWith('_url')) && t.length > 3) return true
  if ((lk === 'email' || lk === 'phone') && (t.includes('@') || /^\+?[\d\s().-]{8,}$/.test(t))) return true
  return false
}

function mapPropsStringsDeep(
  props: Record<string, unknown>,
  mode: 'sentence' | 'toggle',
): Record<string, unknown> {
  const fn = mode === 'sentence' ? toSentenceCase : toToggleCase
  const visit = (val: unknown, key: string): unknown => {
    if (typeof val === 'string') {
      if (shouldSkipStringCase(val, key)) return val
      return fn(val)
    }
    if (Array.isArray(val)) return val.map((el, i) => visit(el, `${key}[${i}]`))
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const o = val as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(o)) {
        if (TEXT_CASE_SKIP_KEYS.has(k)) {
          out[k] = v
          continue
        }
        out[k] = visit(v, k)
      }
      return out
    }
    return val
  }
  return visit({ ...props }, 'root') as Record<string, unknown>
}

export function buildTextCasePropsPatch(
  current: Record<string, unknown>,
  cmd: TextCaseMenuId,
): Partial<BlockProps> {
  if (cmd === 'default') return { text_transform: null }
  if (cmd === 'uppercase' || cmd === 'lowercase' || cmd === 'capitalize') {
    return { text_transform: cmd }
  }
  if (cmd === 'sentence' || cmd === 'toggle') {
    const mode = cmd === 'sentence' ? 'sentence' : 'toggle'
    return { text_transform: null, ...mapPropsStringsDeep(current, mode) } as Partial<BlockProps>
  }
  return {}
}

export function currentTextCaseMenuId(props: Record<string, unknown>): TextCaseMenuId {
  const t = (props.text_transform as string | undefined)?.toLowerCase()
  if (t && (TEXT_CASE_CSS as readonly string[]).includes(t)) return t as TextCaseCss
  return 'default'
}

export const TEXT_CASE_MENU_ROWS: { id: TextCaseMenuId; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'sentence', label: 'Sentence case.' },
  { id: 'lowercase', label: 'lowercase' },
  { id: 'uppercase', label: 'UPPERCASE' },
  { id: 'capitalize', label: 'Capitalize Each Word' },
  { id: 'toggle', label: 'tOGGLE cASE' },
]

export function normalizeFontSizePx(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return Math.round(Math.min(FONT_SIZE_PX_MAX, Math.max(FONT_SIZE_PX_MIN, value)))
}

export function stepFontSizePx(current: unknown, delta: number): number {
  const base = normalizeFontSizePx(current) ?? FONT_SIZE_PX_FALLBACK
  return Math.min(FONT_SIZE_PX_MAX, Math.max(FONT_SIZE_PX_MIN, base + delta))
}

/** Word/Docs-style line spacing multipliers. */
export const LINE_HEIGHT_RATIO_PRESETS = [1, 1.15, 1.5, 2, 2.5, 3] as const
export type LineHeightRatioPreset = (typeof LINE_HEIGHT_RATIO_PRESETS)[number]

export const PARAGRAPH_SPACE_STEP_PX = 12
export const PARAGRAPH_SPACE_MAX_PX = 96

export function normalizeLineHeightRatio(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100) / 100
}

export function formatLineHeightLabel(ratio: number | null | undefined): string {
  const n = normalizeLineHeightRatio(ratio)
  if (n == null) return 'Auto'
  return Number.isInteger(n) ? String(n) : String(n)
}
