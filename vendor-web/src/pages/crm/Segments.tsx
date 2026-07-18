import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSegments, useSaveSegment } from '@/hooks/useCrm'
import { crmApi, type Segment } from '@/api/crm'
import { Plus, Loader2, UsersRound, Edit3, RefreshCw, Trash2, Eye } from 'lucide-react'
import { CrmModal, Field } from './_shared'
import { formatDateTime } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  SegmentFilterBuilder, parseSegmentFilter, serializeSegmentFilter, type SegmentFilter,
} from './crmMarketingForms'
import { contactDisplayName } from './crmContactsShared'

import { askConfirm } from '@/components/common/ConfirmProvider'
function SegmentForm({ seg, onClose }: { seg?: Segment; onClose: () => void }) {
  const qc = useQueryClient()
  const save = useSaveSegment()
  const [filter, setFilter] = useState<SegmentFilter>(() => parseSegmentFilter(seg?.filter_dsl))
  const [preview, setPreview] = useState<{ id: string; name: string }[]>([])
  const [previewing, setPreviewing] = useState(false)
  const [form, setForm] = useState({
    name: seg?.name || '',
    description: seg?.description || '',
  })

  const runPreview = async () => {
    if (!seg?.id) return
    setPreviewing(true)
    try {
      const rows = await crmApi.previewSegment(seg.id, 8) as { id: string; first_name: string; last_name?: string; record_type?: string }[]
      setPreview(rows.map(r => ({ id: r.id, name: contactDisplayName(r) })))
    } finally {
      setPreviewing(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Segment name is required')
      return
    }
    try {
      await save.mutateAsync({
        id: seg?.id,
        data: {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          filter_dsl: serializeSegmentFilter(filter),
          is_active: true,
        },
      })
      await qc.invalidateQueries({ queryKey: ['crm', 'segments'] })
      toast.success(seg ? 'Segment updated' : 'Segment saved')
      onClose()
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save segment'))
    }
  }

  const formId = seg ? `segment-form-${seg.id}` : 'segment-form-new'

  return (
    <CrmModal
      title={seg ? 'Edit segment' : 'New segment'}
      onClose={onClose}
      maxW="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Save segment
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-3 pb-4">
        <Field label="Name" required>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Active customers" />
        </Field>
        <Field label="Description">
          <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Who belongs in this group?" />
        </Field>
        <Field label="Conditions">
          <SegmentFilterBuilder value={filter} onChange={setFilter} />
        </Field>
        {seg?.id && (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">Preview matches</p>
              <Button type="button" variant="outline" size="sm" onClick={runPreview} disabled={previewing}>
                {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                Preview
              </Button>
            </div>
            {preview.length > 0 && (
              <ul className="text-xs text-gray-600 space-y-1">
                {preview.map(p => <li key={p.id}>{p.name}</li>)}
              </ul>
            )}
          </div>
        )}
      </form>
    </CrmModal>
  )
}

export default function SegmentsPage() {
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useSegments()
  const [edit, setEdit] = useState<Segment | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const refresh = async (id: string) => {
    await crmApi.refreshSegment(id)
    qc.invalidateQueries({ queryKey: ['crm', 'segments'] })
  }
  const remove = async (id: string) => {
    if (!await askConfirm('Delete this segment?')) return
    await crmApi.deleteSegment(id)
    qc.invalidateQueries({ queryKey: ['crm', 'segments'] })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Segments</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New segment
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : isError ? (
        <Card><CardContent className="p-12 text-center">
          <p className="text-sm text-red-600 mb-3">Could not load segments.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </CardContent></Card>
      ) : !data?.length ? (
        <Card><CardContent className="p-12 text-center">
          <UsersRound className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">Build audience groups with simple conditions — no JSON required.</p>
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> Create one</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(s => (
            <Card key={s.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{s.name}</h3>
                    {s.description && <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{s.description}</p>}
                  </div>
                  <Badge variant="soft">{s.contact_count} contacts</Badge>
                </div>
                <p className="text-xs text-gray-400">
                  {s.last_computed_at ? `Updated ${formatDateTime(s.last_computed_at)}` : 'Not computed'}
                </p>
                <div className="flex gap-1 mt-3 pt-3 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setEdit(s)} title="Edit">
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => refresh(s.id)} title="Refresh count">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(s.id)} title="Delete">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && <SegmentForm onClose={() => setShowCreate(false)} />}
      {edit && <SegmentForm seg={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
