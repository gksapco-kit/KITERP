export interface MockService {
  id: string;
  name: string;
  description: string;
  duration: string;
  price: number;
  currency: string;
  category: string;
  features: string[];
  popular?: boolean;
  image?: string;
}

const swatch = (h: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='hsl(${h},35%,82%)'/><circle cx='320' cy='80' r='60' fill='hsl(${(h + 30) % 360},45%,72%)'/></svg>`,
  )}`;

export const mockServices: MockService[] = [
  {
    id: "s1",
    name: "Brand Strategy Session",
    description: "Two-hour workshop to clarify positioning, voice, and visual direction.",
    duration: "2h",
    price: 350,
    currency: "USD",
    category: "Strategy",
    features: ["Discovery brief", "Positioning canvas", "Action plan"],
    popular: true,
    image: swatch(210),
  },
  {
    id: "s2",
    name: "Logo & Identity Package",
    description: "Full identity system with logo, type, and color guidelines.",
    duration: "2 weeks",
    price: 2400,
    currency: "USD",
    category: "Design",
    features: ["3 concepts", "Style guide", "Source files", "1 round revisions"],
    image: swatch(40),
  },
  {
    id: "s3",
    name: "Website Audit",
    description: "Detailed UX, performance, and SEO audit with prioritized fixes.",
    duration: "3 days",
    price: 600,
    currency: "USD",
    category: "Consulting",
    features: ["Lighthouse report", "Heuristic review", "Prioritized fixes"],
    image: swatch(160),
  },
  {
    id: "s4",
    name: "Monthly SEO Retainer",
    description: "Ongoing technical SEO, content briefs, and reporting.",
    duration: "Monthly",
    price: 1200,
    currency: "USD",
    category: "Marketing",
    features: ["Tech SEO", "4 content briefs", "Monthly report"],
    image: swatch(120),
  },
];

export const mockPricingTiers = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    period: "month",
    description: "For solo store owners getting set up.",
    features: ["1 business front", "Up to 50 products", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    price: 49,
    period: "month",
    description: "For growing brands needing more reach.",
    features: ["3 business fronts", "Unlimited products", "Priority support", "Abandoned cart"],
    highlighted: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: 129,
    period: "month",
    description: "For high-volume merchants.",
    features: ["Unlimited business fronts", "Advanced analytics", "Dedicated manager", "Custom integrations"],
  },
];
