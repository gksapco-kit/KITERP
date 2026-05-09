# Checkout Template — Integration Guide

A self-contained, UI-only checkout template designed to be dropped into ERP-generated storefronts. No backend dependencies. All visual styling driven by CSS variables; all data driven by typed props.

---

## File map

```
src/checkout/
├── theme.css                 ← All visual tokens (override per tenant)
├── types.ts                  ← Data contract — map your ERP responses to these shapes
├── config.tsx                ← CheckoutConfig (layout, feature toggles, branding)
├── components/               ← Reusable, token-driven UI pieces
│   ├── Header.tsx
│   ├── LineItem.tsx
│   ├── OrderSummary.tsx
│   ├── AddressForm.tsx
│   ├── AddressBook.tsx
│   ├── ShippingMethods.tsx
│   ├── PaymentSection.tsx
│   ├── ContactStep.tsx
│   └── Section.tsx
├── layouts/                  ← Three interchangeable checkout layouts
│   ├── TwoColumnLayout.tsx
│   ├── WizardLayout.tsx
│   └── AccordionLayout.tsx
├── hooks/
│   └── useCheckoutDemo.ts    ← Replace with your real ERP-backed state
├── mock/
│   └── data.ts               ← Sample cart / addresses / order
└── pages/
    ├── CartPage.tsx
    ├── CheckoutPage.tsx
    ├── OrderConfirmationPage.tsx
    ├── OrderStatusPage.tsx
    └── ThemePreviewPage.tsx
```

---

## Builder integration — `wb_sites.style_config`

When a vendor publishes via the **vendor website builder** (Style panel → Checkout section), these two optional keys are written into `wb_sites.style_config`:

| Key | Type | Purpose |
|-----|------|---------|
| `checkout_layout` | `"two-column" \| "wizard" \| "accordion"` | Sets the default layout for `/checkout`. Vendor picks it in Style panel → Checkout → Page Layout. |
| `checkout_token_overrides` | `Record<string, string>` | Per-token CSS variable values for `.checkout-root` (HSL triplets or raw values). Set in Style panel → Checkout → Advanced Checkout Tokens. |

**Precedence at `/checkout`:**

```
theme.css defaults
  ↓ overridden by style_config primary/accent/bg/font/radius (auto-mapped)
    ↓ overridden by style_config.checkout_token_overrides
      ↓ overridden by ?layout= URL param (QA / dev override only)
```

Colors derived automatically: `primary_color → --brand-primary`, `accent_color → --brand-accent`, `bg_color → --surface`, `surface_color → --surface-muted`, `text_color → --text`, `font_heading → --font-heading`, `font_body → --font-body`. `border_radius` enum maps to `--radius-*` pixel values.

---

## Theming (per tenant)

Every visual decision lives in `theme.css` as CSS variables on `.checkout-root`. To re-skin a tenant store, just override variables on the root element — no rebuild, no JS:

```html
<div
  class="checkout-root"
  style="
    --brand-primary: 12 90% 55%;
    --brand-primary-foreground: 0 0% 100%;
    --radius-md: 14px;
    --font-heading: 'Playfair Display', serif;
    --logo-height: 40px;
  "
>
  <CheckoutPage />
</div>
```

Colors use **HSL triplets** (no `hsl()` wrapper, no commas) so they can be used with alpha: `hsl(var(--brand-primary) / 0.1)`.

Use **`/theme` in the running app** as a live editor — try the presets, paste in your brand color, then copy the resulting CSS block into your ERP's tenant config.

### Token reference

| Token | Purpose |
|---|---|
| `--brand-primary`, `--brand-primary-foreground` | CTAs, active states |
| `--brand-accent`, `--brand-accent-foreground` | Secondary highlights |
| `--surface`, `--surface-muted`, `--surface-elevated` | Backgrounds |
| `--border-token` | All borders |
| `--text`, `--text-muted`, `--text-subtle` | Typography colors |
| `--success`, `--warning`, `--danger`, `--info` | Status colors |
| `--font-heading`, `--font-body`, `--font-size-base` | Typography |
| `--radius-sm/md/lg` | Corner roundness |
| `--shadow-sm/md/lg` | Elevation |
| `--logo-height` | Header logo sizing |

---

## Configuration (per store, runtime)

Wrap your checkout in `CheckoutConfigProvider` to override behavior:

```tsx
<CheckoutConfigProvider
  config={{
    layout: "two-column",     // | "wizard" | "accordion"
    paymentMode: "hybrid",    // | "tabs" | "providers"
    enabledProviders: ["stripe", "paypal", "apple_pay"],
    showCoupon: true,
    showOrderNotes: true,
    showGiftMessage: false,
    allowGuest: true,
    requirePhone: false,
    showTaxBreakdown: true,
    showShippingMethods: true,
    showSavedAddresses: true,
    showTrustBadges: true,
    storeName: "Acme Goods",
    logoUrl: "https://cdn.example.com/acme-logo.svg",
    locale: "en-US",
    legalLinks: [{ label: "Refund policy", href: "/refunds" }],
  }}
>
  <CheckoutPage />
</CheckoutConfigProvider>
```

Store this config in your ERP per tenant and pass it in.

---

## Data contract — the only thing Cursor needs to wire

Everything the UI consumes is in `types.ts`. Map your ERP API responses to:

- `Cart` — items, subtotal, shipping, discounts, taxes, total
- `Address` — shipping/billing address
- `ShippingMethod[]` — available rates
- `Customer` — email, optional saved addresses
- `Order` — confirmation + status timeline
- `PaymentSelection` — what user picked

Replace the `useCheckoutDemo` hook with real React Query (or whatever) calls into your ERP. Components do not need to change.

### Wiring example

```tsx
function useCheckout(cartId: string) {
  const cart = useQuery(['cart', cartId], () => api.getCart(cartId));
  const shippingMethods = useQuery(['shipping', cartId], () => api.getShippingMethods(cartId));

  return {
    state: {
      cart: cart.data,
      shippingMethods: shippingMethods.data ?? [],
      // ...
    },
    actions: {
      updateQuantity: (id, q) => api.updateCartItem(cartId, id, q),
      applyCoupon: (code) => api.applyCoupon(cartId, code),
      setShippingMethod: (id) => api.setShippingMethod(cartId, id),
      placeOrder: (payload) => api.placeOrder(cartId, payload),
      // ...
    },
  };
}
```

Then in `CheckoutPage`:

```tsx
const checkout = useCheckout(cartId);  // your hook
return <TwoColumnLayout {...checkout} />;
```

---

## Payment integration

The `PaymentSection` is provider-agnostic. It supports three modes via `paymentMode`:

- **`tabs`** — Card / Wallet / Bank / BNPL tabs with mock fields. Use when you collect details yourself or via a single provider.
- **`providers`** — Branded buttons (Stripe, PayPal, Apple Pay, Google Pay, Klarna, Afterpay). Cursor swaps each button for the real SDK widget.
- **`hybrid`** — Provider buttons on top, card form below.

It emits `PaymentSelection` events. To plug in **Stripe Elements**:

```tsx
<PaymentSection onChange={(sel) => {
  if (sel.kind === 'tab' && sel.tab === 'card') {
    // mount <CardElement /> in place of the demo CardForm
  }
  if (sel.kind === 'provider' && sel.provider === 'stripe') {
    // trigger Stripe Express Checkout / Payment Request Button
  }
}} />
```

Or replace the entire `<PaymentSection />` with your provider's prebuilt widget — the surrounding layout doesn't care.

---

## Routes shipped in the demo

| Route | Purpose |
|---|---|
| `/cart` | Cart page with empty state |
| `/checkout` | Default two-column checkout |
| `/checkout?layout=wizard` | Multi-step wizard |
| `/checkout?layout=accordion` | Accordion checkout |
| `/checkout?payment=tabs` | Tabs-only payment mode |
| `/order/:id/confirmation` | Thank-you page |
| `/order/:id/status` | Tracking timeline |
| `/theme` | Live theme editor with presets |

Lift these routes (or any subset) into your ERP's storefront router.

---

## States covered

- ✅ Empty cart
- ✅ Editable cart line items (qty, remove, max-qty cap)
- ✅ Out-of-stock badge
- ✅ Saved address picker + add new
- ✅ Inline form validation with error states
- ✅ Coupon apply / remove with badge
- ✅ Shipping method selection (incl. free / pickup)
- ✅ Tax breakdown toggle
- ✅ Three layout variants
- ✅ Three payment modes
- ✅ Order confirmation + next-steps
- ✅ Order tracking timeline (past + pending)
- ✅ Mobile collapsible order summary
- ✅ Loading state (place-order button)
- ✅ Theme preview / live editor

---

## License & attribution

Use freely inside your ERP product. No external services or accounts required.
