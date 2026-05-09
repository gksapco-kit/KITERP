import { useESSProfile, useESSAcknowledgePolicy } from '@/hooks/useESS'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PendingPolicy = { id?: string; title?: string; name?: string; version?: number }

export default function ESSPolicies() {
  const { data: profile, isLoading } = useESSProfile()
  const ack = useESSAcknowledgePolicy()

  const pending = (profile?.pending_policies ?? []) as PendingPolicy[]

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Policies to read</h1>
          <p className="text-sm text-gray-500">
            Acknowledge each published policy assigned to you. This matches the vendor ESS hub.
          </p>
        </div>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-gray-500 border rounded-lg p-6 bg-white">You have no pending policy acknowledgements.</p>
      ) : (
        <ul className="divide-y border rounded-lg bg-white overflow-hidden">
          {pending.map((p) => {
            const id = p.id as string
            const title = (p.title || p.name || 'Policy') as string
            const ver = p.version != null ? ` v${p.version}` : ''
            return (
              <li key={id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ver.trim() || 'Published policy'}</p>
                </div>
                <Button
                  size="sm"
                  disabled={ack.isPending}
                  onClick={() => ack.mutate(id)}
                  className="shrink-0"
                >
                  {ack.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'I have read & acknowledge'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
