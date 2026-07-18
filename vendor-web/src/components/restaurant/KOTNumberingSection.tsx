import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Hash, Loader2 } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { RestaurantKOTSettings } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

import { askConfirm } from '@/components/common/ConfirmProvider'
export function KOTNumberingSection({
  restaurantId,
  restaurantName,
  emptyHint = 'Select a restaurant above to configure its KOT number range.',
}: {
  restaurantId?: string
  restaurantName?: string
  emptyHint?: string
}) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'sequential' | 'per_order'>('sequential')
  const [startNumber, setStartNumber] = useState('1')
  const [endNumber, setEndNumber] = useState('999')
  const [reset, setReset] = useState<'daily' | 'continuous'>('daily')

  const settingsQ = useQuery({
    queryKey: ['restaurant', 'kot-settings', restaurantId],
    queryFn: () => vendorApi.restaurantGetKOTSettings(restaurantId!),
    enabled: !!restaurantId,
  })

  useEffect(() => {
    if (!settingsQ.data) return
    const s = settingsQ.data
    setMode(s.mode)
    setStartNumber(String(s.start_number))
    setEndNumber(String(s.end_number))
    setReset(s.reset)
  }, [settingsQ.data])

  const save = useMutation({
    mutationFn: () => {
      const start = parseInt(startNumber, 10) || 1
      const end = parseInt(endNumber, 10) || start
      if (end < start) throw new Error('End number must be at least the start number')
      return vendorApi.restaurantUpdateKOTSettings(restaurantId!, {
        mode,
        start_number: start,
        end_number: end,
        reset,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'kot-settings', restaurantId] })
      toast.success('KOT numbering saved')
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Could not save KOT settings'
      toast.error(msg)
    },
  })

  const resetCounter = useMutation({
    mutationFn: () => vendorApi.restaurantUpdateKOTSettings(restaurantId!, { reset_counter_now: true }),
    onSuccess: (data: RestaurantKOTSettings) => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'kot-settings', restaurantId] })
      toast.success(`Counter reset — next KOT will be #${data.next_preview}`)
    },
    onError: () => toast.error('Could not reset counter'),
  })

  const settings = settingsQ.data

  if (!restaurantId) {
    return (
      <section className="rounded-xl border bg-card p-5 space-y-2">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Hash className="w-4 h-4 text-orange-600" /> KOT numbering
        </h2>
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Hash className="w-4 h-4 text-orange-600" /> KOT numbering
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure ticket numbers for <span className="font-medium text-foreground">{restaurantName || 'this outlet'}</span>.
          Kitchen and floor boards show these numbers when orders are sent.
        </p>
      </div>

      {settingsQ.isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs uppercase text-muted-foreground font-semibold block mb-1">Numbering mode</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value as 'sequential' | 'per_order')}
                className="h-9 text-sm border rounded-md px-2 bg-background w-full max-w-md"
              >
                <option value="sequential">Sequential — one running number for the whole restaurant (recommended)</option>
                <option value="per_order">Per order — KOT #1, #2… resets for each table order</option>
              </select>
            </div>

            {mode === 'sequential' && (
              <>
                <div>
                  <label className="text-xs uppercase text-muted-foreground font-semibold block mb-1">Start number</label>
                  <Input
                    type="number"
                    min={1}
                    value={startNumber}
                    onChange={e => setStartNumber(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-muted-foreground font-semibold block mb-1">End number</label>
                  <Input
                    type="number"
                    min={1}
                    value={endNumber}
                    onChange={e => setEndNumber(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">After end, numbering wraps back to start.</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs uppercase text-muted-foreground font-semibold block mb-1">Reset policy</label>
                  <select
                    value={reset}
                    onChange={e => setReset(e.target.value as 'daily' | 'continuous')}
                    className="h-9 text-sm border rounded-md px-2 bg-background w-full max-w-md"
                  >
                    <option value="daily">Daily — restart from start number each day</option>
                    <option value="continuous">Continuous — keep counting, wrap only at end number</option>
                  </select>
                </div>
                {settings && (
                  <div className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
                    <span className="font-semibold">Next KOT will be #{settings.next_preview}</span>
                    {settings.last_reset_date && reset === 'daily' && (
                      <span className="text-blue-700/80 ml-2">· last daily reset {settings.last_reset_date}</span>
                    )}
                  </div>
                )}
              </>
            )}

            {mode === 'per_order' && (
              <p className="sm:col-span-2 text-sm text-muted-foreground rounded-lg border border-dashed px-4 py-3">
                Each table order gets its own KOT sequence (1, 2, 3…). Range settings do not apply in this mode.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save KOT settings'}
            </Button>
            {mode === 'sequential' && async (
              <Button
                size="sm"
                variant="outline"
                disabled={resetCounter.isPending}
                onClick={async () => {
                  if (await askConfirm(`Reset counter to #${startNumber}? This affects the next ticket issued.`)) {
                    resetCounter.mutate()
                  }
                }}
              >
                {resetCounter.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset counter now'}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
