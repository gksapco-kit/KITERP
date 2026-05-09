export interface MockTestimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating?: number;
  avatar?: string;
}

const avatar = (h: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><rect width='80' height='80' fill='hsl(${h},35%,80%)'/><circle cx='40' cy='32' r='14' fill='hsl(${(h + 30) % 360},45%,55%)'/><rect x='14' y='52' width='52' height='30' rx='14' fill='hsl(${(h + 30) % 360},45%,55%)'/></svg>`,
  )}`;

export const mockTestimonials: MockTestimonial[] = [
  {
    id: "t1",
    name: "Priya N.",
    role: "Founder, Halo Studio",
    quote:
      "The brand strategy session unlocked six months of stuck thinking in two hours. We've been compounding ever since.",
    rating: 5,
    avatar: avatar(20),
  },
  {
    id: "t2",
    name: "Marco D.",
    role: "Head of Marketing, Northbound",
    quote:
      "Our identity finally feels like us. Clean process, zero drama, and the source files are pristine.",
    rating: 5,
    avatar: avatar(180),
  },
  {
    id: "t3",
    name: "Aiko T.",
    role: "Product lead, Fern",
    quote:
      "The audit gave us a prioritized list we could actually ship. Lighthouse went from 58 to 94 in a week.",
    rating: 4,
    avatar: avatar(120),
  },
];

export const mockProcess = [
  {
    id: "step1",
    step: 1,
    title: "Discover",
    description:
      "30-min intake call, brand questionnaire, and audit of current materials.",
  },
  {
    id: "step2",
    step: 2,
    title: "Define",
    description:
      "Workshop to align on positioning, audience, and visual direction.",
  },
  {
    id: "step3",
    step: 3,
    title: "Design",
    description:
      "Two concept directions presented, refined into one polished system.",
  },
  {
    id: "step4",
    step: 4,
    title: "Deliver",
    description:
      "Final assets, source files, and a guidelines doc handed off.",
  },
];

export const mockFaq = [
  {
    id: "f1",
    question: "How quickly can we get started?",
    answer:
      "Most engagements kick off within a week. Strategy sessions can usually be booked the same week if a slot is open.",
  },
  {
    id: "f2",
    question: "Do you offer payment plans?",
    answer:
      "Projects over $1,500 can be split into 2 or 3 milestone payments. Just ask before invoicing.",
  },
  {
    id: "f3",
    question: "What's your revision policy?",
    answer:
      "Each package includes one round of revisions. Additional rounds are billed at our hourly rate, agreed in advance.",
  },
  {
    id: "f4",
    question: "Can you work with our existing team?",
    answer:
      "Absolutely. We slot into Slack, Linear, or Notion and adapt our cadence to your stand-ups.",
  },
];

export interface MockTeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  rating: number;
  reviews: number;
  available: boolean;
  nextAvailable?: string;
  avatar: string;
}

export const mockTeam: MockTeamMember[] = [
  {
    id: "tm1",
    name: "Elena Ruiz",
    role: "Lead Strategist",
    bio: "12 years building brand systems for hospitality and DTC.",
    rating: 4.9,
    reviews: 87,
    available: true,
    nextAvailable: "Today, 3:30 PM",
    avatar: avatar(20),
  },
  {
    id: "tm2",
    name: "Jordan Chen",
    role: "Senior Designer",
    bio: "Identity, packaging, and editorial. Loves a tight grid.",
    rating: 4.8,
    reviews: 64,
    available: true,
    nextAvailable: "Tomorrow, 10:00 AM",
    avatar: avatar(160),
  },
  {
    id: "tm3",
    name: "Priya Shah",
    role: "Creative Director",
    bio: "Leads the studio. Heavy on positioning and verbal identity.",
    rating: 5.0,
    reviews: 42,
    available: false,
    nextAvailable: "Next Monday",
    avatar: avatar(310),
  },
];

export interface MockAddon {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  recommended?: boolean;
}

export const mockAddons: MockAddon[] = [
  {
    id: "ad1",
    name: "Brand voice guidelines",
    description: "Tone of voice doc with do/don't examples.",
    price: 250,
    currency: "USD",
    recommended: true,
  },
  {
    id: "ad2",
    name: "Social media kit",
    description: "Templated posts, story frames, and avatar set.",
    price: 180,
    currency: "USD",
  },
  {
    id: "ad3",
    name: "Pitch deck template",
    description: "16-slide editable Figma deck in your new system.",
    price: 220,
    currency: "USD",
  },
  {
    id: "ad4",
    name: "Onboarding email sequence",
    description: "5-email welcome flow, copy + design.",
    price: 320,
    currency: "USD",
  },
];
