import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Calendar, Check, Loader2, Mail, Phone, User, Users } from 'lucide-react'
import { restaurantApi } from '@/api/restaurant'
import { PhoneInput } from '@/components/ui/PhoneInput'

function today() {
  return new Date().toISOString().slice(0, 10)
}

const TIME_SLOTS = [
  '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
  '17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30',
]

export default function ReservationPage() {
  const { vendorSlug } = useParams<{ vendorSlug: string }>()
  const [form, setForm] = useState({
    guest_name: '', guest_phone: '', guest_email: '',
    reservation_date: today(), reservation_time: '19:00',
    party_size: 2, notes: '',
  })
  const [success, setSuccess] = useState(false)

  const submit = useMutation({
    mutationFn: () => restaurantApi.submitReservation(vendorSlug!, {
      ...form,
      party_size: Number(form.party_size),
    }),
    onSuccess: () => setSuccess(true),
  })

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))
  const valid = form.guest_name.trim().length > 0 && form.reservation_date && form.reservation_time

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-amber-50 gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Reservation confirmed!</h1>
        <p className="text-gray-600 max-w-sm">
          We've received your reservation for <strong>{form.party_size} guest{form.party_size > 1 ? 's' : ''}</strong> on <strong>{form.reservation_date}</strong> at <strong>{form.reservation_time}</strong>.
        </p>
        <p className="text-sm text-gray-500">Our team will confirm shortly via phone or email.</p>
        <button
          type="button"
          onClick={() => { setSuccess(false); setForm(f => ({ ...f, guest_name: '', guest_phone: '', guest_email: '', notes: '' })) }}
          className="mt-2 px-6 py-2.5 rounded-full border border-amber-500 text-amber-700 font-semibold hover:bg-amber-50 transition-colors"
        >
          Make another reservation
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white border-b px-4 py-5">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="font-bold text-xl text-gray-900">Reserve a table</h1>
            <p className="text-sm text-gray-500">Fill in your details below</p>
          </div>
        </div>
      </div>

      <form
        className="flex-1 p-4 space-y-4"
        onSubmit={e => { e.preventDefault(); if (valid) submit.mutate() }}
      >
        {/* Guest name */}
        <div>
          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1.5">
            <User className="w-4 h-4 text-gray-400" /> Your name <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={form.guest_name}
            onChange={e => set('guest_name', e.target.value)}
            placeholder="John Smith"
            className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {/* Phone + email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1.5">
              <Phone className="w-4 h-4 text-gray-400" /> Phone
            </label>
            <PhoneInput
              value={form.guest_phone}
              onChange={v => set('guest_phone', v)}
              defaultCountryIso="IN"
              autoComplete="tel"
              name="guest_phone"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1.5">
              <Mail className="w-4 h-4 text-gray-400" /> Email
            </label>
            <input
              type="email"
              value={form.guest_email}
              onChange={e => set('guest_email', e.target.value)}
              placeholder="you@email.com"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        {/* Party size */}
        <div>
          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1.5">
            <Users className="w-4 h-4 text-gray-400" /> Party size
          </label>
          <div className="flex gap-2 flex-wrap">
            {[1,2,3,4,5,6,8,10].map(n => (
              <button key={n} type="button" onClick={() => set('party_size', n)}
                className={`w-10 h-10 rounded-xl border text-sm font-semibold transition-colors ${
                  form.party_size === n ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1.5">
            <Calendar className="w-4 h-4 text-gray-400" /> Date <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="date"
            min={today()}
            value={form.reservation_date}
            onChange={e => set('reservation_date', e.target.value)}
            className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {/* Time */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Time <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TIME_SLOTS.map(t => (
              <button key={t} type="button" onClick={() => set('reservation_time', t)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.reservation_time === t ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Special requests</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Allergies, occasions, seating preferences…"
            rows={2}
            className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
        </div>

        {submit.isError && (
          <p className="text-sm text-red-500">Could not submit reservation. Please try again.</p>
        )}

        <button
          type="submit"
          disabled={!valid || submit.isPending}
          className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {submit.isPending
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Booking…</>
            : <><Check className="w-5 h-5" /> Confirm reservation</>}
        </button>
      </form>
    </div>
  )
}
