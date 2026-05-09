export interface MockReview {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified?: boolean;
  helpful?: number;
}

export const mockReviews: MockReview[] = [
  {
    id: "r1",
    productId: "p1",
    author: "Mira K.",
    rating: 5,
    title: "Soft from day one",
    body: "Lovely linen weight, fits true to size. Wash cold, hang dry — perfect.",
    date: "2026-03-12",
    verified: true,
    helpful: 24,
  },
  {
    id: "r2",
    productId: "p1",
    author: "Devon S.",
    rating: 4,
    title: "Great shirt, sleeves a touch long",
    body: "Color is exactly as pictured. Sleeves run a little long for me.",
    date: "2026-02-28",
    verified: true,
    helpful: 11,
  },
  {
    id: "r3",
    productId: "p1",
    author: "Anonymous",
    rating: 5,
    title: "Perfect summer staple",
    body: "Breathes really well in heat. Wore it on a humid trip and stayed cool.",
    date: "2026-02-04",
    helpful: 6,
  },
  {
    id: "r4",
    productId: "p1",
    author: "Lina O.",
    rating: 3,
    title: "Wrinkles a lot",
    body: "Nice fabric but very wrinkly. Worth knowing if you don't iron.",
    date: "2026-01-19",
    verified: true,
    helpful: 19,
  },
];

export const reviewBreakdown = [
  { stars: 5, count: 78 },
  { stars: 4, count: 31 },
  { stars: 3, count: 12 },
  { stars: 2, count: 5 },
  { stars: 1, count: 2 },
];
