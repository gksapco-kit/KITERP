import { useState } from "react";
import { Page, Section } from "../KitLayout";
import { AvailabilityCalendar, TimeSlotPicker } from "@/kit/bookings/AvailabilityCalendar";
import { GroupBookingFlow, RecurringBookingFlow, WaitlistFlow } from "@/kit/bookings/BookingFlows";
import { mockServices, mockSlotsForDay } from "@/kit/mock";

export default function BookingsShowcase() {
  const [date, setDate] = useState<Date>(new Date());
  const [slot, setSlot] = useState<string>();
  return (
    <Page title="Bookings" intro="Calendar + slots, plus the three missing flows: group, recurring, waitlist.">
      <Section title="Availability calendar + time slots">
        <div className="grid md:grid-cols-2 gap-6">
          <AvailabilityCalendar value={date} onChange={setDate} blockedDates={[]} />
          <div>
            <h3 className="text-sm font-medium mb-2">Available slots for {date.toLocaleDateString()}</h3>
            <TimeSlotPicker slots={mockSlotsForDay(date)} value={slot} onChange={setSlot} />
          </div>
        </div>
      </Section>
      <Section title="Group booking" description="Per-person or flat-rate group pricing with size limit.">
        <div className="max-w-md"><GroupBookingFlow service={mockServices[1]} perPerson maxGroupSize={10} /></div>
      </Section>
      <Section title="Recurring booking" description="Weekly / bi-weekly / monthly with end-by-count or end-by-date and a summary of all occurrences.">
        <div className="max-w-md"><RecurringBookingFlow service={mockServices[2]} /></div>
      </Section>
      <Section title="Waitlist" description="Email + phone form, then 'You're on the waitlist' with position.">
        <div className="max-w-md"><WaitlistFlow service={mockServices[0]} /></div>
      </Section>
    </Page>
  );
}
