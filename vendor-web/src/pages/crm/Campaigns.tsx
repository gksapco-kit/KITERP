import { useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useCampaigns, useSaveCampaign, useEmailTemplates, useSegments } from '@/hooks/useCrm'
import { crmApi, type Campaign, type CampaignStep } from '@/api/crm'
import { Plus, Loader2, Megaphone, Play, Pause, Send, MousePointerClick, AlertCircle, Edit3 } from 'lucide-react'
import { CrmModal, Field, Pager, LoadingRow, EmptyRow } from './_shared'
import { formatDateTime } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import { inputCls } from './crmContactsShared'
import { CampaignStepsBuilder, type CampaignDripStep } from './crmMarketingForms'
import { CrmDateTimeField } from './crmExtras'

function stepsToDrip(steps?: CampaignStep[]): CampaignDripStep[] {
  if (!steps?.length) return []
  return steps.map(s => ({
    delay_minutes: s.delay_minutes ?? 0,
    channel: s.channel || 'email',
    template_id: s.template_id || '',
  }))
}

function CampaignForm({ campaign, onClose }: { campaign?: Campaign; onClose: () => void }) {
  const qc = useQueryClient()
  const save = useSaveCampaign()
  const { data: templates } = useEmailTemplates()
  const { data: segments } = useSegments()
  const tplList = (templates ?? []).map(t => ({ id: t.id, name: t.name }))

  const [form, setForm] = useState({
    name: campaign?.name || '',
    type: campaign?.type || 'broadcast',
    channel: campaign?.channel || 'email',
    template_id: campaign?.template_id || '',
    segment_id: campaign?.segment_id || '',
    scheduled_at: campaign?.scheduled_at?.slice(0, 16) || '',
    dripSteps: stepsToDrip(campaign?.steps),
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Campaign name is required')
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
    <CrmModal title={campaign ? 'Edit campaign' : 'New campaign'} onClose={onClose} maxW="max-w-2xl">
      <form onSubmit={submit} className="space-y-3">
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
              onChange={v => setForm(p => ({ ...p, channel: v }))}
              options={[
                { value: 'email', label: 'Email' },
                { value: 'sms', label: 'SMS' },
                { value: 'whatsapp', label: 'WhatsApp' },
              ]}
            />
          </Field>
        </div>
        {form.type !== 'drip' && (
          <Field label="Email template">
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
        <Field label="Audience segment">
          <Select
            value={form.segment_id}
            onChange={v => setForm(p => ({ ...p, segment_id: v }))}
            placeholder="— All contacts —"
            options={selectOptionsWithBlank(
              '— All contacts —',
              (segments ?? []).map(s => ({ value: s.id, label: `${s.name} (${s.contact_count})` })),
            )}
          />
        </Field>
        <Field label="Schedule send (optional)">
          <CrmDateTimeField
            value={form.scheduled_at}
            onChange={v => setForm(p => ({ ...p, scheduled_at: v }))}
            showPresets={false}
          />
        </Field>
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
  const [showCreate, setShowCreate] = useState(false)
  const [edit, setEdit] = useState<Campaign | null>(null)
  const { data, isLoading } = useCampaigns({ page, size: 20 })

  const start = async (id: string) => {
    await crmApi.startCampaign(id)
    qc.invalidateQueries({ queryKey: ['crm', 'campaigns'] })
  }
  const pause = async (id: string) => {
    await crmApi.pauseCampaign(id)
    qc.invalidateQueries({ queryKey: ['crm', 'campaigns'] })
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
                    <Badge variant={c.status === 'running' ? 'success' : c.status === 'paused' ? 'warning' : 'secondary'}>{c.status}</Badge>
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
                      {c.status === 'running' ? (
                        <Button variant="ghost" size="sm" onClick={() => pause(c.id)}><Pause className="w-4 h-4" /></Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => start(c.id)}><Play className="w-4 h-4 text-emerald-600" /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>

      {showCreate && <CampaignForm onClose={() => setShowCreate(false)} />}
      {edit && <CampaignForm campaign={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
