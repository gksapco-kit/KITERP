import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVendor } from '@/contexts/VendorContext'
import { useStoreInfo } from '@/hooks/useStore'
import { storeApi } from '@/api/store'
import {
  resolveBusinessContactAddress,
  resolveBusinessContactEmail,
  resolveBusinessContactPhone,
} from '@/lib/businessContact'

export default function ContactPage() {
  const { storePath, vendor: ctxVendor } = useVendor()
  const { data: store } = useStoreInfo()
  const vendor = (ctxVendor || store) as Parameters<typeof resolveBusinessContactEmail>[2]

  const email = resolveBusinessContactEmail(undefined, undefined, vendor)
  const phone = resolveBusinessContactPhone(undefined, undefined, vendor)
  const address = resolveBusinessContactAddress(undefined, undefined, vendor)

  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)

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
      const res = await storeApi.submitContactQuery({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        message: form.message.trim(),
      })
      toast.success(res.message || 'Message sent!')
      setForm({ name: '', email: '', phone: '', message: '' })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-8 sm:py-10 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Contact Us</h1>
        <p className="text-sm text-gray-500">
          Store details and a form to send your question or issue.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s+/g, '')}`}
              className="flex items-center gap-3 rounded-xl border bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <Phone className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Phone</p>
                <p className="text-sm text-gray-600">{phone}</p>
              </div>
            </a>
          ) : null}
          {email ? (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-3 rounded-xl border bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Email</p>
                <p className="text-sm text-gray-600">{email}</p>
              </div>
            </a>
          ) : null}
          {address ? (
            <div className="flex items-start gap-3 rounded-xl border bg-white p-4">
              <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Address</p>
                <p className="text-sm text-gray-600">{address}</p>
              </div>
            </div>
          ) : null}
          {!phone && !email && !address && (
            <div className="rounded-xl border border-dashed bg-white p-4 text-sm text-gray-500">
              Contact details are not set yet. The store can add them under Settings → Contact Information.
            </div>
          )}
          <p className="text-xs text-gray-500 pt-1">
            Looking for policies?{' '}
            <Link to={storePath('/policies')} className="text-primary hover:underline">
              View store policies
            </Link>
          </p>
        </div>

        <form onSubmit={onSubmit} className="rounded-xl border bg-white p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Send a query</h2>
          <div>
            <Label htmlFor="cq-name">Your name *</Label>
            <Input
              id="cq-name"
              className="mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
            />
          </div>
          <div>
            <Label htmlFor="cq-email">Email</Label>
            <Input
              id="cq-email"
              type="email"
              className="mt-1"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <Label htmlFor="cq-phone">Phone</Label>
            <Input
              id="cq-phone"
              className="mt-1"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Mobile number"
            />
          </div>
          <div>
            <Label htmlFor="cq-msg">Issue / message *</Label>
            <textarea
              id="cq-msg"
              className="mt-1 w-full min-h-[112px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Describe your question or issue…"
            />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending…' : 'Submit query'}
          </Button>
        </form>
      </div>
    </div>
  )
}
