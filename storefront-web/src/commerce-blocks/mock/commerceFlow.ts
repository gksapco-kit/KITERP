// Mock data for checkout, address, gift cards, order confirmation
export const mockCheckout = {
  items: [
    { productId: "p1", quantity: 1, variant: "M / Sand" },
    { productId: "p7", quantity: 2, variant: "Set of 4" },
  ],
  subtotal: 201,
  shipping: 0,
  tax: 16.08,
  discount: 20,
  total: 197.08,
  currency: "USD",
  promoCode: "WELCOME20",
};

export const mockAddresses = [
  {
    id: "a1",
    label: "Home",
    name: "Alex Morgan",
    line1: "1429 Garrison Ave",
    line2: "Apt 4B",
    city: "Brooklyn",
    region: "NY",
    postal: "11221",
    country: "United States",
    phone: "+1 (555) 014-2280",
    isDefault: true,
  },
  {
    id: "a2",
    label: "Office",
    name: "Alex Morgan",
    line1: "300 W 14th St",
    line2: "Floor 3",
    city: "New York",
    region: "NY",
    postal: "10014",
    country: "United States",
    phone: "+1 (555) 014-2280",
    isDefault: false,
  },
];

export const mockOrderConfirmation = {
  orderNumber: "AC-104829",
  placedAt: "April 27, 2026 · 14:02",
  email: "alex@morganstudio.co",
  items: [
    { productId: "p1", quantity: 1, variant: "M / Sand", price: 89 },
    { productId: "p7", quantity: 2, variant: "Set of 4", price: 56 },
  ],
  subtotal: 201,
  shipping: 0,
  tax: 16.08,
  discount: 20,
  total: 197.08,
  currency: "USD",
  shippingAddress: {
    name: "Alex Morgan",
    line1: "1429 Garrison Ave, Apt 4B",
    city: "Brooklyn, NY 11221",
  },
  estimatedDelivery: "May 2 – May 5",
  paymentLast4: "4242",
};

export const mockGiftCards = [
  {
    id: "gc25",
    amount: 25,
    currency: "USD",
    color: "from-amber-200 to-orange-300",
  },
  {
    id: "gc50",
    amount: 50,
    currency: "USD",
    color: "from-emerald-200 to-teal-300",
    popular: true,
  },
  {
    id: "gc100",
    amount: 100,
    currency: "USD",
    color: "from-sky-200 to-indigo-300",
  },
  {
    id: "gc250",
    amount: 250,
    currency: "USD",
    color: "from-rose-200 to-primary/30",
  },
];

export const mockGiftCardBalance = {
  code: "GC-9F4-2X8H",
  balance: 75.5,
  currency: "USD",
  issuedTo: "Alex Morgan",
  expires: "Dec 31, 2027",
  history: [
    { date: "Apr 12, 2026", description: "Order #AC-104102", amount: -24.5 },
    { date: "Mar 03, 2026", description: "Top-up", amount: 50 },
    { date: "Feb 14, 2026", description: "Gift from Jordan", amount: 50 },
  ],
};

/* ---------- Booking gaps ---------- */

export const mockGroupBooking = {
  service: "Vineyard Tour & Tasting",
  pricePerPerson: 65,
  currency: "USD",
  minSize: 4,
  maxSize: 20,
  includedAges: ["adult", "child"],
  date: "Sat, May 16",
  time: "2:00 PM",
};

export const mockRecurring = {
  service: "Weekly Yoga · Vinyasa Flow",
  startDate: "Mon, May 4",
  time: "7:30 AM · 60 min",
  pricePerSession: 22,
  currency: "USD",
  presets: [
    { id: "weekly", name: "Weekly", description: "Every week, same day" },
    { id: "biweekly", name: "Every 2 weeks", description: "Save 10%" },
    { id: "monthly", name: "Monthly", description: "Once per month" },
  ],
  upcoming: [
    { date: "May 4", status: "scheduled" },
    { date: "May 11", status: "scheduled" },
    { date: "May 18", status: "scheduled" },
    { date: "May 25", status: "scheduled" },
  ],
};

export const mockWaitlist = {
  service: "Private Sound Bath · Sunday 4:00 PM",
  position: 3,
  totalWaiting: 7,
  estimatedNotice: "24–72 hours",
  joinedAt: "Apr 22",
  others: [
    { name: "Jordan T.", joinedAt: "Apr 19" },
    { name: "Priya K.", joinedAt: "Apr 20" },
  ],
};
