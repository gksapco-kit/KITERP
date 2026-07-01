import { useEffect, useMemo, useState, useCallback, type ElementType, type ReactNode } from 'react'
import { BusinessUnitSelect, useDefaultBusinessUnitId } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { CollapsibleSection } from '@/components/common/CollapsibleSection'
import { HelpableText } from '@/components/common/HelpableText'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useStoreMessageConfig, useUpdateStoreMessageConfig, useMessageDeliveryStatus } from '@/hooks/useVendor'
import type {
  EventRecipients,
  MessageEmailRecipient,
  MessagePhoneRecipient,
  MessageTemplate,
  NotificationEventType,
  StoreMessageConfig,
} from '@/api/vendor'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Mail, MessageCircle, MessageSquare, Loader2, Plus, Pencil, Trash2,
  ShoppingCart, AlertTriangle, Building2, Users, UsersRound,
  Phone, Smartphone, Package, FileText, Eye, Calendar, CheckCircle2, Plug, ExternalLink, ChevronDown,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const TEMPLATE_CHANNELS = [
  { key: 'email' as const, label: 'Email' },
  { key: 'sms' as const, label: 'SMS' },
  { key: 'whatsapp' as const, label: 'WhatsApp' },
]

const TEMPLATE_PLACEHOLDERS = [
  '{customer_name}', '{store_name}', '{order_number}', '{total}', '{status}', '{payment_note}',
]

const VENDOR_TEMPLATE_PLACEHOLDERS = [
  '{customer_name}', '{store_name}', '{order_number}', '{total}', '{status}',
]

const DEFAULT_TEMPLATE_MESSAGE =
  'Hi {customer_name},\n\nThank you for your order at {store_name}.\nOrder #{order_number} — {total}\n{payment_note}'

const DEFAULT_VENDOR_TEMPLATE_MESSAGE =
  'New order #{order_number} at {store_name}.\nCustomer: {customer_name}\nTotal: {total}\nStatus: {status}'

function toDatetimeLocal(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(local: string): string {
  if (!local) return ''
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

function defaultTemplateWindow(): { start: string; end: string } {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 30)
  end.setHours(23, 59, 0, 0)
  return { start: start.toISOString(), end: end.toISOString() }
}

function formatScheduleRange(start: string, end: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  }
  return `${fmt(start)} → ${fmt(end)}`
}

function isTemplateActive(t: MessageTemplate, now = new Date()): boolean {
  if (t.enabled === false) return false
  const start = new Date(t.start_at)
  const end = new Date(t.end_at)
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && now >= start && now <= end
}

function applyTemplateTokens(
  text: string,
  storeName: string,
  audience: 'customer' | 'vendor' = 'customer',
): string {
  const sample: Record<string, string> = audience === 'customer'
    ? {
        customer_name: 'Ravi Kumar',
        store_name: storeName || 'Your Store',
        order_number: 'ORD-00031',
        total: '₹999.00',
        status: 'Pending',
        payment_note: 'Payment received.',
      }
    : {
        customer_name: 'Ravi Kumar',
        store_name: storeName || 'Your Store',
        order_number: 'ORD-00031',
        total: '₹999.00',
        status: 'Pending',
      }
  let out = text
  for (const [key, value] of Object.entries(sample)) {
    out = out.split(`{${key}}`).join(value)
  }
  return out
}

const EVENT_KEYS: NotificationEventType[] = [
  'new_orders',
  'order_status_updates',
  'customer_inquiries',
  'system_notifications',
]

const NOTIFICATION_TYPES = [
  {
    key: 'new_orders' as const,
    label: 'New Orders',
    icon: ShoppingCart,
    color: 'text-blue-600 bg-blue-500/10 ring-blue-500/20',
    description: 'Alerts when a customer places a new order.',
  },
  {
    key: 'order_status_updates' as const,
    label: 'Order Status Updates',
    icon: Package,
    color: 'text-sky-600 bg-sky-500/10 ring-sky-500/20',
    description: 'Notifications when order status changes (confirmed, shipped, delivered, etc.).',
  },
  {
    key: 'customer_inquiries' as const,
    label: 'Customer Inquiries',
    icon: MessageSquare,
    color: 'text-violet-600 bg-violet-500/10 ring-violet-500/20',
    description: 'Messages from customers via contact forms, chat, or support requests.',
  },
  {
    key: 'system_notifications' as const,
    label: 'System Notifications',
    icon: AlertTriangle,
    color: 'text-amber-600 bg-amber-500/10 ring-amber-500/20',
    description: 'Platform alerts, maintenance notices, and account-level system events.',
  },
]

const CUSTOMER_CHANNELS = [
  { key: 'email' as const, label: 'Email', icon: Mail, iconClass: 'text-blue-600', description: 'Send order confirmation to customers via email' },
  { key: 'sms' as const, label: 'SMS', icon: Smartphone, iconClass: 'text-emerald-600', description: 'Send order confirmation text messages to customers' },
  { key: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle, iconClass: 'text-green-600', description: 'Send order confirmation WhatsApp messages to customers' },
]

const VENDOR_CHANNELS = [
  { key: 'email' as const, label: 'Email', icon: Mail, iconClass: 'text-blue-600', description: 'Send new order alerts to your team via email' },
  { key: 'sms' as const, label: 'SMS', icon: Smartphone, iconClass: 'text-emerald-600', description: 'Send new order text alerts to your team phones' },
  { key: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle, iconClass: 'text-green-600', description: 'Send new order WhatsApp alerts to your team phones' },
]

function emptyEventRecipients(): EventRecipients {
  return { email_recipients: [], phone_recipients: [], customer_templates: [], vendor_templates: [] }
}

function defaultConfig(): StoreMessageConfig {
  return {
    events: {
      new_orders: emptyEventRecipients(),
      order_status_updates: emptyEventRecipients(),
      customer_inquiries: emptyEventRecipients(),
      system_notifications: emptyEventRecipients(),
    },
    customer_channels: { email: true, sms: false, whatsapp: false },
    vendor_channels: { email: true, sms: false, whatsapp: false },
  }
}

/** Normalize API payload — supports legacy flat lists migrated server-side. */
function normalizeConfig(raw: StoreMessageConfig | Record<string, unknown>): StoreMessageConfig {
  const base = defaultConfig()
  const legacy = raw as Record<string, unknown>
  if (!legacy.events && (legacy.email_recipients || legacy.phone_recipients)) {
    base.events.new_orders = {
      email_recipients: (legacy.email_recipients as MessageEmailRecipient[]) || [],
      phone_recipients: (legacy.phone_recipients as MessagePhoneRecipient[]) || [],
    }
    base.customer_channels = (legacy.customer_channels as StoreMessageConfig['customer_channels']) || base.customer_channels
    base.vendor_channels = (legacy.vendor_channels as StoreMessageConfig['vendor_channels']) || base.vendor_channels
    return base
  }
  const events = (legacy.events || {}) as StoreMessageConfig['events']
  for (const key of EVENT_KEYS) {
    base.events[key] = {
      email_recipients: events[key]?.email_recipients || [],
      phone_recipients: events[key]?.phone_recipients || [],
      customer_templates: events[key]?.customer_templates || [],
      vendor_templates: events[key]?.vendor_templates || [],
    }
  }
  base.customer_channels = (legacy.customer_channels as StoreMessageConfig['customer_channels']) || base.customer_channels
  base.vendor_channels = (legacy.vendor_channels as StoreMessageConfig['vendor_channels']) || base.vendor_channels
  return base
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
        'disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted dark:bg-secondary',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

function eventBlockSummary(block: EventRecipients): string {
  const parts: string[] = []
  if (block.email_recipients.length) parts.push(`${block.email_recipients.length} email`)
  if (block.phone_recipients.length) parts.push(`${block.phone_recipients.length} phone`)
  const vendorCount = block.vendor_templates?.length ?? 0
  const customerCount = block.customer_templates?.length ?? 0
  if (vendorCount) parts.push(`${vendorCount} vendor tmpl`)
  if (customerCount) parts.push(`${customerCount} customer tmpl`)
  return parts.length ? parts.join(' · ') : 'No recipients or templates'
}

function MessageExpandableSection({
  title,
  icon: Icon,
  iconClassName,
  hint,
  helpKey,
  open,
  onToggle,
  headerAction,
  children,
}: {
  title: string
  icon: ElementType
  iconClassName?: string
  hint?: string
  helpKey?: string
  open: boolean
  onToggle: () => void
  headerAction?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <div className={cn('relative flex items-center gap-1', open && 'border-b border-border/50 bg-muted/10')}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className="absolute inset-0 z-0 rounded-none text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        />
        <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
          <Icon className={cn('h-4 w-4 shrink-0 pointer-events-none', iconClassName)} />
          <div className="min-w-0 flex-1">
            <HelpableText
              helpKey={helpKey ?? `message center:${title.toLowerCase()}`}
              className="text-sm font-medium text-foreground"
            >
              {title}
            </HelpableText>
            {hint && !open ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground pointer-events-none">{hint}</p>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground pointer-events-none transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </div>
        {headerAction ? (
          <div
            className="relative z-10 shrink-0 pr-2"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {headerAction}
          </div>
        ) : null}
      </div>
      {open ? <div className="space-y-3 px-3 py-3">{children}</div> : null}
    </div>
  )
}

function newId() {
  return crypto.randomUUID()
}

type EmailModalState = { open: boolean; eventKey: NotificationEventType; editing?: MessageEmailRecipient }
type PhoneModalState = { open: boolean; eventKey: NotificationEventType; editing?: MessagePhoneRecipient }
type DeleteConfirmState = {
  type: 'email' | 'phone' | 'template'
  templateAudience?: 'customer' | 'vendor'
  eventKey: NotificationEventType
  id: string
  value: string
  eventLabel: string
}

type TemplateModalState = {
  open: boolean
  eventKey: NotificationEventType
  audience: 'customer' | 'vendor'
  editing?: MessageTemplate
}
type TemplatePreviewState = {
  open: boolean
  template: MessageTemplate
  eventLabel: string
  audience: 'customer' | 'vendor'
}

export default function CreateMessagesPage() {
  const { defaultId } = useDefaultBusinessUnitId()
  const [storeId, setStoreId] = useState('')
  const [branchId, setBranchId] = useState('')
  const effectiveStoreId = branchId || storeId
  const { data, isLoading } = useStoreMessageConfig(effectiveStoreId)
  const { data: deliveryStatus } = useMessageDeliveryStatus()
  const saveConfig = useUpdateStoreMessageConfig(effectiveStoreId)

  const [config, setConfig] = useState<StoreMessageConfig>(defaultConfig())

  const [emailModal, setEmailModal] = useState<EmailModalState | null>(null)
  const [phoneModal, setPhoneModal] = useState<PhoneModalState | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)
  const [emailForm, setEmailForm] = useState({ email: '', label: '' })
  const [phoneForm, setPhoneForm] = useState({ phone: '', label: '' })
  const [templateModal, setTemplateModal] = useState<TemplateModalState | null>(null)
  const [templatePreview, setTemplatePreview] = useState<TemplatePreviewState | null>(null)
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    message: DEFAULT_TEMPLATE_MESSAGE,
    startLocal: '',
    endLocal: '',
    channels: ['email', 'sms', 'whatsapp'] as Array<'email' | 'sms' | 'whatsapp'>,
    enabled: true,
  })
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const isSectionOpen = (key: string) => openSections[key] === true
  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    if (!storeId && defaultId) setStoreId(defaultId)
  }, [defaultId, storeId])

  useEffect(() => {
    if (data?.message_config) {
      setConfig(normalizeConfig(data.message_config))
    }
  }, [data])

  const storeLabel = data?.store_name ?? 'Business Unit'

  const activeCustomerChannels = useMemo(() => {
    const ch = config.customer_channels
    const enabled = CUSTOMER_CHANNELS.filter((c) => ch[c.key]).map((c) => c.label)
    return enabled.length ? enabled.join(' + ') : 'None'
  }, [config.customer_channels])

  const activeVendorChannels = useMemo(() => {
    const ch = config.vendor_channels
    const enabled = VENDOR_CHANNELS.filter((c) => ch[c.key]).map((c) => c.label)
    return enabled.length ? enabled.join(' + ') : 'None'
  }, [config.vendor_channels])

  /** Save to server immediately — toast confirms each update. */
  const persistConfig = useCallback((next: StoreMessageConfig) => {
    setConfig(next)
    if (!storeId) return
    saveConfig.mutate(next)
  }, [storeId, saveConfig])

  const patchEvent = (eventKey: NotificationEventType, block: EventRecipients) => {
    persistConfig({
      ...config,
      events: { ...config.events, [eventKey]: block },
    })
  }

  const openAddEmail = (eventKey: NotificationEventType) => {
    setEmailForm({ email: '', label: '' })
    setEmailModal({ open: true, eventKey })
  }

  const openEditEmail = (eventKey: NotificationEventType, item: MessageEmailRecipient) => {
    setEmailForm({ email: item.email, label: item.label || '' })
    setEmailModal({ open: true, eventKey, editing: item })
  }

  const saveEmail = () => {
    if (!emailModal) return
    const email = emailForm.email.trim()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error('Enter a valid email address')
      return
    }
    const label = emailForm.label.trim() || undefined
    const block = config.events[emailModal.eventKey]
    const nextEmails = emailModal.editing
      ? block.email_recipients.map((r) =>
          r.id === emailModal.editing!.id ? { ...r, email, label } : r,
        )
      : [...block.email_recipients, { id: newId(), email, label }]
    patchEvent(emailModal.eventKey, { ...block, email_recipients: nextEmails })
    setEmailModal(null)
  }

  const requestDeleteEmail = (eventKey: NotificationEventType, item: MessageEmailRecipient) => {
    const eventLabel = NOTIFICATION_TYPES.find((e) => e.key === eventKey)?.label ?? eventKey
    setDeleteConfirm({
      type: 'email',
      eventKey,
      id: item.id,
      value: item.email,
      eventLabel,
    })
  }

  const requestDeletePhone = (eventKey: NotificationEventType, item: MessagePhoneRecipient) => {
    const eventLabel = NOTIFICATION_TYPES.find((e) => e.key === eventKey)?.label ?? eventKey
    setDeleteConfirm({
      type: 'phone',
      eventKey,
      id: item.id,
      value: item.phone,
      eventLabel,
    })
  }

  const confirmDelete = () => {
    if (!deleteConfirm) return
    const block = config.events[deleteConfirm.eventKey]
    if (deleteConfirm.type === 'email') {
      patchEvent(deleteConfirm.eventKey, {
        ...block,
        email_recipients: block.email_recipients.filter((r) => r.id !== deleteConfirm.id),
      })
    } else if (deleteConfirm.type === 'phone') {
      patchEvent(deleteConfirm.eventKey, {
        ...block,
        phone_recipients: block.phone_recipients.filter((r) => r.id !== deleteConfirm.id),
      })
    } else {
      const templateKey = deleteConfirm.templateAudience === 'vendor' ? 'vendor_templates' : 'customer_templates'
      patchEvent(deleteConfirm.eventKey, {
        ...block,
        [templateKey]: (block[templateKey] || []).filter((t) => t.id !== deleteConfirm.id),
      })
    }
    setDeleteConfirm(null)
  }

  const openAddPhone = (eventKey: NotificationEventType) => {
    setPhoneForm({ phone: '', label: '' })
    setPhoneModal({ open: true, eventKey })
  }

  const openEditPhone = (eventKey: NotificationEventType, item: MessagePhoneRecipient) => {
    setPhoneForm({ phone: item.phone, label: item.label || '' })
    setPhoneModal({ open: true, eventKey, editing: item })
  }

  const savePhone = () => {
    if (!phoneModal) return
    const phone = phoneForm.phone.trim()
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      toast.error('Enter a valid phone number')
      return
    }
    const label = phoneForm.label.trim() || undefined
    const block = config.events[phoneModal.eventKey]
    const nextPhones = phoneModal.editing
      ? block.phone_recipients.map((r) =>
          r.id === phoneModal.editing!.id ? { ...r, phone, label } : r,
        )
      : [...block.phone_recipients, { id: newId(), phone, label }]
    patchEvent(phoneModal.eventKey, { ...block, phone_recipients: nextPhones })
    setPhoneModal(null)
  }

  const openAddTemplate = (eventKey: NotificationEventType, audience: 'customer' | 'vendor') => {
    const win = defaultTemplateWindow()
    setTemplateForm({
      name: '',
      subject: audience === 'vendor'
        ? 'New order #{order_number} — {store_name}'
        : 'Order #{order_number} confirmed — {store_name}',
      message: audience === 'vendor' ? DEFAULT_VENDOR_TEMPLATE_MESSAGE : DEFAULT_TEMPLATE_MESSAGE,
      startLocal: toDatetimeLocal(win.start),
      endLocal: toDatetimeLocal(win.end),
      channels: ['email', 'sms', 'whatsapp'],
      enabled: true,
    })
    setTemplateModal({ open: true, eventKey, audience })
  }

  const openEditTemplate = (
    eventKey: NotificationEventType,
    item: MessageTemplate,
    audience: 'customer' | 'vendor',
  ) => {
    setTemplateForm({
      name: item.name,
      subject: item.subject || '',
      message: item.message,
      startLocal: toDatetimeLocal(item.start_at),
      endLocal: toDatetimeLocal(item.end_at),
      channels: item.channels?.length ? [...item.channels] : ['email', 'sms', 'whatsapp'],
      enabled: item.enabled !== false,
    })
    setTemplateModal({ open: true, eventKey, audience, editing: item })
  }

  const saveTemplate = () => {
    if (!templateModal) return
    const name = templateForm.name.trim()
    const message = templateForm.message.trim()
    const start_at = fromDatetimeLocal(templateForm.startLocal)
    const end_at = fromDatetimeLocal(templateForm.endLocal)
    if (!name) {
      toast.error('Enter a template name')
      return
    }
    if (!message) {
      toast.error('Enter a message body')
      return
    }
    if (!start_at || !end_at) {
      toast.error('Set valid start and end date/time')
      return
    }
    if (new Date(end_at) < new Date(start_at)) {
      toast.error('End date/time must be after start')
      return
    }
    if (templateForm.channels.length === 0) {
      toast.error('Select at least one channel')
      return
    }
    const block = config.events[templateModal.eventKey]
    const templateKey = templateModal.audience === 'vendor' ? 'vendor_templates' : 'customer_templates'
    const templates = block[templateKey] || []
    const payload: MessageTemplate = {
      id: templateModal.editing?.id || newId(),
      name,
      subject: templateForm.subject.trim() || undefined,
      message,
      start_at,
      end_at,
      channels: templateForm.channels,
      enabled: templateForm.enabled,
    }
    const nextTemplates = templateModal.editing
      ? templates.map((t) => (t.id === templateModal.editing!.id ? payload : t))
      : [...templates, payload]
    patchEvent(templateModal.eventKey, { ...block, [templateKey]: nextTemplates })
    setTemplateModal(null)
  }

  const requestDeleteTemplate = (
    eventKey: NotificationEventType,
    item: MessageTemplate,
    audience: 'customer' | 'vendor',
  ) => {
    const eventLabel = NOTIFICATION_TYPES.find((e) => e.key === eventKey)?.label ?? eventKey
    setDeleteConfirm({
      type: 'template',
      templateAudience: audience,
      eventKey,
      id: item.id,
      value: item.name,
      eventLabel,
    })
  }

  const toggleTemplateChannel = (key: 'email' | 'sms' | 'whatsapp') => {
    setTemplateForm((f) => {
      const has = f.channels.includes(key)
      const channels = has ? f.channels.filter((c) => c !== key) : [...f.channels, key]
      return { ...f, channels }
    })
  }

  const setCustomerChannel = (key: keyof StoreMessageConfig['customer_channels'], value: boolean) => {
    persistConfig({
      ...config,
      customer_channels: { ...config.customer_channels, [key]: value },
    })
  }

  const setVendorChannel = (key: keyof StoreMessageConfig['vendor_channels'], value: boolean) => {
    persistConfig({
      ...config,
      vendor_channels: { ...config.vendor_channels, [key]: value },
    })
  }

  const activeEventLabel = emailModal
    ? NOTIFICATION_TYPES.find((e) => e.key === emailModal.eventKey)?.label
    : phoneModal
      ? NOTIFICATION_TYPES.find((e) => e.key === phoneModal.eventKey)?.label
      : templateModal
        ? NOTIFICATION_TYPES.find((e) => e.key === templateModal.eventKey)?.label
        : ''

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div>
        <HelpableText helpKey="message center" className="text-2xl font-bold text-foreground">
          Message Center
        </HelpableText>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Configure recipients, scheduled vendor and customer message templates, and channel preferences per business unit.
          Changes save automatically.{' '}
          <span className="text-muted-foreground/90">
            Hover a section title or label for tips — press{' '}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">F1</kbd> for full help.
          </span>
        </p>
      </div>

      <CollapsibleSection
        title="Business Unit"
        icon={Building2}
        subtitle={storeLabel}
        helpText="Message settings apply only to the selected unit."
        helpKey="message center:business unit"
        open={isSectionOpen('business-unit')}
        toggle={() => toggleSection('business-unit')}
      >
        <div className="max-w-sm space-y-1.5">
          <Label helpKey="select business unit">Select business unit</Label>
          <div className="flex flex-wrap gap-2">
            <BusinessUnitSelect
              value={storeId}
              onChange={(id) => { setStoreId(id); setBranchId('') }}
              className="flex-1 min-w-[10rem]"
            />
            <BranchSelect
              businessUnitId={storeId || null}
              value={branchId}
              onChange={setBranchId}
              allowAll
              className="flex-1 min-w-[10rem]"
            />
          </div>
        </div>
      </CollapsibleSection>

      {deliveryStatus && (
        <CollapsibleSection
          title="Delivery providers"
          icon={Plug}
          subtitle={
            [
              deliveryStatus.email.ready ? 'Email ready' : 'Email setup needed',
              deliveryStatus.sms.ready ? 'SMS ready' : 'SMS setup needed',
              deliveryStatus.whatsapp.ready ? 'WhatsApp ready' : 'WhatsApp setup needed',
            ].join(' · ')
          }
          helpText="Email uses SMTP/SendGrid. SMS and WhatsApp need Twilio or Meta in Integrations."
          helpKey="message center:delivery providers"
          open={isSectionOpen('delivery')}
          toggle={() => toggleSection('delivery')}
        >
          <div className="space-y-2">
            {([
              { key: 'email' as const, label: 'Email', icon: Mail },
              { key: 'sms' as const, label: 'SMS', icon: Smartphone },
              { key: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
            ]).map(({ key, label, icon: Icon }) => {
              const ch = deliveryStatus[key]
              return (
                <div key={key} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div className="flex items-start gap-2 min-w-0">
                    <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', ch.ready ? 'text-green-600' : 'text-amber-600')} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      {ch.ready ? (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ready{ch.provider ? ` (${ch.provider})` : ''}
                        </p>
                      ) : (
                        <ul className="text-xs text-amber-700 mt-0.5 list-disc pl-4 space-y-0.5">
                          {ch.missing.map(m => <li key={m}>{m}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {(!deliveryStatus.sms.ready || !deliveryStatus.whatsapp.ready) && (
              <Button asChild variant="outline" size="sm" className="mt-2 gap-1.5">
                <Link to="/crm/integrations">
                  Set up SMS / WhatsApp in Integrations
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </CollapsibleSection>
      )}

      {isLoading && storeId ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading configuration…
        </div>
      ) : (
        <>
          {NOTIFICATION_TYPES.map((evt) => {
            const block = config.events[evt.key]
            const eventKey = evt.key
            return (
              <CollapsibleSection
                key={eventKey}
                title={evt.label}
                icon={evt.icon}
                subtitle={eventBlockSummary(block)}
                helpText={evt.description}
                helpKey={`message center:${eventKey.replace(/_/g, ' ')}`}
                open={isSectionOpen(`event:${eventKey}`)}
                toggle={() => toggleSection(`event:${eventKey}`)}
              >
                <div className="space-y-3">
                  <MessageExpandableSection
                    title="Email Recipients"
                    helpKey="message center:email recipients"
                    icon={Mail}
                    iconClassName="text-blue-600"
                    hint={
                      block.email_recipients.length
                        ? `${block.email_recipients.length} recipient(s)`
                        : 'Uses vendor support email when empty'
                    }
                    open={isSectionOpen(`event:${eventKey}:email`)}
                    onToggle={() => toggleSection(`event:${eventKey}:email`)}
                    headerAction={
                      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => openAddEmail(eventKey)}>
                        <Plus className="w-3.5 h-3.5" /> Add Email
                      </Button>
                    }
                  >
                    {block.email_recipients.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
                        No email recipients for {evt.label.toLowerCase()}.
                        When empty, the vendor&apos;s primary support email is used as fallback.
                      </p>
                    ) : (
                      <div className="divide-y divide-border rounded-lg border border-border">
                        {block.email_recipients.map((r) => (
                          <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{r.email}</p>
                              {r.label && <p className="text-xs text-muted-foreground">{r.label}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditEmail(eventKey, r)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => requestDeleteEmail(eventKey, r)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </MessageExpandableSection>

                  <MessageExpandableSection
                    title="Phone Recipients"
                    helpKey="message center:phone recipients"
                    icon={Phone}
                    iconClassName="text-emerald-600"
                    hint={
                      block.phone_recipients.length
                        ? `${block.phone_recipients.length} recipient(s) · SMS & WhatsApp`
                        : 'Uses vendor contact phone when empty'
                    }
                    open={isSectionOpen(`event:${eventKey}:phone`)}
                    onToggle={() => toggleSection(`event:${eventKey}:phone`)}
                    headerAction={
                      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => openAddPhone(eventKey)}>
                        <Plus className="w-3.5 h-3.5" /> Add Phone
                      </Button>
                    }
                  >
                    {block.phone_recipients.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
                        No phone recipients for {evt.label.toLowerCase()}.
                        When empty, the vendor&apos;s configured contact phone is used as fallback.
                      </p>
                    ) : (
                      <div className="divide-y divide-border rounded-lg border border-border">
                        {block.phone_recipients.map((r) => (
                          <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{r.phone}</p>
                              {r.label && <p className="text-xs text-muted-foreground">{r.label}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPhone(eventKey, r)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => requestDeletePhone(eventKey, r)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </MessageExpandableSection>

                  <MessageExpandableSection
                    title="Vendor Message Templates"
                    helpKey="message center:vendor message templates"
                    icon={UsersRound}
                    iconClassName="text-emerald-600"
                    hint={
                      (block.vendor_templates || []).length
                        ? `${block.vendor_templates!.length} template(s) · team alerts`
                        : 'Default system alert for your team'
                    }
                    open={isSectionOpen(`event:${eventKey}:vendor-templates`)}
                    onToggle={() => toggleSection(`event:${eventKey}:vendor-templates`)}
                    headerAction={
                      <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => openAddTemplate(eventKey, 'vendor')}>
                        <Plus className="w-3.5 h-3.5" /> Add Template
                      </Button>
                    }
                  >
                    <p className="text-xs text-muted-foreground">
                      Customise alerts sent to your team. When templates overlap, the narrowest date range wins.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Placeholders: {VENDOR_TEMPLATE_PLACEHOLDERS.join(', ')}
                    </p>
                    {(block.vendor_templates || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
                        No templates — default system alert is used for your team.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {(block.vendor_templates || []).map((t) => {
                          const active = isTemplateActive(t)
                          return (
                            <div key={t.id} className="rounded-lg border border-border px-3 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                                    <span className={cn(
                                      'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                                      active ? 'bg-emerald-500/15 text-emerald-700' : 'bg-muted text-muted-foreground',
                                    )}>
                                      {active ? 'Active now' : 'Scheduled'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3 shrink-0" />
                                    {formatScheduleRange(t.start_at, t.end_at)}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Channels: {(t.channels || []).map((c) => c.toUpperCase()).join(', ')}
                                  </p>
                                  <p className="text-xs text-foreground/80 mt-1 line-clamp-2 whitespace-pre-line">{t.message}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Preview"
                                    onClick={() => setTemplatePreview({
                                      open: true,
                                      template: t,
                                      eventLabel: evt.label,
                                      audience: 'vendor',
                                    })}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTemplate(eventKey, t, 'vendor')}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => requestDeleteTemplate(eventKey, t, 'vendor')}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </MessageExpandableSection>

                  <MessageExpandableSection
                    title="Customer Message Templates"
                    helpKey="message center:customer message templates"
                    icon={FileText}
                    iconClassName="text-violet-600"
                    hint={
                      (block.customer_templates || []).length
                        ? `${block.customer_templates!.length} template(s) · customer messages`
                        : 'Default system message for customers'
                    }
                    open={isSectionOpen(`event:${eventKey}:customer-templates`)}
                    onToggle={() => toggleSection(`event:${eventKey}:customer-templates`)}
                    headerAction={
                      <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => openAddTemplate(eventKey, 'customer')}>
                        <Plus className="w-3.5 h-3.5" /> Add Template
                      </Button>
                    }
                  >
                    <p className="text-xs text-muted-foreground">
                      Customise what customers receive. When templates overlap, the narrowest date range wins.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Placeholders: {TEMPLATE_PLACEHOLDERS.join(', ')}
                    </p>
                    {(block.customer_templates || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
                        No templates — default system message is used for customers.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {(block.customer_templates || []).map((t) => {
                          const active = isTemplateActive(t)
                          return (
                            <div key={t.id} className="rounded-lg border border-border px-3 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                                    <span className={cn(
                                      'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                                      active ? 'bg-emerald-500/15 text-emerald-700' : 'bg-muted text-muted-foreground',
                                    )}>
                                      {active ? 'Active now' : 'Scheduled'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3 shrink-0" />
                                    {formatScheduleRange(t.start_at, t.end_at)}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Channels: {(t.channels || []).map((c) => c.toUpperCase()).join(', ')}
                                  </p>
                                  <p className="text-xs text-foreground/80 mt-1 line-clamp-2 whitespace-pre-line">{t.message}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Preview"
                                    onClick={() => setTemplatePreview({
                                      open: true,
                                      template: t,
                                      eventLabel: evt.label,
                                      audience: 'customer',
                                    })}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTemplate(eventKey, t, 'customer')}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => requestDeleteTemplate(eventKey, t, 'customer')}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </MessageExpandableSection>
                </div>
              </CollapsibleSection>
            )
          })}

          <CollapsibleSection
            title="Vendor Notification Preferences"
            icon={UsersRound}
            subtitle={`Active: ${activeVendorChannels}`}
            helpText="Controls which channels send new order alerts to your team."
            helpKey="message center:vendor notification preferences"
            open={isSectionOpen('vendor-prefs')}
            toggle={() => toggleSection('vendor-prefs')}
          >
            <div className="space-y-3">
              {VENDOR_CHANNELS.map((ch) => {
                const delivery = ch.key === 'email' ? deliveryStatus?.email : ch.key === 'sms' ? deliveryStatus?.sms : deliveryStatus?.whatsapp
                const providerReady = !deliveryStatus
                  ? true
                  : ch.key === 'email'
                    ? deliveryStatus.email.ready
                    : Boolean(delivery?.ready)
                return (
                <div key={ch.key} className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ch.icon className={cn('w-4 h-4 shrink-0', ch.iconClass)} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{ch.label}</p>
                      <p className="text-xs text-muted-foreground">{ch.description}</p>
                      {deliveryStatus && !providerReady && delivery?.missing?.[0] && (
                        <p className="text-xs text-amber-700 mt-1">{delivery.missing[0]}</p>
                      )}
                    </div>
                  </div>
                  <Toggle
                    checked={config.vendor_channels[ch.key]}
                    onChange={(v) => setVendorChannel(ch.key, v)}
                    disabled={deliveryStatus ? !providerReady : false}
                  />
                </div>
              )})}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Customer Notification Preferences"
            icon={Users}
            subtitle={`Active: ${activeCustomerChannels}`}
            helpText="Controls which channels send order confirmation messages to customers."
            helpKey="message center:customer notification preferences"
            open={isSectionOpen('customer-prefs')}
            toggle={() => toggleSection('customer-prefs')}
          >
            <div className="space-y-3">
              {CUSTOMER_CHANNELS.map((ch) => {
                const delivery = ch.key === 'email' ? deliveryStatus?.email : ch.key === 'sms' ? deliveryStatus?.sms : deliveryStatus?.whatsapp
                const providerReady = !deliveryStatus
                  ? true
                  : ch.key === 'email'
                    ? deliveryStatus.email.ready
                    : Boolean(delivery?.ready)
                return (
                <div key={ch.key} className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ch.icon className={cn('w-4 h-4 shrink-0', ch.iconClass)} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{ch.label}</p>
                      <p className="text-xs text-muted-foreground">{ch.description}</p>
                      {deliveryStatus && !providerReady && delivery?.missing?.[0] && (
                        <p className="text-xs text-amber-700 mt-1">{delivery.missing[0]}</p>
                      )}
                    </div>
                  </div>
                  <Toggle
                    checked={config.customer_channels[ch.key]}
                    onChange={(v) => setCustomerChannel(ch.key, v)}
                    disabled={deliveryStatus ? !providerReady : false}
                  />
                </div>
              )})}
            </div>
          </CollapsibleSection>
        </>
      )}

      {(emailModal || phoneModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                {emailModal
                  ? (emailModal.editing ? 'Edit Email Recipient' : 'Add Email Recipient')
                  : (phoneModal!.editing ? 'Edit Phone Recipient' : 'Add Phone Recipient')}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">For: {activeEventLabel}</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {emailModal ? (
                <>
                  <div className="space-y-1.5">
                    <Label helpKey="message center:email recipient">Email address</Label>
                    <Input
                      type="email"
                      value={emailForm.email}
                      onChange={(e) => setEmailForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="ops@yourstore.com"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label helpKey="message center:recipient label">Label (optional)</Label>
                    <Input
                      value={emailForm.label}
                      onChange={(e) => setEmailForm((f) => ({ ...f, label: e.target.value }))}
                      placeholder="e.g. Operations team"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label helpKey="phone number">Phone number</Label>
                    <PhoneInput
                      value={phoneForm.phone}
                      onChange={(v) => setPhoneForm((f) => ({ ...f, phone: v }))}
                      defaultCountryIso="IN"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label helpKey="message center:recipient label">Label (optional)</Label>
                    <Input
                      value={phoneForm.label}
                      onChange={(e) => setPhoneForm((f) => ({ ...f, label: e.target.value }))}
                      placeholder="e.g. Store manager"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setEmailModal(null); setPhoneModal(null) }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={emailModal ? saveEmail : savePhone}>
                {(emailModal?.editing || phoneModal?.editing) ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                {deleteConfirm.type === 'template' ? 'Delete template?' : 'Delete recipient?'}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {deleteConfirm.type === 'template' ? (
                  <>Remove template <strong>{deleteConfirm.value}</strong> from <strong>{deleteConfirm.eventLabel}</strong>?</>
                ) : (
                  <>Remove this {deleteConfirm.type === 'email' ? 'email' : 'phone number'} from{' '}
                  <strong>{deleteConfirm.eventLabel}</strong>? This cannot be undone.</>
                )}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm font-medium text-foreground break-all">{deleteConfirm.value}</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {templateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                {templateModal.editing
                  ? (templateModal.audience === 'vendor' ? 'Edit Vendor Template' : 'Edit Customer Template')
                  : (templateModal.audience === 'vendor' ? 'Add Vendor Template' : 'Add Customer Template')}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">For: {activeEventLabel} · {storeLabel}</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label helpKey="message center:template name">Template name</Label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Festival greeting"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label helpKey="message center:email subject">Email subject (optional)</Label>
                <Input
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder={templateModal.audience === 'vendor'
                    ? 'New order #{order_number} — {store_name}'
                    : 'Order #{order_number} confirmed — {store_name}'}
                />
              </div>
              <div className="space-y-1.5">
                <Label helpKey="message center:message body">Message</Label>
                <Textarea
                  value={templateForm.message}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, message: e.target.value }))}
                  rows={6}
                  placeholder={templateModal.audience === 'vendor'
                    ? DEFAULT_VENDOR_TEMPLATE_MESSAGE
                    : DEFAULT_TEMPLATE_MESSAGE}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label helpKey="message center:template schedule">Start date & time</Label>
                  <Input
                    type="datetime-local"
                    value={templateForm.startLocal}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, startLocal: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label helpKey="message center:template schedule">End date & time</Label>
                  <Input
                    type="datetime-local"
                    value={templateForm.endLocal}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, endLocal: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label helpKey="message center:template channels">Channels</Label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_CHANNELS.map((ch) => (
                    <button
                      key={ch.key}
                      type="button"
                      onClick={() => toggleTemplateChannel(ch.key)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                        templateForm.channels.includes(ch.key)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Enabled</p>
                  <p className="text-xs text-muted-foreground">Disabled templates are never selected</p>
                </div>
                <Toggle
                  checked={templateForm.enabled}
                  onChange={(v) => setTemplateForm((f) => ({ ...f, enabled: v }))}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setTemplatePreview({
                  open: true,
                  template: {
                    id: 'preview',
                    name: templateForm.name || 'Preview',
                    subject: templateForm.subject,
                    message: templateForm.message,
                    start_at: fromDatetimeLocal(templateForm.startLocal) || new Date().toISOString(),
                    end_at: fromDatetimeLocal(templateForm.endLocal) || new Date().toISOString(),
                    channels: templateForm.channels,
                    enabled: templateForm.enabled,
                  },
                  eventLabel: activeEventLabel || 'Event',
                  audience: templateModal.audience,
                })}
              >
                <Eye className="w-3.5 h-3.5" /> Preview message
              </Button>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setTemplateModal(null)}>Cancel</Button>
              <Button type="button" onClick={saveTemplate}>
                {templateModal.editing ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {templatePreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Message preview</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {templatePreview.template.name} · {templatePreview.eventLabel} · {storeLabel}
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Email subject</p>
                <p className="text-sm text-foreground">
                  {applyTemplateTokens(
                    templatePreview.template.subject || (
                      templatePreview.audience === 'vendor'
                        ? 'New order #{order_number} — {store_name}'
                        : 'Order #{order_number} confirmed — {store_name}'
                    ),
                    storeLabel,
                    templatePreview.audience,
                  )}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Message body</p>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground whitespace-pre-line">
                  {applyTemplateTokens(templatePreview.template.message, storeLabel, templatePreview.audience)}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Schedule: {formatScheduleRange(templatePreview.template.start_at, templatePreview.template.end_at)}
              </p>
            </div>
            <div className="flex justify-end px-5 py-4 border-t border-border">
              <Button type="button" onClick={() => setTemplatePreview(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
