import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useService, useCreateBooking, useBookingSlots } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { AvailabilityCalendar, TimeSlotPicker } from '@/kit/bookings/AvailabilityCalendar'
import { GroupBookingFlow, RecurringBookingFlow, WaitlistFlow } from '@/kit/bookings/BookingFlows'
import { PlanSelector } from './ServiceDetail'
import { resolveServicePrice, resolveServiceDuration } from '@/lib/servicePricing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, ChevronRight, CheckCircle, Repeat } from 'lucide-react'
import { toast } from 'sonner'

export default function ServiceBookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const { storePath } = useVendor()
  const navigate = useNavigate()
  const { isAuthenticated, customer } = useAuthStore()
  const createBooking = useCreateBooking()

  const { data: service, isLoading } = useService(slug!)

  const activePlans = useMemo(() => (service?.plans || []).filter(p => p.is_active), [service])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const selectedPlan = useMemo(
    () => activePlans.find(p => p.id === selectedPlanId) ?? activePlans[0] ?? null,
    [activePlans, selectedPlanId],
  )

  const planPrice = selectedPlan?.price ?? resolveServicePrice(service)
  const planDuration = selectedPlan?.duration_minutes ?? resolveServiceDuration(service)
  const planAvailability = (selectedPlan?.availability && selectedPlan.availability.length > 0)
    ? selectedPlan.availability
    : service?.availability

  // Convert raw API service (price = number in major units) to kit Service shape directly
  const kitService = service ? {
    id: service.id,
    slug: service.slug,
    name: service.name,
    shortDescription: service.short_description || service.description || '',
    description: service.description || '',
    image: service.image_url || service.media?.find((m: any) => m.is_primary)?.url,
    durationMinutes: planDuration,
    price: planPrice,
    currency: service.currency || 'INR',
    features: service.features || [],
  } : null

  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>()
  const [name, setName] = useState(customer?.full_name ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [notes, setNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [bookingMode, setBookingMode] = useState<'single' | 'group' | 'recurring' | 'waitlist'>('single')

  // Changing plan may change the weekly schedule — clear a date/slot picked under the old plan.
  useEffect(() => {
    setSelectedDate(undefined)
    setSelectedSlot(undefined)
  }, [selectedPlanId])

  const dateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : undefined
  const { data: slotsData, isLoading: slotsLoading } = useBookingSlots(service?.id, dateStr, selectedPlan?.id)
  const slots = slotsData?.slots ?? []

  const blockedByWeeklySchedule = useMemo(() => {
    if (!planAvailability?.length) return []
    const openDays = new Set(planAvailability.filter(a => a.is_available).map(a => a.day_of_week))
    if (openDays.size === 0 || openDays.size === 7) return []
    const closed: string[] = []
    const cursor = new Date()
    for (let i = 0; i < 60; i++) {
      const jsDay = cursor.getDay()
      const modelDay = jsDay === 0 ? 6 : jsDay - 1
      if (!openDays.has(modelDay)) {
        closed.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`)
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return closed
  }, [planAvailability])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!service || !kitService) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground">Service not found.</p>
        <Link to={storePath('/services')} className="mt-4 inline-block text-primary hover:underline">
          Browse services
        </Link>
      </div>
    )
  }

  if (confirmed) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
        <h2 className="text-2xl font-semibold">Booking confirmed!</h2>
        <p className="text-muted-foreground">
          We've received your booking for <strong>{service.name}{selectedPlan ? ` — ${selectedPlan.name}` : ''}</strong>.
          {selectedDate && ` on ${selectedDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`}
          {selectedSlot && ` at ${new Date(selectedSlot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}.
        </p>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-center">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(storePath('/account/bookings'))}>My bookings</Button>
          <Button className="w-full sm:w-auto" onClick={() => navigate(storePath('/services'))}>Browse more services</Button>
        </div>
      </div>
    )
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate || !selectedSlot) {
      toast.error('Please select a date and time slot')
      return
    }
    try {
      const slot = slots.find(s => s.start === selectedSlot)
      await createBooking.mutateAsync({
        service_id: service.id,
        plan_id: selectedPlan?.id,
        booking_date: dateStr!,
        start_time: slot?.start_time ?? new Date(selectedSlot).toTimeString().slice(0, 5),
        notes: notes || undefined,
      })
      setConfirmed(true)
    } catch {
      /* mutation shows error toast */
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
      <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-1.5">
        <Link to={storePath('/services')} className="hover:text-foreground">Services</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={storePath(`/services/${slug}`)} className="hover:text-foreground">{service.name}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">Book</span>
      </nav>

      <h1 className="text-2xl font-semibold mb-6">Book: {service.name}</h1>

      <Tabs value={bookingMode} onValueChange={(v) => setBookingMode(v as typeof bookingMode)}>
        <TabsList className="mb-6">
          <TabsTrigger value="single">Single session</TabsTrigger>
          <TabsTrigger value="group">Group booking</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
          <TabsTrigger value="waitlist">Join waitlist</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              {activePlans.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Repeat className="w-4 h-4" /> Choose a plan</CardTitle></CardHeader>
                  <CardContent>
                    <PlanSelector
                      plans={activePlans}
                      currency={service.currency || 'INR'}
                      selectedId={selectedPlanId ?? activePlans[0]?.id ?? null}
                      onSelect={setSelectedPlanId}
                    />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle>Pick a date</CardTitle></CardHeader>
                <CardContent>
                  <AvailabilityCalendar value={selectedDate} onChange={setSelectedDate} blockedDates={blockedByWeeklySchedule} />
                  {blockedByWeeklySchedule.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">Greyed-out days are outside this plan's weekly schedule.</p>
                  )}
                </CardContent>
              </Card>

              {selectedDate && (
                <Card>
                  <CardHeader><CardTitle>Select a time slot</CardTitle></CardHeader>
                  <CardContent>
                    {slotsLoading ? (
                      <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : slots.length > 0 ? (
                      <TimeSlotPicker slots={slots} value={selectedSlot} onChange={setSelectedSlot} />
                    ) : (
                      <p className="text-sm text-muted-foreground">No slots available on this date.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {selectedDate && selectedSlot && (
                <Card>
                  <CardHeader><CardTitle>Your details</CardTitle></CardHeader>
                  <CardContent>
                    <form onSubmit={handleConfirm} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></div>
                        <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" /></div>
                        <div className="sm:col-span-2"><Label>Phone</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" /></div>
                        <div className="sm:col-span-2"><Label>Notes (optional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" /></div>
                      </div>
                      <Button type="submit" className="w-full" disabled={createBooking.isPending}>
                        {createBooking.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Booking...</> : 'Confirm booking'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar summary */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-5 space-y-3">
                  <h3 className="font-semibold">{service.name}</h3>
                  {selectedPlan && (
                    <p className="text-sm font-medium text-primary flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5" /> {selectedPlan.name}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{selectedPlan?.description || service.short_description}</p>
                  <div className="text-sm flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{planDuration} min</span>
                  </div>
                  <div className="text-sm flex justify-between font-semibold">
                    <span>Price</span>
                    <span>₹{planPrice.toLocaleString('en-IN')}</span>
                  </div>
                  {selectedDate && (
                    <div className="text-sm flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span>{selectedDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  )}
                  {selectedSlot && (
                    <div className="text-sm flex justify-between">
                      <span className="text-muted-foreground">Time</span>
                      <span>{new Date(selectedSlot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="group">
          {kitService && <GroupBookingFlow service={kitService} onSubmit={(d) => toast.success(`Group booking for ${d.attendees} × ₹${d.total.toLocaleString('en-IN')}`)} />}
        </TabsContent>

        <TabsContent value="recurring">
          {kitService && (
            <RecurringBookingFlow
              service={kitService}
              startDate={selectedDate}
              onSubmit={(d) => toast.success(`Recurring: ${d.occurrences.length} sessions, ₹${d.total.toLocaleString('en-IN')}`)}
            />
          )}
        </TabsContent>

        <TabsContent value="waitlist">
          {kitService && <WaitlistFlow service={kitService} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
