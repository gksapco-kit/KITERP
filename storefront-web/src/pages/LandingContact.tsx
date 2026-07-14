import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Mail, MapPin, Phone, Send } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { LandingHeader } from '@/components/landing/LandingHeader'
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

export default function LandingContact() {
  const [contact, setContact] = useState<PlatformContact | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)

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
    if (!form.name.trim() || !form.message.trim()) {
      toast.error('Please enter your name and message')
      return
    }
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error('Provide an email or phone number so we can reply')
      return
    }
    setSending(true)
    try {
      const res = await apiClient.post<{ message?: string }>('/catalog/platform-contact-queries', {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        message: form.message.trim(),
      })
      toast.success(res.data.message || 'Message sent!')
      setForm({ name: '', email: '', phone: '', message: '' })
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
      <div className="kiterp-contact-glow" aria-hidden />
      <LandingHeader />

      <main className="kiterp-contact-main">
        <div className="kiterp-contact-shell kiterp-reveal">
          {/* Brand column */}
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
              Questions about the platform, pricing, or getting started? Reach the team directly.
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

          {/* Message form */}
          <form onSubmit={onSubmit} className="kiterp-contact-form" noValidate>
            <h2 className="kiterp-contact-form-title">Send a message</h2>
            <p className="kiterp-contact-form-hint">We typically reply within one business day.</p>

            <div className="kiterp-contact-fields">
              <label className="kiterp-contact-field kiterp-contact-field--full">
                <span>Your name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Full name"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="kiterp-contact-field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </label>

              <label className="kiterp-contact-field">
                <span>Phone</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Mobile number"
                  autoComplete="tel"
                />
              </label>

              <label className="kiterp-contact-field kiterp-contact-field--full kiterp-contact-field--message">
                <span>Message</span>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="How can we help?"
                  required
                />
              </label>
            </div>

            <button type="submit" disabled={sending} className="kiterp-btn-primary kiterp-contact-submit">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
