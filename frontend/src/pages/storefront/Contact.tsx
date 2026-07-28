import { useState } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import { Phone, Mail, MapPin, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { toast } from 'sonner'
import { storefrontApi, type StorefrontVendor } from '@/api/storefront.api'

function meaningfulContact(value: string | null | undefined): string {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  if (/^[-–—._\s]+$/.test(trimmed)) return ''
  if (/^(n\/?a|none|null|undefined)$/i.test(trimmed)) return ''
  return trimmed
}

/** Business support fields only — do not fall back to account primary contact. */
function contactEmail(vendor: StorefrontVendor) {
  return meaningfulContact(vendor.support_email)
}

function contactPhone(vendor: StorefrontVendor) {
  return meaningfulContact(vendor.support_phone)
}

function contactAddress(vendor: StorefrontVendor) {
  return [vendor.street_address, vendor.city, vendor.state, vendor.postal_code]
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(', ')
}

export default function StorefrontContact() {
  const { vendorSlug } = useParams<{ vendorSlug: string }>()
  const { vendor, themeColor } = useOutletContext<{ vendor: StorefrontVendor; themeColor: string }>()

  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)

  const email = contactEmail(vendor)
  const phone = contactPhone(vendor)
  const address = contactAddress(vendor)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.message.trim()) {
      toast.error('Please fill in your name and message')
      return
    }
    if (!formData.email.trim() && !formData.phone.trim()) {
      toast.error('Provide an email or phone number so we can reply')
      return
    }
    if (!vendorSlug) {
      toast.error('Store not found')
      return
    }

    setSending(true)
    try {
      const res = await storefrontApi.submitContactQuery(vendorSlug, {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        message: formData.message.trim(),
      })
      toast.success(res.message || "Message sent! We'll get back to you soon.")
      setFormData({ name: '', email: '', phone: '', message: '' })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? 'Please check the form and try again'
            : 'Failed to send message'
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  const whatsappNumber = phone.replace(/[^0-9]/g, '')
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber.startsWith('91') ? whatsappNumber : `91${whatsappNumber}`}?text=${encodeURIComponent(`Hi ${vendor.display_name}, I'd like to know more about your products/services.`)}`
    : null

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Contact Us</h1>
        <p className="text-gray-500 mt-2">
          We&apos;d love to hear from you. Reach out through any of these channels or send a query below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-4 bg-white rounded-xl border p-5 hover:shadow-md transition-shadow"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${themeColor}15` }}
              >
                <Phone className="w-6 h-6" style={{ color: themeColor }} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Call Us</p>
                <p className="text-sm text-gray-500">{phone}</p>
              </div>
            </a>
          )}

          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-4 bg-white rounded-xl border p-5 hover:shadow-md transition-shadow"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${themeColor}15` }}
              >
                <Mail className="w-6 h-6" style={{ color: themeColor }} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Email Us</p>
                <p className="text-sm text-gray-500">{email}</p>
              </div>
            </a>
          )}

          {address && (
            <div className="flex items-center gap-4 bg-white rounded-xl border p-5">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${themeColor}15` }}
              >
                <MapPin className="w-6 h-6" style={{ color: themeColor }} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Visit Us</p>
                <p className="text-sm text-gray-500">{address}</p>
              </div>
            </div>
          )}

          {!phone && !email && !address && (
            <div className="bg-white rounded-xl border border-dashed p-5 text-sm text-gray-500">
              Contact details will appear here once the store adds them in Settings → Contact Information.
            </div>
          )}

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-green-50 rounded-xl border border-green-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-medium text-green-800">Chat on WhatsApp</p>
                <p className="text-sm text-green-600">Quick response</p>
              </div>
            </a>
          )}
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 text-lg mb-4">Send us a message</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Your Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <PhoneInput
                className="mt-1"
                value={formData.phone}
                onChange={(phone) => setFormData({ ...formData, phone })}
                defaultCountryIso="IN"
                autoComplete="tel"
                name="phone"
                showStatusHints={false}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Your issue / message *</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Describe your question or issue…"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-28 resize-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <Button
              type="submit"
              className="w-full gap-2 text-white"
              style={{ backgroundColor: themeColor }}
              disabled={sending}
            >
              <Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Submit query'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
