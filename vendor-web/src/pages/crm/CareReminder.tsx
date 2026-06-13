import { useState, useMemo, useEffect, useCallback } from 'react'
import { SectionLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useCustomers } from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import { extractApiError } from '@/lib/errorMessages'
import type { Customer as ApiCustomer } from '@/types'
import {
  Heart, Plus, Search, Mail, MessageCircle, Phone,
  Clock, CheckCircle2, Bell, ArrowRight, Repeat,
  X, Calendar, User, ChevronDown, ChevronUp,
  Send, RotateCcw, Inbox, Sparkles, Pencil,
  AlarmClock, Eye, Trash2, PhoneIncoming, Filter, Users,
} from 'lucide-react'

const ALL_CUSTOMERS_ID = '__all__'

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = 'email' | 'whatsapp' | 'sms' | 'notification'
type RStatus = 'scheduled' | 'sent' | 'responded' | 'cancelled' | 'failed'
type Frequency = 'once' | 'daily' | 'weekly' | 'monthly'

interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  avatar: string
}

interface ActionItem {
  id: string
  created_at: string
  customer_name: string
  note: string
  done: boolean
}

interface Reminder {
  id: string
  customer: Customer
  channel: Channel
  subject: string
  message: string
  scheduled_at: string
  frequency: Frequency
  include_reach_back: boolean
  status: RStatus
  created_at: string
  responded_at?: string
  response_note?: string
  action_items: ActionItem[]
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

const SAMPLE_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Ramesh Mehta',   email: 'ramesh@mehta.com',   phone: '+91 98765 00001', avatar: 'RM' },
  { id: 'c2', name: 'Sunita Rao',     email: 'sunita@rao.co',      phone: '+91 98765 00002', avatar: 'SR' },
  { id: 'c3', name: 'Arjun Sharma',   email: 'arjun@sharma.in',    phone: '+91 98765 00003', avatar: 'AS' },
  { id: 'c4', name: 'Priya Nair',     email: 'priya@nair.com',     phone: '+91 98765 00004', avatar: 'PN' },
  { id: 'c5', name: 'Deepak Singh',   email: 'deepak@singh.biz',   phone: '+91 98765 00005', avatar: 'DS' },
  { id: 'c6', name: 'Kavitha Reddy',  email: 'kavitha@reddy.co',   phone: '+91 98765 00006', avatar: 'KR' },
]

const MESSAGE_TEMPLATES: Record<Channel, { label: string; body: string }[]> = {
  email: [
    { label: 'Follow-up check-in',   body: 'Hi {name}, hope you\'re doing well! We wanted to check in and see if you had any questions about your recent purchase or need any assistance. We\'re here to help!' },
    { label: 'Service reminder',      body: 'Dear {name}, this is a friendly reminder that your service is due for renewal. Let us know if you\'d like to proceed or have any queries.' },
    { label: 'Birthday wish',         body: 'Happy Birthday, {name}! 🎉 Wishing you a wonderful day. As a valued customer, enjoy a special 10% off on your next order — use code BDAY10.' },
    { label: 'Post-purchase care',    body: 'Hi {name}, it\'s been a week since your purchase. We\'d love to know how things are going. Your feedback means a lot to us!' },
  ],
  whatsapp: [
    { label: 'Quick check-in',        body: 'Hi {name} 👋 Just checking in to see if everything is going well with your recent order. Feel free to reply anytime!' },
    { label: 'Reminder ping',         body: 'Hey {name}! Don\'t forget — your appointment / renewal is coming up. Reply YES to confirm or NO to reschedule.' },
    { label: 'Festival greetings',    body: '🙏 Warm wishes to you and your family, {name}! Wishing you joy and prosperity this festive season.' },
    { label: 'Offer alert',           body: '🔥 Exclusive offer for you, {name}! Get 15% off on your next purchase. Valid till this Sunday. Reply DEAL to claim.' },
  ],
  sms: [
    { label: 'Short reminder',        body: 'Hi {name}, reminder: your service renewal is due. Call us at 1800-XXX-XXXX or reply to this message.' },
    { label: 'Appointment reminder',  body: 'Dear {name}, your appointment is scheduled for {date}. Reply CONFIRM or CANCEL. — Your Business Name' },
    { label: 'Payment reminder',      body: 'Hi {name}, friendly reminder about your pending balance. Contact us to settle or discuss payment options.' },
    { label: 'Thank you',             body: 'Thank you {name} for your continued trust! We appreciate your business. — Your Team' },
  ],
  notification: [
    { label: 'Medicine reminder',     body: 'Hi {name}, this is a reminder to take your medicine today at noon (12 PM). Tap below if you need us to call you back.' },
    { label: 'Appointment reminder',  body: 'Hi {name}, your appointment is scheduled for {date}. Open the app for details or request a callback.' },
    { label: 'Service due',           body: 'Hi {name}, your service renewal is due soon. Check the app for options or tap to request a call-back.' },
    { label: 'Follow-up check-in',    body: 'Hi {name}, we wanted to check in and see how things are going. Let us know if you need any help.' },
  ],
}

const STORAGE_KEY = 'crm_care_reminders_v1'
const ACTIONS_KEY = 'crm_care_actions_v1'

function loadReminders(): Reminder[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveReminders(list: Reminder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}
function loadActions(): ActionItem[] {
  try { return JSON.parse(localStorage.getItem(ACTIONS_KEY) || '[]') } catch { return [] }
}
function saveActions(list: ActionItem[]) {
  localStorage.setItem(ACTIONS_KEY, JSON.stringify(list))
}

// ─── Channel Config ───────────────────────────────────────────────────────────

const CHANNEL_META: Record<Channel, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  email:        { label: 'Email',        icon: Mail,           color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  whatsapp:     { label: 'WhatsApp',     icon: MessageCircle,  color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  sms:          { label: 'SMS',          icon: Phone,          color: 'text-primary',    bg: 'bg-accent',    border: 'border-primary/30' },
  notification: { label: 'Notification', icon: Bell,           color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
}

const STATUS_META: Record<RStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'soft'; icon: React.ElementType }> = {
  scheduled:  { label: 'Scheduled',  variant: 'soft',        icon: AlarmClock },
  sent:        { label: 'Sent',       variant: 'secondary',   icon: Send },
  responded:   { label: 'Responded',  variant: 'success',     icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',  variant: 'destructive', icon: X },
  failed:      { label: 'Failed',     variant: 'destructive', icon: X },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDt(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function avatarColor(str: string) {
  const colors = ['bg-blue-500', 'bg-primary', 'bg-emerald-500', 'bg-primary', 'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500']
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % colors.length
  return colors[h]
}

function customerAvatar(name: string) {
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

function apiCustomerToPicker(c: ApiCustomer): Customer {
  return {
    id: c.id,
    name: c.full_name,
    email: c.email,
    phone: c.phone,
    avatar: customerAvatar(c.full_name || '?'),
  }
}

function isRealCustomerId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

function isAllCustomersSelection(customer: Customer | null | undefined) {
  return customer?.id === ALL_CUSTOMERS_ID
}

function personalizeMessage(template: string, customer: Customer, scheduledAt: string) {
  const name = customer.name.split(' ')[0] || 'there'
  return template.replace(/\{name\}/g, name).replace(/\{date\}/g, fmtDt(scheduledAt))
}

function expandRecipients(data: Omit<Reminder, 'id' | 'created_at' | 'status' | 'action_items'>, allCustomers: Customer[]) {
  if (!isAllCustomersSelection(data.customer)) return [data.customer]
  const pool = data.channel === 'notification'
    ? allCustomers.filter(c => isRealCustomerId(c.id))
    : allCustomers
  return pool
}

async function dispatchCustomerNotification(r: Reminder) {
  if (!isRealCustomerId(r.customer.id)) {
    throw new Error('Select a registered customer to send in-app notifications')
  }
  await vendorApi.sendCustomerNotification({
    customer_id: r.customer.id,
    title: r.subject.trim() || `Reminder for ${r.customer.name.split(' ')[0]}`,
    message: r.message,
    include_reach_back: r.include_reach_back,
    reference_id: r.id,
  })
}

// ─── Compose Modal ─────────────────────────────────────────────────────────────

function ComposeModal({
 onClose, onSave, editing, customers }: {
  onClose: () => void
  onSave: (r: Omit<Reminder, 'id' | 'created_at' | 'status' | 'action_items'>) => void
  editing?: Reminder | null
  customers: Customer[]
}) {
  const [step, setStep] = useState<'customer' | 'compose' | 'schedule'>(editing ? 'compose' : 'customer')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(editing?.customer ?? null)
  const [channel, setChannel] = useState<Channel>(editing?.channel ?? 'whatsapp')
  const [subject, setSubject] = useState(editing?.subject ?? '')
  const [message, setMessage] = useState(editing?.message ?? '')
  const [scheduledAt, setScheduledAt] = useState(editing?.scheduled_at ?? '')
  const [frequency, setFrequency] = useState<Frequency>(editing?.frequency ?? 'once')
  const [includeReachBack, setIncludeReachBack] = useState(editing?.include_reach_back ?? false)
  const [showTemplates, setShowTemplates] = useState(false)

  const filteredCustomers = useMemo(() =>
    customers.filter(c =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone || '').includes(customerSearch)
    ), [customers, customerSearch])

  const allCustomersOption = useMemo((): Customer => ({
    id: ALL_CUSTOMERS_ID,
    name: 'All customers',
    email: `Broadcast to ${customers.length} customer${customers.length === 1 ? '' : 's'}`,
    avatar: 'ALL',
  }), [customers.length])

  const notificationRecipients = useMemo(() => {
    if (!selectedCustomer) return []
    if (isAllCustomersSelection(selectedCustomer)) {
      return customers.filter(c => isRealCustomerId(c.id))
    }
    return [selectedCustomer]
  }, [selectedCustomer, customers])

  const notificationBlocked = channel === 'notification' && (
    !notificationRecipients.length ||
    notificationRecipients.some(c => !isRealCustomerId(c.id))
  )

  const applyTemplate = (body: string) => {
    const name = isAllCustomersSelection(selectedCustomer)
      ? '{name}'
      : (selectedCustomer?.name.split(' ')[0] || 'there')
    setMessage(body.replace(/\{name\}/g, name).replace(/\{date\}/g, fmtDt(scheduledAt)))
    setShowTemplates(false)
  }

  const canNext = () => {
    if (step === 'customer') return !!selectedCustomer
    if (step === 'compose') {
      if (notificationBlocked) return false
      if (channel === 'notification' && !subject.trim()) return false
      return message.trim().length > 0
    }
    return !!scheduledAt
  }

  const handleSave = () => {
    if (!selectedCustomer || !message.trim() || !scheduledAt) return
    onSave({ customer: selectedCustomer, channel, subject, message, scheduled_at: scheduledAt, frequency, include_reach_back: includeReachBack })
  }

  const chMeta = CHANNEL_META[channel]
  const ChIcon = chMeta.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">{editing ? 'Edit Reminder' : 'New Care & Reminder'}</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-3 border-b bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            {(['customer', 'compose', 'schedule'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full transition-colors ${step === s ? 'bg-primary/15 text-primary' : (
                  (s === 'compose' && selectedCustomer) || (s === 'schedule' && message.trim()) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                )}`}>
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold bg-white/50">{i + 1}</span>
                  {s === 'customer' ? 'Select Customer' : s === 'compose' ? 'Compose Message' : 'Schedule'}
                </div>
                {i < 2 && <ArrowRight className="w-3 h-3 text-gray-300" />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── Step 1: Customer ── */}
          {step === 'customer' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input className="pl-10" placeholder="Search customers by name, email or phone…"
                  value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {!editing && (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(allCustomersOption)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isAllCustomersSelection(selectedCustomer) ? 'border-primary/60 bg-primary/10' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-primary text-white shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">All customers</p>
                      <p className="text-xs text-gray-500">Send the same reminder to every customer ({customers.length})</p>
                    </div>
                    {isAllCustomersSelection(selectedCustomer) && (
                      <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />
                    )}
                  </button>
                )}
                {filteredCustomers.map(c => (
                  <button key={c.id} onClick={() => setSelectedCustomer(c)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${selectedCustomer?.id === c.id ? 'border-primary/60 bg-primary/10' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(c.avatar)}`}>{c.avatar}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.email} {c.phone ? `· ${c.phone}` : ''}</p>
                    </div>
                    {selectedCustomer?.id === c.id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />}
                  </button>
                ))}
                {!filteredCustomers.length && (
                  <div className="text-center py-10 text-sm text-gray-400">No customers found</div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Compose ── */}
          {step === 'compose' && selectedCustomer && (
            <div className="space-y-4">
              {/* Customer pill */}
              <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                {isAllCustomersSelection(selectedCustomer) ? (
                  <>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-white shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">All customers</p>
                      <p className="text-xs text-gray-500">
                        {notificationRecipients.length || customers.length} recipient{(notificationRecipients.length || customers.length) === 1 ? '' : 's'}
                        {channel === 'notification' && notificationRecipients.length < customers.length
                          ? ` · ${customers.length - notificationRecipients.length} skipped (no app account)`
                          : ''}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${avatarColor(selectedCustomer.avatar)}`}>{selectedCustomer.avatar}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{selectedCustomer.name}</p>
                      <p className="text-xs text-gray-500">{selectedCustomer.email} {selectedCustomer.phone ? `· ${selectedCustomer.phone}` : ''}</p>
                    </div>
                  </>
                )}
                <button onClick={() => setStep('customer')} className="text-xs text-blue-600 hover:underline shrink-0">Change</button>
              </div>

              {/* Channel selector */}
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Delivery Channel</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.entries(CHANNEL_META) as [Channel, typeof CHANNEL_META[Channel]][]).map(([key, meta]) => {
                    const Icon = meta.icon
                    return (
                      <button key={key} onClick={() => setChannel(key)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-medium transition-all ${channel === key ? `${meta.border} ${meta.bg} ${meta.color}` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        <Icon className="w-5 h-5" />
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
                {channel === 'notification' && (
                  <p className="text-xs text-violet-600 mt-2 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 shrink-0" />
                    Delivers an in-app notification to the customer&apos;s storefront / mobile app when sent.
                  </p>
                )}
              </div>

              {/* Subject (email) or title (notification) */}
              {(channel === 'email' || channel === 'notification') && (
                <div>
                  <Label className="text-xs text-gray-500">{channel === 'email' ? 'Email Subject' : 'Notification Title'}</Label>
                  <Input className="mt-1" placeholder={channel === 'email' ? 'e.g. Following up on your recent visit' : 'e.g. Medicine reminder'}
                    value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
              )}

              {notificationBlocked && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {isAllCustomersSelection(selectedCustomer)
                    ? 'No registered customers with app accounts found. In-app notifications require customers from your customer list.'
                    : 'In-app notifications require a registered customer from your customer list (with a storefront account).'}
                </p>
              )}

              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-gray-500">Message</Label>
                  <button onClick={() => setShowTemplates(!showTemplates)}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Use template
                    {showTemplates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
                {showTemplates && (
                  <div className="mb-2 bg-blue-50 rounded-xl border border-blue-100 p-3 space-y-1.5 max-h-44 overflow-y-auto">
                    {MESSAGE_TEMPLATES[channel].map(t => (
                      <button key={t.label} onClick={() => applyTemplate(t.body)}
                        className="w-full text-left text-xs p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-blue-200">
                        <p className="font-semibold text-blue-700">{t.label}</p>
                        <p className="text-gray-500 truncate mt-0.5">{t.body.slice(0, 80)}…</p>
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  className="w-full text-sm border border-input rounded-xl px-3 py-2.5 min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={`Type your ${CHANNEL_META[channel].label} message… Use {name} for customer name${isAllCustomersSelection(selectedCustomer) ? ' (personalised per customer)' : ''}.`}
                  value={message} onChange={e => setMessage(e.target.value)} />
                <p className="text-right text-xs text-gray-400 mt-0.5">{message.length} chars</p>
              </div>

              {/* Reach Me Back toggle */}
              <div className={`rounded-xl border-2 p-4 transition-all ${includeReachBack ? 'border-primary/40 bg-primary/10' : 'border-gray-200 bg-gray-50'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <PhoneIncoming className="w-4 h-4 text-primary" />
                      Include "Reach Me Back" Request
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      A call-to-action button will be added to the message. When the customer taps it, a follow-up action item is created in your CRM for your team to call back.
                    </p>
                    {includeReachBack && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium bg-primary/15 text-primary px-2.5 py-1 rounded-full">
                        <Bell className="w-3 h-3" /> CRM action will be auto-created on response
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setIncludeReachBack(!includeReachBack)}
                    className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors mt-0.5 ${includeReachBack ? 'bg-primary' : 'bg-gray-300'}`}>
                    <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
                      style={{ transform: includeReachBack ? 'translateX(18px)' : 'translateX(2px)' }} />
                  </button>
                </label>
              </div>
            </div>
          )}

          {/* ── Step 3: Schedule ── */}
          {step === 'schedule' && (
            <div className="space-y-5">
              {/* Summary pill */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${chMeta.border} ${chMeta.bg}`}>
                <ChIcon className={`w-5 h-5 ${chMeta.color} shrink-0`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {isAllCustomersSelection(selectedCustomer)
                      ? `All customers (${notificationRecipients.length || customers.length})`
                      : selectedCustomer?.name}
                  </p>
                  <p className={`text-xs ${chMeta.color} font-medium`}>{chMeta.label} · {message.slice(0, 60)}{message.length > 60 ? '…' : ''}</p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Send Date & Time</Label>
                <input type="datetime-local" value={scheduledAt}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Repeat Frequency</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'once',    label: 'Send Once',      icon: Send },
                    { id: 'daily',   label: 'Daily',          icon: Repeat },
                    { id: 'weekly',  label: 'Weekly',         icon: Calendar },
                    { id: 'monthly', label: 'Monthly',        icon: RotateCcw },
                  ] as { id: Frequency; label: string; icon: React.ElementType }[]).map(f => {
                    const FIcon = f.icon
                    return (
                      <button key={f.id} onClick={() => setFrequency(f.id)}
                        className={`flex items-center gap-2 py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition-all ${frequency === f.id ? 'border-primary/60 bg-primary/10 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        <FIcon className="w-3.5 h-3.5" />{f.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Preview card */}
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 bg-gray-50">
                <SectionLabel className="mb-3">Message Preview</SectionLabel>
                <div className={`rounded-xl p-4 ${chMeta.bg} border ${chMeta.border}`}>
                  {channel === 'email' && subject && <p className="text-xs font-bold text-gray-700 mb-2">Subject: {subject}</p>}
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{message}</p>
                  {includeReachBack && (
                    <div className="mt-3 pt-3 border-t border-dashed border-gray-300">
                      <button className="flex items-center gap-2 bg-primary text-white text-xs font-medium px-4 py-2 rounded-lg pointer-events-none">
                        <PhoneIncoming className="w-3.5 h-3.5" /> Please call me back
                      </button>
                      <p className="text-xs text-gray-400 mt-1.5">Tapping this creates a follow-up in your CRM</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                  <AlarmClock className="w-3.5 h-3.5" />
                  {scheduledAt ? `Sends on ${fmtDt(scheduledAt)}` : 'No schedule set yet'}
                  {frequency !== 'once' && <span className="font-medium text-primary">· then {frequency}</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between shrink-0">
          <Button
            variant={step === 'customer' ? 'cancel' : 'ghost'}
            onClick={step === 'customer' ? onClose : () => setStep(step === 'schedule' ? 'compose' : 'customer')}
          >
            {step === 'customer' ? 'Cancel' : '← Back'}
          </Button>
          {step !== 'schedule' ? (
            <Button disabled={!canNext()} onClick={() => setStep(step === 'customer' ? 'compose' : 'schedule')}
              className="bg-primary hover:bg-primary/90 gap-2">
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button disabled={!canNext()} onClick={handleSave} className="bg-primary hover:bg-primary/90 gap-2">
              <Bell className="w-4 h-4" /> {editing ? 'Update Reminder' : 'Schedule Reminder'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Reminder Card ─────────────────────────────────────────────────────────────

function ReminderCard({ r, expanded, onToggleView, onMarkSent, onCancel, onMarkResponded, onEdit, onDelete, onToggleAction }: {
  r: Reminder
  expanded: boolean
  onToggleView: () => void
  onMarkSent: () => void
  onCancel: () => void
  onMarkResponded: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleAction: (actionId: string) => void
}) {
  const chMeta = CHANNEL_META[r.channel]
  const sMeta = STATUS_META[r.status]
  const ChIcon = chMeta.icon
  const SIcon = sMeta.icon
  const pendingActions = r.action_items.filter(a => !a.done)

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-shadow hover:shadow-md ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleView}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleView() } }}
        className={`p-4 flex items-start gap-3 cursor-pointer ${expanded ? 'bg-gray-50/80' : 'hover:bg-gray-50/50'}`}
        aria-expanded={expanded}
      >
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(r.customer.avatar)}`}>
          {r.customer.avatar}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">{r.customer.name}</span>
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${chMeta.bg} ${chMeta.color}`}>
              <ChIcon className="w-3 h-3" />{chMeta.label}
            </div>
            <Badge variant={sMeta.variant as any}>
              <SIcon className="w-3 h-3 mr-1" />{sMeta.label}
            </Badge>
            {r.include_reach_back && (
              <span className="text-xs font-medium bg-primary/15 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <PhoneIncoming className="w-2.5 h-2.5" /> Reach-back
              </span>
            )}
            {pendingActions.length > 0 && (
              <span className="text-xs font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Inbox className="w-2.5 h-2.5" /> {pendingActions.length} action{pendingActions.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{r.message.slice(0, 90)}{r.message.length > 90 ? '…' : ''}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            <span className="flex items-center gap-1"><AlarmClock className="w-3 h-3" />{fmtDt(r.scheduled_at)}</span>
            {r.frequency !== 'once' && <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />{r.frequency}</span>}
            {r.responded_at && <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3 h-3" />Responded {fmtDt(r.responded_at)}</span>}
          </div>
        </div>

        {/* Expand indicator */}
        <div className="flex items-center gap-1 shrink-0 text-gray-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* View mode panel */}
      {expanded && (
        <div className="border-t bg-gray-50 px-4 py-4 space-y-4" onClick={e => e.stopPropagation()}>
          {/* Full message preview */}
          <div>
            <SectionLabel className="mb-2">Message</SectionLabel>
            <div className={`rounded-xl p-3 ${chMeta.bg} border ${chMeta.border} text-sm text-gray-800 leading-relaxed whitespace-pre-wrap`}>
              {r.channel === 'email' && r.subject && <p className="text-xs font-bold text-gray-700 mb-2">Subject: {r.subject}</p>}
              {r.message}
              {r.include_reach_back && (
                <div className="mt-3 pt-3 border-t border-dashed border-gray-300">
                  <span className="inline-flex items-center gap-2 bg-primary text-white text-xs font-medium px-3 py-1.5 rounded-lg">
                    <PhoneIncoming className="w-3.5 h-3.5" /> Please call me back
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* CRM Action Items */}
          {r.action_items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Inbox className="w-3.5 h-3.5 text-amber-500" /> CRM Action Items (Reach-back Responses)
              </p>
              <div className="space-y-2">
                {r.action_items.map(a => (
                  <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border bg-white ${a.done ? 'opacity-60' : ''}`}>
                    <button onClick={() => onToggleAction(a.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${a.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-primary/60'}`}>
                      {a.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${a.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{a.note}</p>
                      <p className="text-xs text-gray-400 mt-0.5">From: {a.customer_name} · {fmtDt(a.created_at)}</p>
                    </div>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${a.done ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      {a.done ? 'Done' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {r.status === 'scheduled' && (
              <>
                <Button size="sm" variant="outline" onClick={onMarkSent} className="gap-1.5 text-xs">
                  <Send className="w-3.5 h-3.5" />
                  {r.channel === 'notification' ? 'Send notification' : 'Mark as Sent'}
                </Button>
                <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5 text-xs">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button size="sm" variant="cancel" onClick={onCancel} className="gap-1.5 text-xs text-red-500 hover:text-red-600">
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
              </>
            )}
            {r.status === 'sent' && r.include_reach_back && (
              <Button size="sm" variant="outline" onClick={onMarkResponded} className="gap-1.5 text-xs text-emerald-600">
                <PhoneIncoming className="w-3.5 h-3.5" /> Simulate Customer Response
              </Button>
            )}
            {(r.status === 'cancelled' || r.status === 'failed') && (
              <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5 text-xs">
                <RotateCcw className="w-3.5 h-3.5" /> Reschedule
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onDelete} className="gap-1.5 text-xs text-gray-400 hover:text-red-500 ml-auto">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CareReminderPage() {
  const { data: customersData } = useCustomers({ size: 100 })
  const customers = useMemo(() => {
    const items = customersData?.items?.map(apiCustomerToPicker) ?? []
    return items.length ? items : SAMPLE_CUSTOMERS
  }, [customersData?.items])

  const [reminders, setReminders] = useState<Reminder[]>(loadReminders)
  const [actions, setActions] = useState<ActionItem[]>(loadActions)
  const [showCompose, setShowCompose] = useState(false)
  const [editing, setEditing] = useState<Reminder | null>(null)
  const [filterStatus, setFilterStatus] = useState<RStatus | 'all'>('all')
  const [filterChannel, setFilterChannel] = useState<Channel | 'all'>('all')
  const [search, setSearch] = useState('')
  const [viewingId, setViewingId] = useState<string | null>(null)

  const persist = (list: Reminder[]) => { setReminders(list); saveReminders(list) }
  const persistActions = (list: ActionItem[]) => { setActions(list); saveActions(list) }

  const sendNotificationReminder = useCallback(async (r: Reminder) => {
    await dispatchCustomerNotification(r)
  }, [])

  const handleSave = async (data: Omit<Reminder, 'id' | 'created_at' | 'status' | 'action_items'>) => {
    if (editing) {
      const updated = reminders.map(r => r.id === editing.id ? { ...r, ...data } : r)
      persist(updated)
      toast.success('Reminder updated!')
      setShowCompose(false)
      setEditing(null)
      return
    }

    const recipients = expandRecipients(data, customers)
    if (isAllCustomersSelection(data.customer) && !recipients.length) {
      toast.error('No customers available to send to')
      return
    }

    const isDueNow = data.channel === 'notification' && new Date(data.scheduled_at) <= new Date()
    const baseTs = Date.now()
    const created: Reminder[] = []

    for (let i = 0; i < recipients.length; i++) {
      const customer = recipients[i]
      const newR: Reminder = {
        ...data,
        customer,
        message: personalizeMessage(data.message, customer, data.scheduled_at),
        id: `r${baseTs}-${i}-${customer.id.slice(0, 8)}`,
        created_at: new Date().toISOString(),
        status: 'scheduled',
        action_items: [],
      }
      if (isDueNow && data.channel === 'notification') {
        try {
          await sendNotificationReminder(newR)
          newR.status = 'sent'
        } catch {
          // leave scheduled so user can retry via Send notification
        }
      }
      created.push(newR)
    }

    persist([...created, ...reminders])

    if (isAllCustomersSelection(data.customer)) {
      const sentCount = created.filter(r => r.status === 'sent').length
      if (isDueNow && data.channel === 'notification') {
        toast.success(`Notification sent to ${sentCount} of ${recipients.length} customers`)
      } else if (data.channel === 'notification') {
        toast.success(`Notification scheduled for ${recipients.length} customers`)
      } else {
        toast.success(`Reminder scheduled for ${recipients.length} customers`)
      }
    } else {
      const newR = created[0]
      if (isDueNow && data.channel === 'notification' && newR?.status === 'sent') {
        toast.success('Notification sent to customer app')
      } else {
        toast.success(data.channel === 'notification' ? 'Notification scheduled' : 'Reminder scheduled!')
      }
    }

    setShowCompose(false)
    setEditing(null)
  }

  const markSent = async (id: string) => {
    const r = reminders.find(x => x.id === id)
    if (!r) return
    try {
      if (r.channel === 'notification') {
        await sendNotificationReminder(r)
      }
      persist(reminders.map(x => x.id === id ? { ...x, status: 'sent' } : x))
      toast.success(r.channel === 'notification' ? 'Notification sent to customer app' : 'Marked as sent')
    } catch (err) {
      toast.error(extractApiError(err, 'Could not send notification'))
    }
  }

  const cancelReminder = (id: string) => {
    persist(reminders.map(r => r.id === id ? { ...r, status: 'cancelled' } : r))
    toast('Reminder cancelled')
  }

  const deleteReminder = (id: string) => {
    persist(reminders.filter(r => r.id !== id))
    toast('Reminder deleted')
  }

  const markResponded = (id: string) => {
    const r = reminders.find(x => x.id === id)
    if (!r) return
    const newAction: ActionItem = {
      id: `a${Date.now()}`,
      created_at: new Date().toISOString(),
      customer_name: r.customer.name,
      note: `${r.customer.name} requested a call-back via ${CHANNEL_META[r.channel].label}. Follow up immediately.`,
      done: false,
    }
    const allActions = [newAction, ...actions]
    persistActions(allActions)
    persist(reminders.map(x => x.id === id ? {
      ...x,
      status: 'responded',
      responded_at: new Date().toISOString(),
      action_items: [...x.action_items, newAction],
    } : x))
    toast.success(`Action item created! ${r.customer.name} wants a call-back.`, { duration: 4000 })
  }

  const toggleAction = (reminderId: string, actionId: string) => {
    persist(reminders.map(r => r.id === reminderId ? {
      ...r,
      action_items: r.action_items.map(a => a.id === actionId ? { ...a, done: !a.done } : a),
    } : r))
  }

  // Auto-send due in-app notification reminders
  useEffect(() => {
    const tick = async () => {
      const due = reminders.filter(r =>
        r.channel === 'notification' &&
        r.status === 'scheduled' &&
        new Date(r.scheduled_at) <= new Date()
      )
      if (!due.length) return
      let next = [...reminders]
      for (const r of due) {
        try {
          await dispatchCustomerNotification(r)
          next = next.map(x => x.id === r.id ? { ...x, status: 'sent' as RStatus } : x)
        } catch {
          // keep scheduled; user can retry manually
        }
      }
      if (due.some(r => next.find(x => x.id === r.id)?.status === 'sent')) {
        persist(next)
      }
    }
    tick()
    const timer = setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, [reminders])

  const filtered = useMemo(() => reminders.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (filterChannel !== 'all' && r.channel !== filterChannel) return false
    if (search && !r.customer.name.toLowerCase().includes(search.toLowerCase()) && !r.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [reminders, filterStatus, filterChannel, search])

  const stats = useMemo(() => ({
    scheduled: reminders.filter(r => r.status === 'scheduled').length,
    sent:      reminders.filter(r => r.status === 'sent').length,
    responded: reminders.filter(r => r.status === 'responded').length,
    actions:   reminders.flatMap(r => r.action_items).filter(a => !a.done).length,
  }), [reminders])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Heart className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">Care & Reminders</h1>
          </div>
          <p className="text-sm text-gray-500">Schedule personalised messages via Email, WhatsApp, SMS, or in-app Notification. Enable reach-back to auto-create CRM follow-up actions.</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowCompose(true) }} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" /> New Reminder
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Scheduled',         value: stats.scheduled, icon: AlarmClock,   color: 'text-blue-600',   bg: 'bg-blue-50',   filter: 'scheduled' as RStatus },
          { label: 'Sent',              value: stats.sent,      icon: Send,         color: 'text-gray-600',   bg: 'bg-gray-50',   filter: 'sent' as RStatus },
          { label: 'Responded',         value: stats.responded, icon: CheckCircle2, color: 'text-emerald-600',bg: 'bg-emerald-50',filter: 'responded' as RStatus },
          { label: 'Pending Actions',   value: stats.actions,   icon: Inbox,        color: 'text-amber-600',  bg: 'bg-amber-50',  filter: 'all' as 'all' },
        ].map(s => {
          const Icon = s.icon
          return (
            <button key={s.label} onClick={() => setFilterStatus(s.filter === filterStatus ? 'all' : s.filter as any)}
              className={`bg-white border rounded-2xl p-4 flex items-start justify-between text-left hover:shadow-md transition-shadow ${filterStatus === s.filter && s.filter !== 'all' ? 'ring-2 ring-primary/40' : ''}`}>
              <div>
                <SectionLabel>{s.label}</SectionLabel>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.bg}`}>
                <Icon className={`w-5 h-5 ${s.color}`} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="pl-9 h-9 text-sm" placeholder="Search by customer or message…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            {(['all', 'scheduled', 'sent', 'responded', 'cancelled'] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s === filterStatus ? 'all' : s)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${filterStatus === s ? 'bg-primary/15 text-primary border-primary/40' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {s === 'all' ? 'All' : STATUS_META[s as RStatus]?.label ?? s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {(['all', 'email', 'whatsapp', 'sms', 'notification'] as const).map(ch => {
              if (ch === 'all') return (
                <button key="all" onClick={() => setFilterChannel('all')}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${filterChannel === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  All Channels
                </button>
              )
              const meta = CHANNEL_META[ch]
              const Icon = meta.icon
              return (
                <button key={ch} onClick={() => setFilterChannel(ch === filterChannel ? 'all' : ch)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${filterChannel === ch ? `${meta.bg} ${meta.color} ${meta.border}` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  <Icon className="w-3 h-3" />{meta.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Reminder list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-primary/40" />
            </div>
            <p className="text-gray-500 text-sm font-medium mb-1">No reminders found</p>
            <p className="text-gray-400 text-xs mb-4">Schedule your first care message to a customer.</p>
            <Button size="sm" onClick={() => { setEditing(null); setShowCompose(true) }} className="bg-primary hover:bg-primary/90 gap-1.5">
              <Plus className="w-4 h-4" /> New Reminder
            </Button>
          </div>
        ) : filtered.map(r => (
          <ReminderCard key={r.id} r={r}
            expanded={viewingId === r.id}
            onToggleView={() => setViewingId(viewingId === r.id ? null : r.id)}
            onMarkSent={() => markSent(r.id)}
            onCancel={() => { cancelReminder(r.id); setViewingId(null) }}
            onMarkResponded={() => markResponded(r.id)}
            onEdit={() => { setEditing(r); setShowCompose(true) }}
            onDelete={() => { deleteReminder(r.id); setViewingId(null) }}
            onToggleAction={actionId => toggleAction(r.id, actionId)}
          />
        ))}
      </div>

      {/* Global pending action items panel */}
      {actions.filter(a => !a.done).length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Inbox className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-800">Pending Customer Reach-Back Actions</h3>
              <span className="text-xs font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">{actions.filter(a => !a.done).length}</span>
            </div>
            <div className="space-y-2">
              {actions.filter(a => !a.done).map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-white rounded-xl border border-amber-200 px-3 py-2.5">
                  <PhoneIncoming className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium">{a.note}</p>
                    <p className="text-xs text-gray-400">{fmtDt(a.created_at)}</p>
                  </div>
                  <button onClick={() => {
                    const updated = actions.map(x => x.id === a.id ? { ...x, done: true } : x)
                    persistActions(updated)
                    persist(reminders.map(r => ({ ...r, action_items: r.action_items.map(ai => ai.id === a.id ? { ...ai, done: true } : ai) })))
                    toast.success('Action marked complete')
                  }} className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Done
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compose/Edit Modal */}
      {showCompose && (
        <ComposeModal
          customers={customers}
          onClose={() => { setShowCompose(false); setEditing(null) }}
          onSave={handleSave}
          editing={editing}
        />
      )}
    </div>
  )
}
