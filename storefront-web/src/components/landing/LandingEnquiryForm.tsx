import type { ReactNode } from 'react'
import { PhoneInput } from '@/components/ui/PhoneInput'

export type EnquiryFormValues = {
  first_name: string
  last_name: string
  title: string
  company: string
  email: string
  phone: string
  source: string
  referral_name: string
  notes: string
}

export const EMPTY_ENQUIRY_FORM: EnquiryFormValues = {
  first_name: '',
  last_name: '',
  title: '',
  company: '',
  email: '',
  phone: '',
  source: 'website',
  referral_name: '',
  notes: '',
}

export const LEAD_SOURCE_OPTIONS = [
  { value: 'website', label: 'Website' },
  { value: 'ads', label: 'Ads' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
] as const

export const TALK_TO_US_SOURCE_OPTIONS = [
  { value: 'talk_to_us', label: 'Talk to us' },
  { value: 'website', label: 'Website' },
  { value: 'ads', label: 'Ads' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
] as const

type SourceOption = { value: string; label: string }

type Props = {
  form: EnquiryFormValues
  onChange: (next: EnquiryFormValues) => void
  sourceOptions: readonly SourceOption[]
  notesLabel: string
  notesPlaceholder: string
  footer?: ReactNode
  compact?: boolean
}

export function composedEnquiryName(form: EnquiryFormValues) {
  return [form.first_name, form.last_name].map((p) => p.trim()).filter(Boolean).join(' ')
}

export function enquiryReferralName(form: EnquiryFormValues) {
  if (form.source !== 'referral') return undefined
  const name = form.referral_name.trim()
  return name || undefined
}

export function LandingEnquiryFields({
  form,
  onChange,
  sourceOptions,
  notesLabel,
  notesPlaceholder,
  footer,
  compact = false,
}: Props) {
  const set = (patch: Partial<EnquiryFormValues>) => onChange({ ...form, ...patch })

  return (
    <div className="kiterp-contact-fields">
      <p className="kiterp-contact-legend">About you</p>
      <label className="kiterp-contact-field">
        <span>First name</span>
        <input
          value={form.first_name}
          onChange={(e) => set({ first_name: e.target.value })}
          placeholder="First name"
          autoComplete="given-name"
        />
      </label>
      <label className="kiterp-contact-field">
        <span>Last name</span>
        <input
          value={form.last_name}
          onChange={(e) => set({ last_name: e.target.value })}
          placeholder="Last name"
          autoComplete="family-name"
        />
      </label>

      <p className="kiterp-contact-legend">Company</p>
      <label className="kiterp-contact-field">
        <span>Title</span>
        <input
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Founder, Manager…"
          autoComplete="organization-title"
        />
      </label>
      <label className="kiterp-contact-field">
        <span>Company</span>
        <input
          value={form.company}
          onChange={(e) => set({ company: e.target.value })}
          placeholder="Company name"
          autoComplete="organization"
        />
      </label>

      <p className="kiterp-contact-legend">How we reach you</p>
      <label className="kiterp-contact-field">
        <span>Email</span>
        <input
          type="email"
          value={form.email}
          onChange={(e) => set({ email: e.target.value })}
          placeholder="you@company.com"
          autoComplete="email"
        />
      </label>
      <div className="kiterp-contact-field">
        <span>Phone</span>
        <PhoneInput
          value={form.phone}
          onChange={(phone) => set({ phone })}
          defaultCountryIso="IN"
          autoComplete="tel"
          name="phone"
          showStatusHints={false}
          size={compact ? 'sm' : 'md'}
        />
      </div>

      <div className="kiterp-contact-field kiterp-contact-field--full">
        <span>Source</span>
        <div className="kiterp-contact-source-pills" role="group" aria-label="How did you hear about us">
          {sourceOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={form.source === opt.value ? 'is-active' : undefined}
              onClick={() => set({ source: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {form.source === 'referral' ? (
        <label className="kiterp-contact-field kiterp-contact-field--full">
          <span>Referral name</span>
          <input
            value={form.referral_name}
            onChange={(e) => set({ referral_name: e.target.value })}
            placeholder="Who referred you?"
            autoComplete="off"
          />
        </label>
      ) : null}

      <label className="kiterp-contact-field kiterp-contact-field--full kiterp-contact-field--message">
        <span>{notesLabel}</span>
        <textarea
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder={notesPlaceholder}
        />
      </label>
      {footer}
    </div>
  )
}
