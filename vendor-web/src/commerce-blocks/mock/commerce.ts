import { mockProducts } from "./products";

export const mockBundle = {
  id: "b1",
  title: "Frequently bought together",
  productIds: ["p2", "p7", "p3"],
  bundlePrice: 148,
  originalPrice: 168,
  currency: "USD",
};

export const mockCrossSell = {
  title: "You might also like",
  productIds: ["p5", "p6", "p8", "p1"],
};

export const mockRecentlyViewed = {
  title: "Recently viewed",
  productIds: ["p4", "p1", "p7", "p3", "p5"],
};

export const mockSearchResults = {
  query: "linen",
  total: 3,
  productIds: ["p1", "p3", "p2"],
  suggestions: ["linen shirt", "linen napkins", "linen tote"],
};

export const mockFilters = [
  {
    id: "category",
    name: "Category",
    type: "checkbox" as const,
    options: [
      { id: "apparel", label: "Apparel", count: 24 },
      { id: "home", label: "Home", count: 41 },
      { id: "stationery", label: "Stationery", count: 12 },
      { id: "bags", label: "Bags", count: 8 },
    ],
  },
  {
    id: "color",
    name: "Color",
    type: "swatch" as const,
    options: [
      { id: "stone", label: "Stone", color: "#d6cfc4" },
      { id: "navy", label: "Navy", color: "#1f2a44" },
      { id: "moss", label: "Moss", color: "#6b7a4f" },
      { id: "rust", label: "Rust", color: "#a8593a" },
      { id: "ink", label: "Ink", color: "#1c1c1c" },
    ],
  },
  {
    id: "price",
    name: "Price",
    type: "range" as const,
    min: 0,
    max: 200,
    value: [20, 120] as [number, number],
  },
  {
    id: "availability",
    name: "Availability",
    type: "checkbox" as const,
    options: [
      { id: "in-stock", label: "In stock", count: 62 },
      { id: "preorder", label: "Pre-order", count: 4 },
    ],
  },
];

export const mockWishlist = {
  productIds: ["p1", "p6", "p8"],
};

export const mockPromos = [
  {
    id: "promo1",
    code: "SPRING20",
    headline: "Spring sale — 20% off everything",
    subline: "Use code SPRING20 at checkout. Ends Sunday.",
    accent: "primary" as const,
  },
  {
    id: "promo2",
    code: "FREESHIP",
    headline: "Free shipping on orders over $50",
    subline: "No code needed. Continental US only.",
    accent: "muted" as const,
  },
];

export const mockOrder = {
  id: "ORD-10428",
  status: "in_transit" as "ordered" | "packed" | "in_transit" | "delivered",
  placedAt: "Apr 22",
  estimatedDelivery: "Apr 29",
  carrier: "USPS Priority",
  tracking: "9400 1118 9988 7766 5544",
  items: [
    { productId: "p2", qty: 1 },
    { productId: "p7", qty: 1 },
  ],
  steps: [
    { id: "ordered", label: "Order placed", date: "Apr 22" },
    { id: "packed", label: "Packed", date: "Apr 23" },
    { id: "in_transit", label: "In transit", date: "Apr 25" },
    { id: "delivered", label: "Delivered", date: null },
  ],
};

export const mockLoyalty = {
  tier: "Gold",
  points: 1840,
  nextTier: "Platinum",
  pointsToNext: 660,
  totalToNext: 2500,
  perks: [
    "Free shipping on every order",
    "Early access to new drops",
    "2× points on weekends",
    "Birthday gift",
  ],
};

export { mockProducts };
