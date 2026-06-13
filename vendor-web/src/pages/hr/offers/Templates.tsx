import { useState, useRef, useEffect, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Plus, Trash2, Star, Save, ArrowLeft,
  Building2, Users, Store, ChevronRight, Eye, EyeOff,
  BookOpen, X, Video, ListChecks, CheckCircle2,
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
import type { OfferLetterTemplate } from '@/types'

// ── Merge variables available in templates ────────────────────────────────────
const MERGE_VARS = [
  { key: 'candidate_name',  label: 'Candidate Name' },
  { key: 'designation',     label: 'Designation' },
  { key: 'department',      label: 'Department' },
  { key: 'store',           label: 'Store / Branch' },
  { key: 'offered_ctc',     label: 'CTC (Annual)' },
  { key: 'offered_date',    label: 'Offer Date' },
  { key: 'joining_date',    label: 'Joining Date' },
  { key: 'expiry_date',     label: 'Expiry Date' },
  { key: 'vendor_name',     label: 'Company Name' },
  { key: 'candidate_email', label: 'Email' },
  { key: 'candidate_phone', label: 'Phone' },
  { key: 'today',           label: 'Today\'s Date' },
]

// ── Sample values for the live preview ───────────────────────────────────────
const SAMPLE: Record<string, string> = {
  candidate_name:  'Rahul Sharma',
  designation:     'Software Engineer',
  department:      'Engineering',
  store:           'GV Krishna Store',
  offered_ctc:     'Rs.12,00,000',
  offered_date:    '01 May 2026',
  joining_date:    '15 May 2026',
  expiry_date:     '10 May 2026',
  vendor_name:     'Your Company',
  candidate_email: 'rahul@example.com',
  candidate_phone: '+91 98765 43210',
  today:           new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
}

function renderPreview(body: string): string {
  let out = body
  for (const [k, v] of Object.entries(SAMPLE)) out = out.replaceAll(`{{${k}}}`, v)
  return out
}

// ── Empty template form state ─────────────────────────────────────────────────
function emptyForm() {
  return { name: '', description: '', body_html: '', designation_id: '', department_id: '', store_id: '', is_default: false }
}

// ── Guide panel ──────────────────────────────────────────────────────────────
const GUIDE_STEPS = [
  {
    n: 1,
    title: 'Create a template',
    body:  'Click the "+ New" button in the sidebar header. Give your template a clear name (e.g. "Engineering Offer Letter") and an optional admin note in the Description field.',
  },
  {
    n: 2,
    title: 'Set the scope',
    body:  'Use the Role, Department, and Store dropdowns to limit which offers auto-pick this template. Leave all three blank to make it a global fallback. The most specific match always wins.',
  },
  {
    n: 3,
    title: 'Write the body',
    body:  'Type your letter in the HTML textarea. Place your cursor where you need a dynamic value, then click any {{merge_var}} chip to insert it. Variables are replaced with real data when an offer is created.',
  },
  {
    n: 4,
    title: 'Preview before saving',
    body:  'Toggle the "Preview" button in the editor toolbar to see a live render of your template using sample candidate values. No real data is affected.',
  },
  {
    n: 5,
    title: 'Set as default',
    body:  'Click the star "Set Default" button to mark this template as the automatic fallback for new offers that have no closer scope match.',
  },
]

const VIDEO_KEY = 'hr_template_guide_video'

function toEmbedUrl(raw: string): string {
  try {
    const url = new URL(raw)
    // YouTube watch URL → embed
    if (url.hostname.includes('youtube.com') && url.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${url.searchParams.get('v')}?rel=0`
    }
    // YouTube short URL youtu.be/ID
    if (url.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${url.pathname}?rel=0`
    }
    // Vimeo
    if (url.hostname.includes('vimeo.com')) {
      const id = url.pathname.split('/').filter(Boolean).pop()
      return `https://player.vimeo.com/video/${id}`
    }
    // Already an embed or other: return as-is
    return raw
  } catch {
    return raw
  }
}

function GuidePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab]     = useState<'steps' | 'video'>('steps')
  const [videoUrl, setVideoUrl] = useState(() => localStorage.getItem(VIDEO_KEY) ?? '')
  const [draft, setDraft] = useState(videoUrl)
  const embedUrl = videoUrl ? toEmbedUrl(videoUrl) : ''

  function saveVideo() {
    const trimmed = draft.trim()
    setVideoUrl(trimmed)
    if (trimmed) localStorage.setItem(VIDEO_KEY, trimmed)
    else         localStorage.removeItem(VIDEO_KEY)
  }

  function clearVideo() {
    setVideoUrl('')
    setDraft('')
    localStorage.removeItem(VIDEO_KEY)
  }

  return (
    <div className="border-b bg-blue-50">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100">
        <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="text-xs font-medium text-blue-800 flex-1">How to use templates</span>
        <div className="flex gap-1">
          <button
            onClick={() => setTab('steps')}
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${tab === 'steps' ? 'bg-primary text-white' : 'text-blue-600 hover:bg-blue-100'}`}>
            <ListChecks className="w-3 h-3" /> Steps
          </button>
          <button
            onClick={() => setTab('video')}
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${tab === 'video' ? 'bg-primary text-white' : 'text-blue-600 hover:bg-blue-100'}`}>
            <Video className="w-3 h-3" /> Video
          </button>
        </div>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Steps tab */}
      {tab === 'steps' && (
        <div className="px-3 py-2 space-y-2 max-h-60 overflow-y-auto">
          {GUIDE_STEPS.map(step => (
            <div key={step.n} className="flex gap-2">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {step.n}
              </div>
              <div>
                <p className="text-xs font-medium text-blue-900">{step.title}</p>
                <p className="text-xs text-blue-700 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1 pb-0.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
            <p className="text-xs text-green-700 font-medium">You're ready — try creating your first template!</p>
          </div>
        </div>
      )}

      {/* Video tab */}
      {tab === 'video' && (
        <div className="px-3 py-2">
          {!embedUrl ? (
            <>
              <p className="text-xs text-blue-700 mb-1.5">Paste a YouTube or Vimeo URL to embed a walkthrough video for your team.</p>
              <div className="flex gap-1.5">
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveVideo()}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                />
                <button
                  onClick={saveVideo}
                  disabled={!draft.trim()}
                  className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-40">
                  Save
                </button>
              </div>
            </>
          ) : (
            <div>
              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                <iframe
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full rounded border"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Template guide video"
                />
              </div>
              <div className="flex gap-3 mt-1.5">
                <button onClick={() => { setDraft(videoUrl); setVideoUrl('') }} className="text-xs text-blue-600 hover:underline">Change URL</button>
                <button onClick={clearVideo} className="text-xs text-red-500 hover:underline">Remove video</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Scope label for list item ─────────────────────────────────────────────────
function ScopeChips({ tpl }: { tpl: OfferLetterTemplate }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tpl.designation && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
          <Users className="w-2.5 h-2.5" />{(tpl.designation as any).name}
        </span>
      )}
      {tpl.department && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
          <Building2 className="w-2.5 h-2.5" />{(tpl.department as any).name}
        </span>
      )}
      {tpl.store && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
          <Store className="w-2.5 h-2.5" />{(tpl.store as any).name}
        </span>
      )}
      {!tpl.designation && !tpl.department && !tpl.store && (
        <span className="text-xs text-gray-400 italic">Global</span>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OfferTemplatesPage() {
  const navigate   = useNavigate()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: templates = [], isLoading } = useHROfferTemplates()
  const { data: deptData }  = useHRDepartments()
  const { data: desigData } = useHRDesignations()
  const { data: storeData } = useStores({ limit: 100 })

  const departments  = (deptData  as any)?.departments  ?? deptData  ?? []
  const designations = (desigData as any)?.designations ?? desigData ?? []
  const stores       = (storeData as any)?.stores        ?? storeData ?? []

  const createTpl    = useCreateHROfferTemplate()
  const updateTpl    = useUpdateHROfferTemplate()
  const deleteTpl    = useDeleteHROfferTemplate()
  const setDefault   = useSetDefaultHROfferTemplate()

  const [selected, setSelected]   = useState<OfferLetterTemplate | null>(null)
  const [form,     setForm]       = useState(emptyForm())
  const [preview,  setPreview]    = useState(false)
  const [filterDept,  setFilterDept]  = useState('')
  const [filterDesig, setFilterDesig] = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [isNew,     setIsNew]     = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  // When a template is selected, load into form
  useEffect(() => {
    if (selected) {
      setForm({
        name:           selected.name,
        description:    selected.description ?? '',
        body_html:      selected.body_html,
        designation_id: selected.designation_id ?? '',
        department_id:  selected.department_id ?? '',
        store_id:       selected.store_id ?? '',
        is_default:     selected.is_default,
      })
      setIsNew(false)
    }
  }, [selected])

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (filterDept  && t.department_id  !== filterDept)  return false
      if (filterDesig && t.designation_id !== filterDesig) return false
      if (filterStore && t.store_id       !== filterStore)  return false
      return true
    })
  }, [templates, filterDept, filterDesig, filterStore])

  function startNew() {
    setSelected(null)
    setForm(emptyForm())
    setIsNew(true)
  }

  function setField(k: keyof typeof form, v: unknown) {
    setForm(f => ({ ...f, [k]: v }))
  }

  // Insert merge var at cursor position in textarea
  function insertMergeVar(key: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const token = `{{${key}}}`
    const newVal = form.body_html.slice(0, start) + token + form.body_html.slice(end)
    setField('body_html', newVal)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }

  async function handleSave() {
    const payload: Record<string, unknown> = {
      name:           form.name,
      description:    form.description || undefined,
      body_html:      form.body_html,
      designation_id: form.designation_id || undefined,
      department_id:  form.department_id  || undefined,
      store_id:       form.store_id       || undefined,
      is_default:     form.is_default,
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
    if (!selected) return
    if (!confirm(`Delete template "${selected.name}"?`)) return
    await deleteTpl.mutateAsync(selected.id)
    setSelected(null)
    setForm(emptyForm())
    setIsNew(false)
  }

  async function handleSetDefault() {
    if (!selected) return
    const tpl = await setDefault.mutateAsync(selected.id)
    setSelected(tpl)
  }

  const isBusy = createTpl.isPending || updateTpl.isPending
  const hasEditor = isNew || !!selected

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">

      {/* ── Sidebar ── */}
      <div className="w-72 shrink-0 border-r bg-white flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <button onClick={() => navigate('/hr/offers')}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-semibold text-gray-900 flex-1">Offer Templates</h1>
          <button
            onClick={() => setShowGuide(v => !v)}
            title="How to use templates"
            className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${showGuide ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50'}`}>
            <BookOpen className="w-3.5 h-3.5" />
          </button>
          <button onClick={startNew}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>

        {/* Guide panel (collapsible) */}
        {showGuide && <GuidePanel onClose={() => setShowGuide(false)} />}

        {/* Scope filters */}
        <div className="px-3 py-2 border-b space-y-1.5 bg-gray-50">
          <select value={filterDesig} onChange={e => setFilterDesig(e.target.value)}
            className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white">
            <option value="">All Roles (Designation)</option>
            {designations.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white">
            <option value="">All Departments</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filterStore} onChange={e => setFilterStore(e.target.value)}
            className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white">
            <option value="">All Stores / Branches</option>
            {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto divide-y">
          {isLoading && <p className="text-xs text-gray-400 text-center py-6">Loading…</p>}
          {!isLoading && filteredTemplates.length === 0 && (
            <div className="py-10 text-center">
              <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No templates yet.</p>
              <button onClick={startNew} className="mt-2 text-xs text-blue-600 hover:underline">Create one</button>
            </div>
          )}
          {filteredTemplates.map(t => (
            <button key={t.id}
              onClick={() => setSelected(t)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selected?.id === t.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 truncate flex-1">{t.name}</p>
                {t.is_default && <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" />}
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
              </div>
              <ScopeChips tpl={t} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Editor ── */}
      {!hasEditor ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-sm">Select a template to edit, or create a new one.</p>
            <button onClick={startNew}
              className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
              <Plus className="w-4 h-4" /> New Template
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Editor toolbar */}
          <div className="flex items-center gap-2 px-5 py-3 border-b bg-white shrink-0">
            <h2 className="text-sm font-semibold text-gray-900 flex-1">
              {isNew ? 'New Template' : `Editing: ${selected?.name}`}
            </h2>
            <button onClick={() => setPreview(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors ${preview ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'hover:bg-gray-50 text-gray-600'}`}>
              {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {preview ? 'Edit' : 'Preview'}
            </button>
            {!isNew && (
              <>
                <button onClick={handleSetDefault} disabled={selected?.is_default}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 disabled:opacity-40 transition-colors">
                  <Star className="w-3.5 h-3.5" /> {selected?.is_default ? 'Default' : 'Set Default'}
                </button>
                <button onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-red-50 hover:border-red-300 text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </>
            )}
            <button onClick={handleSave} disabled={isBusy || !form.name || !form.body_html}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />
              {isBusy ? 'Saving…' : 'Save'}
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden">

            {/* ── Left: form fields ── */}
            <div className={`${preview ? 'w-[40%]' : 'w-[55%]'} flex flex-col overflow-y-auto border-r bg-white p-5 gap-4 transition-all`}>

              {/* Name + Description */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1" required>Template Name</Label>
                  <input value={form.name} onChange={e => setField('name', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Engineering Offer Letter" />
                </div>
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">Description</Label>
                  <input value={form.description} onChange={e => setField('description', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Short admin note…" />
                </div>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Scope <span className="font-normal normal-case text-gray-400">— leave blank for global</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Role</label>
                    <select value={form.designation_id} onChange={e => setField('designation_id', e.target.value)}
                      className="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white">
                      <option value="">— Any Role —</option>
                      {designations.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Department</label>
                    <select value={form.department_id} onChange={e => setField('department_id', e.target.value)}
                      className="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white">
                      <option value="">— Any Dept —</option>
                      {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Store className="w-3 h-3" /> Store</label>
                    <select value={form.store_id} onChange={e => setField('store_id', e.target.value)}
                      className="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white">
                      <option value="">— Any Store —</option>
                      {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_default} onChange={e => setField('is_default', e.target.checked)} className="rounded text-blue-600" />
                  <span className="text-xs text-gray-700">Set as default template for new offers</span>
                </label>
              </div>

              {/* Merge variable chips */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Insert merge variable
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MERGE_VARS.map(({ key, label }) => (
                    <button key={key} type="button" onClick={() => insertMergeVar(key)}
                      className="text-xs px-2 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors font-mono">
                      {`{{${key}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body textarea */}
              <div className="flex-1 flex flex-col">
                <Label className="block text-xs font-medium text-gray-600 mb-1" required>Template Body (HTML allowed)</Label>
                <textarea
                  ref={textareaRef}
                  value={form.body_html}
                  onChange={e => setField('body_html', e.target.value)}
                  className="flex-1 w-full border rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[300px]"
                  placeholder={"Dear {{candidate_name}},\n\nWe are pleased to offer you the position of {{designation}} in the {{department}} department...\n\nCTC: {{offered_ctc}}\nJoining Date: {{joining_date}}\n\nRegards,\n{{vendor_name}}"}
                />
              </div>
            </div>

            {/* ── Right: preview ── */}
            {preview && (
              <div className="flex-1 overflow-y-auto bg-white p-5">
                <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Live Preview (sample values)</p>
                <div className="border rounded-xl p-6 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderPreview(form.body_html) }} />
              </div>
            )}
            {!preview && (
              <div className="flex-1 overflow-y-auto bg-gray-50 p-5">
                <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Preview (toggle to see rendered output)</p>
                <div className="border rounded-xl p-6 bg-white text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
                  {form.body_html || 'Start typing your template body on the left…'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
