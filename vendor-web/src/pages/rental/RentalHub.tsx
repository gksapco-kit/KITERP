import { useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Loader2, Package, Plus } from 'lucide-react'
import apiClient from '@/api/client'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const rentalApi = {
  listAssets: () => apiClient.get('/vendors/me/rentals/assets').then((r) => r.data),
  createAsset: (body: Record<string, unknown>) => apiClient.post('/vendors/me/rentals/assets', body).then((r) => r.data),
  listBookings: () => apiClient.get('/vendors/me/rentals/bookings').then((r) => r.data),
  createBooking: (body: Record<string, unknown>) => apiClient.post('/vendors/me/rentals/bookings', body).then((r) => r.data),
}

export default function RentalHubPage() {
  const qc = useQueryClient()
  const { data: assets = [], isLoading: la } = useQuery({ queryKey: ['rental-assets'], queryFn: rentalApi.listAssets })
  const { data: bookings = [], isLoading: lb } = useQuery({ queryKey: ['rental-bookings'], queryFn: rentalApi.listBookings })
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [dailyRate, setDailyRate] = useState('')
  const [deposit, setDeposit] = useState('')

  const createAsset = useMutation({
    mutationFn: () => rentalApi.createAsset({
      name,
      daily_rate: Number(dailyRate) || 0,
      deposit_amount: Number(deposit) || 0,
    }),
    onSuccess: () => {
      toast.success('Rental asset added')
      setShowForm(false)
      setName('')
      setDailyRate('')
      setDeposit('')
      qc.invalidateQueries({ queryKey: ['rental-assets'] })
    },
    onError: () => toast.error('Could not create asset'),
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rentals</h1>
          <p className="text-sm text-gray-500 mt-1">Manage rental assets, deposits, and booking schedules.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> Add asset
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-white p-4 grid sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500">Asset name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Camera kit, Room A…" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Daily rate (₹)</label>
            <Input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Deposit (₹)</label>
            <Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          </div>
          <Button className="sm:col-span-3 w-fit" disabled={!name || createAsset.isPending} onClick={() => createAsset.mutate()}>
            {createAsset.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save asset'}
          </Button>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" /> Assets
        </h2>
        {la ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : assets.length === 0 ? (
          <p className="text-sm text-gray-500 border border-dashed rounded-lg p-6">No rental assets yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {(assets as Record<string, unknown>[]).map((a) => (
              <div key={String(a.id)} className="rounded-xl border bg-white p-4">
                <p className="font-medium">{String(a.name)}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {formatCurrency(Number(a.daily_rate || 0))}/day · deposit {formatCurrency(Number(a.deposit_amount || 0))}
                </p>
                <span className="text-xs capitalize text-gray-400">{String(a.status)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Bookings
        </h2>
        {lb ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-gray-500 border border-dashed rounded-lg p-6">No rental bookings yet.</p>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3"><TableColumnLabel>Customer</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Dates</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right"><TableColumnLabel>Total</TableColumnLabel></th>
                  <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(bookings as Record<string, unknown>[]).map((b) => (
                  <tr key={String(b.id)}>
                    <td className="px-4 py-3">{String(b.customer_name)}</td>
                    <td className="px-4 py-3 text-gray-600">{String(b.start_date)} → {String(b.end_date)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(Number(b.total_amount || 0))}</td>
                    <td className="px-4 py-3 capitalize">{String(b.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
