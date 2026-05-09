import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ExternalLink, FileText, Layout, Loader2, Paintbrush, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { websiteApi } from '@/api/websites'
import type { WebsiteTemplate } from '@/types/websites'
import { getTemplatePreviewPalette } from '@/lib/templateBlockHighlights'
import { getStorefrontAppOrigin, STOREFRONT_OPEN_IN_BROWSER_BTN_CLASS } from '@/lib/storefrontPreviewUrl'

// ── Fonts available via Google Fonts in storefront-web globals.css ────────────
const HEADING_FONTS = ['Fraunces', 'Playfair Display', 'DM Serif Display', 'Space Grotesk', 'Manrope', 'Inter']
const BODY_FONTS    = ['Inter', 'Manrope', 'Space Grotesk', 'Fraunces']

export interface CustomStyleParams {
  primary?: string
  accent?: string
  bg?: string
  fg?: string
  displayFont?: string
  bodyFont?: string
  storeName?: string
}

/** Returns a storefront full-page preview URL, optionally with custom style params. */
export function getStorefrontTemplateBrowserPreviewUrl(
  templateId: string,
  custom?: CustomStyleParams,
): string {
  const base = `${getStorefrontAppOrigin()}/template-browser/${encodeURIComponent(templateId)}`

  if (!custom) return base
  const p = new URLSearchParams()
  if (custom.primary)     p.set('p', custom.primary)
  if (custom.accent)      p.set('a', custom.accent)
  if (custom.bg)          p.set('bg', custom.bg)
  if (custom.fg)          p.set('fg', custom.fg)
  if (custom.displayFont) p.set('hf', custom.displayFont)
  if (custom.bodyFont)    p.set('bf', custom.bodyFont)
  if (custom.storeName)   p.set('name', custom.storeName)
  const qs = p.toString()
  return qs ? `${base}?${qs}` : base
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isStorefrontTemplate(id: string) {
  return id.startsWith('storefront_')
}

/** Derive initial hex colors from template data. Prefers default_style, falls back to preview_palette. */
function initColors(template: WebsiteTemplate): { primary: string; accent: string; bg: string; fg: string } {
  const ds = template.default_style
  const pal = template.preview_palette ?? []
  return {
    primary: ds?.primary_color || pal[0] || '#221D1A',
    accent:  ds?.accent_color  || pal[1] || '#E45E25',
    bg:      ds?.bg_color      || pal[2] || '#F9F7F5',
    fg:      ds?.text_color    || pal[4] || pal[3] || '#221D1A',
  }
}

// ── Customize style panel ─────────────────────────────────────────────────────
interface StylePanelProps {
  template: WebsiteTemplate
}
function CustomizeStylePanel({ template }: StylePanelProps) {
  const defaults = initColors(template)
  const defaultDisplayFont = template.default_style?.font_heading || 'Fraunces'
  const defaultBodyFont    = template.default_style?.font_body    || 'Inter'
  const defaultStoreName   = template.name

  const [primary, setPrimary]           = useState(defaults.primary)
  const [accent, setAccent]             = useState(defaults.accent)
  const [bg, setBg]                     = useState(defaults.bg)
  const [fg, setFg]                     = useState(defaults.fg)
  const [displayFont, setDisplayFont]   = useState(defaultDisplayFont)
  const [bodyFont, setBodyFont]         = useState(defaultBodyFont)
  const [storeName, setStoreName]       = useState(defaultStoreName)

  const reset = () => {
    setPrimary(defaults.primary)
    setAccent(defaults.accent)
    setBg(defaults.bg)
    setFg(defaults.fg)
    setDisplayFont(defaultDisplayFont)
    setBodyFont(defaultBodyFont)
    setStoreName(defaultStoreName)
  }

  const previewUrl = getStorefrontTemplateBrowserPreviewUrl(template.id, {
    primary, accent, bg, fg, displayFont, bodyFont,
    storeName: storeName !== defaultStoreName ? storeName : undefined,
  })

  return (
    <div className="border border-violet-200 rounded-2xl bg-gradient-to-br from-violet-50/60 to-fuchsia-50/40 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Paintbrush className="w-3.5 h-3.5 text-violet-600 shrink-0" />
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-violet-700">Customize style</span>
        <span className="text-[10px] text-gray-400 ml-auto">Live preview below</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Colors */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">Brand colors</div>
          <div className="space-y-1.5">
            {(
              [
                { label: 'Primary',    value: primary, set: setPrimary },
                { label: 'Accent',     value: accent,  set: setAccent  },
                { label: 'Background', value: bg,       set: setBg      },
                { label: 'Text',       value: fg,       set: setFg      },
              ] as const
            ).map(({ label, value, set }) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer group">
                <span
                  className="w-5 h-5 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-200 shrink-0 relative overflow-hidden"
                  style={{ backgroundColor: value }}
                >
                  <input
                    type="color"
                    value={value}
                    onChange={e => set(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title={`Pick ${label.toLowerCase()} color`}
                  />
                </span>
                <span className="text-[11px] text-gray-700 w-20 shrink-0">{label}</span>
                <input
                  type="text"
                  value={value}
                  onChange={e => {
                    const v = e.target.value.trim()
                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) set(v)
                    else if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) set(v)
                  }}
                  maxLength={7}
                  placeholder="#000000"
                  className="flex-1 min-w-0 font-mono text-[10px] px-2 py-1 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-violet-300 text-gray-800"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Fonts + Store name */}
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">Typography</div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-gray-700 w-14 shrink-0">Heading</span>
                <select
                  value={displayFont}
                  onChange={e => setDisplayFont(e.target.value)}
                  className="flex-1 text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-violet-300 text-gray-800"
                >
                  {HEADING_FONTS.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-gray-700 w-14 shrink-0">Body</span>
                <select
                  value={bodyFont}
                  onChange={e => setBodyFont(e.target.value)}
                  className="flex-1 text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-violet-300 text-gray-800"
                >
                  {BODY_FONTS.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">Store name</div>
            <input
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="My Store"
              className="w-full text-[11px] px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-violet-300 text-gray-800"
            />
          </div>

          {/* Palette preview */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[10px] text-gray-400">Preview:</span>
            {[primary, accent, bg, fg].map((c, i) => (
              <span key={i} className="w-5 h-5 rounded-full border border-white shadow-sm ring-1 ring-gray-200" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-violet-100">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-extrabold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 transition-opacity shadow-sm"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Preview with this style
        </a>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export interface WebsiteTemplatePreviewModalProps {
  template: WebsiteTemplate | null
  /** Target site for apply; if missing, apply is disabled with a hint. */
  siteId: string | null | undefined
  siteLabel?: string | null
  onClose: () => void
  /** After successful apply (e.g. clear selection in builder). */
  onApplied?: () => void
  zIndexClass?: string
}

export function WebsiteTemplatePreviewModal({
  template,
  siteId,
  siteLabel,
  onClose,
  onApplied,
  zIndexClass = 'z-[220]',
}: WebsiteTemplatePreviewModalProps) {
  const qc = useQueryClient()
  const [applyArmed, setApplyArmed] = useState(false)
  const [applyText, setApplyText] = useState('')
  const [showCustomize, setShowCustomize] = useState(false)

  const applyMut = useMutation({
    mutationFn: async (templateId: string) => {
      if (!siteId) throw new Error('no_site')
      return websiteApi.applyTemplate(siteId, templateId)
    },
    onSuccess: (_data, templateId) => {
      qc.invalidateQueries({ queryKey: ['websites'] })
      if (siteId) {
        qc.invalidateQueries({ queryKey: ['websites', siteId] })
        qc.invalidateQueries({ queryKey: ['websites', siteId, 'pages'] })
      }
      const name = template?.name || templateId
      toast.success(`Template "${name}" applied!`)
      onApplied?.()
      onClose()
      setApplyArmed(false)
      setApplyText('')
    },
    onError: (err: unknown) => {
      if ((err as Error)?.message === 'no_site') {
        toast.error('Choose a site first.')
        return
      }
      toast.error('Failed to apply template')
    },
  })

  if (!template) return null

  const isStorefront = isStorefrontTemplate(template.id)
  const pageCount = template.page_count ?? template.pages?.length ?? 0
  const navPages = (template.pages || []).filter(p => (p.show_in_nav ?? true) && !p.is_homepage)
  const navCount = template.nav_page_count ?? navPages.length + 1
  const tier = template.tier || (pageCount >= 6 ? 'full' : 'lite')
  const palette = getTemplatePreviewPalette(template)
  const canApply = !!siteId && siteId.length > 0

  const handleClose = () => {
    setApplyArmed(false)
    setApplyText('')
    onClose()
  }

  return (
    <div className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4', zIndexClass)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden max-h-[min(900px,95vh)] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 p-5 border-b border-gray-100 shrink-0">
          <div className="w-36 h-24 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
            {template.thumbnail
              ? <img src={template.thumbnail} className="w-full h-full object-cover" alt={template.name} />
              : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No thumbnail</div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-extrabold text-gray-900 truncate">{template.name}</h2>
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide',
                    tier === 'full' ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-gray-100 text-gray-600',
                  )}>
                    {tier === 'full' ? 'Full site' : 'Lite'}
                  </span>
                  <span className="text-[10px] bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 font-semibold">
                    {template.category}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                {siteLabel && (
                  <p className="text-[11px] text-violet-700 font-semibold mt-1 truncate">Apply to: {siteLabel}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    {pageCount} page{pageCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-200">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Layout className="w-3.5 h-3.5 text-gray-400" />
                    {navCount} in nav
                  </span>
                  <span className="text-gray-200">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-gray-400">Palette</span>
                    <span className="inline-flex -space-x-1">
                      {palette.slice(0, 5).map((c, i) => (
                        <span key={`${c}-${i}`} className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isStorefront && (
                  <button
                    type="button"
                    onClick={() => setShowCustomize(v => !v)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-colors',
                      showCustomize
                        ? 'bg-violet-600 text-white'
                        : 'text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100',
                    )}
                    title="Customize template style"
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    Edit style
                  </button>
                )}
                <a
                  href={getStorefrontTemplateBrowserPreviewUrl(template.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={STOREFRONT_OPEN_IN_BROWSER_BTN_CLASS}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in browser
                </a>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pages */}
            <div className="border border-gray-100 rounded-2xl p-4">
              <div className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400 mb-2">Pages included</div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {(template.pages || []).map((p) => {
                  const isHome = !!p.is_homepage || p.page_type === 'home' || p.slug === 'home'
                  const inNav = (p.show_in_nav ?? true)
                  return (
                    <div key={p.slug} className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-gray-50 border border-gray-100">
                      <span className={cn('text-[10px] font-extrabold px-1.5 py-0.5 rounded-md',
                        isHome ? 'bg-emerald-100 text-emerald-700' : inNav ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-gray-600'
                      )}>
                        {isHome ? 'Home' : inNav ? 'Nav' : 'Footer'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-gray-800 truncate">{p.title}</div>
                        <div className="text-[10px] text-gray-400 truncate">/{p.slug}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* What you get + apply */}
            <div className="border border-gray-100 rounded-2xl p-4">
              <div className="text-[10px] font-extrabold uppercase tracking-wide text-gray-400 mb-2">What you get</div>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2"><span className="text-violet-600 mt-0.5">•</span>Image-first hero and gallery sections where included.</li>
                <li className="flex items-start gap-2"><span className="text-violet-600 mt-0.5">•</span>Connect live catalog, services, and bookings from the <b>Data</b> tab on each block after apply.</li>
                <li className="flex items-start gap-2"><span className="text-violet-600 mt-0.5">•</span>Everything remains editable in the builder.</li>
              </ul>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="font-extrabold">Heads up</div>
                <div className="mt-1 text-amber-800/90">
                  Applying a template will <b>replace all pages and blocks</b> on the selected site.
                </div>
              </div>

              {!canApply && (
                <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Select a site above to enable <b>Apply</b>.
                </p>
              )}

              <div className="mt-4">
                {!applyArmed ? (
                  <button
                    type="button"
                    disabled={!canApply}
                    onClick={() => { setApplyArmed(true); setApplyText('') }}
                    className={cn(
                      'w-full py-2.5 rounded-xl font-extrabold text-sm transition-opacity shadow-sm',
                      canApply
                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed',
                    )}
                  >
                    Apply this template
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="text-[11px] text-gray-500">
                      Type <b>APPLY</b> to confirm.
                    </div>
                    <input
                      value={applyText}
                      onChange={e => setApplyText(e.target.value)}
                      placeholder="APPLY"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setApplyArmed(false); setApplyText('') }}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-extrabold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={applyText.trim().toUpperCase() !== 'APPLY' || applyMut.isPending || !canApply}
                        onClick={() => { if (canApply) applyMut.mutate(template.id) }}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl text-sm font-extrabold transition-colors',
                          (applyText.trim().toUpperCase() === 'APPLY' && !applyMut.isPending && canApply)
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed',
                        )}
                      >
                        {applyMut.isPending
                          ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Applying…</span>
                          : 'Confirm apply'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customize style panel — only for storefront templates */}
          {isStorefront && showCustomize && (
            <CustomizeStylePanel template={template} />
          )}
        </div>
      </div>
    </div>
  )
}
