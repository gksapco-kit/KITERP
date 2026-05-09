import type { Address, Cart, Customer, Order, ShippingMethod } from "../types";

export const mockShippingMethods: ShippingMethod[] = [
  {
    id: "standard",
    label: "Standard shipping",
    description: "3–5 business days",
    price: { amount: 499, currency: "USD" },
    estimatedDays: { min: 3, max: 5 },
  },
  {
    id: "express",
    label: "Express shipping",
    description: "1–2 business days",
    price: { amount: 1499, currency: "USD" },
    estimatedDays: { min: 1, max: 2 },
  },
  {
    id: "pickup",
    label: "Store pickup",
    description: "Ready in 4 hours",
    price: { amount: 0, currency: "USD" },
  },
];

export const mockSavedAddresses: Address[] = [
  {
    id: "addr_1",
    label: "Home",
    fullName: "Alex Morgan",
    line1: "421 Linden Ave",
    line2: "Apt 3B",
    city: "Brooklyn",
    region: "NY",
    postalCode: "11217",
    country: "US",
    phone: "+1 555 0142",
    isDefault: true,
  },
  {
    id: "addr_2",
    label: "Office",
    fullName: "Alex Morgan",
    company: "Northwind Co.",
    line1: "1 Park Plaza",
    line2: "Suite 1200",
    city: "New York",
    region: "NY",
    postalCode: "10003",
    country: "US",
    phone: "+1 555 0142",
  },
];

export const mockCart: Cart = {
  id: "cart_demo",
  items: [
    {
      id: "li_1",
      productId: "p_1",
      variantId: "v_1",
      name: "Linen Overshirt",
      variantLabel: "Sand / M",
      imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=200&h=200&fit=crop",
      unitPrice: { amount: 8900, currency: "USD" },
      quantity: 1,
      sku: "LIN-OVR-SND-M",
      inStock: true,
      maxQuantity: 5,
    },
    {
      id: "li_2",
      productId: "p_2",
      variantId: "v_2",
      name: "Wool Beanie",
      variantLabel: "Charcoal",
      imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=200&h=200&fit=crop",
      unitPrice: { amount: 2400, currency: "USD" },
      quantity: 2,
      sku: "WOL-BNE-CHR",
      inStock: true,
      maxQuantity: 10,
    },
    {
      id: "li_3",
      productId: "p_3",
      name: "Leather Card Holder",
      variantLabel: "Tan",
      imageUrl: "https://images.unsplash.com/photo-1606503825008-909a67e63c3d?w=200&h=200&fit=crop",
      unitPrice: { amount: 3500, currency: "USD" },
      quantity: 1,
      sku: "LTR-CRD-TAN",
      inStock: true,
    },
  ],
  subtotal: { amount: 17200, currency: "USD" },
  shipping: { amount: 499, currency: "USD" },
  discounts: [{ code: "WELCOME10", label: "Welcome 10%", amount: { amount: 1720, currency: "USD" } }],
  taxes: [{ label: "Sales tax (8.875%)", amount: { amount: 1378, currency: "USD" } }],
  total: { amount: 17357, currency: "USD" },
};

export const mockCustomer: Customer = {
  email: "alex@example.com",
  firstName: "Alex",
  lastName: "Morgan",
  isGuest: true,
  savedAddresses: mockSavedAddresses,
};

export const mockOrder: Order = {
  id: "order_demo",
  number: "ORD-10293",
  placedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  status: "shipped",
  customer: mockCustomer,
  shippingAddress: mockSavedAddresses[0],
  shippingMethod: mockShippingMethods[0],
  cart: mockCart,
  paymentSummary: { method: "Visa •••• 4242", provider: "stripe" },
  notes: "Please leave at the front desk.",
  trackingNumber: "1Z999AA10123456784",
  trackingUrl: "#",
  timeline: [
    {
      status: "placed",
      label: "Order placed",
      occurredAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    },
    { status: "paid", label: "Payment confirmed", occurredAt: new Date(Date.now() - 1000 * 60 * 60 * 29).toISOString() },
    { status: "packed", label: "Packed", occurredAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() },
    { status: "shipped", label: "Shipped", occurredAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
    { status: "out_for_delivery", label: "Out for delivery" },
    { status: "delivered", label: "Delivered" },
  ],
};
