import { useState } from "react";
import {
  CheckCircle2,
  Lock,
  CreditCard,
  Truck,
  Package,
  MapPin,
  Phone,
  Mail,
  Tag as TagIcon,
  Plus,
  Pencil,
  Gift,
  Sparkles,
  ChevronRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockProducts } from "@/commerce-blocks/mock/products";
import {
  mockCheckout,
  mockAddresses,
  mockOrderConfirmation,
  mockGiftCards,
  mockGiftCardBalance,
} from "@/commerce-blocks/mock/commerceFlow";

/* ---------- Checkout ---------- */

interface CheckoutProps {
  layout?: "twoColumn" | "stacked";
  showPromo?: boolean;
  cta?: string;
}

export function Checkout({
  layout = "twoColumn",
  showPromo = true,
  cta = "Place order",
}: CheckoutProps) {
  const [shipping, setShipping] = useState("standard");
  const [pay, setPay] = useState("card");
  const [demoPhone, setDemoPhone] = useState("+15550142280");

  // mockProducts is a shared, mutable array — a live-synced product block earlier on the
  // same page can replace its contents with real vendor products, so these static demo
  // productIds ("p1", "p7") may no longer resolve. Filter out any that don't match instead
  // of crashing.
  const items = mockCheckout.items
    .map((i) => ({
      ...i,
      product: mockProducts.find((p) => p.id === i.productId),
    }))
    .filter((it) => it.product);

  const Summary = (
    <aside className="space-y-4 rounded-lg border border-border bg-muted/30 p-5">
      <h3 className="text-sm font-semibold">Order summary</h3>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.productId} className="flex gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
              {it.product!.image && (
                <img src={it.product!.image} alt={it.product!.name} className="h-full w-full object-cover" />
              )}
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-xs font-medium text-background">
                {it.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-sm font-medium">{it.product!.name}</div>
              <div className="text-xs text-muted-foreground">{it.variant}</div>
            </div>
            <div className="text-sm font-medium">
              {formatPrice(it.product!.price * it.quantity, it.product!.currency)}
            </div>
          </li>
        ))}
      </ul>

      {showPromo && (
        <div className="flex gap-2">
          <Input placeholder="Promo code" defaultValue={mockCheckout.promoCode} className="h-9" />
          <Button variant="outline" size="sm">Apply</Button>
        </div>
      )}

      <Separator />
      <div className="space-y-1.5 text-sm">
        <Row label="Subtotal" value={formatPrice(mockCheckout.subtotal, mockCheckout.currency)} />
        <Row label="Shipping" value={mockCheckout.shipping === 0 ? "Free" : formatPrice(mockCheckout.shipping, mockCheckout.currency)} />
        <Row label="Tax" value={formatPrice(mockCheckout.tax, mockCheckout.currency)} />
        {mockCheckout.discount > 0 && (
          <Row
            label={
              <span className="inline-flex items-center gap-1 text-success">
                <TagIcon className="h-3 w-3" />
                Discount
              </span>
            }
            value={`−${formatPrice(mockCheckout.discount, mockCheckout.currency)}`}
            valueClass="text-success"
          />
        )}
      </div>
      <Separator />
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">Total</span>
        <span className="text-xl font-semibold">{formatPrice(mockCheckout.total, mockCheckout.currency)}</span>
      </div>
      <Button className="w-full" size="lg">
        <Lock className="h-4 w-4" />
        {cta}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Secured payment · 30-day returns
      </p>
    </aside>
  );

  const Form = (
    <div className="space-y-6">
      <Section title="Contact" icon={Mail}>
        <Field label="Email">
          <Input defaultValue="alex@morganstudio.co" placeholder="you@example.com" />
        </Field>
      </Section>

      <Section title="Shipping address" icon={MapPin}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name"><Input defaultValue="Alex" /></Field>
          <Field label="Last name"><Input defaultValue="Morgan" /></Field>
          <Field label="Address" className="sm:col-span-2"><Input defaultValue="1429 Garrison Ave" /></Field>
          <Field label="Apt, suite (optional)" className="sm:col-span-2"><Input defaultValue="Apt 4B" /></Field>
          <Field label="City"><Input defaultValue="Brooklyn" /></Field>
          <Field label="State"><Input defaultValue="NY" /></Field>
          <Field label="ZIP code"><Input defaultValue="11221" /></Field>
          <Field label="Phone">
            <PhoneInput
              value={demoPhone}
              onChange={setDemoPhone}
              defaultCountryIso="US"
              compact
              compactCountry
              subtleFeedback
            />
          </Field>
        </div>
      </Section>

      <Section title="Shipping method" icon={Truck}>
        <RadioGroup value={shipping} onValueChange={setShipping} className="space-y-2">
          <ShipOption id="standard" name="Standard" eta="5–7 business days" price="Free" current={shipping} />
          <ShipOption id="express" name="Express" eta="2–3 business days" price="$14.00" current={shipping} />
          <ShipOption id="overnight" name="Overnight" eta="Next business day" price="$28.00" current={shipping} />
        </RadioGroup>
      </Section>

      <Section title="Payment" icon={CreditCard}>
        <RadioGroup value={pay} onValueChange={setPay} className="space-y-2">
          <PayOption id="card" name="Credit card" sub="Visa, Mastercard, Amex" current={pay} />
          <PayOption id="paypal" name="PayPal" sub="Pay with your PayPal account" current={pay} />
          <PayOption id="apple" name="Apple Pay" sub="Faster checkout with Touch ID" current={pay} />
        </RadioGroup>
        {pay === "card" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Card number" className="sm:col-span-2"><Input placeholder="1234 1234 1234 1234" /></Field>
            <Field label="Expiry"><Input placeholder="MM / YY" /></Field>
            <Field label="CVC"><Input placeholder="CVC" /></Field>
          </div>
        )}
      </Section>
    </div>
  );

  return (
    <div className="bg-background p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Checkout</h2>
        <p className="mt-1 text-sm text-muted-foreground">Almost there — review and place your order.</p>
      </div>
      {layout === "twoColumn" ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {Form}
          {Summary}
        </div>
      ) : (
        <div className="space-y-8">
          {Form}
          {Summary}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, valueClass }: { label: React.ReactNode; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", valueClass)}>{value}</span>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ShipOption({
  id,
  name,
  eta,
  price,
  current,
}: {
  id: string;
  name: string;
  eta: string;
  price: string;
  current: string;
}) {
  const active = current === id;
  return (
    <Label
      htmlFor={`ship-${id}`}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 transition-colors",
        active && "border-primary bg-primary/5",
      )}
    >
      <RadioGroupItem id={`ship-${id}`} value={id} />
      <div className="flex-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{eta}</div>
      </div>
      <div className="text-sm font-semibold">{price}</div>
    </Label>
  );
}

function PayOption({
  id,
  name,
  sub,
  current,
}: {
  id: string;
  name: string;
  sub: string;
  current: string;
}) {
  const active = current === id;
  return (
    <Label
      htmlFor={`pay-${id}`}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 transition-colors",
        active && "border-primary bg-primary/5",
      )}
    >
      <RadioGroupItem id={`pay-${id}`} value={id} />
      <div className="flex-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      <CreditCard className="h-4 w-4 text-muted-foreground" />
    </Label>
  );
}

/* ---------- Address book ---------- */

interface AddressBookProps {
  layout?: "list" | "grid";
  showPhone?: boolean;
}

export function AddressBook({ layout = "list", showPhone = true }: AddressBookProps) {
  const [selected, setSelected] = useState(mockAddresses[0].id);
  return (
    <div className="bg-background p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Saved addresses</h2>
          <p className="text-sm text-muted-foreground">Choose where to ship this order.</p>
        </div>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          Add address
        </Button>
      </div>
      <div className={cn(layout === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : "space-y-3")}>
        {mockAddresses.map((a) => {
          const active = selected === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setSelected(a.id)}
              className={cn(
                "group relative w-full rounded-lg border border-border bg-card p-4 text-left transition-colors",
                active && "border-primary ring-1 ring-primary",
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{a.label}</Badge>
                {a.isDefault && (
                  <Badge variant="outline" className="text-xs">Default</Badge>
                )}
                {active && (
                  <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
              <div className="text-sm font-medium">{a.name}</div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {a.line1}{a.line2 ? `, ${a.line2}` : ""}
              </div>
              <div className="text-sm text-muted-foreground">
                {a.city}, {a.region} {a.postal}
              </div>
              <div className="text-sm text-muted-foreground">{a.country}</div>
              {showPhone && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {a.phone}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                  Remove
                </Button>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Order confirmation ---------- */

interface OrderConfirmationProps {
  showItems?: boolean;
  showShipping?: boolean;
  cta?: string;
}

export function OrderConfirmation({
  showItems = true,
  showShipping = true,
  cta = "Track your order",
}: OrderConfirmationProps) {
  const o = mockOrderConfirmation;
  // Same shared-mutable-mock guard as Checkout — a live product feed elsewhere on the page
  // can replace mockProducts, so fall back gracefully instead of crashing on a missed match.
  const items = o.items
    .map((i) => ({
      ...i,
      product: mockProducts.find((p) => p.id === i.productId),
    }))
    .filter((it) => it.product);

  return (
    <div className="bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold">Thanks, your order is in.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirmation #{o.orderNumber} · {o.placedAt}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a receipt to <span className="font-medium text-foreground">{o.email}</span>
          </p>
        </div>

        <div className="rounded-xl border border-border">
          {showItems && (
            <>
              <div className="p-5">
                <h3 className="mb-3 text-sm font-semibold">Items</h3>
                <ul className="space-y-3">
                  {items.map((it) => (
                    <li key={it.productId} className="flex gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                        {it.product!.image && (
                          <img src={it.product!.image} alt={it.product!.name} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{it.product!.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.variant} · Qty {it.quantity}
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        {formatPrice(it.price * it.quantity, o.currency)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <Separator />
            </>
          )}
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
            {showShipping && (
              <div className="space-y-2 p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                  <Truck className="h-3.5 w-3.5" />
                  Shipping to
                </div>
                <div className="text-sm">
                  <div>{o.shippingAddress.name}</div>
                  <div className="text-muted-foreground">{o.shippingAddress.line1}</div>
                  <div className="text-muted-foreground">{o.shippingAddress.city}</div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  Estimated delivery
                </div>
                <div className="text-sm font-medium">{o.estimatedDelivery}</div>
              </div>
            )}
            <div className="space-y-1.5 border-t border-border p-5 text-sm sm:border-l sm:border-t-0">
              <Row label="Subtotal" value={formatPrice(o.subtotal, o.currency)} />
              <Row label="Shipping" value={o.shipping === 0 ? "Free" : formatPrice(o.shipping, o.currency)} />
              <Row label="Tax" value={formatPrice(o.tax, o.currency)} />
              <Row label="Discount" value={`−${formatPrice(o.discount, o.currency)}`} valueClass="text-success" />
              <Separator className="my-2" />
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-semibold">{formatPrice(o.total, o.currency)}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Paid with card ending in {o.paymentLast4}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button>{cta}</Button>
          <Button variant="outline">Continue shopping</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Gift cards ---------- */

interface GiftCardsProps {
  layout?: "shop" | "balance";
  cta?: string;
}

export function GiftCards({ layout = "shop", cta = "Buy gift card" }: GiftCardsProps) {
  if (layout === "balance") return <GiftCardBalance />;
  const [picked, setPicked] = useState(mockGiftCards[1].id);
  const [delivery, setDelivery] = useState("email");

  return (
    <div className="bg-background p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Gift className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Gift cards</h2>
          <p className="text-sm text-muted-foreground">Send something thoughtful — instantly or scheduled.</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {mockGiftCards.map((g) => {
              const active = picked === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setPicked(g.id)}
                  className={cn(
                    "group relative aspect-[4/3] overflow-hidden rounded-lg border border-border p-3 text-left transition-all",
                    `bg-gradient-to-br ${g.color}`,
                    active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                >
                  {g.popular && (
                    <Badge className="absolute right-2 top-2 bg-foreground text-background hover:bg-foreground">
                      Popular
                    </Badge>
                  )}
                  <Sparkles className="h-5 w-5 text-foreground/70" />
                  <div className="absolute inset-x-3 bottom-3">
                    <div className="text-2xl font-semibold text-foreground">${g.amount}</div>
                    <div className="text-xs uppercase tracking-wider text-foreground/70">
                      {g.currency} gift card
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Recipient name"><Input placeholder="Jordan Tate" /></Field>
            <Field label="Recipient email"><Input placeholder="jordan@example.com" /></Field>
            <Field label="Your name"><Input placeholder="Alex Morgan" /></Field>
            <Field label="Send on"><Input type="date" /></Field>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">Personal message</Label>
              <Textarea rows={3} placeholder="Happy birthday — pick something lovely. ✨" />
            </div>
          </div>
        </div>

        <aside className="space-y-4 rounded-lg border border-border bg-muted/30 p-5">
          <h3 className="text-sm font-semibold">Delivery</h3>
          <RadioGroup value={delivery} onValueChange={setDelivery} className="space-y-2">
            <PayOption id="email" name="Email delivery" sub="Sent instantly when scheduled" current={delivery} />
            <PayOption id="print" name="Printable PDF" sub="Download and hand-deliver" current={delivery} />
          </RadioGroup>
          <Separator />
          <div className="space-y-1.5 text-sm">
            <Row label="Card amount" value={`$${mockGiftCards.find((g) => g.id === picked)?.amount}`} />
            <Row label="Delivery" value="Free" />
          </div>
          <Separator />
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-semibold">${mockGiftCards.find((g) => g.id === picked)?.amount}</span>
          </div>
          <Button className="w-full" size="lg">
            <Gift className="h-4 w-4" />
            {cta}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Never expires · Redeemable online & in-store
          </p>
        </aside>
      </div>
    </div>
  );
}

function GiftCardBalance() {
  const b = mockGiftCardBalance;
  return (
    <div className="bg-background p-6">
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Gift card balance</h2>
          <p className="text-sm text-muted-foreground">Check what's left and see recent activity.</p>
        </div>
        <div className="rounded-xl border border-border bg-gradient-to-br from-emerald-200 to-teal-300 p-6">
          <Sparkles className="h-5 w-5 text-foreground/70" />
          <div className="mt-6 text-xs uppercase tracking-wider text-foreground/70">Available balance</div>
          <div className="text-4xl font-semibold text-foreground">{formatPrice(b.balance, b.currency)}</div>
          <div className="mt-3 flex items-center justify-between text-xs text-foreground/70">
            <span>Code: {b.code}</span>
            <span>Expires {b.expires}</span>
          </div>
        </div>
        <div className="rounded-lg border border-border">
          <div className="border-b border-border p-4 text-sm font-semibold">Recent activity</div>
          <ul>
            {b.history.map((h, i) => (
              <li key={i} className="flex items-center justify-between border-b border-border p-4 text-sm last:border-b-0">
                <div>
                  <div className="font-medium">{h.description}</div>
                  <div className="text-xs text-muted-foreground">{h.date}</div>
                </div>
                <div className={cn("font-medium", h.amount > 0 ? "text-success" : "text-foreground")}>
                  {h.amount > 0 ? "+" : ""}
                  {formatPrice(h.amount, b.currency)}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4" />
          Add another card
          <ChevronRight className="ml-auto h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
