import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useIntegrations, useUpsertIntegration } from '@/hooks/useCrm'
import { crmApi, type Integration } from '@/api/crm'
import { Plus, Loader2, Plug, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react'
import { CrmModal, Field } from './_shared'
import { useQueryClient } from '@tanstack/react-query'

const PROVIDERS = [
  { id: 'sendgrid', label: 'SendGrid (Email)', credentials: ['api_key'], settings: ['from_email', 'from_name'] },
  { id: 'smtp',     label: 'SMTP (Email)',     credentials: ['host', 'port', 'username', 'password'], settings: ['from_email'] },
  { id: 'twilio',   label: 'Twilio (SMS / WhatsApp / Voice)', credentials: ['account_sid', 'auth_token'], settings: ['from_number', 'whatsapp_from', 'voice_caller_id'] },
  { id: 'meta_whatsapp', label: 'Meta WhatsApp Cloud API', credentials: ['access_token', 'phone_number_id'], settings: [] },
  { id: 'openai',   label: 'OpenAI (AI features)', credentials: ['api_key'], settings: ['model'] },
  { id: 'google_calendar',  label: 'Google Calendar', credentials: ['client_id', 'client_secret', 'refresh_token'], settings: ['calendar_id'] },
  { id: 'outlook_calendar', label: 'Outlook Calendar', credentials: ['client_id', 'client_secret', 'refresh_token'], settings: ['calendar_id'] },
]

function IntegrationForm({ providerId, onClose }: { providerId: string; onClose: () => void }) {
  const provider = PROVIDERS.find(p => p.id === providerId)!
  const upsert = useUpsertIntegration()
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [label, setLabel] = useState(provider.label)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    upsert.mutate(
      { provider: provider.id, label, credentials: creds, settings },
      { onSuccess: onClose },
    )
  }

  return (
    <CrmModal title={`Connect ${provider.label}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Label"><Input value={label} onChange={e => setLabel(e.target.value)} /></Field>
        {provider.credentials.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-gray-500">Credentials (encrypted at rest)</p>
            {provider.credentials.map(k => (
              <Field key={k} label={k}>
                <Input type={k.includes('password') || k.includes('token') || k.includes('secret') || k.includes('key') ? 'password' : 'text'}
                  value={creds[k] || ''} onChange={e => setCreds(p => ({ ...p, [k]: e.target.value }))} />
              </Field>
            ))}
          </div>
        )}
        {provider.settings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-gray-500">Settings</p>
            {provider.settings.map(k => (
              <Field key={k} label={k}>
                <Input value={settings[k] || ''} onChange={e => setSettings(p => ({ ...p, [k]: e.target.value }))} />
              </Field>
            ))}
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
    </CrmModal>
  )
}

export default function IntegrationsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useIntegrations()
  const [adding, setAdding] = useState<string | null>(null)

  const remove = async (id: string) => {
    if (!confirm('Disconnect this integration?')) return
    await crmApi.deleteIntegration(id)
    qc.invalidateQueries({ queryKey: ['crm', 'integrations'] })
  }

  const connectedById: Record<string, Integration> = {}
  data?.forEach(i => {
    connectedById[i.provider] = i
  })

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">Connect external providers to send emails, SMS, WhatsApp, run AI, sync calendars and more.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDERS.map(p => {
            const conn = connectedById[p.id]
            return (
              <Card key={p.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Plug className="w-5 h-5 text-blue-500 shrink-0" />
                      <h3 className="text-sm font-semibold truncate">{p.label}</h3>
                    </div>
                    {conn ? (
                      <Badge variant={conn.status === 'connected' ? 'success' : 'warning'}>
                        {conn.status === 'connected' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {conn.status}
                      </Badge>
                    ) : <Badge variant="secondary">not connected</Badge>}
                  </div>
                  {conn?.last_error && <p className="text-xs text-red-500 mt-1 line-clamp-2">{conn.last_error}</p>}
                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    <Button variant={conn ? 'outline' : 'default'} size="sm" onClick={() => setAdding(p.id)}>
                      {conn ? 'Reconfigure' : 'Connect'}
                    </Button>
                    {conn && (
                      <Button variant="ghost" size="sm" onClick={() => remove(conn.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {adding && <IntegrationForm providerId={adding} onClose={() => setAdding(null)} />}
    </div>
  )
}
