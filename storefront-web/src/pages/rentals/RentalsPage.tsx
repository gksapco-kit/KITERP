import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Loader2, Package } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { storeApi } from '@/api/store'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function RentalsPage() {
  const { storePath } = useVendor()
  const { customer, isAuthenticated } = useAuthStore()
  const qc = useQueryClient()
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['store-rentals'],
    queryFn: storeApi.listRentalAssets,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')

  const book = useMutation({
    mutationFn: () =>
      storeApi.createRentalBooking({
        asset_id: selectedId!,
        start_date: startDate,
        end_date: endDate,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Rental request submitted')
      setSelectedId(null)
      setStartDate('')
      setEndDate('')
      setNotes('')
      qc.invalidateQueries({ queryKey: ['store-rentals'] })
    },
    onError: () => toast.error('Could not submit rental request'),
  })

  const selected = (assets as Record<string, unknown>[]).find((a) => String(a.id) === selectedId)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <Link to={storePath('/')} className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Rentals</span>
      </nav>

      <div className="flex items-center gap-2 mb-6">
        <Package className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">Rentals</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
      ) : assets.length === 0 ? (
        <p className="text-sm text-gray-500 border border-dashed rounded-xl p-10 text-center">No rental items available right now.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {(assets as Record<string, unknown>[]).map((a) => (
            <button
              key={String(a.id)}
              type="button"
              onClick={() => setSelectedId(String(a.id))}
              className={`text-left rounded-xl border p-4 transition-shadow hover:shadow-md ${selectedId === String(a.id) ? 'ring-2 ring-primary border-primary' : 'bg-white'}`}
            >
              <p className="font-semibold text-gray-900">{String(a.name)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {formatCurrency(Number(a.daily_rate || 0))}/day · deposit {formatCurrency(Number(a.deposit_amount || 0))}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-8 rounded-xl border bg-white p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Book {String(selected.name)}
          </h2>
          {!isAuthenticated ? (
            <p className="text-sm text-gray-600">
              <Link to={storePath('/login')} className="text-primary font-medium">Sign in</Link> to request this rental.
            </p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Start date</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">End date</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
              <p className="text-xs text-gray-500">Booking as {customer?.full_name}</p>
              <Button
                disabled={!startDate || !endDate || book.isPending}
                onClick={() => book.mutate()}
              >
                {book.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Request rental'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
