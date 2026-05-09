import type {
  Product,
  Service,
  CartLine,
  Address,
  Order,
  BlogPost,
  WishlistItem,
  AccountUser,
  BookingSlot,
  NavLinkItem,
} from "./types";

const img = (seed: string, w = 800, h = 600) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const mockNavLinks: NavLinkItem[] = [
  { label: "Shop", href: "/products" },
  { label: "Services", href: "/services" },
  { label: "Bookings", href: "/bookings" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export const mockUser: AccountUser = {
  id: "u_1",
  name: "Aarav Sharma",
  email: "aarav@example.com",
  phone: "+91 90000 12345",
  avatarUrl: img("avatar-aarav", 128, 128),
};

export const mockProducts: Product[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `p_${i + 1}`,
  slug: `product-${i + 1}`,
  name:
    [
      "Aurora Linen Shirt",
      "Nimbus Sneakers",
      "Onyx Smartwatch",
      "Bloom Ceramic Mug",
      "Halcyon Backpack",
      "Solace Desk Lamp",
      "Vesper Sunglasses",
      "Ember Chef Knife",
    ][i] || `Product ${i + 1}`,
  price: 1200 + i * 350,
  compareAtPrice: i % 2 === 0 ? 1800 + i * 350 : undefined,
  currency: "INR",
  image: img(`prod-${i}`, 600, 600),
  images: [img(`prod-${i}-a`, 800, 800), img(`prod-${i}-b`, 800, 800), img(`prod-${i}-c`, 800, 800)],
  rating: 4 + ((i % 10) / 10) * 0.9,
  reviewCount: 12 + i * 7,
  tags: i % 3 === 0 ? ["new"] : i % 3 === 1 ? ["bestseller"] : ["sale"],
  inStock: i !== 5,
  description:
    "Crafted with premium materials and a relentless eye for detail. Designed to last across seasons.",
  variants: [
    { id: "s", label: "S", value: "s" },
    { id: "m", label: "M", value: "m" },
    { id: "l", label: "L", value: "l", available: false },
  ],
}));

export const mockCartLines: CartLine[] = [
  { id: "c1", productId: "p_1", name: "Aurora Linen Shirt", image: img("prod-0"), price: 1200, qty: 1, variant: "M" },
  { id: "c2", productId: "p_3", name: "Bloom Ceramic Mug", image: img("prod-3"), price: 1900, qty: 2 },
];

export const mockServices: Service[] = [
  {
    id: "s_1",
    slug: "deep-tissue-massage",
    name: "Deep Tissue Massage",
    shortDescription: "60-minute therapeutic massage focused on tension relief.",
    durationMinutes: 60,
    price: 2200,
    currency: "INR",
    image: img("svc-1", 900, 600),
    features: ["Certified therapist", "Aromatherapy oils", "Hot towel finish"],
    staff: [
      { id: "st_1", name: "Riya", avatarUrl: img("staff-r", 96, 96) },
      { id: "st_2", name: "Kabir", avatarUrl: img("staff-k", 96, 96) },
    ],
  },
  {
    id: "s_2",
    slug: "studio-photography",
    name: "Studio Photography",
    shortDescription: "Portrait or product shoot with professional lighting.",
    durationMinutes: 90,
    price: 5500,
    currency: "INR",
    image: img("svc-2", 900, 600),
    features: ["10 retouched photos", "Backdrop options", "Same-day previews"],
  },
  {
    id: "s_3",
    slug: "home-cleaning",
    name: "Home Deep Cleaning",
    shortDescription: "Top-to-bottom home cleaning by a 2-person crew.",
    durationMinutes: 180,
    price: 3500,
    currency: "INR",
    image: img("svc-3", 900, 600),
    features: ["Eco-friendly products", "Window & balcony", "Satisfaction guarantee"],
  },
];

export function mockSlotsForDay(date: Date): BookingSlot[] {
  return Array.from({ length: 8 }).map((_, i) => {
    const start = new Date(date);
    start.setHours(9 + i, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(start.getMinutes() + 60);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      available: ![2, 5].includes(i),
    };
  });
}

export const mockAddresses: Address[] = [
  {
    id: "a_1",
    label: "Home",
    fullName: "Aarav Sharma",
    line1: "12 Banyan Lane",
    city: "Bengaluru",
    state: "KA",
    postalCode: "560001",
    country: "India",
    phone: "+91 90000 12345",
    isDefault: true,
  },
  {
    id: "a_2",
    label: "Office",
    fullName: "Aarav Sharma",
    line1: "Tower B, Indiqube",
    line2: "Koramangala",
    city: "Bengaluru",
    state: "KA",
    postalCode: "560034",
    country: "India",
  },
];

export const mockOrders: Order[] = [
  { id: "o_1", number: "INV-1043", placedAt: "2026-04-12", total: 4900, status: "delivered", itemsCount: 3 },
  { id: "o_2", number: "INV-1078", placedAt: "2026-04-21", total: 1899, status: "shipped", itemsCount: 1 },
  { id: "o_3", number: "INV-1102", placedAt: "2026-04-26", total: 7250, status: "pending", itemsCount: 4 },
];

export const mockWishlist: WishlistItem[] = mockProducts.slice(0, 4).map((p, i) => ({
  ...p,
  savedAt: `2026-04-${10 + i}`,
}));

export const mockBlogPosts: BlogPost[] = Array.from({ length: 6 }).map((_, i) => ({
  id: `b_${i + 1}`,
  slug: `post-${i + 1}`,
  title:
    [
      "Designing for trust in modern checkout flows",
      "Why your booking funnel is leaking revenue",
      "A field guide to ERP UX",
      "Inventory accuracy: the silent profit killer",
      "From quote to cash in seven days",
      "The case for opinionated software",
    ][i] || `Article ${i + 1}`,
  excerpt:
    "A practical, opinionated look at the patterns that move the needle for product, ops and finance teams.",
  cover: img(`blog-${i}`, 900, 600),
  date: `2026-04-${10 + i}`,
  author: {
    name: ["Mira Iyer", "Devansh Rao", "Noor Khan"][i % 3],
    avatarUrl: img(`author-${i}`, 96, 96),
    bio: "Writes about commerce, ops and the systems that hold them together.",
  },
  tags: [["product", "ux"], ["ops"], ["erp", "guide"]][i % 3],
  category: ["Product", "Operations", "Guides"][i % 3],
  readingMinutes: 4 + (i % 5),
  content:
    "## Section heading\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur quis ligula vitae nibh dapibus dignissim.\n\n- Bullet one\n- Bullet two\n- Bullet three",
}));

export function formatPrice(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}
