import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'
import {
  useCreatePlatformDeal,
  useMovePlatformDeal,
  usePlatformKanban,
  usePlatformPipelines,
} from '@/hooks/usePlatformCrm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import CrmSubnav from './CrmSubnav'

function formatMoney(amount: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount || 0)
  } catch {
    return String(amount)
  }
}

export default function PlatformCrmPipeline() {
  const { user } = useAuthStore()
  const allowed = isPlatformStaff(user)
  const { data: pipelines, isLoading: loadingPipelines } = usePlatformPipelines()
  const pipelineId = pipelines?.[0]?.id
  const { data: board, isLoading } = usePlatformKanban({
    pipeline_id: pipelineId,
    status: 'open',
  })
  const moveMut = useMovePlatformDeal()
  const createMut = useCreatePlatformDeal()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')

  if (!allowed) return <Navigate to="/dashboard" replace />

  const firstOpenStage = board?.columns?.find((c) => !c.stage.is_won && !c.stage.is_lost)?.stage

  const createDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pipelineId || !firstOpenStage || !title.trim()) {
      toast.error('Title and a pipeline stage are required')
      return
    }
    try {
      await createMut.mutateAsync({
        title: title.trim(),
        pipeline_id: pipelineId,
        stage_id: firstOpenStage.id,
        amount: Number(amount) || 0,
        currency: 'INR',
        status: 'open',
      })
      toast.success('Deal created')
      setTitle('')
      setAmount('')
      setShowForm(false)
    } catch {
      toast.error('Could not create deal')
    }
  }

  return (
    <div className="space-y-6 max-w-[100vw]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">Platform CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-600 mt-1">
            {board?.pipeline?.name || 'Sales pipeline'} — drag deals between stages by moving them.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} disabled={!firstOpenStage}>
          <Plus className="h-4 w-4 mr-1" />
          Add deal
        </Button>
      </div>

      <CrmSubnav />

      {showForm && (
        <form onSubmit={createDeal} className="rounded-xl border bg-white p-4 flex flex-wrap gap-3 items-end max-w-2xl">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-500 mb-1 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="w-36">
            <label className="text-xs text-gray-500 mb-1 block">Amount (INR)</label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={createMut.isPending}>
            Save
          </Button>
        </form>
      )}

      {loadingPipelines || isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      ) : !board?.columns?.length ? (
        <p className="text-sm text-gray-500 border border-dashed rounded-lg p-8 text-center">
          No pipeline stages yet. Open this page once to seed the default sales pipeline.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {board.columns.map((col) => (
            <div
              key={col.stage.id}
              className="w-64 shrink-0 rounded-xl border bg-gray-50/80 p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{col.stage.name}</h3>
                <span className="text-xs text-gray-500">{col.deals.length}</span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {col.deals.map((deal) => (
                  <div key={deal.id} className="rounded-lg border bg-white p-3 space-y-2 shadow-sm">
                    <p className="text-sm font-medium text-gray-900">{deal.title}</p>
                    <p className="text-xs text-gray-500">{formatMoney(Number(deal.amount), deal.currency)}</p>
                    <Select
                      className="w-full text-xs border rounded-md px-2 py-1 bg-white"
                      value={deal.stage_id}
                      disabled={moveMut.isPending}
                      onChange={async (stage_id) => {
                        if (stage_id === deal.stage_id) return
                        try {
                          await moveMut.mutateAsync({ id: deal.id, payload: { stage_id } })
                        } catch {
                          toast.error('Could not move deal')
                        }
                      }}
                      options={board.columns.map((c) => ({
                        value: c.stage.id,
                        label: `Move to ${c.stage.name}`,
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
