import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useCampaigns, useSaveCampaign, useEmailTemplates, useSegments, useCampaignAudience, useTestTemplate } from '@/hooks/useCrm'
import { useMessageDeliveryStatus } from '@/hooks/useVendor'
import { crmApi, type Campaign, type CampaignStep, type EmailTemplate, type Contact } from '@/api/crm'
import { Plus, Loader2, Megaphone, Play, Pause, Send, MousePointerClick, AlertCircle, Edit3, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { CrmModal, Field, Pager, LoadingRow, EmptyRow } from './_shared'
import { formatDateTime } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import { isValidPhoneE164, normalizePhoneE164 } from '@/lib/phoneE164'
import { inputCls } from './crmContactsShared'
import { CampaignStepsBuilder, type CampaignDripStep } from './crmMarketingForms'
import { CrmDateTimeField } from './crmExtras'
import CampaignTemplatesPanel from './CampaignTemplatesPanel'

function stepsToDrip(steps?: CampaignStep[]): CampaignDripStep[] {
  if (!steps?.length) return []
  return steps.map(s => ({
    delay_minutes: s.delay_minutes ?? 0,
    channel: s.channel || 'email',
    template_id: s.template_id || '',
  }))
}

function contactLabel(c: Contact, channel: string): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Contact'
  const isPhoneChannel = channel === 'sms' || channel === 'whatsapp'
  if (isPhoneChannel) {
    const phone = (c.mobile || c.phone || '').trim()
    if (phone) return `${name} · ${phone}`
  } else {
    const email = (c.email || '').trim()
    if (email) return `${name} · ${email}`
  }
  return name
}

function channelTemplateLabel(channel: string) {
  if (channel === 'whatsapp') return 'WhatsApp template'
  if (channel === 'sms') return 'SMS template'
  return 'Email template'
}

const AUDIENCE_PREVIEW_LIMIT = 25
const AUDIENCE_COLLAPSE_THRESHOLD = 15

function channelDeliveryLabel(channel: string) {
  if (channel === 'whatsapp') return 'WhatsApp'
  if (channel === 'sms') return 'SMS'
  return 'email'
}

function AudienceContactPreview({
  contacts,
  total,
  channel,
}: {
  contacts: Contact[]
  total: number
  channel: string
}) {
  const [expanded, setExpanded] = useState(total <= AUDIENCE_COLLAPSE_THRESHOLD)
  const [search, setSearch] = useState('')
  const deliveryLabel = channelDeliveryLabel(channel)
  const hiddenCount = Math.max(0, total - contacts.length)
  const query = search.trim().toLowerCase()
  const filtered = query
    ? contacts.filter(c => contactLabel(c, channel).toLowerCase().includes(query))
    : contacts

  if (total === 0) return null

  return (
    <div className="mt-2 border-t pt-2 space-y-2">
      {total > AUDIENCE_COLLAPSE_THRESHOLD && (
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md px-1 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50/60"
          onClick={() => setExpanded(v => !v)}
        >
          <span>
            {expanded ? 'Hide contact preview' : `Show contact preview (${contacts.length} of ${total})`}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        </button>
      )}

      {expanded && (
        <>
          {contacts.length >= 8 && (
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search in preview…"
              className="h-8 text-xs bg-white"
            />
          )}
          <ul
            className="max-h-48 overflow-y-auto rounded-md border border-gray-100 bg-white/90 divide-y divide-gray-50"
            role="list"
          >
            {filtered.length === 0 ? (
              <li className="px-2.5 py-3 text-xs text-gray-500 text-center">No matches in preview</li>
            ) : (
              filtered.map(c => (
                <li key={c.id} className="truncate px-2.5 py-1.5 text-xs text-gray-600">
                  {contactLabel(c, channel)}
                </li>
              ))
            )}
          </ul>
        </>
      )}

      {hiddenCount > 0 && (
        <p className="text-xs text-gray-500">
          Showing {contacts.length} of <span className="font-medium text-gray-700">{total}</span> contacts.
          {' '}All {total} will receive this {deliveryLabel}.
        </p>
      )}
    </div>
  )
}

function readCampaignScheduleEnd(campaign?: Campaign): string {
  const raw = campaign?.settings?.schedule_end
  return typeof raw === 'string' ? raw.slice(0, 16) : ''
}

function CampaignForm({
  campaign, template, onClose,
}: {
  campaign?: Campaign
  template?: EmailTemplate
  onClose: () => void
}) {
  const qc = useQueryClient()
  const save = useSaveCampaign()
  const testTemplate = useTestTemplate()
  const { data: templates } = useEmailTemplates()
  const { data: segments } = useSegments()

  const [form, setForm] = useState({
    name: campaign?.name || (template ? `${template.name} campaign` : ''),
    type: campaign?.type || 'broadcast',
    channel: campaign?.channel || template?.channel || 'email',
    template_id: campaign?.template_id || template?.id || '',
    segment_id: campaign?.segment_id || '',
    scheduled_at: campaign?.scheduled_at?.slice(0, 16) || '',
    schedule_end: readCampaignScheduleEnd(campaign),
    dripSteps: stepsToDrip(campaign?.steps),
  })
  const [testRecipient, setTestRecipient] = useState('')

  const channelTemplates = (templates ?? []).filter(t => (t.channel || 'email') === form.channel)
  const tplList = channelTemplates.length > 0
    ? channelTemplates.map(t => ({ id: t.id, name: t.name }))
    : (templates ?? []).map(t => ({ id: t.id, name: t.name }))

  const { data: audience, isLoading: audienceLoading } = useCampaignAudience(
    form.channel,
    form.segment_id || undefined,
    true,
    AUDIENCE_PREVIEW_LIMIT,
  )
  const { data: deliveryStatus } = useMessageDeliveryStatus()

  const channelDelivery = form.channel === 'whatsapp'
    ? deliveryStatus?.whatsapp
    : form.channel === 'sms'
      ? deliveryStatus?.sms
      : deliveryStatus?.email
  const channelReady = !deliveryStatus || channelDelivery?.ready !== false

  const allContactsLabel = audienceLoading
    ? 'All customer contacts…'
    : `All customer contacts (${audience?.total ?? 0})`

  const isPhoneChannel = form.channel === 'whatsapp' || form.channel === 'sms'
  const testTemplateId = form.type === 'drip'
    ? form.dripSteps.find(s => s.template_id)?.template_id
    : form.template_id

  const sendTest = async () => {
    if (!testTemplateId) {
      toast.error('Select a template first')
      return
    }
    const recipient = testRecipient.trim()
    if (!recipient) {
      toast.error(isPhoneChannel ? 'Enter a phone number for the test' : 'Enter an email for the test')
      return
    }
    if (isPhoneChannel) {
      const phone = normalizePhoneE164(recipient)
      if (!isValidPhoneE164(phone)) {
        toast.error('Enter a valid mobile number with country code (e.g. +91 96525 02965)')
        return
      }
    }
    try {
      const result = await testTemplate.mutateAsync({
        id: testTemplateId,
        data: isPhoneChannel
          ? { channel: form.channel, test_phone: normalizePhoneE164(recipient) }
          : { channel: form.channel, test_email: recipient },
      })
      toast.success(result.message || 'Test sent')
    } catch (err) {
      toast.error(extractApiError(err, 'Could not send test'))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Campaign name is required')
      return
    }
    if (form.scheduled_at && form.schedule_end && new Date(form.schedule_end) <= new Date(form.scheduled_at)) {
      toast.error('Campaign end date must be after start date')
      return
    }
    const steps = form.type === 'drip'
      ? form.dripSteps
          .filter(s => s.template_id)
          .map((s, i) => ({
            sort_order: i,
            delay_minutes: s.delay_minutes,
            channel: s.channel,
            template_id: s.template_id,
          }))
      : undefined

    try {
      await save.mutateAsync({
        id: campaign?.id,
        data: {
          name: form.name.trim(),
          type: form.type,
          channel: form.channel,
          template_id: form.template_id || undefined,
          segment_id: form.segment_id || undefined,
          scheduled_at: form.scheduled_at || undefined,
          settings: form.schedule_end ? { schedule_end: form.schedule_end } : undefined,
          steps,
        },
      })
      await qc.invalidateQueries({ queryKey: ['crm', 'campaigns'] })
      toast.success(campaign ? 'Campaign updated' : 'Campaign saved')
      onClose()
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save campaign'))
    }
  }

  return (
    <CrmModal title={campaign ? 'Edit campaign' : template ? 'New campaign from template' : 'New campaign'} onClose={onClose} maxW="max-w-2xl">
      <form onSubmit={submit} className="space-y-3">
        {template && (
          <div className="rounded-lg border bg-emerald-50/50 px-3 py-2 text-sm text-emerald-800">
            Using template: <span className="font-medium">{template.name}</span>
          </div>
        )}
        <Field label="Campaign name" required>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. June newsletter" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select
              value={form.type}
              onChange={v => setForm(p => ({ ...p, type: v }))}
              options={[
                { value: 'broadcast', label: 'Broadcast (one-shot)' },
                { value: 'drip', label: 'Drip sequence' },
                { value: 'trigger', label: 'Trigger-based' },
              ]}
            />
          </Field>
          <Field label="Channel">
            <Select
              value={form.channel}
              onChange={v => {
                setTestRecipient('')
                setForm(p => ({ ...p, channel: v, template_id: '' }))
              }}
              options={[
                { value: 'email', label: 'Email' },
                { value: 'sms', label: 'SMS' },
                { value: 'whatsapp', label: 'WhatsApp' },
              ]}
            />
          </Field>
        </div>
        {form.type !== 'drip' && (
          <Field label={channelTemplateLabel(form.channel)}>
            <Select
              value={form.template_id}
              onChange={v => setForm(p => ({ ...p, template_id: v }))}
              placeholder="— Select template —"
              options={selectOptionsWithBlank(
                '— Select template —',
                tplList.map(t => ({ value: t.id, label: t.name })),
              )}
            />
          </Field>
        )}
        {form.type === 'drip' && (
          <Field label="Sequence">
            <CampaignStepsBuilder
              steps={form.dripSteps}
              onChange={dripSteps => setForm(p => ({ ...p, dripSteps }))}
              templates={tplList}
            />
          </Field>
        )}
        <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Test before creating campaign
          </p>
          <Field label={isPhoneChannel ? 'Your phone number' : 'Your email address'}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              {isPhoneChannel ? (
                <div className="min-w-0 flex-1">
                  <PhoneInput
                    value={testRecipient}
                    onChange={setTestRecipient}
                    defaultCountryIso="IN"
                    inferCountryFromLocation
                    compact
                    compactCountry
                    placeholder="96525 02965"
                    disabled={!testTemplateId || !channelReady}
                    className="bg-white"
                  />
                </div>
              ) : (
                <Input
                  type="email"
                  value={testRecipient}
                  onChange={e => setTestRecipient(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 bg-white"
                  disabled={!testTemplateId || !channelReady}
                />
              )}
              <Button
                type="button"
                variant="outline"
                className="shrink-0 bg-white sm:mt-0"
                disabled={testTemplate.isPending || !testTemplateId || !testRecipient.trim() || !channelReady}
                onClick={sendTest}
              >
                {testTemplate.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
                <span className="ml-2">Send test</span>
              </Button>
            </div>
          </Field>
          {!testTemplateId ? (
            <p className="text-xs text-amber-700">
              {form.type === 'drip'
                ? 'Add at least one step with a template in the sequence above.'
                : `Select a ${channelTemplateLabel(form.channel).toLowerCase()} above to send a sample.`}
            </p>
          ) : !channelReady && channelDelivery?.missing?.[0] ? (
            <p className="text-xs text-amber-700 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {channelDelivery.missing[0]}{' '}
                <Link to="/crm/integrations" className="font-medium underline underline-offset-2">
                  Open Integrations
                </Link>
              </span>
            </p>
          ) : (
            <p className="text-[11px] text-gray-500">
              Sends one sample {form.channel === 'whatsapp' ? 'WhatsApp' : form.channel === 'sms' ? 'SMS' : 'email'} with demo merge tags (e.g. Priya). No campaign is created until you click Create campaign.
              {form.channel === 'whatsapp' && (
                <> {' '}Twilio sandbox: set <span className="font-medium">whatsapp_from</span> to +14155238886 in Integrations, then message +1 415 523 8886 on WhatsApp with your join code.</>
              )}
              {form.channel === 'sms' && (
                <> {' '}Trial Twilio: verify +91 numbers in Twilio Console. SMS is not WhatsApp — check your text message inbox.</>
              )}
              {form.channel === 'email' && (
                <> {' '}Check spam if you don’t see the email. Sandbox SMTP (e.g. Mailtrap) only delivers to its test inbox.</>
              )}
            </p>
          )}
        </div>
        <Field label="Audience">
          <Select
            value={form.segment_id}
            onChange={v => setForm(p => ({ ...p, segment_id: v }))}
            placeholder={allContactsLabel}
            options={selectOptionsWithBlank(
              allContactsLabel,
              (segments ?? []).map(s => ({ value: s.id, label: `${s.name} (${s.contact_count})` })),
            )}
          />
          <div className="mt-2 rounded-lg border bg-gray-50/80 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Users className="w-4 h-4 text-emerald-600 shrink-0" />
              {audienceLoading ? (
                <span className="text-gray-500">Loading contacts…</span>
              ) : (
                <span>
                  <span className="font-semibold">{audience?.total ?? 0}</span>
                  {' '}customer contact{(audience?.total ?? 0) === 1 ? '' : 's'} will receive this{' '}
                  {form.channel === 'whatsapp' ? 'WhatsApp' : form.channel === 'sms' ? 'SMS' : 'email'}
                  {form.segment_id ? '' : ' (all eligible contacts)'}
                </span>
              )}
            </div>
            {!audienceLoading && (audience?.contacts?.length ?? 0) > 0 && (
              <AudienceContactPreview
                key={`${form.channel}-${form.segment_id}-${audience?.total ?? 0}`}
                contacts={audience!.contacts}
                total={audience?.total ?? 0}
                channel={form.channel}
              />
            )}
            {!audienceLoading && (audience?.total ?? 0) === 0 && (
              <p className="mt-2 text-xs text-amber-700 border-t pt-2">
                No contacts with a valid {form.channel === 'email' ? 'email address' : 'phone number'} found.
                Add customers in Master Data with a {form.channel === 'email' ? 'email' : 'phone number'}, or add contacts in CRM.
              </p>
            )}
          </div>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Campaign start (optional)">
            <CrmDateTimeField
              value={form.scheduled_at}
              onChange={v => setForm(p => ({ ...p, scheduled_at: v }))}
              showPresets={false}
            />
          </Field>
          <Field label="Campaign end (optional)">
            <CrmDateTimeField
              value={form.schedule_end}
              onChange={v => setForm(p => ({ ...p, schedule_end: v }))}
              showPresets={false}
            />
          </Field>
        </div>
        <p className="text-[11px] text-gray-400 -mt-1">Set when this campaign should run. Leave blank to send manually when you start it.</p>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {campaign ? 'Save changes' : 'Create campaign'}
          </Button>
        </div>
      </form>
    </CrmModal>
  )
}

export default function CampaignsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showCreate, setShowCreate] = useState(false)
  const [edit, setEdit] = useState<Campaign | null>(null)
  const [fromTemplate, setFromTemplate] = useState<EmailTemplate | null>(null)
  const { data, isLoading } = useCampaigns({ page, size: pageSize })

  const start = async (id: string) => {
    try {
      const result = await crmApi.startCampaign(id) as Campaign & {
        dispatch_sent?: number
        dispatch_failed?: number
        dispatch_enrolled?: number
        dispatch_message?: string
      }
      const sent = result.dispatch_sent ?? 0
      const failed = result.dispatch_failed ?? 0
      const enrolled = result.dispatch_enrolled ?? 0
      if (sent > 0) {
        toast.success(`Campaign sent to ${sent} contact${sent === 1 ? '' : 's'}${failed > 0 ? ` (${failed} failed)` : ''}.`)
      } else if (result.dispatch_message) {
        toast.error(result.dispatch_message)
      } else if (enrolled === 0) {
        toast.error('No eligible contacts to send to. Add customers with email in Master Data.')
      } else {
        toast.error('Campaign started but no messages were sent. Check CRM → Integrations (email setup).')
      }
      qc.invalidateQueries({ queryKey: ['crm', 'campaigns'] })
    } catch (err) {
      toast.error(extractApiError(err, 'Could not start campaign'))
    }
  }
  const pause = async (id: string) => {
    try {
      await crmApi.pauseCampaign(id)
      qc.invalidateQueries({ queryKey: ['crm', 'campaigns'] })
      toast.success('Campaign paused')
    } catch (err) {
      toast.error(extractApiError(err, 'Could not pause campaign'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Marketing Campaigns</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New campaign
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Campaign</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell"><TableColumnLabel>Channel</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell"><TableColumnLabel>Stats</TableColumnLabel></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell"><TableColumnLabel>Started</TableColumnLabel></th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Actions</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={6} /> : !data?.items?.length ? (
                <EmptyRow cols={6} message="No campaigns yet" action={
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                    <Megaphone className="w-4 h-4 mr-1" /> Launch first campaign
                  </Button>
                } />
              ) : data.items.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{c.type}{c.steps?.length ? ` · ${c.steps.length} steps` : ''}</p>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <Badge variant="soft">{c.channel}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={c.status === 'active' ? 'success' : c.status === 'paused' ? 'warning' : 'secondary'}>{c.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 hidden lg:table-cell">
                    <div className="flex gap-3">
                      <span className="flex items-center gap-1"><Send className="w-3 h-3" /> {c.sent_count}</span>
                      <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> {c.click_count}</span>
                      <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-500" /> {c.bounce_count}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 hidden xl:table-cell">{c.started_at ? formatDateTime(c.started_at) : '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEdit(c)} title="Edit">
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      {(() => {
                        const isActive = c.status === 'active' || c.status === 'running'
                        const needsSend = isActive && (c.sent_count ?? 0) === 0
                        if (needsSend) {
                          return (
                            <Button variant="ghost" size="sm" title="Send to audience" onClick={() => start(c.id)}>
                              <Play className="w-4 h-4 text-emerald-600" />
                            </Button>
                          )
                        }
                        if (isActive) {
                          return (
                            <Button variant="ghost" size="sm" title="Pause campaign" onClick={() => pause(c.id)}>
                              <Pause className="w-4 h-4" />
                            </Button>
                          )
                        }
                        return (
                          <Button variant="ghost" size="sm" title="Start campaign" onClick={() => start(c.id)}>
                            <Play className="w-4 h-4 text-emerald-600" />
                          </Button>
                        )
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} itemLabel="campaigns" />
        </CardContent>
      </Card>

      <CampaignTemplatesPanel onCreateCampaign={tpl => setFromTemplate(tpl)} />

      {showCreate && <CampaignForm onClose={() => setShowCreate(false)} />}
      {edit && <CampaignForm campaign={edit} onClose={() => setEdit(null)} />}
      {fromTemplate && (
        <CampaignForm
          template={fromTemplate}
          onClose={() => setFromTemplate(null)}
        />
      )}
    </div>
  )
}
