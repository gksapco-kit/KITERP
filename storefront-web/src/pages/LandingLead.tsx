import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Building2, CheckCircle2, Loader2, Plus, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingChatbot } from '@/components/landing/LandingChatbot'
import { PlatformAnalyticsBeacon } from '@/components/landing/PlatformAnalyticsBeacon'
import {
  EMPTY_ENQUIRY_FORM,
  LEAD_SOURCE_OPTIONS,
  LandingEnquiryFields,
  type EnquiryFormValues,
} from '@/components/landing/LandingEnquiryForm'
import { PublicFormTrap, emptyTrapState, trapPayload } from '@/components/landing/PublicFormTrap'
import { useDocumentSeo } from '@/lib/documentSeo'
import { compactJsonLd, organizationJsonLd } from '@/lib/catalogSeo'
import '@/styles/kiterp-landing.css'

const DUPLICATE_MESSAGE = 'We may already have your details. Submit again if this is a new enquiry.'

export default function LandingLead() {
  const [form, setForm] = useState<EnquiryFormValues>(EMPTY_ENQUIRY_FORM)
  const [trap, setTrap] = useState(emptyTrapState)
  const [sending, setSending] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  const [sent, setSent] = useState(false)

  useDocumentSeo({
    title: 'Add a new lead — KITERP',
    description: 'Share your details with the KITERP team. We will follow up about the platform, pricing, and onboarding.',
    keywords: 'KITERP lead, KIT ERP enquiry, business platform demo',
    canonicalPath: '/lead',
    ogImage: '/favicon-192.png',
    jsonLd: compactJsonLd([
      organizationJsonLd(),
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Add a new lead — KITERP',
        url: '/lead',
        description: 'Share your details with the KITERP team.',
      },
    ]),
  })

  useEffect(() => {
    const first = form.first_name.trim()
    const last = form.last_name.trim()
    const email = form.email.trim()
    const phone = form.phone.trim()
    const emailReady = email.includes('@') && /\.[a-z]{2,}$/i.test(email)
    const phoneReady = phone.replace(/\D/g, '').length >= 8
    const nameReady = first.length >= 2 && last.length >= 2

    if (!emailReady && !phoneReady && !nameReady) {
      setDuplicate(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      apiClient
        .post<{ duplicate?: boolean }>(
          '/catalog/platform-leads/check',
          {
            first_name: first || undefined,
            last_name: last || undefined,
            email: emailReady ? email : undefined,
            phone: phoneReady ? phone : undefined,
          },
          { signal: controller.signal },
        )
        .then((res) => setDuplicate(Boolean(res.data.duplicate)))
        .catch((err: { code?: string; name?: string }) => {
          if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return
        })
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [form.first_name, form.last_name, form.email, form.phone])

  const persist = async (force: boolean) => {
    if (!form.first_name.trim() && !form.last_name.trim() && !form.email.trim() && !form.phone.trim()) {
      toast.error('Enter a name, email, or phone number')
      return
    }
    setSending(true)
    try {
      const res = await apiClient.post<{ message?: string }>('/catalog/platform-leads', {
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        title: form.title.trim() || undefined,
        company: form.company.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        source: form.source,
        notes: form.notes.trim() || undefined,
        force,
        ...trapPayload(trap),
      })
      toast.success(res.data.message || 'Thanks — we received your details.')
      setForm(EMPTY_ENQUIRY_FORM)
      setTrap(emptyTrapState())
      setDuplicate(false)
      setSent(true)
    } catch (err: unknown) {
      const data = (err as { response?: { status?: number; data?: { duplicate?: boolean; message?: string; detail?: unknown } } })
        ?.response
      if (data?.status === 409 && data.data?.duplicate) {
        setDuplicate(true)
        toast.message(data.data.message || DUPLICATE_MESSAGE)
        return
      }
      const detail = data?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not save your details')
    } finally {
      setSending(false)
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void persist(false)
  }

  return (
    <div className="kiterp-landing kiterp-contact-page font-kiterp-body">
      <PlatformAnalyticsBeacon />
      <div className="kiterp-contact-glow" aria-hidden />
      <LandingHeader />

      <main className="kiterp-contact-main">
        <div className="kiterp-contact-shell kiterp-reveal">
          <section className="kiterp-contact-brand">
            <Link to="/" className="kiterp-contact-back">
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </Link>

            <p className="kiterp-contact-eyebrow">KIT ERP</p>
            <h1 className="font-kiterp-script kiterp-contact-title">
              Add a new <span className="kiterp-highlight">lead.</span>
            </h1>
            <p className="kiterp-contact-lead">
              Tell us about you or your business. Every field here maps onto the CRM leads list so the team can follow up on pricing, demos, and getting started.
            </p>

            <div className="kiterp-contact-channels">
              <div className="kiterp-contact-channel kiterp-contact-channel--static">
                <span className="kiterp-contact-channel-icon">
                  <UserRound className="w-4 h-4" />
                </span>
                <span>
                  <span className="kiterp-contact-channel-label">Who it&apos;s for</span>
                  <span className="kiterp-contact-channel-value">Founders, partners, and sales enquiries</span>
                </span>
              </div>
              <div className="kiterp-contact-channel kiterp-contact-channel--static">
                <span className="kiterp-contact-channel-icon">
                  <Building2 className="w-4 h-4" />
                </span>
                <span>
                  <span className="kiterp-contact-channel-label">What happens next</span>
                  <span className="kiterp-contact-channel-value">Your details appear on the leads page within a business day</span>
                </span>
              </div>
            </div>
          </section>

          {sent ? (
            <div className="kiterp-contact-form kiterp-contact-success">
              <CheckCircle2 className="kiterp-contact-success-icon" />
              <h2 className="kiterp-contact-form-title">Lead received</h2>
              <p className="kiterp-contact-form-hint">
                Thanks — we saved your details on the KIT ERP leads list. The team will follow up shortly.
              </p>
              <button type="button" className="kiterp-btn-primary kiterp-contact-submit" onClick={() => setSent(false)}>
                Add another lead
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="kiterp-contact-form" noValidate>
              <h2 className="kiterp-contact-form-title">Your details</h2>
              <p className="kiterp-contact-form-hint">Name, company, source, and a way to reach you fill the leads columns.</p>

              <LandingEnquiryFields
                form={form}
                onChange={setForm}
                sourceOptions={LEAD_SOURCE_OPTIONS}
                notesLabel="Notes"
                notesPlaceholder="What are you looking for?"
                footer={
                  <>
                    <PublicFormTrap value={trap} onChange={(patch) => setTrap((t) => ({ ...t, ...patch }))} />
                    {duplicate ? (
                      <p className="kiterp-contact-field kiterp-contact-field--full kiterp-lead-duplicate">
                        {DUPLICATE_MESSAGE}
                      </p>
                    ) : null}
                  </>
                }
              />

              <p className="kiterp-contact-crm-note">
                These details show on the CRM leads page: name, company, source, and your message.
              </p>

              <button
                type={duplicate ? 'button' : 'submit'}
                disabled={sending}
                className="kiterp-btn-primary kiterp-contact-submit"
                onClick={duplicate ? () => void persist(true) : undefined}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {sending ? 'Adding…' : duplicate ? 'Add anyway' : 'Add lead'}
              </button>
            </form>
          )}
        </div>
      </main>
      <LandingChatbot />
    </div>
  )
}
