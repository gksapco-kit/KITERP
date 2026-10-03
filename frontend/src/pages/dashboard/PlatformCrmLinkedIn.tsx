import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Copy, Loader2, Linkedin } from 'lucide-react'
import { toast } from 'sonner'
import { platformCrmApi, type LinkedInSave } from '@/api/platformCrm.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const LEAD_TYPE_LABELS: Record<string, string> = {
  SPONSORED: 'Sponsored ads',
  COMPANY: 'Company page',
  EVENT: 'Events',
  ORGANIZATION_PRODUCT: 'Product page',
}

function apiError(err: unknown, fallback: string) {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  return fallback
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Copied')
  } catch {
    toast.error('Could not copy')
  }
}

export default function PlatformCrmLinkedIn() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { data, isLoading } = useQuery({
    queryKey: ['platform-crm', 'linkedin'],
    queryFn: () => platformCrmApi.linkedinStatus(),
  })

  const [form, setForm] = useState<LinkedInSave>({
    client_id: '',
    client_secret: '',
    organization_id: '',
    sponsored_account_id: '',
    lead_type: 'SPONSORED',
  })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!data || hydrated) return
    setForm({
      client_id: data.client_id || '',
      client_secret: '',
      organization_id: data.organization_id || '',
      sponsored_account_id: data.sponsored_account_id || '',
      lead_type: data.lead_type || 'SPONSORED',
    })
    setHydrated(true)
  }, [data, hydrated])

  useEffect(() => {
    if (params.get('connected') === '1') {
      toast.success('LinkedIn account connected')
      void qc.invalidateQueries({ queryKey: ['platform-crm', 'linkedin'] })
      setParams({}, { replace: true })
    } else if (params.get('error')) {
      toast.error('LinkedIn did not finish connecting. Check the app credentials and try again.')
      setParams({}, { replace: true })
    }
  }, [params, qc, setParams])

  const save = useMutation({
    mutationFn: () => platformCrmApi.saveLinkedIn(form),
    onSuccess: (next) => {
      qc.setQueryData(['platform-crm', 'linkedin'], next)
      setForm((current) => ({ ...current, client_secret: '' }))
      toast.success('LinkedIn settings saved')
    },
    onError: (err) => toast.error(apiError(err, 'Could not save LinkedIn settings')),
  })

  const connect = useMutation({
    mutationFn: () => platformCrmApi.connectLinkedIn(),
    onSuccess: (res) => {
      window.location.href = res.authorize_url
    },
    onError: (err) => toast.error(apiError(err, 'Could not start LinkedIn login')),
  })

  const subscribe = useMutation({
    mutationFn: () => platformCrmApi.subscribeLinkedIn(),
    onSuccess: (next) => {
      qc.setQueryData(['platform-crm', 'linkedin'], next)
      toast.success('LinkedIn will send new leads to this CRM')
    },
    onError: (err) => toast.error(apiError(err, 'Could not subscribe to LinkedIn leads')),
  })

  const sync = useMutation({
    mutationFn: () => platformCrmApi.syncLinkedIn(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['platform-crm', 'leads'] })
      toast.success(
        res.created
          ? `${res.created} LinkedIn lead${res.created === 1 ? '' : 's'} added`
          : 'No new LinkedIn leads in the last 30 days',
      )
    },
    onError: (err) => toast.error(apiError(err, 'Could not sync LinkedIn leads')),
  })

  const testLead = useMutation({
    mutationFn: () => platformCrmApi.createLinkedInTestLead(),
    onSuccess: (lead) => {
      void qc.invalidateQueries({ queryKey: ['platform-crm', 'leads'] })
      toast.success(`Test lead ${lead.number} added to Leads`)
    },
    onError: (err) => toast.error(apiError(err, 'Could not create a test lead')),
  })

  const disconnect = useMutation({
    mutationFn: () => platformCrmApi.disconnectLinkedIn(),
    onSuccess: (next) => {
      qc.setQueryData(['platform-crm', 'linkedin'], next)
      toast.success('LinkedIn account disconnected')
    },
    onError: (err) => toast.error(apiError(err, 'Could not disconnect LinkedIn')),
  })

  const sponsored = form.lead_type === 'SPONSORED'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">CRM Management</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Linkedin className="h-6 w-6 text-[#0A66C2]" />
          LinkedIn
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          LinkedIn Lead Gen Form submissions are added to{' '}
          <Link to="/dashboard/crm/leads" className="text-primary hover:underline">Leads</Link>{' '}
          with source LinkedIn.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          <section className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              {data?.connected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Account connected
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                  Not connected
                </span>
              )}
              {data?.subscription_id ? (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  Lead notifications on
                </span>
              ) : null}
            </div>
            {data?.last_error ? (
              <p className="mt-3 text-sm text-red-600">{data.last_error}</p>
            ) : null}
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-gray-600">
              <li>Create a LinkedIn app and request Lead Sync access for <span className="font-medium text-gray-800">r_marketing_leadgen_automation</span>.</li>
              <li>Paste the Client ID and Client Secret here, then save.</li>
              <li>Register the redirect URL below on that LinkedIn app.</li>
              <li>Connect the LinkedIn account that administers the ad account or company page.</li>
              <li>Enter the ad account or company page ID and turn on lead notifications.</li>
            </ol>
          </section>

          <section className="space-y-4 rounded-xl border bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">LinkedIn app</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="li-client-id">Client ID</Label>
                <Input
                  id="li-client-id"
                  value={form.client_id}
                  onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="li-client-secret">Client Secret</Label>
                <Input
                  id="li-client-secret"
                  type="password"
                  value={form.client_secret}
                  placeholder={data?.client_secret_set ? 'Saved — enter a new secret to replace it' : ''}
                  onChange={(e) => setForm((f) => ({ ...f, client_secret: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="li-lead-type">Lead type</Label>
                <select
                  id="li-lead-type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.lead_type}
                  onChange={(e) => setForm((f) => ({ ...f, lead_type: e.target.value }))}
                >
                  {(data?.lead_types ?? Object.keys(LEAD_TYPE_LABELS)).map((value) => (
                    <option key={value} value={value}>
                      {LEAD_TYPE_LABELS[value] || value}
                    </option>
                  ))}
                </select>
              </div>
              {sponsored ? (
                <div className="space-y-1.5">
                  <Label htmlFor="li-ad-account">Ad account ID</Label>
                  <Input
                    id="li-ad-account"
                    value={form.sponsored_account_id}
                    placeholder="Sponsored account number"
                    onChange={(e) => setForm((f) => ({ ...f, sponsored_account_id: e.target.value }))}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="li-org">Company page ID</Label>
                  <Input
                    id="li-org"
                    value={form.organization_id}
                    placeholder="Organization number"
                    onChange={(e) => setForm((f) => ({ ...f, organization_id: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!data?.client_secret_set || connect.isPending}
                onClick={() => connect.mutate()}
              >
                {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Connect LinkedIn
              </Button>
              {data?.connected ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                >
                  Disconnect
                </Button>
              ) : null}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">URLs to register</h2>
            <UrlRow label="Redirect URL" value={data?.redirect_uri || ''} />
            <UrlRow label="Webhook URL" value={data?.webhook_url || 'Save the app credentials to generate the webhook URL.'} copyable={Boolean(data?.webhook_url)} />
            {data?.webhook_url && !data.webhook_https ? (
              <p className="text-sm text-amber-700">
                LinkedIn only accepts an HTTPS webhook. Set PUBLIC_API_BASE_URL to the public API address before subscribing.
              </p>
            ) : null}
          </section>

          <section className="space-y-3 rounded-xl border bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Leads</h2>
            <p className="text-sm text-gray-600">
              New form submissions show up under Leads. Sync pulls submissions from the last 30 days. A test lead checks the list without waiting for LinkedIn.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!data?.connected || subscribe.isPending}
                onClick={() => subscribe.mutate()}
              >
                {subscribe.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Turn on lead notifications
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!data?.connected || sync.isPending}
                onClick={() => sync.mutate()}
              >
                {sync.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sync recent leads
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={testLead.isPending}
                onClick={() => testLead.mutate()}
              >
                {testLead.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create a test lead
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function UrlRow({ label, value, copyable = true }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 break-all rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800">{value || '—'}</p>
        {copyable && value ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void copyText(value)} title="Copy">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
