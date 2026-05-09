// Mock data for vertical industries

const swatch = (h: number, s = 35, l = 75) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${h},${s}%,${l}%)'/><stop offset='1' stop-color='hsl(${(h + 30) % 360},${s}%,${Math.max(l - 20, 25)}%)'/></linearGradient></defs><rect width='600' height='400' fill='url(%23g)'/></svg>`,
  )}`;

/* ---------- Real estate ---------- */

export interface Property {
  id: string;
  title: string;
  address: string;
  price: number;
  currency: string;
  beds: number;
  baths: number;
  sqft: number;
  type: "house" | "condo" | "loft" | "townhouse";
  status: "for-sale" | "pending" | "new" | "open-house";
  image: string;
  agent?: string;
}

export const mockProperties: Property[] = [
  {
    id: "re1",
    title: "Sunlit Park Slope Brownstone",
    address: "127 Carroll St, Brooklyn, NY",
    price: 1895000,
    currency: "USD",
    beds: 4,
    baths: 3,
    sqft: 2400,
    type: "house",
    status: "new",
    image: swatch(20),
    agent: "Sasha Reed",
  },
  {
    id: "re2",
    title: "Modern Loft with River Views",
    address: "88 Front St #5B, DUMBO",
    price: 1290000,
    currency: "USD",
    beds: 2,
    baths: 2,
    sqft: 1450,
    type: "loft",
    status: "for-sale",
    image: swatch(200),
    agent: "Daniel Chen",
  },
  {
    id: "re3",
    title: "Garden Townhouse with Studio",
    address: "412 Macon St, Bed-Stuy",
    price: 2150000,
    currency: "USD",
    beds: 5,
    baths: 4,
    sqft: 3100,
    type: "townhouse",
    status: "open-house",
    image: swatch(140, 30, 72),
    agent: "Mira Patel",
  },
  {
    id: "re4",
    title: "High-Floor Glass Condo",
    address: "1 Riverside Pl #28A",
    price: 985000,
    currency: "USD",
    beds: 1,
    baths: 1,
    sqft: 820,
    type: "condo",
    status: "pending",
    image: swatch(280, 25, 78),
  },
  {
    id: "re5",
    title: "Restored Greek Revival",
    address: "204 State St, Brooklyn Heights",
    price: 3450000,
    currency: "USD",
    beds: 5,
    baths: 4,
    sqft: 3800,
    type: "house",
    status: "for-sale",
    image: swatch(40, 40, 75),
    agent: "Sasha Reed",
  },
  {
    id: "re6",
    title: "Cozy 1BR with Private Terrace",
    address: "55 Berry St #3F, Williamsburg",
    price: 749000,
    currency: "USD",
    beds: 1,
    baths: 1,
    sqft: 680,
    type: "condo",
    status: "new",
    image: swatch(100, 30, 76),
    agent: "Daniel Chen",
  },
];

/* ---------- Auto inventory ---------- */

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  currency: string;
  mileage: number;
  fuel: "Gas" | "Hybrid" | "Electric" | "Diesel";
  transmission: "Auto" | "Manual";
  bodyStyle: string;
  exteriorColor: string;
  image: string;
  condition: "New" | "Certified" | "Used";
}

export const mockVehicles: Vehicle[] = [
  {
    id: "v1",
    year: 2025,
    make: "Rivian",
    model: "R1S",
    trim: "Adventure",
    price: 84900,
    currency: "USD",
    mileage: 12,
    fuel: "Electric",
    transmission: "Auto",
    bodyStyle: "SUV",
    exteriorColor: "Forest Green",
    image: swatch(140, 30, 65),
    condition: "New",
  },
  {
    id: "v2",
    year: 2023,
    make: "Toyota",
    model: "RAV4",
    trim: "XLE Hybrid",
    price: 32450,
    currency: "USD",
    mileage: 18420,
    fuel: "Hybrid",
    transmission: "Auto",
    bodyStyle: "SUV",
    exteriorColor: "Silver Sky",
    image: swatch(220, 10, 72),
    condition: "Certified",
  },
  {
    id: "v3",
    year: 2022,
    make: "Ford",
    model: "Maverick",
    trim: "Lariat",
    price: 28900,
    currency: "USD",
    mileage: 24180,
    fuel: "Hybrid",
    transmission: "Auto",
    bodyStyle: "Truck",
    exteriorColor: "Velocity Blue",
    image: swatch(210, 45, 60),
    condition: "Used",
  },
  {
    id: "v4",
    year: 2024,
    make: "Subaru",
    model: "Outback",
    trim: "Touring",
    price: 36450,
    currency: "USD",
    mileage: 4210,
    fuel: "Gas",
    transmission: "Auto",
    bodyStyle: "Wagon",
    exteriorColor: "Autumn Green",
    image: swatch(110, 25, 60),
    condition: "Certified",
  },
  {
    id: "v5",
    year: 2025,
    make: "Tesla",
    model: "Model 3",
    trim: "Long Range",
    price: 41990,
    currency: "USD",
    mileage: 60,
    fuel: "Electric",
    transmission: "Auto",
    bodyStyle: "Sedan",
    exteriorColor: "Pearl White",
    image: swatch(0, 0, 90),
    condition: "New",
  },
  {
    id: "v6",
    year: 2021,
    make: "Honda",
    model: "Civic",
    trim: "Sport",
    price: 21450,
    currency: "USD",
    mileage: 41280,
    fuel: "Gas",
    transmission: "Manual",
    bodyStyle: "Sedan",
    exteriorColor: "Sonic Gray",
    image: swatch(220, 5, 55),
    condition: "Used",
  },
];

/* ---------- Fitness classes ---------- */

export interface FitnessClass {
  id: string;
  name: string;
  instructor: string;
  type: "Yoga" | "HIIT" | "Cycle" | "Pilates" | "Strength" | "Boxing";
  duration: number;
  intensity: 1 | 2 | 3 | 4 | 5;
  date: string;
  time: string;
  capacity: number;
  booked: number;
  studio: string;
  price: number;
  currency: string;
}

export const mockFitnessClasses: FitnessClass[] = [
  {
    id: "fc1",
    name: "Sunrise Vinyasa",
    instructor: "Maya Lin",
    type: "Yoga",
    duration: 60,
    intensity: 2,
    date: "Mon, May 4",
    time: "6:30 AM",
    capacity: 24,
    booked: 18,
    studio: "Studio A",
    price: 22,
    currency: "USD",
  },
  {
    id: "fc2",
    name: "Power Cycle 45",
    instructor: "Jordan Park",
    type: "Cycle",
    duration: 45,
    intensity: 5,
    date: "Mon, May 4",
    time: "7:00 AM",
    capacity: 32,
    booked: 32,
    studio: "Cycle Room",
    price: 26,
    currency: "USD",
  },
  {
    id: "fc3",
    name: "Strength Foundations",
    instructor: "Kai Brooks",
    type: "Strength",
    duration: 50,
    intensity: 4,
    date: "Mon, May 4",
    time: "12:15 PM",
    capacity: 16,
    booked: 9,
    studio: "Lifting Floor",
    price: 28,
    currency: "USD",
  },
  {
    id: "fc4",
    name: "Reformer Pilates",
    instructor: "Sara Holm",
    type: "Pilates",
    duration: 55,
    intensity: 3,
    date: "Mon, May 4",
    time: "5:30 PM",
    capacity: 10,
    booked: 7,
    studio: "Studio B",
    price: 34,
    currency: "USD",
  },
  {
    id: "fc5",
    name: "HIIT & Conditioning",
    instructor: "Devon Wright",
    type: "HIIT",
    duration: 45,
    intensity: 5,
    date: "Mon, May 4",
    time: "6:30 PM",
    capacity: 20,
    booked: 14,
    studio: "Studio C",
    price: 24,
    currency: "USD",
  },
  {
    id: "fc6",
    name: "Boxing Basics",
    instructor: "Rico Alvarez",
    type: "Boxing",
    duration: 60,
    intensity: 4,
    date: "Mon, May 4",
    time: "7:30 PM",
    capacity: 14,
    booked: 11,
    studio: "Ring",
    price: 30,
    currency: "USD",
  },
];

/* ---------- Events / tickets ---------- */

export interface EventTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  perks: string[];
  remaining: number;
  popular?: boolean;
}

export const mockEvent = {
  id: "ev1",
  title: "Field Notes — A Night of Ambient",
  tagline: "An intimate evening of live electronic & strings",
  date: "Friday, June 5, 2026",
  doors: "7:30 PM",
  start: "8:30 PM",
  venue: "The Greene Room",
  address: "418 Atlantic Ave, Brooklyn",
  image: swatch(260, 35, 35),
  ageRestriction: "21+",
  tiers: [
    {
      id: "ga",
      name: "General Admission",
      price: 35,
      currency: "USD",
      perks: ["Standing room", "Access to all sets"],
      remaining: 124,
    },
    {
      id: "seated",
      name: "Reserved Seating",
      price: 65,
      currency: "USD",
      perks: ["Reserved seat", "Drink ticket included", "Early entry"],
      remaining: 38,
      popular: true,
    },
    {
      id: "vip",
      name: "VIP Lounge",
      price: 145,
      currency: "USD",
      perks: ["Lounge access", "Meet & greet", "Signed poster", "2 drink tickets"],
      remaining: 6,
    },
  ] as EventTier[],
};

export const mockEventList = [
  {
    id: "ev1",
    title: "Field Notes — A Night of Ambient",
    date: "Jun 5, 2026",
    venue: "The Greene Room, Brooklyn",
    image: swatch(260, 35, 35),
    fromPrice: 35,
    currency: "USD",
    tag: "Music",
  },
  {
    id: "ev2",
    title: "Spring Pop-Up Market",
    date: "Jun 12 – 13, 2026",
    venue: "Industry City",
    image: swatch(60, 40, 70),
    fromPrice: 0,
    currency: "USD",
    tag: "Free",
  },
  {
    id: "ev3",
    title: "Tasting: Natural Wines of the Loire",
    date: "Jun 18, 2026",
    venue: "Cellar No. 9",
    image: swatch(340, 35, 50),
    fromPrice: 55,
    currency: "USD",
    tag: "Food & Drink",
  },
  {
    id: "ev4",
    title: "Sketch Club: Life Drawing",
    date: "Jun 22, 2026",
    venue: "Atelier West",
    image: swatch(20, 30, 65),
    fromPrice: 18,
    currency: "USD",
    tag: "Workshop",
  },
];

/* ---------- Courses ---------- */

export interface Course {
  id: string;
  title: string;
  instructor: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  lessons: number;
  rating: number;
  reviews: number;
  price: number;
  currency: string;
  image: string;
  category: string;
  description: string;
}

export const mockCourses: Course[] = [
  {
    id: "c1",
    title: "Foundations of Modern Ceramics",
    instructor: "Naomi Reyes",
    level: "Beginner",
    duration: "6 weeks",
    lessons: 24,
    rating: 4.9,
    reviews: 412,
    price: 189,
    currency: "USD",
    image: swatch(20, 35, 75),
    category: "Craft",
    description: "Wheel throwing, hand-building, and your first three glazed pieces.",
  },
  {
    id: "c2",
    title: "Photography for Small Brands",
    instructor: "Theo Park",
    level: "Intermediate",
    duration: "4 weeks",
    lessons: 16,
    rating: 4.8,
    reviews: 287,
    price: 149,
    currency: "USD",
    image: swatch(220, 25, 60),
    category: "Photography",
    description: "Build a product photo system that scales without a studio.",
  },
  {
    id: "c3",
    title: "Bread & Pastry Fundamentals",
    instructor: "Élodie Marin",
    level: "Beginner",
    duration: "8 weeks",
    lessons: 32,
    rating: 4.9,
    reviews: 538,
    price: 229,
    currency: "USD",
    image: swatch(40, 45, 75),
    category: "Cooking",
    description: "From sourdough to laminated doughs — recipes you'll keep.",
  },
  {
    id: "c4",
    title: "Watercolor Botanicals",
    instructor: "Priya Anand",
    level: "Beginner",
    duration: "5 weeks",
    lessons: 20,
    rating: 4.7,
    reviews: 196,
    price: 129,
    currency: "USD",
    image: swatch(140, 35, 78),
    category: "Art",
    description: "Loose, expressive florals with a forgiving wet-on-wet technique.",
  },
];

export const mockCourseDetail = {
  ...mockCourses[0],
  syllabus: [
    {
      week: 1,
      title: "Materials, tools, and your studio setup",
      lessons: 4,
      duration: "1h 50m",
    },
    {
      week: 2,
      title: "Hand-building: pinch, coil, and slab",
      lessons: 5,
      duration: "2h 20m",
    },
    {
      week: 3,
      title: "Centering & throwing your first cylinder",
      lessons: 4,
      duration: "2h 05m",
    },
    {
      week: 4,
      title: "Trimming, foot rings, and refinement",
      lessons: 3,
      duration: "1h 35m",
    },
    {
      week: 5,
      title: "Surface, slip, and sgraffito",
      lessons: 4,
      duration: "1h 50m",
    },
    {
      week: 6,
      title: "Glazing, firing, and finishing your three pieces",
      lessons: 4,
      duration: "2h 10m",
    },
  ],
  outcomes: [
    "Throw a balanced cylinder, bowl, and mug",
    "Mix and apply two reliable glazes",
    "Run a small home or shared studio safely",
  ],
};
