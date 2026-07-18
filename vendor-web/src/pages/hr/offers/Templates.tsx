import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  FileText, Trash2, Star, Save, ArrowLeft, Copy,
  Building2, Users, Store, Check, Loader2,
  ChevronUp, ChevronDown, Palette, PenLine, Target,
  RotateCcw,
} from 'lucide-react'
import {
  useHROfferTemplates,
  useCreateHROfferTemplate,
  useUpdateHROfferTemplate,
  useDeleteHROfferTemplate,
  useSetDefaultHROfferTemplate,
  useHRDepartments,
  useHRDesignations,
  useStores,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { useVendorStore } from '@/stores/vendorStore'
import type { OfferLetterTemplate } from '@/types'
import type { OfferLayoutId, OfferWatermarkStyle, LogoShape } from '@/lib/offerLayouts'
import {
  DEFAULT_OFFER_BODY, MERGE_VAR_KEYS, WATERMARK_STYLES,
  wrapOfferPreview, layoutLabel, LAYOUT_LOGO_PLACEMENT,
  isCustomOfferHtml, extractBodyFragmentForLayout,
  countOfferPages,
} from '@/lib/offerLayouts'
import { parseOfferPageFragments, serializeMultiPageCustom } from '@/lib/offerPages'
import { OfferLayoutThemeGrid } from '@/components/hr/OfferLayoutThemeGrid'
import { DEFAULT_OFFER_ACCENT, applyOfferAccentColor } from '@/lib/offerLayoutShells'
import { HtmlRichEditor, type HtmlRichEditorHandle } from '@/components/hr/HtmlRichEditor'
import { OfferLivePreview } from '@/components/hr/OfferLivePreview'
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { InvoiceAccentColorPicker } from '@/components/invoices/InvoiceAccentColorPicker'
import { LogoShapePicker, LOGO_SHAPE_PREVIEW_CLASS } from '@/components/common/LogoShapePicker'
import { askConfirm } from '@/components/common/ConfirmProvider'

const MERGE_VARS = MERGE_VAR_KEYS.map(key => ({
  key,
  label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
}))

function emptyForm() {
  return {
    name: '', description: '', body_html: DEFAULT_OFFER_BODY, layout: 'standard' as OfferLayoutId,
    designation_id: '', department_id: '', store_id: '', is_default: false,
    watermark_enabled: false,
    watermark_text: '',
    watermark_opacity: '0.12',
    watermark_style: 'diagonal_text' as OfferWatermarkStyle,
    logo_url: '',
    show_logo: true,
    logo_shape: 'rounded' as LogoShape,
    accent_color: DEFAULT_OFFER_ACCENT,
  }
}

function AccordionSection({ title, badge, children, defaultOpen = false }: {
  title: string; badge?: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {title}
          {badge && <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-600">{badge}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3 bg-white">{children}</div>}
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between py-1.5 cursor-pointer gap-3">
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        {hint && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors mt-0.5 ${checked ? 'bg-primary' : 'bg-gray-300'}`}
      >
        <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform" style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }} />
      </button>
    </label>
  )
}

type SettingsTab = 'design' | 'content' | 'scope'

function resolveOriginPath(url: string) {
  if (!url) return ''
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url
  return `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`
}

export default function OfferTemplatesPage() {
  const navigate = useNavigate()
  const editorRef = useRef<HtmlRichEditorHandle>(null)

  const vendorName = useVendorStore(s => s.vendor?.business_name) || 'Your Company'
  const vendorLogo = useVendorStore(s => s.vendor?.logo_url) || ''

  const { data: templatesData } = useHROfferTemplates()
  const templates = templatesData ?? []
  const { data: deptData } = useHRDepartments()
  const { data: desigData } = useHRDesignations()
  const { data: storeData } = useStores({ limit: 100 })

  const departments = (deptData as { departments?: unknown[] })?.departments ?? (Array.isArray(deptData) ? deptData : [])
  const designations = (desigData as { designations?: unknown[] })?.designations ?? (Array.isArray(desigData) ? desigData : [])
  const stores = (storeData as { stores?: unknown[] })?.stores ?? (Array.isArray(storeData) ? storeData : [])

  const createTpl = useCreateHROfferTemplate()
  const updateTpl = useUpdateHROfferTemplate()
  const deleteTpl = useDeleteHROfferTemplate()
  const setDefault = useSetDefaultHROfferTemplate()

  const [selected, setSelected] = useState<OfferLetterTemplate | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('design')
  const [isNew, setIsNew] = useState(false)
  const [mergePick, setMergePick] = useState('')
  const [previewBody, setPreviewBody] = useState(form.body_html)
  const didHydrateRef = useRef(false)

  const previewVendorRef = useRef(vendorName)
  if (vendorName && vendorName !== 'Your Company') previewVendorRef.current = vendorName

  const normalizeOfferBody = useCallback((html: string) => {
    if (!html?.trim()) return html
    if (!html.includes('data-offer-multi-page') && !html.includes('data-offer-custom')) return html
    const frags = parseOfferPageFragments(html)
    if (frags.length <= 1) return frags[0] ?? html
    return serializeMultiPageCustom(frags)
  }, [])

  const applyTemplateToForm = useCallback((tpl: OfferLetterTemplate) => {
    const body = normalizeOfferBody(tpl.body_html)
    setForm({
      name: tpl.name,
      description: tpl.description ?? '',
      body_html: body,
      layout: (tpl.layout || 'standard') as OfferLayoutId,
      designation_id: tpl.designation_id ?? '',
      department_id: tpl.department_id ?? '',
      store_id: tpl.store_id ?? '',
      is_default: tpl.is_default,
      watermark_enabled: tpl.watermark_enabled ?? false,
      watermark_text: tpl.watermark_text ?? '',
      watermark_opacity: tpl.watermark_opacity ?? '0.12',
      watermark_style: (tpl.watermark_style || 'diagonal_text') as OfferWatermarkStyle,
      logo_url: tpl.logo_url ?? '',
      show_logo: tpl.show_logo ?? true,
      logo_shape: (tpl.logo_shape || 'rounded') as LogoShape,
      accent_color: tpl.accent_color || DEFAULT_OFFER_ACCENT,
    })
    setPreviewBody(body)
    setIsNew(false)
  }, [normalizeOfferBody])

  const applyEmptyForm = useCallback(() => {
    const next = emptyForm()
    setForm(next)
    setPreviewBody(next.body_html)
    setIsNew(true)
  }, [])

  // Debounce preview updates so the iframe does not flash on every keystroke
  useEffect(() => {
    const t = window.setTimeout(() => setPreviewBody(form.body_html), 280)
    return () => window.clearTimeout(t)
  }, [form.body_html])

  // Auto-select default / first template once per mount (uses cached list when revisiting)
  useEffect(() => {
    if (didHydrateRef.current || templatesData === undefined) return
    didHydrateRef.current = true
    if (templatesData.length === 0) {
      setIsNew(true)
      return
    }
    const pick = templatesData.find(t => t.is_default) ?? templatesData[0]
    setSelected(pick)
    applyTemplateToForm(pick)
  }, [templatesData, applyTemplateToForm])

  const logoPreviewClass = LOGO_SHAPE_PREVIEW_CLASS[form.logo_shape ?? 'rounded']

  const previewHtml = useMemo(() => {
    const logoUrl = resolveOriginPath(form.logo_url || vendorLogo)
    return wrapOfferPreview(previewBody, form.layout, previewVendorRef.current, '', true, {
      enabled: form.watermark_enabled,
      text: form.watermark_text || previewVendorRef.current,
      opacity: parseFloat(form.watermark_opacity) || 0.12,
      style: form.watermark_style,
    }, {
      url: logoUrl || undefined,
      show: form.show_logo,
      shape: form.logo_shape,
    }, {
      mergeBodyVars: true,
      editableTemplate: true,
      accentColor: form.accent_color || DEFAULT_OFFER_ACCENT,
    })
  }, [previewBody, form.layout, form.accent_color, form.watermark_enabled, form.watermark_text, form.watermark_opacity, form.watermark_style, form.logo_url, form.show_logo, form.logo_shape, vendorLogo])

  const pageCount = useMemo(() => countOfferPages(previewBody), [previewBody])

  const handleLayoutChange = useCallback((id: OfferLayoutId) => {
    setForm(f => {
      const body = isCustomOfferHtml(f.body_html) ? extractBodyFragmentForLayout(f.body_html) : f.body_html
      return { ...f, layout: id, body_html: body }
    })
    setPreviewBody(prev => (isCustomOfferHtml(prev) ? extractBodyFragmentForLayout(prev) : prev))
  }, [])

  const handlePreviewBodyChange = useCallback((html: string) => {
    const body = normalizeOfferBody(html)
    setForm(f => (f.body_html === body ? f : { ...f, body_html: body }))
    setPreviewBody(body)
  }, [normalizeOfferBody])

  const uploadLogo = async (file: File) => {
    try {
      const result = await vendorApi.uploadVendorLogo(file)
      setField('logo_url', result.logo_url)
      toast.success('Logo uploaded')
    } catch {
      toast.error('Could not upload logo — use PNG or JPG under 2MB')
    }
  }

  const startNew = useCallback(() => {
    setSelected(null)
    applyEmptyForm()
    setSettingsTab('design')
  }, [applyEmptyForm])

  const selectTemplate = useCallback((id: string) => {
    const tpl = templates.find(t => t.id === id)
    if (tpl) {
      setSelected(tpl)
      applyTemplateToForm(tpl)
    }
  }, [templates, applyTemplateToForm])

  function setField<K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  const handleAccentColorChange = useCallback((next: string) => {
    setForm(f => {
      const prev = (f.accent_color || DEFAULT_OFFER_ACCENT).trim()
      const hasCustom = isCustomOfferHtml(f.body_html) || f.body_html.includes('data-offer-multi-page')
      if (!hasCustom || prev.toLowerCase() === next.toLowerCase()) {
        return { ...f, accent_color: next }
      }
      let body = f.body_html.replaceAll(prev, next).replaceAll(prev.toUpperCase(), next.toUpperCase())
      body = applyOfferAccentColor(body, next)
      setPreviewBody(body)
      return { ...f, accent_color: next, body_html: body }
    })
  }, [])

  const setBodyHtml = useCallback((html: string) => {
    setForm(f => (f.body_html === html ? f : { ...f, body_html: html }))
  }, [])

  const setSettingsTabStable = useCallback((tab: SettingsTab) => {
    setSettingsTab(tab)
  }, [])

  function insertMergeVar(key: string) {
    if (settingsTab !== 'content') setSettingsTab('content')
    window.requestAnimationFrame(() => editorRef.current?.insertText(`{{${key}}}`))
  }

  function handleReset() {
    if (selected && !isNew) {
      applyTemplateToForm(selected)
    } else {
      applyEmptyForm()
    }
  }

  async function handleSave() {
    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description || undefined,
      body_html: form.body_html,
      layout: form.layout,
      designation_id: form.designation_id || undefined,
      department_id: form.department_id || undefined,
      store_id: form.store_id || undefined,
      is_default: form.is_default,
      watermark_enabled: form.watermark_enabled,
      watermark_text: form.watermark_text || undefined,
      watermark_opacity: form.watermark_opacity,
      watermark_style: form.watermark_style,
      logo_url: form.logo_url || undefined,
      show_logo: form.show_logo,
      logo_shape: form.logo_shape,
      accent_color: form.accent_color || DEFAULT_OFFER_ACCENT,
    }
    if (isNew) {
      const tpl = await createTpl.mutateAsync(payload)
      setSelected(tpl)
      setIsNew(false)
    } else if (selected) {
      const tpl = await updateTpl.mutateAsync({ id: selected.id, data: payload })
      setSelected(tpl)
    }
  }

  async function handleDelete() {
    if (!selected || !(await askConfirm(`Delete template "${selected.name}"?`))) return
    await deleteTpl.mutateAsync(selected.id)
    setSelected(null)
    applyEmptyForm()
  }

  async function handleDuplicate() {
    if (!selected) return
    setSelected(null)
    setForm({
      name: `${selected.name} (Copy)`,
      description: selected.description ?? '',
      body_html: selected.body_html,
      layout: (selected.layout || 'standard') as OfferLayoutId,
      designation_id: selected.designation_id ?? '',
      department_id: selected.department_id ?? '',
      store_id: selected.store_id ?? '',
      is_default: false,
      watermark_enabled: selected.watermark_enabled ?? false,
      watermark_text: selected.watermark_text ?? '',
      watermark_opacity: selected.watermark_opacity ?? '0.12',
      watermark_style: (selected.watermark_style || 'diagonal_text') as OfferWatermarkStyle,
      logo_url: selected.logo_url ?? '',
      show_logo: selected.show_logo ?? true,
      logo_shape: (selected.logo_shape || 'rounded') as LogoShape,
      accent_color: selected.accent_color || DEFAULT_OFFER_ACCENT,
    })
    setPreviewBody(selected.body_html)
    setIsNew(true)
    setSettingsTab('design')
  }

  async function handleSetDefault() {
    if (!selected) return
    const tpl = await setDefault.mutateAsync(selected.id)
    setSelected(tpl)
    setField('is_default', tpl.is_default)
  }

  const isBusy = createTpl.isPending || updateTpl.isPending
  const canSave = !!form.name.trim() && !!form.body_html.trim()

  return (
    <form
      className="space-y-0"
      onSubmit={e => e.preventDefault()}
      onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault() }}
    >
      {/* Top bar — same pattern as Invoice / Quotation Templates */}
      <div className="flex items-center justify-between pb-4 border-b mb-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/hr/offers')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Offer Letter Templates</h1>
            <p className="text-xs text-gray-500">
              Customise offer letter print and PDF templates — layout, content, and scope
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={startNew} className="h-9 gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> New
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleReset} className="h-9 min-w-[5.5rem] gap-1.5 text-xs text-gray-600">
            <RotateCcw className="w-3.5 h-3.5 shrink-0" /> Reset
          </Button>
          {!isNew && selected && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={handleDuplicate} className="h-9 gap-1.5 text-xs hidden sm:inline-flex">
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleSetDefault} disabled={selected.is_default} className="h-9 gap-1.5 text-xs hidden sm:inline-flex">
                <Star className="w-3.5 h-3.5" /> Default
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDelete} className="h-9 gap-1.5 text-xs text-red-600 hidden sm:inline-flex">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </>
          )}
          <Button type="button" onClick={handleSave} disabled={isBusy || !canSave} className="h-9 min-w-[9.5rem] gap-2 bg-primary hover:bg-primary/90">
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 shrink-0" />}
            Save Template
          </Button>
        </div>
      </div>

      {/* Main grid — preview left, settings right (matches invoice templates) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <OfferLivePreview
          html={previewHtml}
          layout={form.layout}
          editable
          onBodyChange={handlePreviewBodyChange}
          pageCount={pageCount}
          vendorName={previewVendorRef.current}
          accentColor={form.accent_color || DEFAULT_OFFER_ACCENT}
        />

        {/* Right: Settings panel — always mounted so tab/editor state is never lost */}
        <div className="space-y-3">
          <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
            {([
              { id: 'design' as const, label: 'Design', icon: Palette },
              { id: 'content' as const, label: 'Content', icon: PenLine },
              { id: 'scope' as const, label: 'Scope', icon: Target },
            ]).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSettingsTabStable(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${
                  settingsTab === t.id
                    ? 'bg-white shadow text-blue-700 border border-blue-100'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <t.icon className="w-3.5 h-3.5 shrink-0" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className={settingsTab === 'design' ? 'space-y-3' : 'hidden'} aria-hidden={settingsTab !== 'design'}>
              <AccordionSection title="Template" badge={isNew ? 'New' : form.name || 'Untitled'} defaultOpen>
                <div className="space-y-3">
                  {templates.length > 0 && (
                    <div>
                      <Label className="text-xs text-gray-500 mb-1.5 block">Open template</Label>
                      <select
                        value={isNew ? '' : (selected?.id ?? '')}
                        onChange={e => {
                          if (e.target.value) selectTemplate(e.target.value)
                        }}
                        className="w-full h-9 border rounded-md px-2 text-sm bg-white"
                      >
                        {isNew && <option value="">— New template —</option>}
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name}{t.is_default ? ' ★' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Template name</Label>
                    <input
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      placeholder="e.g. Engineering Offer Letter"
                      className="w-full h-9 border rounded-md px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Description (internal)</Label>
                    <input
                      value={form.description}
                      onChange={e => setField('description', e.target.value)}
                      placeholder="Optional admin note"
                      className="w-full h-9 border rounded-md px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection title="Themes" badge={layoutLabel(form.layout)} defaultOpen>
                <p className="text-xs text-gray-500 mb-2">Same layout library as invoice templates — thumbnails show logo placement.</p>
                <OfferLayoutThemeGrid
                  selectedId={form.layout}
                  accentColor={form.accent_color || DEFAULT_OFFER_ACCENT}
                  onSelect={handleLayoutChange}
                />
              </AccordionSection>

              <AccordionSection
                title="Color palette"
                badge={form.accent_color || DEFAULT_OFFER_ACCENT}
                defaultOpen
              >
                <InvoiceAccentColorPicker
                  value={form.accent_color || DEFAULT_OFFER_ACCENT}
                  onChange={handleAccentColorChange}
                />
              </AccordionSection>

              <AccordionSection title="Logo" badge={form.show_logo ? 'On' : 'Off'} defaultOpen>
                <ToggleRow
                  label="Show logo"
                  hint={LAYOUT_LOGO_PLACEMENT[form.layout] ?? LAYOUT_LOGO_PLACEMENT.classic}
                  checked={form.show_logo}
                  onChange={v => setField('show_logo', v)}
                />
                {form.show_logo && (
                  <>
                  <div className="flex items-center gap-3 pt-1">
                    {form.logo_url || vendorLogo ? (
                      <div className="relative shrink-0">
                        <img
                          src={resolveOriginPath(form.logo_url || vendorLogo)}
                          alt="Logo"
                          className={`h-12 w-12 border p-1 bg-white ${logoPreviewClass}`}
                        />
                        {form.logo_url && (
                          <button
                            type="button"
                            onClick={() => setField('logo_url', '')}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px]"
                            title="Remove template logo"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className={`h-12 w-12 border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0 ${logoPreviewClass}`}>
                        <Building2 className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <ImageSourcePicker
                        title="Logo"
                        onFile={uploadLogo}
                        buttonLabel={form.logo_url ? 'Change logo' : 'Upload logo'}
                        buttonVariant="outline"
                        buttonSize="sm"
                        buttonClassName="gap-1.5 w-full cursor-pointer text-xs"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {form.logo_url ? 'Template logo' : vendorLogo ? 'Using company logo' : 'PNG, JPG • Max 2 MB'}
                      </p>
                    </div>
                  </div>
                  <LogoShapePicker
                    value={form.logo_shape}
                    onChange={shape => setField('logo_shape', shape)}
                  />
                  </>
                )}
              </AccordionSection>

              <AccordionSection title="Watermark" badge={form.watermark_enabled ? 'On' : 'Off'}>
                <ToggleRow
                  label="Show watermark"
                  hint="Faded text or logo mark behind the letter body"
                  checked={form.watermark_enabled}
                  onChange={v => setField('watermark_enabled', v)}
                />
                {form.watermark_enabled && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <Label className="text-xs text-gray-500 mb-1.5 block">Watermark text</Label>
                      <input
                        value={form.watermark_text}
                        onChange={e => setField('watermark_text', e.target.value)}
                        placeholder={vendorName || 'Company name or CONFIDENTIAL'}
                        className="w-full h-9 border rounded-md px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1.5 block">Style</Label>
                      <select
                        value={form.watermark_style}
                        onChange={e => setField('watermark_style', e.target.value as OfferWatermarkStyle)}
                        className="w-full h-9 border rounded-md px-2 text-sm bg-white"
                      >
                        {WATERMARK_STYLES.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1.5 block">
                        Opacity ({Math.round((parseFloat(form.watermark_opacity) || 0.12) * 100)}%)
                      </Label>
                      <input
                        type="range"
                        min={4}
                        max={35}
                        value={Math.round((parseFloat(form.watermark_opacity) || 0.12) * 100)}
                        onChange={e => setField('watermark_opacity', String(Number(e.target.value) / 100))}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>
                )}
              </AccordionSection>
          </div>

          <div className={settingsTab === 'content' ? 'space-y-3' : 'hidden'} aria-hidden={settingsTab !== 'content'}>
              <AccordionSection title="Merge fields" defaultOpen>
                <p className="text-xs text-gray-500 mb-2">Click a field to insert at the cursor in the letter body.</p>
                <div className="flex flex-wrap gap-1.5">
                  {MERGE_VARS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => insertMergeVar(key)}
                      className="text-xs px-2 py-1 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-mono"
                      title={label}
                    >
                      {`{{${key}}}`}
                    </button>
                  ))}
                </div>
              </AccordionSection>

              <AccordionSection title="Letter body" defaultOpen>
                <select
                  value={mergePick}
                  onChange={e => {
                    const key = e.target.value
                    if (key) { insertMergeVar(key); setMergePick('') }
                  }}
                  className="w-full h-8 border rounded-md px-2 text-xs bg-white mb-2"
                >
                  <option value="">Insert merge field…</option>
                  {MERGE_VARS.map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <HtmlRichEditor
                  ref={editorRef}
                  editorKey={selected?.id ?? (isNew ? 'new' : '')}
                  value={form.body_html}
                  onChange={setBodyHtml}
                  placeholder="Dear {{candidate_name}}, we are pleased to offer you…"
                  className="min-h-[280px]"
                />
              </AccordionSection>
          </div>

          <div className={settingsTab === 'scope' ? 'space-y-3' : 'hidden'} aria-hidden={settingsTab !== 'scope'}>
              <AccordionSection title="Template scope" badge={form.designation_id || form.department_id || form.store_id ? 'Scoped' : 'Global'} defaultOpen>
                <p className="text-xs text-gray-500 mb-3">Leave all blank for a global template. More specific templates are auto-selected for matching offers.</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Role / designation</label>
                    <select value={form.designation_id} onChange={e => setField('designation_id', e.target.value)}
                      className="w-full h-9 border rounded-md px-2 text-sm bg-white">
                      <option value="">Any role</option>
                      {(designations as { id: string; name: string }[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Department</label>
                    <select value={form.department_id} onChange={e => setField('department_id', e.target.value)}
                      className="w-full h-9 border rounded-md px-2 text-sm bg-white">
                      <option value="">Any department</option>
                      {(departments as { id: string; name: string }[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Store className="w-3 h-3" /> Store / branch</label>
                    <select value={form.store_id} onChange={e => setField('store_id', e.target.value)}
                      className="w-full h-9 border rounded-md px-2 text-sm bg-white">
                      <option value="">Any store</option>
                      {(stores as { id: string; name: string }[]).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection title="Default template" badge={form.is_default ? 'On' : 'Off'}>
                <ToggleRow
                  label="Set as default"
                  hint="Auto-selected when creating new offers with no closer scope match"
                  checked={form.is_default}
                  onChange={v => setField('is_default', v)}
                />
              </AccordionSection>

              {!isNew && selected && (
                <div className="rounded-xl border bg-gray-50 px-4 py-3 space-y-2">
                  <p className="text-xs font-medium text-gray-600">Template actions</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleDuplicate} className="h-8 text-xs gap-1">
                      <Copy className="w-3.5 h-3.5" /> Duplicate
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleSetDefault} disabled={selected.is_default} className="h-8 text-xs gap-1">
                      <Star className="w-3.5 h-3.5" /> Set default
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleDelete} className="h-8 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </form>
  )
}
