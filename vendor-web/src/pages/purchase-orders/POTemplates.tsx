import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePOTemplateSettings, useUpdatePOTemplateSettings } from '@/hooks/useVendor'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { toast } from 'sonner'
import {
  ArrowLeft, Loader2, Upload, X, Check,
  ChevronDown, ChevronUp, Building2, Pen, Eye, Eraser, RotateCcw,
  Palette, ToggleLeft, FileOutput,
} from 'lucide-react'
import { generatePOHtml, PO_TEMPLATE_COLORS, DEFAULT_PO_SETTINGS } from '@/lib/poTemplates'
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { SingleImagePreview } from '@/components/common/CatalogMediaLightbox'
import type { POTemplateSettings } from '@/lib/poTemplates'

function resolveOriginPath(url: string) {
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url
  return `${window.location.origin}${url}`
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = ev => resolve(ev.target?.result as string)
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

// ── Template thumbnails ───────────────────────────────────────────────────────

const PO_TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    desc: 'Traditional PO with coloured header table',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect y="0" width="120" height="28" fill="${color}"/>
      <rect x="6" y="5" width="30" height="18" fill="rgba(255,255,255,.25)" rx="2"/>
      <rect x="42" y="8" width="50" height="6" fill="rgba(255,255,255,.8)" rx="1"/>
      <rect x="42" y="16" width="34" height="4" fill="rgba(255,255,255,.5)" rx="1"/>
      <rect x="6" y="34" width="50" height="18" fill="#f8fafc" rx="2"/>
      <rect x="64" y="34" width="50" height="18" fill="#f8fafc" rx="2"/>
      <rect x="6" y="58" width="108" height="12" fill="#f0fdf4" rx="2" stroke="${color}" stroke-width="0.5"/>
      <rect y="76" width="120" height="8" fill="${color}"/>
      ${[0,1,2,3].map(i=>`<rect x="0" y="${84+i*12}" width="120" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="80" y="134" width="34" height="18" fill="#f8fafc" rx="2" stroke="#e5e7eb" stroke-width=".5"/>
      <rect x="6" y="148" width="50" height="6" fill="#e5e7eb" rx="1"/>
    </svg>`,
  },
  {
    id: 'modern',
    name: 'Modern',
    desc: 'Gradient header with colour-accented columns',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect y="0" width="120" height="34" fill="url(#mg3)"/>
      <defs><linearGradient id="mg3" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color}cc"/></linearGradient></defs>
      <rect x="6" y="6" width="22" height="22" fill="rgba(255,255,255,.2)" rx="3"/>
      <rect x="34" y="9" width="40" height="6" fill="rgba(255,255,255,.85)" rx="1"/>
      <rect x="34" y="17" width="28" height="4" fill="rgba(255,255,255,.5)" rx="1"/>
      <rect x="84" y="7" width="30" height="8" fill="rgba(255,255,255,.15)" rx="1"/>
      <rect x="84" y="17" width="24" height="4" fill="rgba(255,255,255,.3)" rx="1"/>
      <rect x="6" y="40" width="50" height="14" fill="#f8fafc" rx="2"/>
      <rect x="62" y="40" width="52" height="14" fill="#f8fafc" rx="2"/>
      <rect x="6" y="60" width="108" height="10" fill="#f0fdf4" rx="2"/>
      <rect x="6" y="74" width="108" height="6" fill="none" stroke="${color}" stroke-width="1.5"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${80+i*11}" width="108" height="10" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="74" y="124" width="40" height="24" fill="#f8fafc" rx="3"/>
      <rect x="6" y="152" width="50" height="4" fill="#e5e7eb" rx="1"/>
    </svg>`,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    desc: 'Clean white with 3-column party layout',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="6" y="8" width="24" height="10" fill="#e5e7eb" rx="1"/>
      <rect x="6" y="20" width="40" height="5" fill="#374151" rx="1"/>
      <rect x="80" y="8" width="34" height="10" fill="${color}" opacity=".2" rx="2"/>
      <rect x="82" y="12" width="20" height="4" fill="${color}" rx="1"/>
      <rect x="6" y="34" width="33" height="16" fill="#f8fafc" rx="1"/>
      <rect x="44" y="34" width="33" height="16" fill="#f8fafc" rx="1"/>
      <rect x="82" y="34" width="32" height="16" fill="#f8fafc" rx="1"/>
      <rect x="6" y="55" width="114" height="1" fill="#e5e7eb"/>
      ${['#9ca3af','#9ca3af','#9ca3af','#9ca3af'].map((c,i)=>`<rect x="${6+i*27}" y="58" width="22" height="3" fill="${c}" rx="1"/>`).join('')}
      <rect x="6" y="63" width="114" height="1" fill="#e5e7eb"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${64+i*11}" width="108" height="10" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="6" y="112" width="114" height="1" fill="#e5e7eb"/>
      <rect x="80" y="116" width="34" height="28" fill="#f8fafc" rx="2"/>
      <rect x="6" y="150" width="50" height="5" fill="#f3f4f6" rx="1"/>
    </svg>`,
  },
  {
    id: 'formal',
    name: 'Formal',
    desc: 'Navy corporate header with accent stripe',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect y="0" width="120" height="3" fill="${color}"/>
      <rect y="3" width="120" height="31" fill="#1e3a5f"/>
      <rect y="34" width="120" height="3" fill="${color}"/>
      <rect x="6" y="7" width="22" height="20" fill="rgba(255,255,255,.1)" rx="2"/>
      <rect x="34" y="9" width="40" height="6" fill="rgba(255,255,255,.8)" rx="1"/>
      <rect x="34" y="17" width="28" height="4" fill="rgba(255,255,255,.4)" rx="1"/>
      <rect x="88" y="8" width="26" height="4" fill="${color}" opacity=".5" rx="1"/>
      <rect x="88" y="14" width="20" height="5" fill="rgba(255,255,255,.7)" rx="1"/>
      <rect x="6" y="42" width="50" height="18" fill="#f8fafc" rx="2"/>
      <rect x="62" y="42" width="52" height="18" fill="#f8fafc" rx="2"/>
      <rect x="6" y="66" width="50" height="18" fill="#f8fafc" rx="2" stroke="${color}" stroke-width=".5"/>
      <rect x="62" y="66" width="52" height="18" fill="#f8fafc" rx="2" stroke="${color}" stroke-width=".5"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${90+i*11}" width="108" height="10" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="74" y="136" width="40" height="20" fill="#1e3a5f" rx="3"/>
      <rect x="78" y="140" width="20" height="4" fill="${color}" rx="1"/>
      <rect x="6" y="154" width="50" height="4" fill="#e5e7eb" rx="1"/>
    </svg>`,
  },
]

// ── Accordion ─────────────────────────────────────────────────────────────────

function AccordionSection({ title, children, defaultOpen = false, badge }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge && <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">{badge}</span>}
        </span>
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
    <label className="flex items-center justify-between py-1.5 cursor-pointer gap-3">
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full border-2 transition-colors ${checked ? 'border-transparent bg-primary' : 'border-gray-300 bg-gray-200 dark:border-gray-500 dark:bg-gray-600'}`}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
    </label>
  )
}

// ── Draw Signature Canvas ─────────────────────────────────────────────────────

function SignaturePad({ onSave, onClear }: { onSave: (dataUrl: string) => void; onClear: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing   = useRef(false)
  const lastPos   = useRef<{ x: number; y: number } | null>(null)
  const hasDrawn  = useRef(false)

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    drawing.current = true
    lastPos.current = getPos(e)
    hasDrawn.current = true
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!drawing.current || !lastPos.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  const stopDraw = () => { drawing.current = false; lastPos.current = null }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      hasDrawn.current = false
      onClear()
    }
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn.current) { toast.error('Please draw a signature first'); return }
    onSave(canvas.toDataURL('image/png'))
    toast.success('Signature saved!')
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 cursor-crosshair touch-none"
        style={{ height: '120px' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <p className="text-xs text-gray-400 text-center">Draw your signature above using mouse or touch</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={clearCanvas}>
          <Eraser className="w-3.5 h-3.5" /> Clear
        </Button>
        <Button type="button" size="sm" className="flex-1 gap-1.5 bg-primary hover:bg-primary/90" onClick={saveSignature}>
          <Check className="w-3.5 h-3.5" /> Use This Signature
        </Button>
      </div>
    </div>
  )
}

// ── Sample PO data for preview ────────────────────────────────────────────────

const SAMPLE_PO = {
  po_number: 'PO/2025-26/0042',
  status: 'sent',
  order_date: new Date().toISOString(),
  expected_delivery_date: new Date(Date.now() + 7 * 86400000).toISOString(),
  reference_number: 'REF-2025-042',
  payment_terms: 'Net 30 days',
  vendor_name: 'Your Business Name',
  vendor_gstin: '36ABCDE1234F1Z5',
  vendor_address: { street: 'Block A, Industrial Area', city: 'Hyderabad', state: 'Telangana', postal_code: '500001' },
  // Supplier
  supplier_name: 'ABC Distributors Pvt Ltd',
  supplier_gstin: '27XYZAB9876C1Z3',
  supplier_email: 'supplier@abcdist.com',
  supplier_phone: '+91 98765 43210',
  supplier_address: { street: '12, Warehouse Complex', city: 'Mumbai', state: 'Maharashtra', postal_code: '400001' },
  // Ship To
  ship_to_name: 'Main Warehouse – Hyderabad',
  ship_to_address: { street: 'Gate No. 3, Logistics Park, Medchal', city: 'Hyderabad', state: 'Telangana', postal_code: '501401' },
  ship_to_contact: '+91 90001 23456',
  // Items
  items: [
    { product_name: 'Office Chair – Ergonomic Pro', product_sku: 'CHR-001', hsn_code: '940130', description: 'High-back mesh, adjustable armrests', quantity_ordered: 10, unit_cost: 4500, total_cost: 45000 },
    { product_name: 'Standing Desk 120cm', product_sku: 'DSK-204', hsn_code: '940330', description: 'Height-adjustable motorised', quantity_ordered: 5, unit_cost: 12000, total_cost: 60000 },
    { product_name: 'Monitor Stand', product_sku: 'MNT-STD', hsn_code: '847160', description: '', quantity_ordered: 15, unit_cost: 1200, total_cost: 18000 },
  ],
  // Financials
  subtotal: 123000,
  discount_amount: 0,
  cgst_amount: 11070,
  sgst_amount: 11070,
  igst_amount: 0,
  total_tax: 22140,
  grand_total: 145140,
  total: 145140,
  notes: 'Please ensure all items are packed securely. Deliver to main warehouse gate between 9 AM – 5 PM.',
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function POTemplatesPage() {
  const navigate = useNavigate()
  const { data: rawSettings, isLoading } = usePOTemplateSettings()
  const { data: vendor } = useQuery({ queryKey: ['myVendor'], queryFn: vendorApi.getMyVendor })
  const updateSettings = useUpdatePOTemplateSettings()

  const [settings, setSettings] = useState<POTemplateSettings>({ ...DEFAULT_PO_SETTINGS })
  const [previewHtml, setPreviewHtml] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [sigMode, setSigMode] = useState<'upload' | 'draw'>('upload')
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'design' | 'branding' | 'content'>('design')
  const previewRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0)

  // Dynamically compute scale so the A4 content (820×1160 px) fills the preview box
  useLayoutEffect(() => {
    const el = previewRef.current
    if (!el) return
    const recalc = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) {
        setPreviewScale(Math.min(width / 820, height / 1160))
      }
    }
    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (rawSettings) setSettings(prev => ({ ...prev, ...(rawSettings as Partial<POTemplateSettings>) }))
  }, [rawSettings])

  const logoUrl = settings.logo_url || vendor?.logo_url || ''

  useEffect(() => {
    const sampleData = {
      ...SAMPLE_PO,
      vendor_name: vendor?.business_name || SAMPLE_PO.vendor_name,
      vendor_gstin: settings.vendor_gstin || vendor?.gstin || SAMPLE_PO.vendor_gstin,
      vendor_address: vendor?.street_address
        ? { street: vendor.street_address, city: vendor.city || '', state: vendor.state || '', postal_code: vendor.postal_code || '' }
        : SAMPLE_PO.vendor_address,
      vendor_logo_url: logoUrl,
      payment_terms: settings.payment_terms || SAMPLE_PO.payment_terms,
    }
    const html = generatePOHtml(sampleData, { ...settings, logo_url: logoUrl || undefined }, window.location.origin)
    setPreviewHtml(html)
  }, [settings, vendor, logoUrl])

  const set = useCallback(<K extends keyof POTemplateSettings>(key: K, value: POTemplateSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateSettings.mutateAsync(settings as unknown as Record<string, unknown>)
    } finally {
      setIsSaving(false)
    }
  }

  const uploadPoLogo = async (file: File) => {
    try {
      const result = await vendorApi.uploadVendorLogo(file)
      set('logo_url', result.logo_url)
      toast.success('Logo updated!')
    } catch {
      toast.error('Could not upload PO logo — use a PNG or JPG file under 2MB')
    }
  }

  const applyPoSignatureUpload = async (file: File) => {
    setUploadingSignature(true)
    try {
      const result = await vendorApi.uploadInvoiceSignature(file)
      set('signature_url', result.signature_url)
      toast.success('Signature uploaded!')
    } catch {
      toast.error('Could not upload PO signature — use a PNG or JPG file under 2MB')
    } finally {
      setUploadingSignature(false)
    }
  }

  const applyDrawnSignatureSave = async (file: File) => {
    set('signature_url', await fileToDataUrl(file))
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
  }

  return (
    <div className="space-y-0">
      {/* Top bar */}
      <div className="flex items-center justify-between pb-4 border-b mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/purchase-orders')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">PO Template Settings</h1>
            <p className="text-xs text-gray-500">Customise layout, parties, tax details & signature for printed Purchase Orders</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-primary hover:bg-primary/90">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
        {/* Left: Live Preview — sticky, fills viewport height, no scrollbar */}
        <div
          className="sticky top-4 flex flex-col"
          style={{ height: 'calc(100vh - 120px)' }}
        >
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <Eye className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Live Preview</span>
            <span className="text-xs text-gray-400">(sample data — all fields shown)</span>
          </div>
          <div
            ref={previewRef}
            className="flex-1 border rounded-xl overflow-hidden bg-gray-50 relative shadow-inner"
          >
            {previewScale > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${820 / previewScale}px`,
                  height: `${1160 / previewScale}px`,
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
              >
                <iframe
                  srcDoc={previewHtml}
                  title="PO Preview"
                  className="border-0 bg-white"
                  style={{
                    width: '820px',
                    height: '1160px',
                    pointerEvents: 'none',
                    display: 'block',
                  }}
                  scrolling="no"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Settings Panel — scrolls naturally with the page, no inner scrollbar */}
        <div className="space-y-4 pb-8">

          {/* ── Tab Bar ── */}
          <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {([
              { id: 'design',   label: 'Design',   icon: Palette },
              { id: 'branding', label: 'Branding',  icon: Building2 },
              { id: 'content',  label: 'Content',   icon: ToggleLeft },
            ] as { id: typeof settingsTab; label: string; icon: React.ElementType }[]).map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setSettingsTab(t.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-all border-b-2 ${settingsTab === t.id ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* ── Design Tab ── */}
          {settingsTab === 'design' && <>
            <AccordionSection title="Templates" defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                {PO_TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => set('template', tmpl.id as POTemplateSettings['template'])}
                    className={`relative rounded-xl border-2 p-2 transition-all text-left ${
                      settings.template === tmpl.id
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {settings.template === tmpl.id && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="w-full rounded-md overflow-hidden border border-gray-100"
                      dangerouslySetInnerHTML={{ __html: tmpl.svg(settings.color) }} />
                    <p className="mt-1.5 text-xs font-medium text-gray-800">{tmpl.name}</p>
                    <p className="text-xs text-gray-500 leading-tight">{tmpl.desc}</p>
                  </button>
                ))}
              </div>
            </AccordionSection>

            <AccordionSection title="Theme Colour" defaultOpen>
              <div className="flex flex-wrap gap-2">
                {PO_TEMPLATE_COLORS.map(c => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => set('color', c.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${settings.color === c.value ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ background: c.value }}
                  >
                    {settings.color === c.value && <Check className="w-4 h-4 text-white mx-auto" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-xs text-gray-500 shrink-0">Custom</Label>
                <input type="color" value={settings.color} onChange={e => set('color', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-300" />
                <Input value={settings.color} onChange={e => set('color', e.target.value)}
                  className="flex-1 text-xs font-mono h-8" maxLength={7} />
              </div>
            </AccordionSection>
          </>}

          {/* ── Branding Tab ── */}
          {settingsTab === 'branding' && <>
            <AccordionSection title="Company Logo" defaultOpen>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <SingleImagePreview
                    url={logoUrl}
                    alt="Logo"
                    resolveUrl={resolveOriginPath}
                    className="rounded-lg"
                    imgClassName="h-14 max-w-[120px] object-contain border rounded-lg p-1"
                    editable
                    onSave={uploadPoLogo}
                  >
                    <button onClick={() => set('logo_url', '')}
                      className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </SingleImagePreview>
                ) : (
                  <div className="h-14 w-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-gray-300" />
                  </div>
                )}
                <div className="flex-1">
                  <ImageSourcePicker
                    title="Logo"
                    onFile={uploadPoLogo}
                    buttonLabel={logoUrl ? 'Change logo' : 'Upload logo'}
                    buttonVariant="outline"
                    buttonSize="sm"
                    buttonClassName="gap-1.5 w-full"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">PNG, JPG, SVG · Max 2 MB</p>
                </div>
              </div>
              <ToggleRow label="Show logo on PO" checked={settings.show_logo} onChange={v => set('show_logo', v)} />
            </AccordionSection>

            <AccordionSection title="Authorised Signature" badge="Draw or Upload" defaultOpen>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-3">
                {(['upload', 'draw'] as const).map(m => (
                  <button key={m} onClick={() => setSigMode(m)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${sigMode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    {m === 'upload' ? '⬆ Upload Image' : '✏ Draw Signature'}
                  </button>
                ))}
              </div>
              {sigMode === 'upload' ? (
                <div className="flex items-center gap-4">
                  {settings.signature_url && !settings.signature_url.startsWith('data:') ? (
                    <SingleImagePreview
                      url={settings.signature_url}
                      alt="Signature"
                      resolveUrl={resolveOriginPath}
                      className="rounded-lg"
                      imgClassName="h-14 max-w-[140px] object-contain border rounded-lg p-1 bg-white"
                      editable
                      onSave={applyPoSignatureUpload}
                    >
                      <button onClick={() => set('signature_url', '')}
                        className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </SingleImagePreview>
                  ) : (
                    <div className="h-14 w-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1">
                      <Pen className="w-5 h-5 text-gray-300" />
                      <span className="text-xs text-gray-400">No signature</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <ImageSourcePicker
                      title="Signature"
                      onFile={applyPoSignatureUpload}
                      disabled={uploadingSignature}
                      uploading={uploadingSignature}
                      buttonLabel={settings.signature_url ? 'Change signature' : 'Upload signature'}
                      buttonVariant="outline"
                      buttonSize="sm"
                      buttonClassName="gap-1.5 w-full"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">PNG, JPG · transparent background recommended</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {settings.signature_url?.startsWith('data:') && (
                    <SingleImagePreview
                      url={settings.signature_url}
                      alt="Drawn signature"
                      className="mb-2 rounded-lg"
                      imgClassName="h-16 border rounded-lg p-2 bg-white object-contain"
                      editable
                      onSave={applyDrawnSignatureSave}
                    >
                      <button onClick={() => set('signature_url', '')}
                        className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </SingleImagePreview>
                  )}
                  <SignaturePad
                    onSave={dataUrl => set('signature_url', dataUrl)}
                    onClear={() => { if (settings.signature_url?.startsWith('data:')) set('signature_url', '') }}
                  />
                </div>
              )}
              <div className="pt-2 border-t mt-2">
                <ToggleRow label="Show signature on PO" checked={settings.show_signature} onChange={v => set('show_signature', v)} />
                {settings.show_signature && (
                  <div className="mt-1.5">
                    <Label className="text-xs text-gray-500">Signatory Name</Label>
                    <Input className="mt-0.5 text-sm h-8" placeholder="e.g. Rajesh Kumar, Procurement Head"
                      value={settings.signatory_name || ''} onChange={e => set('signatory_name', e.target.value)} />
                  </div>
                )}
              </div>
            </AccordionSection>
          </>}

          {/* ── Content Tab ── */}
          {settingsTab === 'content' && <>
            <AccordionSection title="Party Details" badge="Sold To · Ship To" defaultOpen>
              <p className="text-xs text-gray-500 -mt-1 mb-2">Sold To = your company (buyer). Ship To = delivery location.</p>
              <ToggleRow label="Show Sold To / Bill To party" hint="Your company as the purchasing entity" checked={settings.show_sold_to} onChange={v => set('show_sold_to', v)} />
              <ToggleRow label="Show Ship To / Deliver To" hint="Delivery warehouse or site address" checked={settings.show_ship_to} onChange={v => set('show_ship_to', v)} />
              <ToggleRow label="Show supplier address" checked={settings.show_supplier_address} onChange={v => set('show_supplier_address', v)} />
              <ToggleRow label="Show GSTIN numbers" hint="Vendor and supplier GSTIN on the PO" checked={settings.show_gstin} onChange={v => set('show_gstin', v)} />
              {settings.show_gstin && (
                <div>
                  <Label className="text-xs text-gray-500">Your GSTIN</Label>
                  <Input className="mt-0.5 text-sm h-8 font-mono" placeholder="36ABCDE1234F1Z5"
                    value={settings.vendor_gstin || ''} onChange={e => set('vendor_gstin', e.target.value)} />
                </div>
              )}
            </AccordionSection>

            <AccordionSection title="PO Details & Options" defaultOpen>
              <ToggleRow label="Show expected delivery date" checked={settings.show_delivery_date} onChange={v => set('show_delivery_date', v)} />
              <ToggleRow label="Show payment terms" checked={settings.show_payment_terms} onChange={v => set('show_payment_terms', v)} />
              {settings.show_payment_terms && (
                <div>
                  <Label className="text-xs text-gray-500">Default Payment Terms</Label>
                  <Input className="mt-0.5 text-sm h-8" placeholder="e.g. Net 30 days, Advance payment"
                    value={settings.payment_terms || ''} onChange={e => set('payment_terms', e.target.value)} />
                </div>
              )}
              <ToggleRow label="Show reference number" checked={settings.show_reference_number} onChange={v => set('show_reference_number', v)} />
              <ToggleRow label="Show item description" checked={settings.show_description} onChange={v => set('show_description', v)} />
              <ToggleRow label="Show unit price column" checked={settings.show_unit_price} onChange={v => set('show_unit_price', v)} />
            </AccordionSection>

            <AccordionSection title="Tax Details" badge="GST" defaultOpen>
              <p className="text-xs text-gray-500 -mt-1 mb-2">When enabled, CGST, SGST and IGST are shown as separate rows in the totals.</p>
              <ToggleRow label="Show tax breakdown (CGST / SGST / IGST)" checked={settings.show_tax_breakdown} onChange={v => set('show_tax_breakdown', v)} />
            </AccordionSection>

            <AccordionSection title="Payment / Bank Details">
              <ToggleRow label="Show bank details on PO" checked={settings.show_bank_details} onChange={v => set('show_bank_details', v)} />
              {settings.show_bank_details && (
                <div className="space-y-2 mt-1">
                  {[
                    { key: 'bank_name',          label: 'Bank Name',        placeholder: 'State Bank of India' },
                    { key: 'account_holder_name', label: 'Account Holder',   placeholder: 'Business Legal Name' },
                    { key: 'account_number',      label: 'Account Number',   placeholder: '1234567890' },
                    { key: 'ifsc_code',           label: 'IFSC Code',        placeholder: 'SBIN0001234' },
                    { key: 'upi_id',              label: 'UPI ID (optional)', placeholder: 'business@upi' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <Label className="text-xs text-gray-500">{label}</Label>
                      <Input className="mt-0.5 text-sm h-8" placeholder={placeholder}
                        value={(settings[key as keyof POTemplateSettings] as string) || ''}
                        onChange={e => set(key as keyof POTemplateSettings, e.target.value as never)} />
                    </div>
                  ))}
                </div>
              )}
            </AccordionSection>

            <AccordionSection title="Notes & Terms & Conditions">
              <ToggleRow label="Show notes" checked={settings.show_notes} onChange={v => set('show_notes', v)} />
              {settings.show_notes && (
                <div>
                  <Label className="text-xs text-gray-500">Default Notes</Label>
                  <textarea className="w-full mt-0.5 text-sm border rounded-lg px-3 py-2 min-h-[64px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Please deliver to main warehouse gate between 9 AM – 5 PM."
                    value={settings.default_notes || ''} onChange={e => set('default_notes', e.target.value)} />
                </div>
              )}
              <ToggleRow label="Show terms & conditions" checked={settings.show_terms} onChange={v => set('show_terms', v)} />
              {settings.show_terms && (
                <div>
                  <Label className="text-xs text-gray-500">Default Terms & Conditions</Label>
                  <textarea className="w-full mt-0.5 text-sm border rounded-lg px-3 py-2 min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. All goods are subject to quality inspection upon delivery."
                    value={settings.default_terms || ''} onChange={e => set('default_terms', e.target.value)} />
                </div>
              )}
            </AccordionSection>
          </>}

          {/* ── Always-visible save buttons ── */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={isSaving} className="flex-1 gap-2 bg-primary hover:bg-primary/90">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Settings
            </Button>
            <Button variant="outline" onClick={() => { setSettings({ ...DEFAULT_PO_SETTINGS }); toast('Settings reset to defaults') }}
              className="gap-2 text-gray-500 px-3">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
