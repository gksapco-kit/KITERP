import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, Mail, MapPin, Phone, Send } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingChatbot } from '@/components/landing/LandingChatbot'
import { PlatformAnalyticsBeacon } from '@/components/landing/PlatformAnalyticsBeacon'
import {
  EMPTY_ENQUIRY_FORM,
  LandingEnquiryFields,
  TALK_TO_US_SOURCE_OPTIONS,
  composedEnquiryName,
  type EnquiryFormValues,
} from '@/components/landing/LandingEnquiryForm'
import { PublicFormTrap, emptyTrapState, trapPayload } from '@/components/landing/PublicFormTrap'
import { useDocumentSeo } from '@/lib/documentSeo'
import { compactJsonLd, contactPageJsonLd, organizationJsonLd } from '@/lib/catalogSeo'
import '@/styles/kiterp-landing.css'

type PlatformContact = {
  email?: string | null
  phone?: string | null
  address?: string | null
  street_address?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

const EMPTY_TALK_FORM: EnquiryFormValues = { ...EMPTY_ENQUIRY_FORM, source: 'talk_to_us' }

export default function LandingContact() {
  const [contact, setContact] = useState<PlatformContact | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<EnquiryFormValues>(EMPTY_TALK_FORM)
  const [trap, setTrap] = useState(emptyTrapState)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useDocumentSeo({
    title: 'Contact KITERP — Support & Sales',
    description:
      'Contact the KITERP team for platform support, partnerships, pricing questions, and business onboarding help.',
    keywords: 'KITERP contact, KIT ERP support, business platform help',
    canonicalPath: '/contact',
    ogImage: '/favicon-192.png',
    jsonLd: compactJsonLd([organizationJsonLd(), contactPageJsonLd()]),
  })

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<PlatformContact>('/catalog/platform-contact')
      .then((res) => {
        if (!cancelled) setContact(res.data)
      })
      .catch(() => {
        if (!cancelled) setContact(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const address =
    contact?.address ||
    [contact?.street_address, contact?.city, contact?.state, contact?.postal_code]
      .map((p) => (p || '').trim())
      .filter(Boolean)
      .join(', ')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = composedEnquiryName(form)
    if (name.length < 2 || !form.notes.trim()) {
      toast.error('Please enter your name and message')
      return
    }
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error('Provide an email or phone number so we can reply')
      return
    }
    if (form.notes.trim().length < 5) {
      toast.error('Please add a little more detail in your message')
      return
    }
    setSending(true)
    try {
      const res = await apiClient.post<{ message?: string }>('/catalog/platform-contact-queries', {
        name,
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        title: form.title.trim() || undefined,
        company: form.company.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        source: form.source || 'talk_to_us',
        message: form.notes.trim(),
        ...trapPayload(trap),
      })
      toast.success(res.data.message || 'Message sent!')
      setForm(EMPTY_TALK_FORM)
      setTrap(emptyTrapState())
      setSent(true)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const hasContact = Boolean(contact?.phone || contact?.email || address)

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
              Let&apos;s <span className="kiterp-highlight">talk.</span>
            </h1>
            <p className="kiterp-contact-lead">
              Questions about the platform, pricing, or getting started? Share your details — they land on the leads page so the team can follow up.
            </p>

            <div className="kiterp-contact-channels">
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[var(--kiterp-primary)]" />
              ) : hasContact ? (
                <>
                  {contact?.phone ? (
                    <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="kiterp-contact-channel">
                      <span className="kiterp-contact-channel-icon">
                        <Phone className="w-4 h-4" />
                      </span>
                      <span>
                        <span className="kiterp-contact-channel-label">Phone</span>
                        <span className="kiterp-contact-channel-value">{contact.phone}</span>
                      </span>
                    </a>
                  ) : null}
                  {contact?.email ? (
                    <a href={`mailto:${contact.email}`} className="kiterp-contact-channel">
                      <span className="kiterp-contact-channel-icon">
                        <Mail className="w-4 h-4" />
                      </span>
                      <span>
                        <span className="kiterp-contact-channel-label">Email</span>
                        <span className="kiterp-contact-channel-value">{contact.email}</span>
                      </span>
                    </a>
                  ) : null}
                  {address ? (
                    <div className="kiterp-contact-channel kiterp-contact-channel--static">
                      <span className="kiterp-contact-channel-icon">
                        <MapPin className="w-4 h-4" />
                      </span>
                      <span>
                        <span className="kiterp-contact-channel-label">Address</span>
                        <span className="kiterp-contact-channel-value">{address}</span>
                      </span>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="kiterp-contact-empty">
                  Contact details will appear here once they&apos;re added in Admin Settings.
                </p>
              )}
            </div>
          </section>

          {sent ? (
            <div id="talk-to-us" className="kiterp-contact-form kiterp-contact-success">
              <CheckCircle2 className="kiterp-contact-success-icon" />
              <h2 className="kiterp-contact-form-title">Message received</h2>
              <p className="kiterp-contact-form-hint">
                Thanks — this enquiry is now on the KIT ERP leads list. We typically reply within one business day.
              </p>
              <button type="button" className="kiterp-btn-primary kiterp-contact-submit" onClick={() => setSent(false)}>
                Send another message
              </button>
            </div>
          ) : (
            <form id="talk-to-us" onSubmit={onSubmit} className="kiterp-contact-form" noValidate>
              <h2 className="kiterp-contact-form-title">Talk to us</h2>
              <p className="kiterp-contact-form-hint">
                A name, company, source, and email or phone fill the leads columns. We typically reply within one business day.
              </p>

              <LandingEnquiryFields
                form={form}
                onChange={setForm}
                sourceOptions={TALK_TO_US_SOURCE_OPTIONS}
                notesLabel="Message"
                notesPlaceholder="How can we help?"
                footer={<PublicFormTrap value={trap} onChange={(patch) => setTrap((t) => ({ ...t, ...patch }))} />}
              />

              <p className="kiterp-contact-crm-note">
                Submitting this form creates a lead with your name, company, source, and message.
              </p>

              <button type="submit" disabled={sending} className="kiterp-btn-primary kiterp-contact-submit">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </main>
      <LandingChatbot />
    </div>
  )
}
