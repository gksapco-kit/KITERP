/**
 * Full-browser preview for website builder templates.
 *
 * For storefront_* IDs: renders the React template component with a floating
 * two-tab editor panel — Style (brand colors/fonts) and Content (texts,
 * images, buttons) — both with live in-preview updates.
 *
 * For all other IDs: fetches PublicSite from the API and renders via BlockRenderer.
 */
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, ExternalLink, Loader2, Paintbrush, Pencil, RotateCcw, Store, Type, X } from 'lucide-react'
import BlockRenderer from '@/components/builder/BlockRenderer'
import { publicSitesApi } from '@/api/publicSites'
import type { PublicPage, PublicSite } from '@/blocks/registry'
import { VendorContext, type VendorContextType } from '@/contexts/VendorContext'
import { TEMPLATES } from '@/storefront/templates'
import type { StorefrontConfig } from '@/storefront/theming'
import { EditContext, type ContentMap } from '@/storefront/editContext'
import { CONTENT_SCHEMAS, type ContentSchema, type EditSection } from '@/storefront/contentSchema'

// ── Storefront template map ──────────────────────────────────────────────────
const FashionTemplate     = lazy(() => import('@/storefront/templates/FashionTemplate').then(m => ({ default: m.FashionTemplate })))
const ElectronicsTemplate = lazy(() => import('@/storefront/templates/ElectronicsTemplate').then(m => ({ default: m.ElectronicsTemplate })))
const GroceryTemplate     = lazy(() => import('@/storefront/templates/GroceryTemplate').then(m => ({ default: m.GroceryTemplate })))
const RestaurantTemplate  = lazy(() => import('@/storefront/templates/RestaurantTemplate').then(m => ({ default: m.RestaurantTemplate })))
const ServicesTemplate    = lazy(() => import('@/storefront/templates/ServicesTemplate').then(m => ({ default: m.ServicesTemplate })))

const STOREFRONT_TEMPLATES: Record<string, React.ComponentType<{ config?: StorefrontConfig; basePath?: string }>> = {
  storefront_fashion:     FashionTemplate,
  storefront_electronics: ElectronicsTemplate,
  storefront_grocery:     GroceryTemplate,
  storefront_restaurant:  RestaurantTemplate,
  storefront_services:    ServicesTemplate,
}

// ── Available fonts (matches globals.css Google Fonts imports) ────────────────
const HEADING_FONTS = ['Fraunces', 'Playfair Display', 'DM Serif Display', 'Space Grotesk', 'Manrope', 'Inter']
const BODY_FONTS    = ['Inter', 'Manrope', 'Space Grotesk', 'Fraunces']

// ── Hex ↔ HSL utilities ───────────────────────────────────────────────────────
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function hslToHex(hsl: string): string {
  const m = hsl.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/)
  if (!m) return '#000000'
  const h = parseFloat(m[1]) / 360
  const s = parseFloat(m[2]) / 100
  const l = parseFloat(m[3]) / 100
  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// ── Block-based helpers ───────────────────────────────────────────────────────
const DEFAULT_PRODUCT_DISPLAY: Record<string, boolean> = {
  brand: true, short_description: true, specifications: true, warranty: true,
  return_policy: true, shipping_info: true, offer_label: true, sku: true,
  stock_status: true, tags: true,
}
const DEFAULT_SERVICE_DISPLAY: Record<string, boolean> = {
  brand: true, short_description: true, whats_included: true, whats_not_included: true,
  prerequisites: true, service_areas: true, cancellation_policy: true, offer_label: true,
  service_mode: true, tags: true,
}

function pickPage(site: PublicSite, slug: string | null): PublicPage | null {
  const pages = site.pages || []
  if (slug) { const hit = pages.find(p => p.slug === slug); if (hit) return hit }
  return pages.find(p => p.is_homepage) || pages[0] || null
}

/** Returns the vendor-web origin. In dev it's port 3001; in production same origin. */
function vendorOrigin() {
  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.hostname}:3001`
  }
  return window.location.origin
}

// ── Apply-template helpers ────────────────────────────────────────────────────

/** Read vendor access_token from localStorage (stored by vendor-web auth). */
function getVendorToken(): string | null {
  return localStorage.getItem('access_token')
}

/** Vendor API base (same backend, different auth token). */
const VENDOR_API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '')

async function vendorFetch<T>(
  path: string,
  opts?: RequestInit,
): Promise<T> {
  const token = getVendorToken()
  const res = await fetch(`${VENDOR_API}${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

interface SiteListItem { id: string; name: string; is_published: boolean }

/**
 * Finds or creates the vendor's first wb site and applies templateId to it,
 * then publishes it so the change goes live.
 */
async function applyTemplateToStore(
  templateId: string,
  styleOverrides?: Record<string, string>,
): Promise<{ siteId: string; siteName: string }> {
  // 1. List existing sites
  const sites = await vendorFetch<SiteListItem[]>('/vendors/me/websites/')
  let siteId: string
  let siteName: string

  if (sites.length > 0) {
    // Use the most-recent site (list is ordered by created_at desc)
    siteId = sites[0].id
    siteName = sites[0].name
  } else {
    // No site yet — create one
    const created = await vendorFetch<SiteListItem>('/vendors/me/websites/', {
      method: 'POST',
      body: JSON.stringify({
        name: 'My Store',
        description: '',
        style_config: styleOverrides ?? {},
      }),
    })
    siteId = created.id
    siteName = created.name
  }

  // 2. Apply the template (backend sets wb_catalog_template_id in style_config)
  await vendorFetch(`/vendors/me/websites/${siteId}/apply-template/${encodeURIComponent(templateId)}`, {
    method: 'POST',
  })

  // 3. If the user customised colors in the Style tab, patch them back on top of the
  //    template defaults so their adjustments are preserved.
  if (styleOverrides && Object.keys(styleOverrides).length > 0) {
    await vendorFetch<unknown>(`/vendors/me/websites/${siteId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        style_config: styleOverrides,
      }),
    }).catch(() => { /* non-fatal */ })
  }

  // 4. Publish so the change is immediately visible on the live store
  await vendorFetch(`/vendors/me/websites/${siteId}/publish`, { method: 'POST' })
    .catch(() => { /* ignore publish errors — template was still applied */ })

  return { siteId, siteName }
}

type ApplyState = 'idle' | 'loading' | 'done' | 'error' | 'unauthenticated'

function ApplyToStoreButton({
  templateId,
  styleOverrides,
}: {
  templateId: string
  styleOverrides?: Record<string, string>
}) {
  const [state, setState] = useState<ApplyState>(() =>
    getVendorToken() ? 'idle' : 'unauthenticated',
  )
  const [errorMsg, setErrorMsg] = useState('')
  const [siteInfo, setSiteInfo] = useState<{ id: string; name: string } | null>(null)

  const handleApply = async () => {
    if (state === 'loading' || state === 'done') return
    if (!getVendorToken()) {
      // Open business user login, then come back
      window.open(`${vendorOrigin()}/login`, '_blank')
      return
    }
    setState('loading')
    setErrorMsg('')
    try {
      const result = await applyTemplateToStore(templateId, styleOverrides)
      setSiteInfo({ id: result.siteId, name: result.siteName })
      setState('done')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg.includes('401') || msg.includes('403')
        ? 'Not logged in as a vendor. Open the vendor dashboard first.'
        : `Apply failed: ${msg}`)
      setState('error')
    }
  }

  if (state === 'done' && siteInfo) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white">
        <Check className="w-3.5 h-3.5" />
        Applied!{' '}
        <a
          href={`${vendorOrigin()}/websites/${siteInfo.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80"
        >
          Open in Builder
        </a>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-red-600 max-w-[180px] truncate" title={errorMsg}>{errorMsg}</span>
        <button
          type="button"
          onClick={() => setState(getVendorToken() ? 'idle' : 'unauthenticated')}
          className="text-[10px] underline text-gray-500 hover:text-gray-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (state === 'unauthenticated') {
    return (
      <button
        type="button"
        onClick={() => window.open(`${vendorOrigin()}/login`, '_blank')}
        className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border bg-white border-amber-300 text-gray-700 hover:bg-amber-100 transition-colors"
        title="Log in to your vendor dashboard first"
      >
        <Store className="w-3.5 h-3.5" />
        Log in to apply
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleApply}
      disabled={state === 'loading'}
      className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
      title="Apply this template to your live store and publish it"
    >
      {state === 'loading'
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Store className="w-3.5 h-3.5" />
      }
      {state === 'loading' ? 'Applying…' : 'Apply to my store'}
    </button>
  )
}

// ── Preview bar ───────────────────────────────────────────────────────────────
function PreviewBar({
  label, pages, activePage, onPageChange,
  onEditToggle, editOpen, onEditInBuilder,
  applyButton,
}: {
  label: string
  pages?: PublicPage[]
  activePage?: PublicPage | null
  onPageChange?: (slug: string) => void
  onEditToggle?: () => void
  editOpen?: boolean
  onEditInBuilder?: () => void
  /** Fully-constructed <ApplyToStoreButton /> element to slot in. */
  applyButton?: React.ReactNode
}) {
  return (
    <div className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-amber-200 bg-amber-50 text-amber-950 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-extrabold shrink-0">Template preview</span>
        <span className="text-amber-800/90 truncate">{label} — not your live site.</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {pages && pages.length > 1 && activePage && onPageChange && (
          <select className="text-xs border border-amber-300 rounded-lg px-2 py-1 bg-white text-gray-800 max-w-[12rem]"
            value={activePage.slug} onChange={e => { if (e.target.value) onPageChange(e.target.value) }}>
            {pages.map(p => <option key={p.id} value={p.slug}>{p.title} (/{p.slug})</option>)}
          </select>
        )}
        {onEditToggle && (
          <button type="button" onClick={onEditToggle}
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${
              editOpen ? 'bg-primary text-white border-primary' : 'bg-white border-amber-300 text-gray-700 hover:bg-amber-100'
            }`}>
            <Paintbrush className="w-3.5 h-3.5" />
            Edit style
          </button>
        )}
        {onEditInBuilder && (
          <button
            type="button"
            onClick={onEditInBuilder}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border bg-primary text-white border-primary hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit in Builder
          </button>
        )}
        {applyButton}
        <button type="button" onClick={() => window.close()}
          className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100">
          <X className="w-3.5 h-3.5" /> Close
        </button>
      </div>
    </div>
  )
}

// ── Style tab ─────────────────────────────────────────────────────────────────
function StyleTab({
  hexColors, displayFont, bodyFont, storeName,
  onColorChange, onDisplayFontChange, onBodyFontChange, onStoreNameChange, onReset,
}: {
  hexColors: { primary: string; accent: string; bg: string; fg: string }
  displayFont: string; bodyFont: string; storeName: string
  onColorChange: (key: 'primary' | 'accent' | 'bg' | 'fg', hex: string) => void
  onDisplayFontChange: (f: string) => void; onBodyFontChange: (f: string) => void
  onStoreNameChange: (n: string) => void; onReset: () => void
}) {
  const colorRows = [
    { key: 'primary' as const, label: 'Primary',    value: hexColors.primary },
    { key: 'accent'  as const, label: 'Accent',     value: hexColors.accent  },
    { key: 'bg'      as const, label: 'Background', value: hexColors.bg      },
    { key: 'fg'      as const, label: 'Text',        value: hexColors.fg      },
  ]
  return (
    <div className="flex-1 p-4 space-y-5 overflow-y-auto">
      <div>
        <label className="block text-[10px] font-extrabold uppercase tracking-wide text-gray-500 mb-1.5">Store name</label>
        <input type="text" value={storeName} onChange={e => onStoreNameChange(e.target.value)} placeholder="My Store"
          className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring text-gray-900" />
      </div>
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-gray-500 mb-2">Brand colors</div>
        <div className="space-y-2">
          {colorRows.map(({ key, label, value }) => (
            <div key={key} className="flex items-center gap-2.5">
              <label className="relative flex-shrink-0 cursor-pointer">
                <span className="block w-8 h-8 rounded-lg border-2 border-white ring-1 ring-gray-200 shadow-sm" style={{ backgroundColor: value }} />
                <input type="color" value={value} onChange={e => onColorChange(key, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-lg" />
              </label>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-gray-500 mb-0.5">{label}</div>
                <input type="text" value={value} maxLength={7} placeholder="#000000"
                  onChange={e => { const v = e.target.value.trim(); if (/^#[0-9A-Fa-f]{6}$/.test(v)) onColorChange(key, v) }}
                  className="w-full font-mono text-xs px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-ring text-gray-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-1 rounded-xl overflow-hidden h-8">
        {colorRows.map(({ key, value }) => <div key={key} className="flex-1" style={{ backgroundColor: value }} />)}
      </div>
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-gray-500 mb-2">Typography</div>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 block mb-1">Heading font</label>
            <select value={displayFont} onChange={e => onDisplayFontChange(e.target.value)}
              className="w-full text-sm px-2.5 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-ring text-gray-800">
              {HEADING_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <div className="mt-1 text-xs text-gray-400 truncate" style={{ fontFamily: `'${displayFont}', serif` }}>
              Heading preview — {displayFont}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 block mb-1">Body font</label>
            <select value={bodyFont} onChange={e => onBodyFontChange(e.target.value)}
              className="w-full text-sm px-2.5 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-ring text-gray-800">
              {BODY_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <div className="mt-1 text-xs text-gray-400 truncate" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>
              Body preview — {bodyFont}
            </div>
          </div>
        </div>
      </div>
      <button type="button" onClick={onReset}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors w-full justify-center border border-gray-200">
        <RotateCcw className="w-3.5 h-3.5" /> Reset style to defaults
      </button>
    </div>
  )
}

// ── Content tab ───────────────────────────────────────────────────────────────
function ContentTab({
  schema, content, highlighted,
  onHighlight, onContentChange,
}: {
  schema: ContentSchema
  content: ContentMap
  highlighted: string | null
  onHighlight: (id: string | null) => void
  onContentChange: (key: string, value: string) => void
}) {
  const [open, setOpen] = useState<string | null>(schema[0]?.id ?? null)

  useEffect(() => {
    if (highlighted && highlighted !== open) setOpen(highlighted)
  }, [highlighted])  // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToSection = (section: EditSection) => {
    const el = document.querySelector(`[data-edit-id="${section.id}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    onHighlight(section.id)
    setOpen(section.id)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {schema.map((section) => {
        const isOpen = open === section.id
        const isHighlighted = highlighted === section.id
        return (
          <div key={section.id} className={`border-b border-gray-100 ${isHighlighted ? 'bg-accent/70' : ''}`}>
            <button
              type="button"
              onClick={() => { setOpen(isOpen ? null : section.id); onHighlight(section.id) }}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isHighlighted && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                <span className={`text-xs font-bold truncate ${isHighlighted ? 'text-primary' : 'text-gray-800'}`}>
                  {section.label}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); scrollToSection(section) }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-primary/15 text-primary"
                  title="Scroll to this section"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3">
                {section.fields.map((field) => {
                  const val = content[field.key] ?? ''
                  return (
                    <div key={field.key}>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">{field.label}</label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={val}
                          onChange={e => onContentChange(field.key, e.target.value)}
                          placeholder={field.fallback}
                          rows={3}
                          className="w-full text-xs px-2.5 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-ring text-gray-900 resize-y leading-relaxed"
                        />
                      ) : field.type === 'image' ? (
                        <div>
                          <input
                            type="url"
                            value={val}
                            onChange={e => onContentChange(field.key, e.target.value)}
                            placeholder={field.fallback}
                            className="w-full text-xs px-2.5 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-ring text-gray-900 font-mono"
                          />
                          {(val || field.fallback) && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 aspect-video max-h-24">
                              <img
                                src={val || field.fallback}
                                alt="Preview"
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                onLoad={e => { (e.target as HTMLImageElement).style.display = '' }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={e => onContentChange(field.key, e.target.value)}
                          placeholder={field.fallback}
                          className="w-full text-xs px-2.5 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-ring text-gray-900"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      <div className="p-4 text-[10px] text-gray-400 text-center">
        Click the <ExternalLink className="inline w-2.5 h-2.5 mx-0.5" /> icon next to any section to scroll to it in the preview.
      </div>
    </div>
  )
}

// ── Edit panel (Style + Content tabs) ─────────────────────────────────────────
type PanelTab = 'style' | 'content'

interface EditPanelProps {
  templateId: string
  // Style
  hexColors: { primary: string; accent: string; bg: string; fg: string }
  displayFont: string; bodyFont: string; storeName: string
  onColorChange: (key: 'primary' | 'accent' | 'bg' | 'fg', hex: string) => void
  onDisplayFontChange: (f: string) => void; onBodyFontChange: (f: string) => void
  onStoreNameChange: (n: string) => void; onStyleReset: () => void
  // Content
  schema: ContentSchema
  content: ContentMap
  highlighted: string | null
  onHighlight: (id: string | null) => void
  onContentChange: (key: string, value: string) => void
  onContentReset: () => void
}

function EditPanel(props: EditPanelProps) {
  const { templateId, schema, content, highlighted, onHighlight, onContentChange, onContentReset, ...styleProps } = props
  const [tab, setTab] = useState<PanelTab>('content')

  return (
    <div className="fixed top-[3.5rem] right-0 bottom-0 w-72 bg-white border-l border-gray-200 shadow-2xl z-[200] flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <Paintbrush className="w-4 h-4 text-primary" />
        <span className="text-sm font-extrabold text-gray-900 flex-1">Edit template</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 shrink-0">
        <button
          type="button"
          onClick={() => setTab('content')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${
            tab === 'content' ? 'text-primary border-b-2 border-primary bg-accent/80' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Type className="w-3.5 h-3.5" /> Content
        </button>
        <button
          type="button"
          onClick={() => setTab('style')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${
            tab === 'style' ? 'text-primary border-b-2 border-primary bg-accent/80' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Paintbrush className="w-3.5 h-3.5" /> Style
        </button>
      </div>

      {/* Tab body */}
      {tab === 'style' ? (
        <StyleTab
          hexColors={styleProps.hexColors}
          displayFont={styleProps.displayFont}
          bodyFont={styleProps.bodyFont}
          storeName={styleProps.storeName}
          onColorChange={styleProps.onColorChange}
          onDisplayFontChange={styleProps.onDisplayFontChange}
          onBodyFontChange={styleProps.onBodyFontChange}
          onStoreNameChange={styleProps.onStoreNameChange}
          onReset={styleProps.onStyleReset}
        />
      ) : (
        <ContentTab
          schema={schema}
          content={content}
          highlighted={highlighted}
          onHighlight={onHighlight}
          onContentChange={onContentChange}
        />
      )}

      {/* Footer */}
      {tab === 'content' && (
        <div className="p-3 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onContentReset}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 py-1.5 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200">
            <RotateCcw className="w-3 h-3" /> Reset all content
          </button>
        </div>
      )}

      <div className="px-3 py-2 border-t border-gray-100 text-[9px] text-gray-400 text-center shrink-0">
        Changes are live in the preview. Apply the template to save to your site.
      </div>
    </div>
  )
}

// ── Storefront React component preview ───────────────────────────────────────
function StorefrontPreview({ templateId }: { templateId: string }) {
  const TemplateComponent = STOREFRONT_TEMPLATES[templateId]
  const rawKey = templateId.replace('storefront_', '')
  const tpl = TEMPLATES.find(t => t.id === rawKey)
  const schema = CONTENT_SCHEMAS[templateId] ?? []

  const [searchParams] = useSearchParams()
  const [panelOpen, setPanelOpen] = useState(false)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [content, setContent] = useState<ContentMap>({})

  const defaults = useMemo(() => {
    if (!tpl) return { primary: '#221D1A', accent: '#E45E25', bg: '#F9F7F5', fg: '#221D1A', display: 'Fraunces', body: 'Inter', name: 'My Store' }
    return {
      primary: hslToHex(tpl.defaultBrand.primary),
      accent:  hslToHex(tpl.defaultBrand.accent),
      bg:      hslToHex(tpl.defaultBrand.bg),
      fg:      hslToHex(tpl.defaultBrand.fg),
      display: tpl.defaultBrand.display,
      body:    tpl.defaultBrand.body,
      name:    tpl.name,
    }
  }, [tpl])

  const [hexPrimary,  setHexPrimary]  = useState(() => searchParams.get('p')    || defaults.primary)
  const [hexAccent,   setHexAccent]   = useState(() => searchParams.get('a')    || defaults.accent)
  const [hexBg,       setHexBg]       = useState(() => searchParams.get('bg')   || defaults.bg)
  const [hexFg,       setHexFg]       = useState(() => searchParams.get('fg')   || defaults.fg)
  const [displayFont, setDisplayFont] = useState(() => searchParams.get('hf')   || defaults.display)
  const [bodyFont,    setBodyFont]    = useState(() => searchParams.get('bf')   || defaults.body)
  const [storeName,   setStoreName]   = useState(() => searchParams.get('name') || defaults.name)

  const defaultsRef = useRef(defaults)
  useEffect(() => {
    if (defaultsRef.current === defaults) return
    defaultsRef.current = defaults
    if (!searchParams.get('p'))    setHexPrimary(defaults.primary)
    if (!searchParams.get('a'))    setHexAccent(defaults.accent)
    if (!searchParams.get('bg'))   setHexBg(defaults.bg)
    if (!searchParams.get('fg'))   setHexFg(defaults.fg)
    if (!searchParams.get('hf'))   setDisplayFont(defaults.display)
    if (!searchParams.get('bf'))   setBodyFont(defaults.body)
    if (!searchParams.get('name')) setStoreName(defaults.name)
  }, [defaults, searchParams])

  const resetStyle = () => {
    setHexPrimary(defaults.primary); setHexAccent(defaults.accent)
    setHexBg(defaults.bg); setHexFg(defaults.fg)
    setDisplayFont(defaults.display); setBodyFont(defaults.body)
    setStoreName(defaults.name)
  }

  const handleColorChange = useCallback((key: 'primary' | 'accent' | 'bg' | 'fg', hex: string) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return
    if (key === 'primary') setHexPrimary(hex)
    if (key === 'accent')  setHexAccent(hex)
    if (key === 'bg')      setHexBg(hex)
    if (key === 'fg')      setHexFg(hex)
  }, [])

  const handleContentChange = useCallback((key: string, value: string) => {
    setContent(prev => ({ ...prev, [key]: value }))
  }, [])

  const config: StorefrontConfig = useMemo(() => ({
    templateId: rawKey, preset: 'classic', storeName,
    brand: {
      primary: hexToHsl(hexPrimary), accent: hexToHsl(hexAccent),
      bg: hexToHsl(hexBg), fg: hexToHsl(hexFg),
      display: displayFont, body: bodyFont,
    },
  }), [rawKey, storeName, hexPrimary, hexAccent, hexBg, hexFg, displayFont, bodyFont])

  const editValue = useMemo(() => ({
    editMode: panelOpen,
    content,
    highlighted,
    setHighlighted,
    updateContent: handleContentChange,
  }), [panelOpen, content, highlighted, handleContentChange])

  const label = rawKey.charAt(0).toUpperCase() + rawKey.slice(1)

  if (!TemplateComponent) return null

  return (
    <EditContext.Provider value={editValue}>
      {/* Live section highlight injection */}
      {panelOpen && (
        <style dangerouslySetInnerHTML={{ __html: `
          [data-edit-id] {
            outline: 2px dashed rgba(124,58,237,0.22);
            outline-offset: 3px;
            transition: outline-color 0.15s;
          }
          [data-edit-id]:hover {
            outline-color: rgba(124,58,237,0.55);
          }
          ${highlighted ? `[data-edit-id="${highlighted}"] { outline: 3px solid rgb(124,58,237) !important; outline-offset: 4px; }` : ''}
        `}} />
      )}

      <div className="min-h-screen flex flex-col bg-white">
        <PreviewBar
          label={label}
          onEditToggle={() => setPanelOpen(v => !v)}
          editOpen={panelOpen}
          onEditInBuilder={() => {
            const url = `${vendorOrigin()}/websites?openTemplate=${encodeURIComponent(templateId)}&templateName=${encodeURIComponent(label)}`
            window.open(url, '_blank')
          }}
          applyButton={
            <ApplyToStoreButton
              templateId={templateId}
              styleOverrides={{
                primary_color: hexPrimary,
                accent_color: hexAccent,
                bg_color: hexBg,
                text_color: hexFg,
                font_heading: displayFont,
                font_body: bodyFont,
              }}
            />
          }
        />
        <div className={panelOpen ? 'pr-72 transition-all' : 'transition-all'}>
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center py-32">
              <Loader2 className="w-8 h-8 text-primary/80 animate-spin" />
            </div>
          }>
            <TemplateComponent config={config} basePath={`/template-browser/${templateId}`} />
          </Suspense>
        </div>

        {panelOpen && (
          <EditPanel
            templateId={templateId}
            hexColors={{ primary: hexPrimary, accent: hexAccent, bg: hexBg, fg: hexFg }}
            displayFont={displayFont}
            bodyFont={bodyFont}
            storeName={storeName}
            onColorChange={handleColorChange}
            onDisplayFontChange={setDisplayFont}
            onBodyFontChange={setBodyFont}
            onStoreNameChange={setStoreName}
            onStyleReset={resetStyle}
            schema={schema}
            content={content}
            highlighted={highlighted}
            onHighlight={setHighlighted}
            onContentChange={handleContentChange}
            onContentReset={() => setContent({})}
          />
        )}
      </div>
    </EditContext.Provider>
  )
}

// ── Block-based preview ──────────────────────────────────────────────────────
function BlockBasedPreview({ templateId }: { templateId: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [site, setSite] = useState<PublicSite | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [openingBuilder, setOpeningBuilder] = useState(false)
  const pageSlug = searchParams.get('p') || null

  useEffect(() => {
    setLoading(true); setErr(null)
    publicSitesApi.getWebsiteTemplatePreview(templateId)
      .then(data => setSite(data))
      .catch(() => setErr('Could not load template preview. Is the API running?'))
      .finally(() => setLoading(false))
  }, [templateId])

  const activePage = site ? pickPage(site, pageSlug) : null

  const vendorValue = useMemo((): VendorContextType => {
    const base = `/template-browser/${templateId}`
    return {
      vendor: null, vendorSlug: 'template-preview', isLoading: false, error: null,
      storePath: (path: string) => {
        const clean = path.startsWith('/') ? path : `/${path}`
        if (clean === '/' || clean === '') return base
        return `${base}?p=${encodeURIComponent(clean.replace(/^\//, ''))}`
      },
      displayFields: { product: DEFAULT_PRODUCT_DISPLAY, service: DEFAULT_SERVICE_DISPLAY },
    }
  }, [templateId])

  /** Open the full vendor-web builder in template-edit mode. */
  const handleEditInBuilder = async () => {
    if (openingBuilder) return
    setOpeningBuilder(true)
    try {
      // Reuse an existing template-sandbox site to avoid creating a new one on every click.
      const listRes = await fetch('/api/v1/vendors/me/websites/', { credentials: 'include' })
      if (!listRes.ok) throw new Error('list_failed')
      const allSites: { id: string; description?: string | null; is_published?: boolean }[] = await listRes.json()
      const existing = allSites.find(
        s => s.description?.startsWith('Sandbox for template:') && !s.is_published,
      )

      let siteId: string
      if (existing) {
        siteId = existing.id
      } else {
        const createRes = await fetch('/api/v1/vendors/me/websites/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: `${site?.name ?? templateId} — Template Edit`,
            description: `Sandbox for template: ${templateId}`,
            style_config: {},
          }),
        })
        if (!createRes.ok) throw new Error('create_failed')
        const newSite = await createRes.json()
        siteId = newSite.id
      }

      try {
        await fetch(`/api/v1/vendors/me/websites/${siteId}/ensure-blank`, {
          method: 'POST',
          credentials: 'include',
        })
      } catch {
        // Builder will retry via expectBlank=1
      }

      const builderUrl = `${vendorOrigin()}/websites/${siteId}?templateMode=true&expectBlank=1&templateName=${encodeURIComponent(site?.name ?? templateId)}`
      window.open(builderUrl, '_blank')
    } catch {
      // If not authenticated, open the vendor-web with the template pre-selected
      const fallbackUrl = `${vendorOrigin()}/websites?openTemplate=${encodeURIComponent(templateId)}&templateName=${encodeURIComponent(site?.name ?? templateId)}`
      window.open(fallbackUrl, '_blank')
    } finally {
      setOpeningBuilder(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 text-primary/80 animate-spin" /></div>
  if (err || !site || !activePage) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <p className="text-gray-700 mb-3">{err || 'No preview available.'}</p>
        <Link to="/" className="text-primary font-medium hover:underline">Back to home</Link>
      </div>
    )

  return (
    <VendorContext.Provider value={vendorValue}>
      <div className="min-h-screen flex flex-col bg-white">
        <PreviewBar
          label={site.name}
          pages={site.pages || []}
          activePage={activePage}
          onPageChange={(slug) => { if (slug) setSearchParams({ p: slug }); else setSearchParams({}) }}
          onEditInBuilder={handleEditInBuilder}
          applyButton={<ApplyToStoreButton templateId={templateId} />}
        />
        {openingBuilder && (
          <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex items-center gap-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <div>
                <div className="font-bold text-gray-900">Opening in Builder…</div>
                <div className="text-xs text-gray-500 mt-0.5">Creating template sandbox and loading editor</div>
              </div>
            </div>
          </div>
        )}
        <BlockRenderer blocks={activePage.blocks || []} site={site} />
      </div>
    </VendorContext.Provider>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function TemplateBrowserPreview() {
  const { templateId = '' } = useParams<{ templateId: string }>()
  if (!templateId) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <p className="text-gray-700 mb-3">Missing template id.</p>
      <Link to="/" className="text-primary font-medium hover:underline">Back to home</Link>
    </div>
  )
  if (templateId in STOREFRONT_TEMPLATES) return <StorefrontPreview templateId={templateId} />
  return <BlockBasedPreview templateId={templateId} />
}
