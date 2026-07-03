import { useState } from "react";
import { Star, ThumbsUp, Check, Search, X, Heart, Bell, BadgePercent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { mockProducts } from "@/commerce-blocks/mock/products";
import { mockReviews, reviewBreakdown } from "@/commerce-blocks/mock/reviews";
import {
  mockBundle,
  mockCrossSell,
  mockRecentlyViewed,
  mockSearchResults,
  mockFilters,
  mockWishlist,
  mockPromos,
  mockOrder,
  mockLoyalty,
} from "@/commerce-blocks/mock/commerce";
import { ProductCard } from "./ProductCard";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { cn } from "@/lib/utils";
import { catalogGridClassName } from "@/lib/commerceCatalogLayout";

/* ---------------- Product Reviews ---------------- */

interface ReviewsProps {
  productId?: string;
  showBreakdown?: boolean;
  showHelpful?: boolean;
  title?: string;
}

export function ProductReviews({
  productId = "p1",
  showBreakdown = true,
  showHelpful = true,
  title = "Customer reviews",
}: ReviewsProps) {
  const product = mockProducts.find((p) => p.id === productId) ?? mockProducts[0];
  const reviews = mockReviews.filter((r) => r.productId === productId);
  const total = reviewBreakdown.reduce((s, r) => s + r.count, 0);
  const avg = product.rating ?? 4.6;

  return (
    <section className="px-6 py-10">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        {showBreakdown && (
          <aside className="space-y-4 rounded-lg border border-border bg-card p-5">
            <div>
              <div className="text-4xl font-semibold">{avg.toFixed(1)}</div>
              <div className="mt-1 flex items-center gap-1 text-warning">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn("h-4 w-4", i < Math.round(avg) ? "fill-warning" : "fill-none")}
                  />
                ))}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Based on {total} reviews
              </div>
            </div>
            <div className="space-y-2">
              {reviewBreakdown.map((row) => {
                const pct = (row.count / total) * 100;
                return (
                  <div key={row.stars} className="flex items-center gap-2 text-xs">
                    <span className="w-6 text-muted-foreground">{row.stars}★</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-warning" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">
                      {row.count}
                    </span>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" className="w-full">
              Write a review
            </Button>
          </aside>
        )}
        <div className="divide-y divide-border">
          {reviews.map((r) => (
            <article key={r.id} className="py-5 first:pt-0">
              <div className="flex items-center gap-2">
                <div className="flex text-warning">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn("h-3.5 w-3.5", i < r.rating ? "fill-warning" : "fill-none")}
                    />
                  ))}
                </div>
                <h4 className="font-medium">{r.title}</h4>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {r.author} · {r.date}
                {r.verified && (
                  <span className="ml-2 inline-flex items-center gap-1 text-success">
                    <Check className="h-3 w-3" /> Verified
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm">{r.body}</p>
              {showHelpful && (
                <button className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <ThumbsUp className="h-3 w-3" /> Helpful ({r.helpful ?? 0})
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Comparison Table ---------------- */

interface ComparisonProps {
  productIds?: string[];
  highlightDifferences?: boolean;
}

export function ComparisonTable({
  productIds = ["p1", "p2", "p3", "p7"],
  highlightDifferences = true,
}: ComparisonProps) {
  const items = productIds
    .map((id) => mockProducts.find((p) => p.id === id))
    .filter(Boolean) as typeof mockProducts;

  const rows: {
    label: string;
    get: (p: (typeof items)[number]) => React.ReactNode;
    /** Plain, JSON-safe value to diff on — required whenever `get` renders JSX, since
     * React elements carry a circular `_owner`/Fiber back-reference in dev mode that
     * crashes `JSON.stringify`. */
    compare?: (p: (typeof items)[number]) => unknown;
  }[] = [
    { label: "Category", get: (p) => p.category },
    {
      label: "Price",
      get: (p) => <span className="font-semibold">{formatPrice(p.price, p.currency)}</span>,
      compare: (p) => p.price,
    },
    {
      label: "Rating",
      get: (p) =>
        p.rating ? (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {p.rating} ({p.reviews})
          </span>
        ) : (
          "—"
        ),
      compare: (p) => p.rating ?? null,
    },
    {
      label: "Tags",
      get: (p) => p.tags.join(", ") || "—",
    },
    {
      label: "Availability",
      get: (p) =>
        p.inStock ? (
          <Badge variant="secondary" className="bg-success/15 text-success-foreground">
            In stock
          </Badge>
        ) : (
          <Badge variant="outline">Sold out</Badge>
        ),
      compare: (p) => p.inStock,
    },
  ];

  return (
    <section className="px-6 py-10">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight">Compare products</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-32 p-4 text-left font-medium text-muted-foreground">Feature</th>
              {items.map((p) => (
                <th key={p.id} className="p-4 text-left">
                  <div className="flex flex-col gap-2">
                    <div className="aspect-square w-20 overflow-hidden rounded-md bg-muted">
                      {p.image && (
                        <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <span className="font-medium">{p.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const values = items.map((p) => row.get(p));
              const compareValues = items.map((p) => (row.compare ? row.compare(p) : row.get(p)));
              const allSame =
                highlightDifferences &&
                compareValues.every((v) => JSON.stringify(v) === JSON.stringify(compareValues[0]));
              return (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="p-4 font-medium text-muted-foreground">{row.label}</td>
                  {values.map((v, i) => (
                    <td
                      key={i}
                      className={cn(
                        "p-4",
                        highlightDifferences && !allSame && "bg-accent/30",
                      )}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <td />
              {items.map((p) => (
                <td key={p.id} className="p-4">
                  <Button size="sm" variant="outline" className="w-full" disabled={!p.inStock}>
                    Add to cart
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------- Bundle / Frequently bought together ---------------- */

interface BundleProps {
  title?: string;
  cta?: string;
}

export function ProductBundle({
  title = "Frequently bought together",
  cta = "Add bundle to cart",
}: BundleProps) {
  const items = mockBundle.productIds
    .map((id) => mockProducts.find((p) => p.id === id))
    .filter(Boolean) as typeof mockProducts;
  const savings = mockBundle.originalPrice - mockBundle.bundlePrice;

  return (
    <section className="px-6 py-10">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-4">
          {items.map((p, i) => (
            <div key={p.id} className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="aspect-square w-24 overflow-hidden rounded-md bg-muted">
                  {p.image && (
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="text-center">
                  <div className="line-clamp-1 max-w-[120px] text-xs font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPrice(p.price, p.currency)}
                  </div>
                </div>
              </div>
              {i < items.length - 1 && (
                <span className="text-2xl text-muted-foreground">+</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold">
                {formatPrice(mockBundle.bundlePrice, mockBundle.currency)}
              </span>
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(mockBundle.originalPrice, mockBundle.currency)}
              </span>
              <Badge variant="secondary" className="bg-success/15 text-success-foreground">
                Save {formatPrice(savings, mockBundle.currency)}
              </Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Bundle includes {items.length} items
            </div>
          </div>
          <Button size="lg">{cta}</Button>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Cross-sell / Recently viewed (shared row) ---------------- */

interface RowProps {
  variant?: "crossSell" | "recentlyViewed";
  title?: string;
  showPrice?: boolean;
  columns?: number;
  gap?: number;
  itemLimit?: number;
  imageHeightPct?: number;
  cardPadding?: number;
  cardStyle?: string;
  showTags?: boolean;
  showCta?: boolean;
}

export function ProductRow({
  variant = "crossSell",
  title,
  showPrice = true,
  columns = 4,
  gap = 16,
  itemLimit = 4,
  imageHeightPct,
  cardPadding,
  cardStyle,
  showTags = false,
  showCta = true,
}: RowProps) {
  const data = variant === "crossSell" ? mockCrossSell : mockRecentlyViewed;
  const items = data.productIds
    .map((id) => mockProducts.find((p) => p.id === id))
    .filter(Boolean) as typeof mockProducts;
  const heading = title ?? data.title;
  const limit = itemLimit ?? items.length;
  const cardProps = { imageHeightPct, cardPadding, cardStyle, showCta };

  return (
    <section className="px-6 py-10">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight">{heading}</h2>
      <div className={cn("grid", catalogGridClassName(columns))} style={{ gap }}>
        {items.slice(0, limit).map((p) => (
          <ProductCard key={p.id} productId={p.id} showPrice={showPrice} showTags={showTags} {...cardProps} />
        ))}
      </div>
    </section>
  );
}

/* ---------------- Search Results ---------------- */

interface SearchProps {
  showSuggestions?: boolean;
  columns?: number;
  gap?: number;
  itemLimit?: number;
  imageHeightPct?: number;
  cardPadding?: number;
  cardStyle?: string;
  showTags?: boolean;
  showCta?: boolean;
}

export function SearchResults({
  showSuggestions = true,
  columns = 3,
  gap = 16,
  itemLimit,
  imageHeightPct,
  cardPadding,
  cardStyle,
  showTags = true,
  showCta = true,
}: SearchProps) {
  const items = mockSearchResults.productIds
    .map((id) => mockProducts.find((p) => p.id === id))
    .filter(Boolean) as typeof mockProducts;
  const limit = itemLimit ?? items.length;
  const cardProps = { imageHeightPct, cardPadding, cardStyle, showTags, showCta };

  return (
    <section className="px-6 py-10">
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          defaultValue={mockSearchResults.query}
          className="border-0 bg-transparent px-0 focus-visible:ring-0"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mb-4 text-sm text-muted-foreground">
        {mockSearchResults.total} results for{" "}
        <span className="font-medium text-foreground">"{mockSearchResults.query}"</span>
      </div>
      {showSuggestions && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Try:</span>
          {mockSearchResults.suggestions.map((s) => (
            <Badge key={s} variant="outline" className="cursor-pointer">
              {s}
            </Badge>
          ))}
        </div>
      )}
      <div className={cn("grid", catalogGridClassName(columns))} style={{ gap }}>
        {items.slice(0, limit).map((p) => (
          <ProductCard key={p.id} productId={p.id} {...cardProps} />
        ))}
      </div>
    </section>
  );
}

/* ---------------- Filters Sidebar ---------------- */

interface FiltersProps {
  showActiveCount?: boolean;
}

export function FiltersSidebar({ showActiveCount = true }: FiltersProps) {
  const [active, setActive] = useState<string[]>(["apparel", "in-stock"]);
  const [price, setPrice] = useState<[number, number]>([20, 120]);

  const toggle = (id: string) =>
    setActive((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <section className="p-6">
      <aside className="max-w-xs space-y-6 rounded-lg border border-border bg-card p-5">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide">Filters</h3>
          {showActiveCount && active.length > 0 && (
            <button
              onClick={() => setActive([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear ({active.length})
            </button>
          )}
        </header>

        {mockFilters.map((f) => (
          <div key={f.id} className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {f.name}
            </Label>
            {f.type === "checkbox" && (
              <div className="space-y-1.5">
                {f.options.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={active.includes(opt.id)}
                        onCheckedChange={() => toggle(opt.id)}
                      />
                      {opt.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{opt.count}</span>
                  </label>
                ))}
              </div>
            )}
            {f.type === "swatch" && (
              <div className="flex flex-wrap gap-2">
                {f.options.map((opt) => {
                  const selected = active.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggle(opt.id)}
                      title={opt.label}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 transition-all",
                        selected ? "border-primary scale-110" : "border-border",
                      )}
                      style={{ backgroundColor: opt.color }}
                    />
                  );
                })}
              </div>
            )}
            {f.type === "range" && (
              <div className="space-y-2 pt-1">
                <Slider
                  value={price}
                  min={f.min}
                  max={f.max}
                  step={1}
                  onValueChange={(v) => setPrice(v as [number, number])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>${price[0]}</span>
                  <span>${price[1]}</span>
                </div>
              </div>
            )}
          </div>
        ))}

        <Button className="w-full">Apply filters</Button>
      </aside>
    </section>
  );
}

/* ---------------- Wishlist ---------------- */

interface WishlistProps {
  layout?: "grid" | "list";
  columns?: number;
  gap?: number;
  itemLimit?: number;
  imageHeightPct?: number;
  cardPadding?: number;
  cardStyle?: string;
  showTags?: boolean;
  showCta?: boolean;
}

export function WishlistBlock({
  layout = "grid",
  columns = 3,
  gap = 16,
  itemLimit,
  imageHeightPct,
  cardPadding,
  cardStyle,
  showTags = true,
  showCta = true,
}: WishlistProps) {
  const items = mockWishlist.productIds
    .map((id) => mockProducts.find((p) => p.id === id))
    .filter(Boolean) as typeof mockProducts;
  const visible = items.slice(0, itemLimit ?? items.length);
  const cardProps = { imageHeightPct, cardPadding, cardStyle, showTags, showCta };

  return (
    <section className="px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">
          <Heart className="mr-2 inline h-5 w-5 fill-destructive text-destructive" />
          My wishlist
        </h2>
        <span className="text-sm text-muted-foreground">{visible.length} items</span>
      </div>
      {layout === "grid" ? (
        <div className={cn("grid", catalogGridClassName(columns))} style={{ gap }}>
          {visible.map((p) => (
            <div key={p.id} className="relative">
              <ProductCard productId={p.id} {...cardProps} />
              <button className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 shadow-sm backdrop-blur hover:bg-background">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {visible.map((p) => (
            <li key={p.id} className="flex items-center gap-4 p-4">
              <div className="h-16 w-16 overflow-hidden rounded-md bg-muted">
                {p.image && <img src={p.image} alt={p.name} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.category}</div>
              </div>
              <div className="font-semibold">{formatPrice(p.price, p.currency)}</div>
              {showCta && <Button size="sm">Add to cart</Button>}
              <Button size="icon" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Stock Notifier ---------------- */

interface NotifierProps {
  productId?: string;
  cta?: string;
}

export function StockNotifier({
  productId = "p4",
  cta = "Notify me when available",
}: NotifierProps) {
  const product = mockProducts.find((p) => p.id === productId) ?? mockProducts[3];
  const [done, setDone] = useState(false);

  return (
    <section className="p-6">
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-md bg-muted">
            {product.image && (
              <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
            )}
          </div>
          <div>
            <Badge variant="outline" className="mb-2">
              <Bell className="h-3 w-3" /> Out of stock
            </Badge>
            <h3 className="font-semibold">{product.name}</h3>
            <div className="text-sm text-muted-foreground">
              {formatPrice(product.price, product.currency)}
            </div>
          </div>
        </div>
        {done ? (
          <div className="mt-5 flex items-center gap-2 rounded-md bg-success/10 px-4 py-3 text-sm text-success-foreground">
            <Check className="h-4 w-4 text-success" />
            We'll email you the moment it's back.
          </div>
        ) : (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setDone(true);
            }}
          >
            <Label htmlFor="sn-email">Email address</Label>
            <Input id="sn-email" type="email" placeholder="you@example.com" required />
            <Button type="submit" className="w-full">
              <Bell className="h-4 w-4" />
              {cta}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}

/* ---------------- Promo Banner ---------------- */

interface PromoProps {
  promoId?: string;
  layout?: "banner" | "card";
}

export function PromoBanner({ promoId = "promo1", layout = "banner" }: PromoProps) {
  const promo = mockPromos.find((p) => p.id === promoId) ?? mockPromos[0];

  if (layout === "banner") {
    return (
      <section className="p-6">
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-4 rounded-lg px-6 py-4",
            promo.accent === "primary"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          <div className="flex items-center gap-3">
            <BadgePercent className="h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">{promo.headline}</div>
              <div className="text-xs opacity-80">{promo.subline}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <code
              className={cn(
                "rounded border px-3 py-1 font-mono text-sm tracking-wider",
                promo.accent === "primary"
                  ? "border-primary-foreground/30 bg-primary-foreground/10"
                  : "border-border bg-background",
              )}
            >
              {promo.code}
            </code>
            <Button
              size="sm"
              variant={promo.accent === "primary" ? "secondary" : "default"}
            >
              Shop sale
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="p-6">
      <div className="mx-auto max-w-md rounded-lg border-2 border-dashed border-primary bg-primary/5 p-8 text-center">
        <BadgePercent className="mx-auto h-10 w-10 text-primary" />
        <h3 className="mt-3 text-2xl font-semibold">{promo.headline}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{promo.subline}</p>
        <code className="mt-5 inline-block rounded-md border border-border bg-background px-4 py-2 font-mono text-base tracking-wider">
          {promo.code}
        </code>
        <Button className="mt-5 w-full">Copy code & shop</Button>
      </div>
    </section>
  );
}

/* ---------------- Order Tracking ---------------- */

interface OrderProps {
  showItems?: boolean;
}

export function OrderTracking({ showItems = true }: OrderProps) {
  const currentIndex = mockOrder.steps.findIndex((s) => s.id === mockOrder.status);
  const items = mockOrder.items
    .map((it) => ({ ...it, product: mockProducts.find((p) => p.id === it.productId) }))
    .filter((it) => it.product);

  return (
    <section className="p-6">
      <div className="mx-auto max-w-2xl space-y-6 rounded-lg border border-border bg-card p-6">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Order {mockOrder.id}
            </div>
            <h3 className="text-xl font-semibold">Arriving {mockOrder.estimatedDelivery}</h3>
          </div>
          <Badge variant="secondary">{mockOrder.carrier}</Badge>
        </header>

        <ol className="relative grid grid-cols-4 gap-2">
          <div className="absolute left-0 right-0 top-3 h-0.5 bg-border" />
          <div
            className="absolute left-0 top-3 h-0.5 bg-primary transition-all"
            style={{ width: `${(currentIndex / (mockOrder.steps.length - 1)) * 100}%` }}
          />
          {mockOrder.steps.map((s, i) => {
            const reached = i <= currentIndex;
            return (
              <li key={s.id} className="relative flex flex-col items-center text-center">
                <div
                  className={cn(
                    "z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-card",
                    reached ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {reached && <Check className="h-3 w-3" />}
                </div>
                <div className="mt-2 text-xs font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.date ?? "—"}</div>
              </li>
            );
          })}
        </ol>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
          <span className="text-muted-foreground">Tracking #: </span>
          <code className="font-mono">{mockOrder.tracking}</code>
        </div>

        {showItems && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              In this shipment
            </div>
            <ul className="divide-y divide-border">
              {items.map((it) => (
                <li key={it.productId} className="flex items-center gap-3 py-3">
                  <div className="h-12 w-12 overflow-hidden rounded-md bg-muted">
                    {it.product!.image && (
                      <img
                        src={it.product!.image}
                        alt={it.product!.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{it.product!.name}</div>
                    <div className="text-xs text-muted-foreground">Qty {it.qty}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- Loyalty / Points widget ---------------- */

interface LoyaltyProps {
  showPerks?: boolean;
}

export function LoyaltyWidget({ showPerks = true }: LoyaltyProps) {
  const pct = (mockLoyalty.points / mockLoyalty.totalToNext) * 100;

  return (
    <section className="p-6">
      <div className="mx-auto max-w-md space-y-5 rounded-lg border border-border bg-gradient-to-br from-accent to-card p-6">
        <header className="flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {mockLoyalty.tier} member
            </div>
            <div className="text-3xl font-semibold tabular-nums">
              {mockLoyalty.points.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">pts</span>
            </div>
          </div>
          <Badge variant="secondary">{mockLoyalty.tier}</Badge>
        </header>

        <div>
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Progress to {mockLoyalty.nextTier}</span>
            <span>
              {mockLoyalty.pointsToNext.toLocaleString()} pts to go
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-background">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {showPerks && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your perks
            </div>
            <ul className="space-y-1.5">
              {mockLoyalty.perks.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-success" /> {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button variant="outline" className="w-full">
          Redeem points
        </Button>
      </div>
    </section>
  );
}
