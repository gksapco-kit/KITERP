import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useIntegrations, useUpsertIntegration, useSetIntegrationCheckoutActive } from '@/hooks/useCrm'
import { crmApi, type Integration } from '@/api/crm'
import { Plus, Loader2, CheckCircle2, AlertTriangle, Trash2, Zap, Eye, EyeOff, Copy, MessageSquare, CreditCard, Plug2 } from 'lucide-react'
import { CrmModal, Field } from './_shared'
import { CommunicationIntegrationCard, COMMUNICATION_INTEGRATION_GRID_CLASS } from '@/components/crm/CommunicationIntegrationCard'
import type { CommunicationProviderId } from '@/components/crm/CommunicationProviderLogo'
import { PaymentProcessorCard, PAYMENT_INTEGRATION_GRID_CLASS } from '@/components/crm/PaymentProcessorCard'
import type { PaymentProviderId } from '@/components/crm/PaymentProviderLogo'
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_IDS,
  PAYMENT_SETTING_HINTS,
  PAYMENT_MODE_OPTIONS,
  normalizePaymentMode,
  razorpayKeyImpliesMode,
} from '@/components/crm/paymentProvidersCatalog'
import { Select } from '@/components/ui/select'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'

const PROVIDERS = [
  { id: 'sendgrid', label: 'SendGrid (Email)', credentials: ['api_key'], settings: ['from_email', 'from_name'] },
  { id: 'smtp',     label: 'SMTP (Email)',     credentials: ['host', 'port', 'username', 'password'], settings: ['from_email'] },
  { id: 'twilio',   label: 'Twilio (SMS / WhatsApp / Voice)', credentials: ['account_sid', 'auth_token'], settings: ['from_number', 'whatsapp_from', 'voice_caller_id'] },
  { id: 'meta_whatsapp', label: 'Meta WhatsApp Cloud API', credentials: ['access_token', 'phone_number_id'], settings: [] },
  { id: 'openai',   label: 'OpenAI (AI features)', credentials: ['api_key'], settings: ['model'] },
  { id: 'google_calendar',  label: 'Google Calendar', credentials: ['client_id', 'client_secret', 'refresh_token'], settings: ['calendar_id'] },
  { id: 'outlook_calendar', label: 'Outlook Calendar', credentials: ['client_id', 'client_secret', 'refresh_token'], settings: ['calendar_id'] },
]

const ALL_PROVIDERS = [...PROVIDERS, ...PAYMENT_PROVIDERS]

const SETTING_HINTS: Record<string, Record<string, string>> = {
  twilio: {
    from_number: 'SMS only — buy a Twilio phone number with SMS enabled (NOT +14155238886 WhatsApp sandbox)',
    whatsapp_from: 'WhatsApp only — Twilio sandbox: +14155238886. Cannot be used for SMS.',
    voice_caller_id: 'Optional caller ID for voice calls',
  },
  ...PAYMENT_SETTING_HINTS,
}

const TESTABLE = new Set(['sendgrid', 'smtp', 'twilio', 'razorpay', 'stripe', 'square', 'paypal', 'payu'])
const DELETE_CONFIRM_PHRASE = 'DELETE'

function isCheckoutActive(integration: Integration): boolean {
  return integration.settings?.checkout_active === true
}

function isSecretField(key: string) {
  const k = key.toLowerCase()
  if (['key_id', 'publishable_key', 'merchant_key', 'application_id', 'client_id', 'webhook_id'].includes(k)) {
    return false
  }
  return k.includes('password') || k.includes('token') || k.includes('secret') || k.includes('key')
}

function settingsToForm(settings: Record<string, unknown> | undefined): Record<string, string> {
  if (!settings) return {}
  return Object.fromEntries(
    Object.entries(settings).map(([k, v]) => {
      if (k === 'checkout_active') return [k, v === true || v === 'true' ? 'true' : '']
      if (k === 'mode') return [k, normalizePaymentMode(v == null ? '' : String(v))]
      return [k, v == null ? '' : String(v)]
    }),
  )
}

function CredentialInput({
  fieldKey,
  providerId,
  secret,
  value,
  placeholder,
  onChange,
}: {
  fieldKey: string
  providerId: string
  secret: boolean
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Input
        type={secret && !show ? 'password' : 'text'}
        autoComplete={secret ? 'new-password' : 'off'}
        name={`kiterp-${providerId}-${fieldKey}`}
        data-1p-ignore="true"
        data-lpignore="true"
        value={value}
        placeholder={placeholder}
        className={secret ? 'pr-10' : undefined}
        onChange={e => onChange(e.target.value)}
      />
      {secret && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={show ? 'Hide value' : 'Show value'}
          onClick={() => setShow(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  )
}

function IntegrationForm({
  providerId,
  existing,
  onClose,
}: {
  providerId: string
  existing?: Integration
  onClose: () => void
}) {
  const provider = ALL_PROVIDERS.find(p => p.id === providerId)!
  const upsert = useUpsertIntegration()
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Record<string, string>>(() =>
    settingsToForm(existing?.settings),
  )
  const [label, setLabel] = useState(existing?.label || provider.label)
  const [testEmail, setTestEmail] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState(false)
  const [testOk, setTestOk] = useState(false)
  const [loadingDefaults, setLoadingDefaults] = useState(true)
  const [envKeySource, setEnvKeySource] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  const [webhookEvents, setWebhookEvents] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    setLoadingDefaults(true)

    const load = async () => {
      try {
        if (existing?.id) {
          const form = await crmApi.getIntegrationForm(existing.id)
          if (cancelled) return
          setLabel(form.label || provider.label)
          setSettings(settingsToForm(form.settings))
          setCreds(form.credentials || {})
          if (form.webhook_url) setWebhookUrl(form.webhook_url)
          return
        }

        const defaults = await crmApi.getIntegrationDefaults(provider.id)
        if (cancelled) return
        if (defaults.key_source) setEnvKeySource(defaults.key_source)
        if (defaults.webhook_url) setWebhookUrl(defaults.webhook_url)
        if (defaults.webhook_events) setWebhookEvents(defaults.webhook_events)
        if (defaults.credentials && Object.keys(defaults.credentials).length > 0) {
          setCreds(defaults.credentials)
        }
        if (defaults.settings && Object.keys(defaults.settings).length > 0) {
          setSettings(prev => ({ ...defaults.settings, ...prev }))
        }
      } catch {
        if (!cancelled && existing?.settings) {
          setSettings(settingsToForm(existing.settings))
        }
      } finally {
        if (!cancelled) setLoadingDefaults(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [existing, provider.id, provider.label])

  const markDirty = () => setTestOk(false)

  const credentialsForApi = (): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(creds)) {
      const trimmed = (value || '').trim()
      if (!trimmed) continue
      out[key] = trimmed
    }
    return out
  }

  const reloadFromEnv = async () => {
    try {
      const defaults = await crmApi.getIntegrationDefaults(provider.id)
      if (defaults.credentials) setCreds(defaults.credentials)
      if (defaults.settings) setSettings(prev => ({ ...prev, ...defaults.settings }))
      if (defaults.key_source) setEnvKeySource(defaults.key_source)
      setTestOk(false)
      toast.success('Loaded credentials from backend/.env')
    } catch {
      toast.error('Could not load .env defaults — check backend/.env and restart the API')
    }
  }

  const runTest = async () => {
    setTesting(true)
    try {
      const result = await crmApi.testIntegration({
        provider: provider.id,
        credentials: credentialsForApi(),
        settings: {
          ...settings,
          ...(provider.settings.includes('mode')
            ? { mode: normalizePaymentMode(settings.mode) }
            : {}),
        },
        test_email: testEmail || undefined,
        test_phone: testPhone || undefined,
        integration_id: existing?.id,
      })
      setTestOk(true)
      toast.success(result.message || 'Connection verified')
    } catch (err) {
      setTestOk(false)
      toast.error(extractApiError(err, 'Connection test failed'))
    } finally {
      setTesting(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const payloadSettings: Record<string, string> = { ...settings }
    if (provider.settings.includes('mode')) {
      payloadSettings.mode = normalizePaymentMode(settings.mode)
    }
    upsert.mutate(
      { provider: provider.id, label, credentials: credentialsForApi(), settings: payloadSettings },
      {
        onSuccess: () => {
          toast.success(existing ? 'Integration updated' : 'Integration connected')
          onClose()
        },
        onError: err => toast.error(extractApiError(err, 'Could not save integration')),
      },
    )
  }

  const showEmailTest = provider.id === 'sendgrid' || provider.id === 'smtp'
  const showPhoneTest = provider.id === 'twilio'

  return (
    <CrmModal title={`Connect ${provider.label}`} onClose={onClose}>
      {loadingDefaults ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
      <form onSubmit={submit} className="space-y-3" autoComplete="off">
        <Field label="Label">
          <Input value={label} onChange={e => { setLabel(e.target.value); markDirty() }} />
        </Field>
        {provider.credentials.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-gray-500">Credentials (encrypted at rest)</p>
            {!existing && envKeySource && (provider.id === 'smtp' || provider.id === 'sendgrid') && (
              <p className="text-xs text-blue-600">
                Pre-filled from backend/.env ({envKeySource}). Restart the API after changing .env.
              </p>
            )}
            {(provider.id === 'smtp' || provider.id === 'sendgrid') && (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={reloadFromEnv}>
                Reload from backend/.env
              </Button>
            )}
            {provider.credentials.map(k => (
              <Field key={k} label={k}>
                <CredentialInput
                  fieldKey={k}
                  providerId={provider.id}
                  secret={isSecretField(k)}
                  value={creds[k] || ''}
                  placeholder={
                    provider.id === 'smtp' && k === 'host'
                      ? 'smtp.sendgrid.net'
                      : provider.id === 'smtp' && k === 'username'
                        ? 'apikey'
                        : undefined
                  }
                  onChange={value => {
                    setCreds(p => ({ ...p, [k]: value }))
                    if (provider.id === 'razorpay' && k === 'key_id') {
                      const implied = razorpayKeyImpliesMode(value)
                      if (implied) {
                        setSettings(p => ({ ...p, mode: implied }))
                      }
                    }
                    markDirty()
                  }}
                />
              </Field>
            ))}
          </div>
        )}
        {provider.settings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-gray-500">Settings</p>
            {provider.settings.map(k => (
              <Field key={k} label={k === 'mode' ? 'Mode' : k}>
                {k === 'mode' ? (
                  <Select
                    value={normalizePaymentMode(settings.mode)}
                    onChange={value => {
                      setSettings(p => ({ ...p, mode: value }))
                      markDirty()
                    }}
                    options={[...PAYMENT_MODE_OPTIONS]}
                  />
                ) : (
                  <Input
                    value={settings[k] || ''}
                    onChange={e => { setSettings(p => ({ ...p, [k]: e.target.value })); markDirty() }}
                  />
                )}
                {SETTING_HINTS[provider.id]?.[k] && (
                  <p className="text-xs text-muted-foreground mt-1">{SETTING_HINTS[provider.id][k]}</p>
                )}
              </Field>
            ))}
            {provider.id === 'razorpay' && (() => {
              const implied = razorpayKeyImpliesMode(creds.key_id || '')
              const selected = normalizePaymentMode(settings.mode)
              if (!implied || implied === selected) return null
              return (
                <p className="text-xs text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  {implied === 'sandbox'
                    ? 'This Key ID is a test key (rzp_test_). Switch Mode to Sandbox, or paste a live Key ID (rzp_live_) for Live.'
                    : 'This Key ID is a live key (rzp_live_). Switch Mode to Live, or paste a test Key ID (rzp_test_) for Sandbox.'}
                </p>
              )
            })()}
          </div>
        )}

        {provider.id === 'razorpay' && (
          <div className="space-y-1 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-amber-900">UPI not showing at checkout?</p>
            <p>
              UPI is controlled by your Razorpay merchant account, not KIT ERP. In Razorpay Dashboard go to
              {' '}<strong>Account &amp; Settings → Payment Configuration</strong>, ensure UPI (QR / apps / collect) is
              visible, complete KYC if needed, then save. If UPI is enabled but still missing, raise a support ticket
              with Razorpay — they must provision UPI for your Merchant ID.
            </p>
          </div>
        )}

        {PAYMENT_PROVIDER_IDS.has(provider.id) && webhookUrl && (
          <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <p className="text-xs font-medium uppercase text-gray-500">Webhook URL</p>
            <p className="text-xs text-muted-foreground">
              Register this URL in your {provider.label} dashboard. Events: payment success / capture.
            </p>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="text-xs font-mono" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                title="Copy webhook URL"
                onClick={() => {
                  void navigator.clipboard.writeText(webhookUrl)
                  toast.success('Webhook URL copied')
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            {webhookEvents.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Suggested events: {webhookEvents.join(', ')}
              </p>
            )}
          </div>
        )}

        {TESTABLE.has(provider.id) && (
          <div className="space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-3">
            <p className="text-xs font-medium uppercase text-gray-500">Test connection</p>
            {showEmailTest && (
              <Field label="Send test email to">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                />
              </Field>
            )}
            {showPhoneTest && (
              <Field label="Send test SMS to (E.164)">
                <PhoneInput
                  value={testPhone}
                  onChange={setTestPhone}
                  defaultCountryIso="IN"
                  compact
                  compactCountry
                  subtleFeedback
                  autoComplete="tel"
                  name="phone"
                />
              </Field>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={testing}
              onClick={runTest}
            >
              {testing
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <Zap className="w-4 h-4 mr-2" />}
              Test connection
            </Button>
            {testOk && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connection verified — you can save now.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={upsert.isPending}>
            {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </form>
      )}
    </CrmModal>
  )
}

function DeleteIntegrationModal({
  integration,
  providerLabel,
  onClose,
  onDeleted,
}: {
  integration: Integration
  providerLabel: string
  onClose: () => void
  onDeleted: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const canDelete = confirmText.trim().toUpperCase() === DELETE_CONFIRM_PHRASE && !deleting

  const handleDelete = async () => {
    if (!canDelete) return
    setDeleting(true)
    try {
      await crmApi.deleteIntegration(integration.id)
      toast.success('Integration disconnected')
      onDeleted()
      onClose()
    } catch (err) {
      toast.error(extractApiError(err, 'Could not disconnect integration'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <CrmModal title="Disconnect integration?" onClose={onClose} maxW="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/30">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-foreground">
              You are about to remove <strong>{integration.label || providerLabel}</strong>.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Saved credentials will be deleted.{' '}
              {PAYMENT_PROVIDER_IDS.has(integration.provider)
                ? 'Checkout will no longer offer this payment method until you connect again.'
                : 'Email, SMS, and WhatsApp may stop working until you connect again.'}
            </p>
          </div>
        </div>

        <Field label={`Type ${DELETE_CONFIRM_PHRASE} to confirm`}>
          <Input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder={DELETE_CONFIRM_PHRASE}
            autoComplete="off"
            autoFocus
            className="font-mono text-sm"
          />
        </Field>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            disabled={!canDelete}
            onClick={handleDelete}
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Delete
          </Button>
        </div>
      </div>
    </CrmModal>
  )
}

export default function IntegrationsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useIntegrations()
  const setCheckoutActive = useSetIntegrationCheckoutActive()
  const [adding, setAdding] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ integration: Integration; providerLabel: string } | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const connectedById: Record<string, Integration> = {}
  data?.forEach(i => {
    connectedById[i.provider] = i
  })

  const connectedPayments = (data ?? []).filter(
    i => PAYMENT_PROVIDER_IDS.has(i.provider) && i.status === 'connected',
  )
  const activePayment = connectedPayments.find(isCheckoutActive)

  const handleCheckoutToggle = (integration: Integration, next: boolean) => {
    setTogglingId(integration.id)
    setCheckoutActive.mutate(
      { id: integration.id, checkout_active: next },
      {
        onSuccess: () => {
          toast.success(
            next
              ? `${integration.label || integration.provider} is live on checkout`
              : `${integration.label || integration.provider} deactivated on checkout`,
          )
        },
        onError: err => toast.error(extractApiError(err, 'Could not update checkout activation')),
        onSettled: () => setTogglingId(null),
      },
    )
  }

  const renderCommunicationGrid = () => (
    <div className={COMMUNICATION_INTEGRATION_GRID_CLASS}>
      {PROVIDERS.map(p => {
        const conn = connectedById[p.id]
        return (
          <CommunicationIntegrationCard
            key={p.id}
            providerId={p.id as CommunicationProviderId}
            label={p.label}
            conn={conn}
            onConnect={() => setAdding(p.id)}
            onDelete={() => conn && setDeleteTarget({ integration: conn, providerLabel: p.label })}
          />
        )
      })}
    </div>
  )

  const renderPaymentProviderGrid = () => (
    <div className={PAYMENT_INTEGRATION_GRID_CLASS}>
      {PAYMENT_PROVIDERS.map(p => {
        const conn = connectedById[p.id]
        const isConnected = conn?.status === 'connected'
        const isLive = Boolean(conn && isCheckoutActive(conn))
        const otherIsLive = Boolean(activePayment && activePayment.id !== conn?.id)
        const activateBlocked = otherIsLive && !isLive
        const busy = togglingId === conn?.id || setCheckoutActive.isPending

        return (
          <PaymentProcessorCard
            key={p.id}
            providerId={p.id as PaymentProviderId}
            label={p.label}
            conn={conn}
            isConnected={isConnected}
            isLive={isLive}
            activateBlocked={activateBlocked}
            activeProviderLabel={activePayment?.label || activePayment?.provider || null}
            busy={busy}
            onConnect={() => setAdding(p.id)}
            onActivate={() => conn && handleCheckoutToggle(conn, true)}
            onDeactivate={() => conn && handleCheckoutToggle(conn, false)}
            onDelete={() => conn && setDeleteTarget({ integration: conn, providerLabel: p.label })}
          />
        )
      })}
    </div>
  )

  const connectedCount = (data ?? []).filter(i => i.status === 'connected').length
  const commConnected = PROVIDERS.filter(p => connectedById[p.id]?.status === 'connected').length
  const paymentConnected = PAYMENT_PROVIDERS.filter(p => connectedById[p.id]?.status === 'connected').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-gradient-to-r from-muted/30 via-background to-background px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10">
            <Plug2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              System · Integrations
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Connect your providers</h1>
            <p className="text-xs text-muted-foreground">
              Email, SMS, WhatsApp, AI, calendars, CRM, and checkout payments in one place.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="soft" className="rounded-full px-2.5 py-0.5 text-[11px]">
            {connectedCount} connected
          </Badge>
          {activePayment && (
            <Badge variant="success" className="rounded-full px-2.5 py-0.5 text-[11px]">
              Live: {activePayment.label || activePayment.provider}
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
                <MessageSquare className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Communication &amp; CRM</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {commConnected}/{PROVIDERS.length} connected
              </span>
            </div>
            {renderCommunicationGrid()}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600">
                <CreditCard className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Payment Processors</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {paymentConnected}/{PAYMENT_PROVIDERS.length} connected
              </span>
            </div>
            {renderPaymentProviderGrid()}
          </section>
        </div>
      )}

      {adding && (
        <IntegrationForm
          providerId={adding}
          existing={connectedById[adding]}
          onClose={() => setAdding(null)}
        />
      )}

      {deleteTarget && (
        <DeleteIntegrationModal
          integration={deleteTarget.integration}
          providerLabel={deleteTarget.providerLabel}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => qc.invalidateQueries({ queryKey: ['crm', 'integrations'] })}
        />
      )}
    </div>
  )
}
