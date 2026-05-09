import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useCampaigns, useSaveCampaign, useEmailTemplates, useSegments } from '@/hooks/useCrm'
import { crmApi } from '@/api/crm'
import { Plus, Loader2, Megaphone, Play, Pause, Send, MousePointerClick, AlertCircle } from 'lucide-react'
import { CrmModal, Field, Pager, LoadingRow, EmptyRow } from './_shared'
import { formatDateTime } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

function CampaignForm({ onClose }: { onClose: () => void }) {
  const save = useSaveCampaign()
  const { data: templates } = useEmailTemplates()
  const { data: segments } = useSegments()
  const [form, setForm] = useState({
    name: '', type: 'broadcast', channel: 'email',
    template_id: '', segment_id: '', scheduled_at: '',
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    save.mutate(
      {
        data: {
          name: form.name, type: form.type, channel: form.channel,
          template_id: form.template_id || undefined,
          segment_id: form.segment_id || undefined,
          scheduled_at: form.scheduled_at || undefined,
        },
      },
      { onSuccess: onClose },
    )
  }
  return (
    <CrmModal title="New campaign" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name" required><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="broadcast">Broadcast (one-shot)</option>
              <option value="drip">Drip sequence</option>
              <option value="trigger">Trigger-based</option>
            </select>
          </Field>
          <Field label="Channel">
            <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </Field>
        </div>
        <Field label="Template">
          <select value={form.template_id} onChange={e => setForm(p => ({ ...p, template_id: e.target.value }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">— Select —</option>
            {templates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Segment">
          <select value={form.segment_id} onChange={e => setForm(p => ({ ...p, segment_id: e.target.value }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">— All contacts —</option>
            {segments?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.contact_count})</option>)}
          </select>
        </Field>
        <Field label="Scheduled at (optional)"><Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} /></Field>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Create
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
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
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
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Campaign</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Channel</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Stats</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden xl:table-cell">Started</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
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
                    <p className="text-xs text-gray-500">{c.type}</p>
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
                    {c.status === 'running' ? (
                      <Button variant="ghost" size="sm" onClick={() => pause(c.id)}><Pause className="w-4 h-4" /></Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => start(c.id)}><Play className="w-4 h-4 text-emerald-600" /></Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>

      {showCreate && <CampaignForm onClose={() => setShowCreate(false)} />}
    </div>
  )
}
