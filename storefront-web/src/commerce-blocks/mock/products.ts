export interface MockProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  image?: string;
  tags: string[];
  category: string;
  inStock: boolean;
  rating?: number;
  reviews?: number;
}

const swatch = (h: number, s = 40, l = 80) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${h},${s}%,${l}%)'/><stop offset='1' stop-color='hsl(${(h + 40) % 360},${s}%,${Math.max(l - 20, 20)}%)'/></linearGradient></defs><rect width='400' height='400' fill='url(%23g)'/></svg>`,
  )}`;

export const mockProducts: MockProduct[] = [
  {
    id: "p1",
    name: "Linen Field Shirt",
    description: "Breathable lightweight linen, garment-washed for softness.",
    price: 89,
    compareAtPrice: 120,
    currency: "USD",
    image: swatch(30),
    tags: ["New", "Linen"],
    category: "Apparel",
    inStock: true,
    rating: 4.6,
    reviews: 128,
  },
  {
    id: "p2",
    name: "Ceramic Pour-over Kit",
    description: "Hand-thrown ceramic dripper with bamboo carafe.",
    price: 64,
    currency: "USD",
    image: swatch(20, 30, 78),
    tags: ["Bestseller"],
    category: "Home",
    inStock: true,
    rating: 4.8,
    reviews: 342,
  },
  {
    id: "p3",
    name: "Walnut Desk Tray",
    description: "Hand-finished walnut catch-all for the everyday carry.",
    price: 48,
    currency: "USD",
    image: swatch(15, 35, 60),
    tags: ["Wood"],
    category: "Home",
    inStock: true,
    rating: 4.7,
    reviews: 89,
  },
  {
    id: "p4",
    name: "Wool Trail Socks",
    description: "Merino blend with cushioned heel — 3-pair pack.",
    price: 32,
    currency: "USD",
    image: swatch(200, 30, 75),
    tags: ["Pack of 3"],
    category: "Apparel",
    inStock: false,
    rating: 4.5,
    reviews: 56,
  },
  {
    id: "p5",
    name: "Brass Pocket Notebook",
    description: "Refillable brass cover with 96 pages of cotton paper.",
    price: 38,
    currency: "USD",
    image: swatch(45, 50, 70),
    tags: ["Refillable"],
    category: "Stationery",
    inStock: true,
    rating: 4.9,
    reviews: 412,
  },
  {
    id: "p6",
    name: "Canvas Day Tote",
    description: "Heavy-duty 14oz canvas with leather handles.",
    price: 72,
    compareAtPrice: 95,
    currency: "USD",
    image: swatch(160, 25, 78),
    tags: ["Sale"],
    category: "Bags",
    inStock: true,
    rating: 4.4,
    reviews: 203,
  },
  {
    id: "p7",
    name: "Stoneware Mug Set",
    description: "Set of 4 reactive-glaze stoneware mugs, dishwasher safe.",
    price: 56,
    currency: "USD",
    image: swatch(280, 25, 80),
    tags: [],
    category: "Home",
    inStock: true,
    rating: 4.6,
    reviews: 167,
  },
  {
    id: "p8",
    name: "Recycled Wool Throw",
    description: "Soft and warm throw made from recycled wool fibers.",
    price: 128,
    currency: "USD",
    image: swatch(320, 25, 78),
    tags: ["Recycled"],
    category: "Home",
    inStock: true,
    rating: 4.8,
    reviews: 91,
  },
];

export const mockCategories: Array<{ id: string; name: string; count: number; image?: string; appliesTo?: string }> = [
  { id: "apparel", name: "Apparel", count: 24, image: swatch(30), appliesTo: "product" },
  { id: "home", name: "Home", count: 41, image: swatch(160, 25, 78), appliesTo: "product" },
  { id: "stationery", name: "Stationery", count: 12, image: swatch(45, 50, 70), appliesTo: "product" },
  { id: "bags", name: "Bags", count: 8, image: swatch(280, 25, 80), appliesTo: "product" },
];
