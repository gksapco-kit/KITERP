export interface MockResource {
  id: string;
  name: string;
  type: "room" | "table" | "court" | "equipment";
  capacity: number;
  description: string;
  features: string[];
  pricePerHour: number;
  currency: string;
  available: boolean;
}

export const mockResources: MockResource[] = [
  {
    id: "rs1",
    name: "Studio A — North light",
    type: "room",
    capacity: 8,
    description: "Bright corner studio with 14ft ceilings and a roll-up door.",
    features: ["Natural light", "Sound system", "Whiteboard", "Wi-Fi 6"],
    pricePerHour: 95,
    currency: "USD",
    available: true,
  },
  {
    id: "rs2",
    name: "Studio B — Photo cyc",
    type: "room",
    capacity: 6,
    description: "9ft white cyc, Profoto strobes, and a tethering station.",
    features: ["Cyc wall", "Strobes", "Tethering", "Hair & makeup"],
    pricePerHour: 140,
    currency: "USD",
    available: true,
  },
  {
    id: "rs3",
    name: "Court 3 — Indoor",
    type: "court",
    capacity: 4,
    description: "Climate-controlled hard court with LED lighting.",
    features: ["Air conditioned", "Pro net", "Ball hopper", "Towels"],
    pricePerHour: 48,
    currency: "USD",
    available: false,
  },
  {
    id: "rs4",
    name: "Boardroom — Walnut",
    type: "room",
    capacity: 12,
    description: "Walnut conference table, video conferencing, catering ready.",
    features: ["Video conf", "Catering", "Privacy glass"],
    pricePerHour: 75,
    currency: "USD",
    available: true,
  },
];

export const mockWizardSteps = [
  { id: "service", label: "Service", description: "What are you booking?" },
  { id: "date", label: "Date", description: "Pick a day" },
  { id: "time", label: "Time", description: "Pick a slot" },
  { id: "details", label: "Details", description: "Your info" },
  { id: "review", label: "Review", description: "Confirm & pay" },
];

export const mockEmailPreview = {
  subject: "Your booking is confirmed — Brand Strategy Session",
  preheader: "Tue, May 14 at 2:00 PM · Studio · 14 Mercer St",
  from: "bookings@studio.example",
  to: "jane.doe@example.com",
  body: [
    "Hi Jane,",
    "Thanks for booking with us. Your Brand Strategy Session is confirmed for Tuesday, May 14 at 2:00 PM.",
    "Location: Studio · 14 Mercer St, Floor 3. Please arrive 5 minutes early — our front desk will buzz you up.",
    "Need to reschedule? You can do it free of charge up to 24 hours before your appointment.",
    "Looking forward to it,",
    "The Studio team",
  ],
};

export interface MockPastBooking {
  id: string;
  service: string;
  date: string;
  time: string;
  status: "completed" | "cancelled" | "no_show" | "upcoming";
  price: number;
  currency: string;
  withWho?: string;
}

export const mockPastBookings: MockPastBooking[] = [
  {
    id: "bk-2026-018",
    service: "Brand Strategy Session",
    date: "May 14, 2026",
    time: "14:00",
    status: "upcoming",
    price: 350,
    currency: "USD",
    withWho: "Elena Ruiz",
  },
  {
    id: "bk-2026-014",
    service: "Logo Refinement",
    date: "Apr 02, 2026",
    time: "10:30",
    status: "completed",
    price: 180,
    currency: "USD",
    withWho: "Jordan Chen",
  },
  {
    id: "bk-2026-009",
    service: "Website Audit",
    date: "Mar 18, 2026",
    time: "16:00",
    status: "completed",
    price: 600,
    currency: "USD",
    withWho: "Priya Shah",
  },
  {
    id: "bk-2026-002",
    service: "Quick Consult",
    date: "Feb 11, 2026",
    time: "11:00",
    status: "cancelled",
    price: 75,
    currency: "USD",
  },
];
