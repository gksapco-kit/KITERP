import { Check, ClipboardList, ExternalLink, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { mediaUrl } from '@/lib/utils'

export type RegistrationAnswerField = {
  key: string
  label: string
  type: string
}

type Props = {
  formName?: string | null
  fields?: RegistrationAnswerField[] | null
  answers?: Record<string, unknown> | null
  channel?: string | null
  accent?: string
  actions?: ReactNode
}

function AnswerValue({ field, raw }: { field: RegistrationAnswerField; raw: unknown }) {
  if (field.type === 'image') {
    const url = typeof raw === 'string' && raw.trim() ? raw.trim() : ''
    if (!url) return <p className="text-xs text-muted-foreground">—</p>
    const src = mediaUrl(url)
    return (
      <a href={src} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-2 group">
        <img
          src={src}
          alt={field.label}
          className="h-12 w-12 rounded border border-border object-cover transition group-hover:opacity-90"
        />
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
          Open <ExternalLink className="h-2.5 w-2.5" />
        </span>
      </a>
    )
  }

  if (field.type === 'checkbox' || field.type === 'terms' || typeof raw === 'boolean') {
    const yes = raw === true || raw === 'true' || raw === 'Yes' || raw === 'yes' || raw === 1 || raw === '1'
    const no = raw === false || raw === 'false' || raw === 'No' || raw === 'no' || raw === 0 || raw === '0'
    if (yes || no) {
      return (
        <span
          className={`inline-flex items-center gap-0.5 rounded px-1.5 py-px text-[11px] font-medium ${
            yes
              ? 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {yes ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
          {yes ? 'Yes' : 'No'}
        </span>
      )
    }
  }

  const text = raw == null || raw === '' ? '' : String(raw)
  if (!text.trim()) return <p className="text-xs text-muted-foreground">—</p>
  return <p className="break-words text-xs font-semibold leading-tight text-foreground">{text}</p>
}

export function RegistrationAnswersPanel({
  formName,
  fields = [],
  answers = {},
  channel,
  accent = '#0f766e',
  actions,
}: Props) {
  const list = Array.isArray(fields) ? fields : []
  const values = answers || {}

  if (!list.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
        No registration field labels were stored with this booking.
      </div>
    )
  }

  // Group fields under headings so the read view matches the form structure.
  type Section = { heading: string | null; fields: RegistrationAnswerField[] }
  const sections: Section[] = []
  let current: Section = { heading: null, fields: [] }
  for (const field of list) {
    if (field.type === 'heading') {
      if (current.heading || current.fields.length) sections.push(current)
      current = { heading: field.label || 'Section', fields: [] }
      continue
    }
    current.fields.push(field)
  }
  if (current.heading || current.fields.length) sections.push(current)

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
            <ClipboardList className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {formName || 'Registration form'}
            </p>
            <p className="text-[10px] leading-tight text-muted-foreground">
              Guest answers collected with this booking
              {channel ? ` · ${channel}` : ''}
            </p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-1.5">{actions}</div> : null}
      </div>

      <div className="space-y-2 p-2 sm:p-2.5">
        {sections.map((section, sIdx) => (
          <div key={`${section.heading || 'fields'}-${sIdx}`} className="space-y-1">
            {section.heading ? (
              <div
                className="rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
                style={{ background: accent }}
              >
                {section.heading}
              </div>
            ) : null}
            {section.fields.length === 0 ? (
              <p className="px-1 text-[11px] text-muted-foreground">No fields in this section.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
                {section.fields.map((field) => {
                  const wide =
                    field.type === 'textarea'
                    || field.type === 'terms'
                    || field.type === 'image'
                  return (
                    <div
                      key={field.key}
                      className={`flex items-baseline gap-2 rounded border border-border/70 bg-muted/20 px-2 py-1.5 ${wide ? 'col-span-2 lg:col-span-3' : ''}`}
                    >
                      <p className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        {field.label}
                      </p>
                      <div className="min-w-0 flex-1">
                        <AnswerValue field={field} raw={values[field.key]} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
