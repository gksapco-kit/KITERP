/**
 * PrintTemplates — configurable print-template manager for the Real Estate vertical.
 *
 * Panels
 * ──────
 * Left   : Sidebar listing template types with a "new / open override" toggle.
 * Centre : HTML body editor (textarea) + Jinja2 merge-field picker.
 * Right  : Live sandboxed preview iframe + print-settings form.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reApi, type MergeField, type PrintSettings, type Row } from '@/api/realestate'
import { useREMeta } from '../shared'
import { Loading } from './parts'

// ──────────────────────────────────────────────────────────────────────────────
// Small style helpers
// ──────────────────────────────────────────────────────────────────────────────
const field =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50'
const textarea =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono resize-y'
const btn = (variant: 'primary' | 'outline' | 'ghost' | 'danger' = 'outline') => {
  const base = 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50'
  if (variant === 'primary') return `${base} bg-primary text-primary-foreground hover:bg-primary/90`
  if (variant === 'danger')  return `${base} border border-destructive text-destructive hover:bg-destructive/10`
  if (variant === 'ghost')   return `${base} hover:bg-accent hover:text-accent-foreground`
  return `${base} border border-input hover:bg-accent hover:text-accent-foreground`
}

// ──────────────────────────────────────────────────────────────────────────────
// Merge-field chip
// ──────────────────────────────────────────────────────────────────────────────
function FieldChip({ f, onInsert }: { f: MergeField; onInsert: (key: string) => void }) {
  return (
    <button
      type="button"
      title={`Sample: ${f.sample}`}
      onClick={() => onInsert(f.key)}
      className="rounded border border-dashed border-primary/40 bg-primary/5 px-1.5 py-0.5 text-xs font-mono text-primary hover:bg-primary/15 transition-colors"
    >
      {'{{ '}
      {f.key}
      {' }}'}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Print settings form
// ──────────────────────────────────────────────────────────────────────────────
function PrintSettingsForm({
  value,
  onChange,
}: {
  value: PrintSettings
  onChange: (ps: PrintSettings) => void
}) {
  const s = value
  const set = (k: keyof PrintSettings, v: unknown) => onChange({ ...s, [k]: v })
  return (
    <div className="space-y-3 text-sm">
      {/* Letterhead */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Letterhead
        </label>
        <div className="space-y-2">
          <div>
            <label className="mb-0.5 block text-xs text-muted-foreground">Logo URL</label>
            <input className={field} placeholder="https://…/logo.png" value={s.logo_url ?? ''} onChange={(e) => set('logo_url', e.target.value)} />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-muted-foreground">
              Header HTML <span className="text-primary">(Jinja2; use {'{{ logo_url }}, {{ developer_entity }}'})</span>
            </label>
            <textarea
              className={`${textarea} h-16`}
              value={s.header_html ?? ''}
              onChange={(e) => set('header_html', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-muted-foreground">Footer HTML</label>
            <textarea
              className={`${textarea} h-16`}
              value={s.footer_html ?? ''}
              onChange={(e) => set('footer_html', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Page */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Page layout
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-xs text-muted-foreground">Paper size</label>
            <select className={field} value={s.page_size ?? 'A4'} onChange={(e) => set('page_size', e.target.value as 'A4' | 'Letter' | 'Legal')}>
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-muted-foreground">Orientation</label>
            <select className={field} value={s.orientation ?? 'portrait'} onChange={(e) => set('orientation', e.target.value as 'portrait' | 'landscape')}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-muted-foreground">Margin (mm)</label>
            <input type="number" className={field} value={s.margin_mm ?? 15} min={5} max={50} onChange={(e) => set('margin_mm', Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-muted-foreground">Font size (px)</label>
            <input type="number" className={field} value={s.font_size_px ?? 13} min={10} max={20} onChange={(e) => set('font_size_px', Number(e.target.value))} />
          </div>
        </div>
        <div className="mt-2">
          <label className="mb-0.5 block text-xs text-muted-foreground">Font family</label>
          <input className={field} placeholder="Arial, Helvetica, sans-serif" value={s.font_family ?? ''} onChange={(e) => set('font_family', e.target.value)} />
        </div>
      </div>

      {/* Watermark & signature */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Watermark & signature
        </label>
        <div className="space-y-2">
          <div>
            <label className="mb-0.5 block text-xs text-muted-foreground">Watermark text (e.g. DRAFT)</label>
            <input className={field} placeholder="DRAFT" value={s.watermark ?? ''} onChange={(e) => set('watermark', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={s.show_signature ?? false}
              onChange={(e) => set('show_signature', e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Show signature block
          </label>
          {s.show_signature && (
            <>
              <div>
                <label className="mb-0.5 block text-xs text-muted-foreground">Signatory name / designation</label>
                <input className={field} value={s.signatory_name ?? ''} onChange={(e) => set('signatory_name', e.target.value)} />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-muted-foreground">Signature image URL</label>
                <input className={field} placeholder="https://…/signature.png" value={s.signature_url ?? ''} onChange={(e) => set('signature_url', e.target.value)} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Custom CSS */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Custom CSS
        </label>
        <textarea
          className={`${textarea} h-24`}
          placeholder="table { font-size: 12px; } …"
          value={s.custom_css ?? ''}
          onChange={(e) => set('custom_css', e.target.value)}
        />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Template editor panel
// ──────────────────────────────────────────────────────────────────────────────
type EditorProps = {
  templateType: string
  existing: Row | null            // null → creating new override
  mergeFields: MergeField[]
  onSaved: () => void
  onCancel: () => void
}

function TemplateEditor({ templateType, existing, mergeFields, onSaved, onCancel }: EditorProps) {
  const qc = useQueryClient()

  // Load built-in default so we can pre-fill / offer "reset"
  const defaultQ = useQuery({
    queryKey: ['re-tpl-default', templateType],
    queryFn: () => reApi.templateDefault(templateType),
    staleTime: Infinity,
  })

  // Form state
  const [name, setName]       = useState(existing?.name as string ?? `Custom ${templateType.replace(/_/g, ' ')}`)
  const [subject, setSubject] = useState(existing?.subject as string ?? '')
  const [body, setBody]       = useState(existing?.body as string ?? '')
  const [ps, setPs]           = useState<PrintSettings>((existing?.print_settings as PrintSettings) ?? {})
  const [isDefault, setIsDefault] = useState(!!(existing?.is_default))
  const [isActive, setIsActive]   = useState(existing ? !!(existing?.is_active) : true)
  const [tab, setTab]             = useState<'body' | 'settings'>('body')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Pre-fill from built-in default when creating new
  useEffect(() => {
    if (!existing && defaultQ.data) {
      setSubject(defaultQ.data.subject)
      setBody(defaultQ.data.body)
    }
  }, [existing, defaultQ.data])

  const resetToDefault = useCallback(() => {
    if (!defaultQ.data) return
    setSubject(defaultQ.data.subject)
    setBody(defaultQ.data.body)
  }, [defaultQ.data])

  const insertField = useCallback((key: string) => {
    const ta = bodyRef.current
    if (!ta) return
    const before = body.slice(0, ta.selectionStart)
    const after  = body.slice(ta.selectionEnd)
    const token  = `{{ ${key} }}`
    const next   = before + token + after
    setBody(next)
    // Restore cursor after inserted token
    requestAnimationFrame(() => {
      ta.focus()
      const pos = before.length + token.length
      ta.setSelectionRange(pos, pos)
    })
  }, [body])

  // Live preview — build a quick preview using the default sample values
  const handlePreview = useCallback(async () => {
    if (!existing) {
      // Render subject/body clientside via built-in default preview endpoint isn't available yet
      // so load the default preview and overlay current body
      if (!defaultQ.data) return
      setPreviewHtml(defaultQ.data.preview_html)
      return
    }
    const data = await reApi.templatePreview(existing.id)
    setPreviewHtml(data.html)
  }, [existing, defaultQ.data])

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = { name, subject, body, is_default: isDefault, is_active: isActive, print_settings: ps }
      if (existing) {
        return reApi.templateUpdate(existing.id, payload)
      }
      return reApi.templateCreate({ template_type: templateType, ...payload })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['re-list', 'templates'] })
      onSaved()
    },
  })

  if (defaultQ.isLoading) return <Loading />

  return (
    <div className="flex h-full gap-3 overflow-hidden">
      {/* ── Centre: editor ────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <button type="button" className={btn('ghost')} onClick={onCancel}>← Back</button>
          <span className="flex-1 text-sm font-medium capitalize">{templateType.replace(/_/g, ' ')}</span>
          <button type="button" className={btn()} onClick={resetToDefault} title="Restore built-in body">
            ↺ Reset to default
          </button>
          <button type="button" className={btn()} onClick={handlePreview}>Preview</button>
          <button
            type="button"
            className={btn('primary')}
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>

        {saveMut.isError && (
          <p className="rounded bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            {String((saveMut.error as any)?.response?.data?.detail ?? 'Save failed')}
          </p>
        )}

        {/* Name + subject */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-xs text-muted-foreground">Template name</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-muted-foreground">Subject line</label>
            <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        </div>

        {/* Flags */}
        <div className="flex items-center gap-4 text-xs">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4 rounded border-input" />
            Set as default for this type
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
            Active
          </label>
        </div>

        {/* Tab: body / settings */}
        <div className="flex gap-1 border-b border-border">
          {(['body', 'settings'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'body' ? 'Body (HTML / Jinja2)' : 'Print settings'}
            </button>
          ))}
        </div>

        {tab === 'body' && (
          <>
            {/* Merge-field picker */}
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Click a field to insert it at the cursor position:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {mergeFields.map((f) => (
                  <FieldChip key={f.key} f={f} onInsert={insertField} />
                ))}
              </div>
            </div>

            <textarea
              ref={bodyRef}
              className={`${textarea} min-h-[28rem] flex-1`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
            />
          </>
        )}

        {tab === 'settings' && <PrintSettingsForm value={ps} onChange={setPs} />}
      </div>

      {/* ── Right: preview ─────────────────────────────────────────────────── */}
      <div className="flex w-[420px] shrink-0 flex-col gap-2 overflow-y-auto">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">Preview</span>
          {previewHtml && (
            <button
              type="button"
              className={btn()}
              onClick={() => {
                const w = window.open('', '_blank')
                if (w) { w.document.write(previewHtml); w.document.close(); w.focus(); w.print() }
              }}
            >
              🖨 Print
            </button>
          )}
        </div>

        {previewHtml ? (
          <iframe
            title="Template preview"
            sandbox=""
            srcDoc={previewHtml}
            className="h-[36rem] w-full flex-1 rounded-lg border border-border bg-white"
          />
        ) : (
          <div className="flex h-[36rem] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Click <strong className="mx-1">Preview</strong> to see a sample render
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────
export default function PrintTemplates() {
  const meta = useREMeta()
  const qc = useQueryClient()

  const templateTypes: string[] = meta.data?.template_types ?? []
  const mergeFieldsMap: Record<string, MergeField[]> = meta.data?.merge_fields ?? {}

  // All vendor-saved templates
  const listQ = useQuery({
    queryKey: ['re-list', 'templates'],
    queryFn: () => reApi.list('templates', { size: 200 }),
    enabled: !!meta.data,
  })

  const [selectedType, setSelectedType] = useState<string | null>(null)
  // editing: undefined = list view, 'new' = create form, Row = edit form
  const [editing, setEditing]           = useState<Row | 'new' | undefined>(undefined)

  const deleteMut = useMutation({
    mutationFn: (id: string) => reApi.remove('templates', id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['re-list', 'templates'] }),
  })

  const templatesByType = (listQ.data?.items ?? []).reduce<Record<string, Row[]>>((acc, t) => {
    const k = t.template_type as string
    ;(acc[k] ??= []).push(t)
    return acc
  }, {})

  if (meta.isLoading || listQ.isLoading) return <Loading />

  // ── Editor mode ──
  if (selectedType && editing !== undefined) {
    const row = editing === 'new' ? null : editing
    return (
      <div className="h-full overflow-hidden p-3">
        <TemplateEditor
          templateType={selectedType}
          existing={row}
          mergeFields={mergeFieldsMap[selectedType] ?? []}
          onSaved={() => { setEditing(undefined); setSelectedType(null) }}
          onCancel={() => { setEditing(undefined); setSelectedType(null) }}
        />
      </div>
    )
  }

  // ── List mode ──
  return (
    <div className="flex h-full gap-3 overflow-hidden p-3">
      {/* Left: type list */}
      <div className="w-56 shrink-0 overflow-y-auto rounded-xl border border-border bg-card">
        <p className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Template types
        </p>
        {templateTypes.map((t) => {
          const count = (templatesByType[t] ?? []).length
          return (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedType(t === selectedType ? null : t)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50 ${
                selectedType === t ? 'bg-accent font-medium' : ''
              }`}
            >
              <span className="capitalize">{t.replace(/_/g, ' ')}</span>
              {count > 0 && (
                <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Right: template cards for selected type */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {!selectedType ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Select a template type to manage overrides
          </div>
        ) : (
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <h2 className="flex-1 text-base font-semibold capitalize">
                {selectedType.replace(/_/g, ' ')}
              </h2>
              <button
                type="button"
                className={btn('primary')}
                onClick={() => setEditing('new')}
              >
                + New override
              </button>
            </div>

            {/* Built-in default notice */}
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Built-in default</strong> — a built-in template is always
              available. Create an override to customise the body, letterhead or layout for your organisation.
            </div>

            {/* Existing overrides */}
            {(templatesByType[selectedType] ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No overrides yet — using the built-in default.
              </p>
            ) : (
              <div className="space-y-2">
                {(templatesByType[selectedType] ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{t.name as string}</p>
                      {t.subject && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.subject as string}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs">
                      {t.is_default && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                          Default
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          t.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className={btn('ghost')}
                        onClick={() => { setSelectedType(t.template_type as string); setEditing(t) }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={btn('danger')}
                        disabled={deleteMut.isPending}
                        onClick={() => {
                          if (confirm(`Delete template "${t.name}"?`)) {
                            deleteMut.mutate(t.id)
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
