import { useState } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import { Phone, Mail, MapPin, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import type { StorefrontVendor } from '@/api/storefront.api'

export default function StorefrontContact() {
  const { vendorSlug: _vendorSlug } = useParams<{ vendorSlug: string }>()
  const { vendor, themeColor } = useOutletContext<{ vendor: StorefrontVendor; themeColor: string }>()

  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.message) {
      toast.error('Please fill in your name and message')
      return
    }
    setSending(true)
    setTimeout(() => {
      setSending(false)
      toast.success('Message sent! We\'ll get back to you soon.')
      setFormData({ name: '', email: '', phone: '', message: '' })
    }, 1000)
  }

  const whatsappNumber = vendor.primary_phone?.replace(/[^0-9]/g, '')
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber.startsWith('91') ? whatsappNumber : `91${whatsappNumber}`}?text=${encodeURIComponent(`Hi ${vendor.display_name}, I'd like to know more about your products/services.`)}`
    : null

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Contact Us</h1>
        <p className="text-gray-500 mt-2">We'd love to hear from you. Reach out to us through any of these channels.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact cards */}
        <div className="space-y-4">
          {vendor.primary_phone && (
            <a href={`tel:${vendor.primary_phone}`} className="flex items-center gap-4 bg-white rounded-xl border p-5 hover:shadow-md transition-shadow max-h-[90vh] overflow-y-auto">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}>
                <Phone className="w-6 h-6" style={{ color: themeColor }} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Call Us</p>
                <p className="text-sm text-gray-500">{vendor.primary_phone}</p>
              </div>
            </a>
          )}

          {vendor.primary_email && (
            <a href={`mailto:${vendor.primary_email}`} className="flex items-center gap-4 bg-white rounded-xl border p-5 hover:shadow-md transition-shadow max-h-[90vh] overflow-y-auto">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}>
                <Mail className="w-6 h-6" style={{ color: themeColor }} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Email Us</p>
                <p className="text-sm text-gray-500">{vendor.primary_email}</p>
              </div>
            </a>
          )}

          {vendor.city && (
            <div className="flex items-center gap-4 bg-white rounded-xl border p-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${themeColor}15` }}>
                <MapPin className="w-6 h-6" style={{ color: themeColor }} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Visit Us</p>
                <p className="text-sm text-gray-500">{vendor.city}, {vendor.state}</p>
              </div>
            </div>
          )}

          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-green-50 rounded-xl border border-green-200 p-5 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-medium text-green-800">Chat on WhatsApp</p>
                <p className="text-sm text-green-600">Quick response guaranteed</p>
              </div>
            </a>
          )}
        </div>

        {/* Contact form */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 text-lg mb-4">Send us a message</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Your Name *</label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Full name" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="your@email.com" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Phone number" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Message *</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="How can we help you?"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-28 resize-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <Button type="submit" className="w-full gap-2 text-white" style={{ backgroundColor: themeColor }} disabled={sending}>
              <Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send Message'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
