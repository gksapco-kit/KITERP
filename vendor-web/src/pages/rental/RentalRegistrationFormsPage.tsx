import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Car, Check, ClipboardList, Eye, Home, ImagePlus, Loader2, PartyPopper, Plus,
  ShieldCheck, Sparkles, Trash2, Wallet, Wrench, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FieldLabel } from '@/components/common/FieldLabel'
import { extractApiError } from '@/lib/errorMessages'
import { mediaUrl } from '@/lib/utils'
import { rentalApi } from './api'
import { RegistrationFormFields } from './RegistrationFormFields'
import { RegistrationFormLetterhead } from './RegistrationFormLetterhead'
import {
  FIELD_TYPE_OPTIONS,
  REGISTRATION_TEMPLATES,
  fieldsFromTemplate,
  themeFromTemplate,
  type RegistrationField,
  type RegistrationFormRecord,
  type RegistrationTemplate,
  type RegistrationTheme,
} from './registrationFormTemplates'

type Draft = {
  id?: string
  name: string
  description: string
  template_key: string
  status: 'draft' | 'published'
  fields: RegistrationField[]
  theme: RegistrationTheme
  use_on_storefront: boolean
  use_on_staff_booking: boolean
}

type SubmissionRow = {
  id: string
  form_id?: string
  form_name?: string | null
  customer_name?: string | null
  booking_number?: string | null
  channel?: string
  created_at?: string | null
  answers?: Record<string, unknown>
  fields?: Array<{ key: string; label: string; type: string }>
}

const blankModern = REGISTRATION_TEMPLATES.find((t) => t.key === 'blank_modern')!

const TEMPLATE_ICONS = {
  shield: ShieldCheck,
  car: Car,
  party: PartyPopper,
  wrench: Wrench,
  home: Home,
  wallet: Wallet,
  sparkles: Sparkles,
} as const

function emptyDraft(): Draft {
  return {
    name: '',
    description: '',
    template_key: 'blank_modern',
    status: 'draft',
    fields: fieldsFromTemplate(blankModern),
    theme: themeFromTemplate(blankModern),
    use_on_storefront: false,
    use_on_staff_booking: false,
  }
}

function slugKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || `field_${Date.now()}`
}

const MAX_REG_FIELDS = 80

export default function RentalRegistrationFormsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'forms' | 'submissions'>('forms')
  const [picking, setPicking] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [previewValues, setPreviewValues] = useState<Record<string, string | boolean>>({})
  const [registering, setRegistering] = useState(false)
  const [regAnswers, setRegAnswers] = useState<Record<string, string | boolean>>({})
  const [regCustomerName, setRegCustomerName] = useState('')

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['rental-registration-forms'],
    queryFn: () => rentalApi.listRegistrationForms() as Promise<RegistrationFormRecord[]>,
  })
  const { data: submissions = [], isLoading: loadingSubs } = useQuery({
    queryKey: ['rental-registration-submissions'],
    queryFn: () => rentalApi.listRegistrationSubmissions() as Promise<SubmissionRow[]>,
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('No form')
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        template_key: draft.template_key,
        status: draft.status,
        fields: draft.fields,
        theme: draft.theme,
        use_on_storefront: draft.use_on_storefront,
        use_on_staff_booking: draft.use_on_staff_booking,
      }
      if (draft.id) return rentalApi.updateRegistrationForm(draft.id, body)
      return rentalApi.createRegistrationForm(body)
    },
    onSuccess: (row: RegistrationFormRecord) => {
      toast.success(
        row.use_on_storefront
          ? 'Saved. This form is enabled on the storefront — customers will see Register & Book.'
          : 'Registration form saved',
      )
      setDraft((d) => (d ? { ...d, id: row.id, use_on_storefront: row.use_on_storefront, status: row.status } : d))
      qc.invalidateQueries({ queryKey: ['rental-registration-forms'] })
    },
    onError: (e) => toast.error(extractApiError(e, 'Could not save form')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => rentalApi.deleteRegistrationForm(id),
    onSuccess: () => {
      toast.success('Form deleted')
      setDraft(null)
      setPicking(false)
      qc.invalidateQueries({ queryKey: ['rental-registration-forms'] })
    },
    onError: (e) => toast.error(extractApiError(e, 'Could not delete form')),
  })

  const startFromTemplate = (tpl: RegistrationTemplate) => {
    setDraft((prev) => ({
      id: prev?.id,
      name: tpl.name,
      description: tpl.description,
      template_key: tpl.key,
      status: prev?.status || 'draft',
      fields: fieldsFromTemplate(tpl),
      theme: themeFromTemplate(tpl),
      use_on_storefront: prev?.use_on_storefront || false,
      use_on_staff_booking: prev?.use_on_staff_booking || false,
    }))
    setPreviewValues({})
    setPicking(false)
  }

  const openForm = (form: RegistrationFormRecord) => {
    setDraft({
      id: form.id,
      name: form.name,
      description: form.description || '',
      template_key: form.template_key || 'blank_modern',
      status: form.status,
      fields: form.fields || [],
      theme: form.theme || { accent: '#0f766e', layout: 'card' },
      use_on_storefront: form.use_on_storefront,
      use_on_staff_booking: form.use_on_staff_booking,
    })
    setPreviewValues({})
    setPicking(false)
  }

  const updateField = (idx: number, patch: Partial<RegistrationField>) => {
    setDraft((d) => {
      if (!d) return d
      return { ...d, fields: d.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)) }
    })
  }

  const addField = () => {
    let createdId = ''
    setDraft((d) => {
      if (!d) return d
      const fields = Array.isArray(d.fields) ? d.fields : []
      if (fields.length >= MAX_REG_FIELDS) {
        toast.error(`You can add up to ${MAX_REG_FIELDS} fields`)
        return d
      }
      const used = new Set(fields.map((f) => f.key))
      let n = fields.length + 1
      let key = `question_${n}`
      while (used.has(key)) {
        n += 1
        key = `question_${n}`
      }
      createdId = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      return {
        ...d,
        fields: [
          ...fields,
          {
            id: createdId,
            key,
            label: `Question ${n}`,
            type: 'text',
            required: false,
            placeholder: '',
            help: '',
            content: '',
            options: [],
          },
        ],
      }
    })
    if (!createdId) return
    requestAnimationFrame(() => {
      document.getElementById(`reg-field-${createdId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const storefrontForm = useMemo(
    () => forms.find((f) => f.use_on_storefront && f.status === 'published') || null,
    [forms],
  )
  const relatedSubs = useMemo(() => {
    if (draft?.id) return submissions.filter((s) => s.form_id === draft.id)
    if (storefrontForm) return submissions.filter((s) => s.form_id === storefrontForm.id)
    return []
  }, [draft?.id, storefrontForm, submissions])

  const submitCustomer = useMutation({
    mutationFn: async () => {
      if (!storefrontForm) throw new Error('No storefront form')
      const missing = (storefrontForm.fields || []).filter((f) => {
        if (f.type === 'heading' || !f.required) return false
        const v = regAnswers[f.key]
        return f.type === 'checkbox' || f.type === 'terms' ? v !== true : !String(v ?? '').trim()
      })
      if (missing.length) throw new Error(`Please fill: ${missing.map((f) => f.label).join(', ')}`)
      return rentalApi.createRegistrationSubmission({
        form_id: storefrontForm.id,
        customer_name: regCustomerName.trim() || undefined,
        answers: regAnswers,
      })
    },
    onSuccess: () => {
      toast.success('Customer registration saved')
      setRegistering(false)
      setRegAnswers({})
      setRegCustomerName('')
      qc.invalidateQueries({ queryKey: ['rental-registration-submissions'] })
      qc.invalidateQueries({ queryKey: ['rental-registration-forms'] })
    },
    onError: (e) => toast.error(extractApiError(e, e instanceof Error ? e.message : 'Could not save registration')),
  })

  if (picking) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Choose a modern template</h1>
            <p className="text-sm text-muted-foreground">Start from a ready-made rental form, then customize fields like Google Forms.</p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {REGISTRATION_TEMPLATES.map((tpl) => {
            const Icon = TEMPLATE_ICONS[tpl.icon]
            return (
              <button
                key={tpl.key}
                type="button"
                onClick={() => startFromTemplate(tpl)}
                className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                <div
                  className="relative h-40 px-5 pt-4"
                  style={{ background: `linear-gradient(160deg, ${tpl.accent}, ${tpl.accent}99 55%, #0f172a22)` }}
                >
                  {tpl.badge && (
                    <span className="absolute left-4 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                      {tpl.badge}
                    </span>
                  )}
                  <div className="absolute inset-x-6 bottom-0 overflow-hidden rounded-t-xl bg-white shadow-md ring-1 ring-black/5">
                    <div className="h-1.5" style={{ background: tpl.accent }} />
                    <div className="space-y-1.5 p-3">
                      {tpl.fields.slice(0, 4).map((f) => (
                        <div key={f.key}>
                          <div className="mb-0.5 h-1 w-14 rounded-full bg-slate-200" />
                          <div className="h-4 rounded-md border border-slate-100 bg-slate-50" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tpl.tagline}</p>
                      <h3 className="mt-1 text-base font-bold text-foreground">{tpl.name}</h3>
                    </div>
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: tpl.accent }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{tpl.description}</p>
                  <p className="text-xs text-muted-foreground">{tpl.fields.length} fields · {tpl.layout} layout</p>
                  <span className="inline-flex items-center text-sm font-medium text-primary opacity-80 group-hover:opacity-100">
                    Use this template
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (draft) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Forms
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{draft.id ? 'Edit registration form' : 'New registration form'}</h1>
              <p className="text-sm text-muted-foreground">Design the intake, then enable it for storefront booking and/or staff bookings.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {draft.id && (
              <Button variant="outline" onClick={() => remove.mutate(draft.id!)} disabled={remove.isPending}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setPicking(true)}>
              Change template
            </Button>
            <label className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${draft.use_on_storefront ? 'border-emerald-300 bg-emerald-500/10' : 'border-border bg-card'}`}>
              <Switch
                checked={draft.use_on_storefront}
                onCheckedChange={(v) => setDraft({
                  ...draft,
                  use_on_storefront: v,
                  status: v ? 'published' : draft.status,
                })}
              />
              <span className="text-sm font-medium whitespace-nowrap">
                Enable storefront
              </span>
            </label>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !draft.name.trim()}>
              {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Save form
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
          <div className="space-y-5">
            <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <FieldLabel required>Form name</FieldLabel>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Renter KYC" />
              <FieldLabel>Description</FieldLabel>
              <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Accent color</FieldLabel>
                  <Input value={draft.theme.accent} onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, accent: e.target.value } })} />
                </div>
                <div>
                  <FieldLabel>Layout</FieldLabel>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={draft.theme.layout}
                    onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, layout: e.target.value as RegistrationTheme['layout'] } })}
                  >
                    <option value="card">Card</option>
                    <option value="split">Split</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
              </div>
              <FieldLabel>Cover title</FieldLabel>
              <Input value={draft.theme.cover_title || ''} onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, cover_title: e.target.value } })} />
              <FieldLabel>Cover subtitle</FieldLabel>
              <Textarea rows={2} value={draft.theme.cover_subtitle || ''} onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, cover_subtitle: e.target.value } })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Company name</FieldLabel>
                  <Input
                    value={draft.theme.company_name || ''}
                    onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, company_name: e.target.value } })}
                    placeholder="e.g. RR 1RK SUITES"
                  />
                </div>
                <div>
                  <FieldLabel>Phone / WhatsApp</FieldLabel>
                  <Input
                    value={draft.theme.company_phone || ''}
                    onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, company_phone: e.target.value } })}
                    placeholder="9000198919"
                  />
                </div>
              </div>
              <FieldLabel>Company address</FieldLabel>
              <Textarea
                rows={2}
                value={draft.theme.company_address || ''}
                onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, company_address: e.target.value } })}
                placeholder="Full property / office address"
              />
              <FieldLabel>Company logo</FieldLabel>
              <div className="flex items-center gap-3">
                {draft.theme.logo_url ? (
                  <div className="relative">
                    <img src={mediaUrl(draft.theme.logo_url)} alt="Company logo" className="h-16 w-16 rounded-lg border border-border object-contain bg-white" />
                    <button
                      type="button"
                      className="absolute -right-2 -top-2 rounded-full bg-background p-1 text-muted-foreground shadow ring-1 ring-border"
                      onClick={() => setDraft({ ...draft, theme: { ...draft.theme, logo_url: '' } })}
                      aria-label="Remove company logo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
                  <ImagePlus className="h-4 w-4" />
                  {draft.theme.logo_url ? 'Replace logo' : 'Upload company logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      try {
                        const uploaded = await rentalApi.uploadRegistrationImage(file)
                        setDraft((d) => (d ? { ...d, theme: { ...d.theme, logo_url: uploaded.url } } : d))
                      } catch (err) {
                        toast.error(extractApiError(err, 'Could not upload logo'))
                      }
                    }}
                  />
                </label>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Questions</h2>
                  <p className="text-xs text-muted-foreground">{draft.fields.length} fields</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addField}>
                  <Plus className="mr-1 h-4 w-4" /> Add field
                </Button>
              </div>
              <div className="space-y-3">
                {draft.fields.map((field, idx) => (
                  <div
                    key={field.id || field.key || `field-${idx}`}
                    id={`reg-field-${field.id || field.key || idx}`}
                    className="rounded-xl border border-border p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
                      <Input
                        value={field.label}
                        onChange={(e) => {
                          const label = e.target.value
                          updateField(idx, { label, key: slugKey(label) || field.key })
                        }}
                      />
                      <select
                        className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                        value={field.type}
                        onChange={(e) => {
                          const type = e.target.value as RegistrationField['type']
                          if (type === 'terms') {
                            const taken = draft.fields.some((f, i) => i !== idx && f.key === 'agree_terms')
                            updateField(idx, {
                              type,
                              required: true,
                              label: field.type === 'terms' ? field.label : 'I agree to the terms and conditions',
                              key: field.type === 'terms' ? field.key : (taken ? `agree_terms_${idx + 1}` : 'agree_terms'),
                              content: field.content || '',
                            })
                            return
                          }
                          if (type === 'image') {
                            updateField(idx, {
                              type,
                              required: false,
                              label: field.type === 'image' ? field.label : 'Photo upload',
                            })
                            return
                          }
                          updateField(idx, { type })
                        }}
                      >
                        {FIELD_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== idx) })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {field.type !== 'heading' && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={field.required} onChange={(e) => updateField(idx, { required: e.target.checked })} />
                        Required
                      </label>
                      {field.type !== 'terms' && field.type !== 'image' && (
                        <Input
                          className="h-8 max-w-xs"
                          placeholder="Placeholder"
                          value={field.placeholder || ''}
                          onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                        />
                      )}
                    </div>
                    )}
                    {field.type === 'terms' && (
                      <Textarea
                        className="mt-2"
                        rows={5}
                        placeholder="Write the terms and conditions guests must read and agree to"
                        value={field.content || ''}
                        onChange={(e) => updateField(idx, { content: e.target.value })}
                      />
                    )}
                    {field.type === 'select' && (
                      <Input
                        className="mt-2"
                        placeholder="Options, comma separated"
                        value={(field.options || []).join(', ')}
                        onChange={(e) => updateField(idx, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                      />
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full" onClick={addField}>
                  <Plus className="mr-1 h-4 w-4" /> Add field
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Where this form is used</h2>
              <label className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Publish form</p>
                  <p className="text-xs text-muted-foreground">Only published forms can be required on booking.</p>
                </div>
                <Switch checked={draft.status === 'published'} onCheckedChange={(v) => setDraft({ ...draft, status: v ? 'published' : 'draft' })} />
              </label>
              <label className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Enable for storefront website</p>
                  <p className="text-xs text-muted-foreground">
                    Only this form is shown on the website. Other registration forms stay off the storefront.
                    Customers then see <strong>Register & Book</strong> and must fill this template.
                  </p>
                </div>
                <Switch
                  checked={draft.use_on_storefront}
                  onCheckedChange={(v) => setDraft({
                    ...draft,
                    use_on_storefront: v,
                    status: v ? 'published' : draft.status,
                  })}
                />
              </label>
              <label className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Show when staff create a booking</p>
                  <p className="text-xs text-muted-foreground">Walk-in bookings in Rental → Bookings also collect these answers.</p>
                </div>
                <Switch checked={draft.use_on_staff_booking} onCheckedChange={(v) => setDraft({ ...draft, use_on_staff_booking: v })} />
              </label>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-muted/30 shadow-sm">
              <p className="flex items-center gap-1 bg-muted px-5 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Eye className="h-3 w-3" /> Live preview
              </p>
              <RegistrationFormLetterhead
                theme={draft.theme}
                fallbackTitle={draft.name || 'Registration'}
                fallbackSubtitle={draft.description}
              />
              <div className="bg-card p-5">
                <RegistrationFormFields
                  fields={draft.fields}
                  values={previewValues}
                  theme={draft.theme}
                  onUploadImage={async (file) => (await rentalApi.uploadRegistrationImage(file)).url}
                  onChange={(key, value) => setPreviewValues((prev) => ({ ...prev, [key]: value }))}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Registration Forms</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Design Google Forms-style intake for renters. Enable a form for the storefront to show <strong>Register & Book</strong> instead of Booking.
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {([
          { id: 'forms' as const, label: 'Forms & templates' },
          { id: 'submissions' as const, label: `Filled registrations${relatedSubs.length ? ` (${relatedSubs.length})` : ''}` },
        ]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === item.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'forms' ? (
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Your registration forms</h2>
              <p className="text-xs text-muted-foreground">Open a form to edit fields, then enable it for storefront if customers should fill it.</p>
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading forms…</p>
            ) : forms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">No saved forms yet. Pick a template below to start.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {forms.map((form) => (
                  <button
                    key={form.id}
                    type="button"
                    onClick={() => openForm(form)}
                    className="rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="mb-3 h-2 w-16 rounded-full" style={{ background: form.theme?.accent || '#0f766e' }} />
                    <h3 className="font-semibold text-foreground">{form.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{form.description || 'No description'}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                      <span className={`rounded-full px-2 py-0.5 ${form.status === 'published' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                        {form.status}
                      </span>
                      {form.use_on_storefront && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-700 dark:text-sky-300">Storefront</span>}
                      {form.use_on_staff_booking && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-700 dark:text-violet-300">Staff</span>}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{form.submission_count || 0} filled</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Templates</h2>
              <p className="text-xs text-muted-foreground">Need extra details? Start another form from a template, then add or change questions.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {REGISTRATION_TEMPLATES.map((tpl) => {
                const Icon = TEMPLATE_ICONS[tpl.icon]
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => startFromTemplate(tpl)}
                    className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 px-4 py-3" style={{ background: `${tpl.accent}14` }}>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: tpl.accent }}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tpl.tagline}</p>
                        <h3 className="text-sm font-bold text-foreground">{tpl.name}</h3>
                      </div>
                    </div>
                    <div className="space-y-2 p-4">
                      <p className="text-xs text-muted-foreground">{tpl.description}</p>
                      <p className="text-xs text-muted-foreground">{tpl.fields.filter((f) => f.type !== 'heading').length} questions</p>
                      <span className="inline-flex items-center text-sm font-medium text-primary">Use this template</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          {!storefrontForm ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No storefront form is enabled</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a form, turn on <strong>Enable storefront</strong>, and save. Only that form’s filled customer details appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{storefrontForm.name}</p>
                  <p className="text-xs text-muted-foreground">Storefront-enabled form — customer and staff registrations show below.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setRegistering((open) => !open)
                    setRegAnswers({})
                    setRegCustomerName('')
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Register customer details
                </Button>
              </div>

              {registering && (
                <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold">Register customer — {storefrontForm.name}</h3>
                  <div>
                    <FieldLabel>Customer name</FieldLabel>
                    <Input
                      value={regCustomerName}
                      onChange={(e) => setRegCustomerName(e.target.value)}
                      placeholder="Name to show in this list"
                    />
                  </div>
                  <RegistrationFormFields
                    fields={storefrontForm.fields || []}
                    values={regAnswers}
                    theme={storefrontForm.theme}
                    onUploadImage={async (file) => (await rentalApi.uploadRegistrationImage(file)).url}
                    onChange={(key, value) => setRegAnswers((prev) => ({ ...prev, [key]: value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => submitCustomer.mutate()} disabled={submitCustomer.isPending}>
                      {submitCustomer.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                      Save registration
                    </Button>
                    <Button variant="outline" onClick={() => setRegistering(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {loadingSubs ? (
                <p className="text-sm text-muted-foreground">Loading filled registrations…</p>
              ) : relatedSubs.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  No filled details yet for the storefront form. Register a customer above, or wait for a storefront booking.
                </p>
              ) : (
                <div className="space-y-3">
                  {relatedSubs.map((row) => {
                    const answerFields = (row.fields || []).filter((f) => f.type !== 'heading')
                    return (
                      <details key={row.id} className="rounded-xl border border-border bg-card open:shadow-sm" open>
                        <summary className="cursor-pointer list-none px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{row.customer_name || 'Guest'}</p>
                              <p className="text-xs text-muted-foreground">
                                {row.form_name || storefrontForm.name}
                                {row.booking_number ? ` · ${row.booking_number}` : ''}
                                {row.channel ? ` · ${row.channel}` : ''}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : '—'}
                            </p>
                          </div>
                        </summary>
                        <div className="grid gap-2 border-t border-border px-4 py-3 sm:grid-cols-2">
                          {answerFields.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No field labels stored for this form.</p>
                          ) : answerFields.map((field) => {
                            const raw = row.answers?.[field.key]
                            const text = typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : String(raw ?? '—')
                            const imageUrl = field.type === 'image' && typeof raw === 'string' ? raw : ''
                            return (
                              <div key={field.key} className="rounded-lg bg-muted/40 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{field.label}</p>
                                {imageUrl ? (
                                  <a href={imageUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block">
                                    <img src={imageUrl} alt={field.label} className="h-20 w-20 rounded-md object-cover" />
                                  </a>
                                ) : (
                                  <p className="text-sm text-foreground">{text || '—'}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </details>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
