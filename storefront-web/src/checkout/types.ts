/* ============================================================
   Checkout Template — Data Contract
   ------------------------------------------------------------
   These are the ONLY shapes the UI consumes. Wire these to
   your ERP endpoints in Cursor. Nothing else needs to change.
   ============================================================ */

export type Money = {
  /** Integer in minor units (cents). e.g. 1999 = $19.99 */
  amount: number;
  currency: string; // ISO 4217 e.g. "USD"
};

export type CartItem = {
  id: string;
  productId: string;
  /** Present for service / booking / subscription cart lines */
  serviceId?: string;
  variantId?: string;
  name: string;
  variantLabel?: string; // e.g. "Black / Large"
  imageUrl?: string;
  unitPrice: Money;
  quantity: number;
  /** Optional per-line metadata for ERP use */
  sku?: string;
  inStock?: boolean;
  maxQuantity?: number;
};

export type DiscountLine = {
  code: string;
  label: string;
  amount: Money; // negative impact represented as positive amount, subtracted in summary
};

export type TaxLine = {
  label: string; // e.g. "VAT 20%"
  amount: Money;
};

export type Cart = {
  id: string;
  items: CartItem[];
  subtotal: Money;
  shipping?: Money;
  discounts: DiscountLine[];
  taxes: TaxLine[];
  total: Money;
};

export type Address = {
  id?: string;
  label?: string; // "Home", "Office"
  fullName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region: string; // state/province
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
  phone?: string;
  isDefault?: boolean;
};

export type ShippingMethod = {
  id: string;
  label: string;
  description?: string; // "2-3 business days"
  price: Money;
  estimatedDays?: { min: number; max: number };
};

export type PaymentProvider =
  | "stripe"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "klarna"
  | "afterpay"
  | "razorpay"
  | "square"
  | "payu"
  | "cod";
export type PaymentTabType = "card" | "wallet" | "bank_transfer" | "bnpl" | "upi";

export type CardDetails = {
  number: string;
  name: string;
  expMonth: string;
  expYear: string;
  cvc: string;
};

export type ProviderPaymentDetails = {
  method?: "upi" | "card" | "netbanking" | "wallet" | "paypal";
  vpa?: string;
  cardDetails?: CardDetails;
  bank?: string;
  wallet?: string;
  paypalEmail?: string;
};

export type PaymentSelection =
  | { kind: "tab"; tab: PaymentTabType; cardDetails?: CardDetails }
  | { kind: "provider"; provider: PaymentProvider; details?: ProviderPaymentDetails };

export type Customer = {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isGuest: boolean;
  savedAddresses?: Address[];
};

export type OrderStatus =
  | "placed"
  | "paid"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refunded";

export type OrderTimelineEvent = {
  status: OrderStatus;
  label: string;
  description?: string;
  occurredAt?: string; // ISO datetime; undefined = future
};

export type Order = {
  id: string;
  number: string; // human-friendly e.g. "ORD-10293"
  placedAt: string;
  status: OrderStatus;
  customer: Customer;
  shippingAddress: Address;
  billingAddress?: Address;
  shippingMethod: ShippingMethod;
  cart: Cart;
  paymentSummary: {
    method: string; // "Visa •••• 4242"
    provider?: PaymentProvider;
  };
  notes?: string;
  giftMessage?: string;
  timeline?: OrderTimelineEvent[];
  trackingUrl?: string;
  trackingNumber?: string;
};

/* ---------- Handlers (wired to ERP in Cursor) ---------- */
export type CheckoutHandlers = {
  onUpdateQuantity?: (itemId: string, quantity: number) => void;
  onRemoveItem?: (itemId: string) => void;
  onApplyCoupon?: (code: string) => Promise<{ ok: boolean; message?: string }>;
  onRemoveCoupon?: (code: string) => void;
  onSubmitAddress?: (address: Address) => void | Promise<void>;
  onSelectSavedAddress?: (addressId: string) => void;
  onSelectShipping?: (methodId: string) => void;
  onSelectPayment?: (selection: PaymentSelection) => void;
  onPlaceOrder?: (payload: {
    customer: Customer;
    shippingAddress: Address;
    billingAddress: Address;
    shippingMethodId: string;
    payment: PaymentSelection;
    notes?: string;
    giftMessage?: string;
  }) => Promise<{ ok: boolean; orderId?: string; error?: string }>;
  onRetryPayment?: () => void;
};
