export interface TimeSlot {
  time: string; // HH:mm
  available: boolean;
}

export interface DayAvailability {
  date: string; // ISO yyyy-mm-dd
  status: "available" | "limited" | "full" | "closed";
  slotsAvailable?: number;
}

const today = new Date();
today.setHours(0, 0, 0, 0);

function iso(offsetDays: number) {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export const mockAvailability: DayAvailability[] = Array.from({ length: 35 }, (_, i) => {
  const dow = (today.getDay() + i) % 7;
  if (dow === 0) return { date: iso(i), status: "closed" as const };
  const seed = (i * 13) % 7;
  if (seed < 2) return { date: iso(i), status: "full" as const, slotsAvailable: 0 };
  if (seed < 4)
    return { date: iso(i), status: "limited" as const, slotsAvailable: 2 };
  return { date: iso(i), status: "available" as const, slotsAvailable: 8 };
});

export const mockSlots: TimeSlot[] = [
  { time: "09:00", available: true },
  { time: "09:30", available: true },
  { time: "10:00", available: false },
  { time: "10:30", available: true },
  { time: "11:00", available: true },
  { time: "11:30", available: false },
  { time: "13:00", available: true },
  { time: "13:30", available: true },
  { time: "14:00", available: true },
  { time: "14:30", available: false },
  { time: "15:00", available: true },
  { time: "15:30", available: true },
  { time: "16:00", available: true },
  { time: "16:30", available: false },
  { time: "17:00", available: true },
];

export const mockBookingService = {
  name: "Brand Strategy Session",
  duration: "2 hours",
  price: 350,
  currency: "USD",
  location: "Studio · 14 Mercer St",
};
