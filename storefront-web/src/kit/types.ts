// Shared types for the ERP UI Kit. Map these to your ERP DTOs.

export type ID = string;

export interface NavLinkItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface AccountUser {
  id: ID;
  name: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
}

export interface Product {
  id: ID;
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  currency?: string;
  image: string;
  images?: Array<string | { url: string; alt_text?: string }>;
  rating?: number;
  reviewCount?: number;
  viewCount?: number;
  tags?: string[];
  inStock?: boolean;
  description?: string;
  track_inventory?: boolean;
  allow_backorders?: boolean;
  quantity?: number;
  stock_status?: string;
  max_quantity_per_order?: number | null;
  min_quantity_per_order?: number | null;
  variants?: {
    id: ID;
    label: string;
    value: string;
    available?: boolean;
    color?: string;
    attributes?: Record<string, string>;
    price?: number;
    compareAtPrice?: number;
    quantity?: number;
    track_inventory?: boolean;
    allow_backorders?: boolean;
    stock_status?: string;
    max_quantity_per_order?: number | null;
    min_quantity_per_order?: number | null;
    uom?: string;
    uom_quantity?: number | null;
    media?: { url: string; media_type?: 'image' | 'video' | 'model3d'; is_primary?: boolean; alt_text?: string; position?: number }[];
  }[];
  /** When true, card price shows "From" using the lowest variant price. */
  showFromPrice?: boolean;
}

export interface CartLine {
  id: ID;
  productId: ID;
  name: string;
  image: string;
  price: number;
  qty: number;
  variant?: string;
}

export interface Service {
  id: ID;
  slug: string;
  name: string;
  shortDescription?: string;
  description?: string;
  image?: string;
  durationMinutes: number;
  price: number;
  currency?: string;
  price_type?: string;
  plans?: Array<{ price?: number | null; price_min?: number | null; is_active?: boolean; sort_order?: number }>;
  features?: string[];
  allowQuoteRequest?: boolean;
  requiresBooking?: boolean;
  bookingLabel?: string;
  staff?: { id: ID; name: string; avatarUrl?: string }[];
}

export interface BookingSlot {
  start: string; // ISO
  end: string; // ISO
  available: boolean;
}

export interface Address {
  id: ID;
  label?: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
}

export interface Order {
  id: ID;
  number: string;
  placedAt: string;
  total: number;
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
  itemsCount: number;
}

export interface BlogPost {
  id: ID;
  slug: string;
  title: string;
  excerpt: string;
  cover: string;
  date: string;
  author: { name: string; avatarUrl?: string; bio?: string };
  tags?: string[];
  category?: string;
  content?: string;
  readingMinutes?: number;
}

export interface WishlistItem extends Product {
  savedAt: string;
  variantId?: string;
}

export interface NotificationPrefs {
  orderUpdates: boolean;
  promotions: boolean;
  newsletters: boolean;
  bookingReminders: boolean;
  smsEnabled: boolean;
}
