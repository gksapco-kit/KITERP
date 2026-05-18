import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSegments, useSaveSegment } from '@/hooks/useCrm'
import { crmApi, type Segment } from '@/api/crm'
import { Plus, Loader2, UsersRound, Edit3, RefreshCw, Trash2 } from 'lucide-react'
import { CrmModal, Field } from './_shared'
import { formatDateTime } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

function SegmentForm({ seg, onClose }: { seg?: Segment; onClose: () => void }) {
  const save = useSaveSegment()
  const [form, setForm] = useState({
    name: seg?.name || '',
    description: seg?.description || '',
    filter_dsl: seg?.filter_dsl ? JSON.stringify(seg.filter_dsl, null, 2) : '{\n  "all": []\n}',
  })
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(form.filter_dsl || '{}')
    } catch {
      setError('Filter must be valid JSON')
      return
    }
    save.mutate(
      {
        id: seg?.id,
        data: {
          name: form.name,
          description: form.description || undefined,
          filter_dsl: parsed,
        },
      },
      { onSuccess: onClose },
    )
  }
  return (
    <CrmModal title={seg ? 'Edit segment' : 'New segment'} onClose={onClose} maxW="max-w-2xl">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name" required><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Field>
        <Field label="Description"><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></Field>
        <Field label="Filter rules (JSON)">
          <textarea value={form.filter_dsl} onChange={e => setForm(p => ({ ...p, filter_dsl: e.target.value }))}
            className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
          <p className="text-xs text-gray-500 mt-1">
            e.g. <code>{`{ "all": [{"field":"lifecycle_stage","op":"eq","value":"customer"}] }`}</code>
          </p>
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </form>
    </CrmModal>
  )
}

export default function SegmentsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useSegments()
  const [edit, setEdit] = useState<Segment | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const refresh = async (id: string) => {
    await crmApi.refreshSegment(id)
    qc.invalidateQueries({ queryKey: ['crm', 'segments'] })
  }
  const remove = async (id: string) => {
    if (!confirm('Delete this segment?')) return
    await crmApi.deleteSegment(id)
    qc.invalidateQueries({ queryKey: ['crm', 'segments'] })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Segments</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New segment
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !data?.length ? (
        <Card><CardContent className="p-12 text-center">
          <UsersRound className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">No segments yet</p>
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
                  <Badge variant="soft">{s.contact_count}</Badge>
                </div>
                <p className="text-xs text-gray-400">
                  {s.last_computed_at ? `Updated ${formatDateTime(s.last_computed_at)}` : 'Not computed'}
                </p>
                <div className="flex gap-1 mt-3 pt-3 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setEdit(s)}>
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => refresh(s.id)} title="Refresh">
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
