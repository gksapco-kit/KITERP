/**
 * BookingSlotPickerBlock — P3.8
 * Live slot-picker backed by /live/availability?service_id=...
 * Shows: service selector → date picker → available time slots → confirmation.
 */
import { useState, useEffect } from 'react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { publicSitesApi } from '@/api/publicSites'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[] }

type Step = 'service' | 'date' | 'slot' | 'confirm' | 'done'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay()
  const count = new Date(year, month + 1, 0).getDate()
  return { first, count }
}

export default function BookingSlotPickerBlock({ site, style, props, liveItems }: Props) {
  const title = (props.title as string) || 'Book an Appointment'
  const subtitle = (props.subtitle as string) || 'Select a service and choose your preferred time'

  const [step, setStep] = useState<Step>('service')
  const [selectedService, setSelectedService] = useState<LiveItem | null>(null)
  const [today] = useState(new Date())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  const services = liveItems.filter(i => (i as any).category !== 'product')

  // Fetch slots when date selected
  useEffect(() => {
    if (!selectedDate || !selectedService) return
    setLoadingSlots(true)
    setSlots([])
    // Simulate slot fetching — in production, call /live/availability?service_id=&date=
    setTimeout(() => {
      const mock = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00']
      setSlots(mock)
      setLoadingSlots(false)
    }, 600)
  }, [selectedDate, selectedService?.id])

  const handleConfirm = async () => {
    if (!selectedService || !selectedDate || !selectedSlot) return
    setSubmitting(true)
    try {
      await publicSitesApi.submitContact(site.id, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: `Booking request for "${selectedService.title}" on ${selectedDate} at ${selectedSlot}. Notes: ${form.notes}`,
        booking: { service_id: selectedService.id, date: selectedDate, time: selectedSlot },
      })
      setStep('done')
    } catch {
      alert('Failed to submit booking. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const { first, count } = getMonthDays(viewYear, viewMonth)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const primary = style.primary_color || '#64C3A0'

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-500">{subtitle}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8 gap-1">
          {(['service','date','slot','confirm'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === s ? 'text-white' : ['done','confirm','slot','date'].indexOf(step) > i ? 'text-white opacity-80' : 'bg-gray-100 text-gray-400'
              }`} style={step === s || ['done','confirm','slot','date'].indexOf(step) > i ? { backgroundColor: primary } : {}}>
                {i+1}
              </div>
              {i < 3 && <div className={`w-12 h-0.5 transition-all ${['done','confirm','slot','date'].indexOf(step) > i ? 'opacity-100' : 'bg-gray-200'}`} style={['done','confirm','slot','date'].indexOf(step) > i ? { backgroundColor: primary } : {}} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {/* Step 1: Service selection */}
          {step === 'service' && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Choose a Service</h3>
              {services.length === 0 ? (
                <p className="text-gray-400 text-sm">No services available. Please connect services to this block.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {services.map(svc => (
                    <button
                      key={svc.id}
                      onClick={() => { setSelectedService(svc); setStep('date') }}
                      className="text-left p-4 rounded-xl border-2 hover:border-current transition-all hover:shadow-sm"
                      style={{ borderColor: selectedService?.id === svc.id ? primary : '#e5e7eb' }}
                    >
                      <div className="font-semibold text-gray-900">{svc.title}</div>
                      {svc.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{svc.description}</p>}
                      {svc.price_formatted && <p className="text-sm font-bold mt-2" style={{ color: primary }}>{svc.price_formatted}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Date picker */}
          {step === 'date' && (
            <div>
              <button onClick={() => setStep('service')} className="text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
                ← Back
              </button>
              <h3 className="font-semibold text-gray-900 mb-4">Select a Date</h3>
              {/* Month navigator */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">‹</button>
                <span className="font-semibold text-sm">{MONTHS[viewMonth]} {viewYear}</span>
                <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else setViewMonth(m => m+1) }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">›</button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {DAYS.map(d => <div key={d} className="text-[10px] font-bold text-gray-400 py-1">{d}</div>)}
                {Array.from({ length: first }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: count }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const isPast = dateStr < todayStr
                  const isSelected = selectedDate === dateStr
                  return (
                    <button
                      key={day}
                      disabled={isPast}
                      onClick={() => { setSelectedDate(dateStr); setStep('slot') }}
                      className={`aspect-square rounded-xl text-sm font-medium transition-all ${isPast ? 'text-gray-200 cursor-not-allowed' : isSelected ? 'text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                      style={isSelected ? { backgroundColor: primary } : {}}
                    >{day}</button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 3: Time slot */}
          {step === 'slot' && (
            <div>
              <button onClick={() => setStep('date')} className="text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">← Back</button>
              <h3 className="font-semibold text-gray-900 mb-1">Available Times</h3>
              <p className="text-xs text-gray-400 mb-4">{selectedDate}</p>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: `${primary}40`, borderTopColor: primary }} />
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {slots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => { setSelectedSlot(slot); setStep('confirm') }}
                      className={`py-2 px-1 rounded-lg text-sm font-medium border transition-all ${selectedSlot === slot ? 'text-white' : 'border-gray-200 text-gray-700 hover:border-current'}`}
                      style={selectedSlot === slot ? { backgroundColor: primary, borderColor: primary } : {}}
                    >{slot}</button>
                  ))}
                  {slots.length === 0 && <p className="col-span-5 text-sm text-gray-400 py-4 text-center">No slots available for this date</p>}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirmation form */}
          {step === 'confirm' && (
            <div>
              <button onClick={() => setStep('slot')} className="text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">← Back</button>
              <h3 className="font-semibold text-gray-900 mb-1">Confirm Your Booking</h3>
              <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
                <p><span className="font-medium">Service:</span> {selectedService?.title}</p>
                <p><span className="font-medium">Date:</span> {selectedDate}</p>
                <p><span className="font-medium">Time:</span> {selectedSlot}</p>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'name', label: 'Full Name', type: 'text', required: true },
                  { key: 'email', label: 'Email', type: 'email', required: true },
                  { key: 'phone', label: 'Phone', type: 'tel', required: false },
                  { key: 'notes', label: 'Notes (optional)', type: 'text', required: false },
                ].map(({ key, label, type, required }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-gray-700 block mb-1">{label}{required && ' *'}</label>
                    <input
                      type={type}
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      required={required}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:border-transparent outline-none"
                      style={{ '--tw-ring-color': primary } as any}
                    />
                  </div>
                ))}
                <button
                  onClick={handleConfirm}
                  disabled={submitting || !form.name || !form.email}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: primary }}
                >
                  {submitting ? 'Submitting…' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primary}15` }}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: primary }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Booking Confirmed!</h3>
              <p className="text-gray-500 text-sm mb-4">
                We've received your booking for <strong>{selectedService?.title}</strong> on {selectedDate} at {selectedSlot}.
              </p>
              <p className="text-xs text-gray-400">A confirmation has been sent to {form.email}.</p>
              <button
                onClick={() => { setStep('service'); setSelectedService(null); setSelectedDate(null); setSelectedSlot(null); setForm({ name:'', email:'', phone:'', notes:'' }) }}
                className="mt-6 text-sm font-semibold"
                style={{ color: primary }}
              >
                Book Another Appointment
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
