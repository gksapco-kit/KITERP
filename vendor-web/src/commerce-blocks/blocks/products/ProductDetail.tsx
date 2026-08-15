import { Minus, Plus, Star, ShoppingBag, Truck, ShieldCheck, Heart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockProducts } from "@/commerce-blocks/mock/products";
import { cn } from "@/lib/utils";

interface Props {
  productId?: string;
  showRating?: boolean;
  showTrustBadges?: boolean;
  cta?: string;
  layout?: "split" | "stacked";
}

export function ProductDetail({
  productId,
  showRating = true,
  showTrustBadges = true,
  cta = "Add to cart",
  layout = "split",
}: Props) {
  const p = mockProducts.find((x) => x.id === productId) ?? mockProducts[0];
  const [qty, setQty] = useState(1);

  const gallery = [p.image, p.image, p.image].filter(Boolean) as string[];

  return (
    <section
      className={cn(
        "grid gap-8 p-6 md:p-10",
        layout === "split" ? "md:grid-cols-2" : "md:grid-cols-1",
      )}
    >
      <div className="space-y-3">
        <div className="aspect-square overflow-hidden rounded-lg bg-muted">
          {gallery[0] && (
            <img src={gallery[0]} alt={p.name} className="h-full w-full object-contain object-center p-3" />
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {gallery.map((src, i) => (
            <div
              key={i}
              className={cn(
                "aspect-square overflow-hidden rounded-md border bg-muted",
                i === 0 ? "border-primary" : "border-border",
              )}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <div className="text-sm text-muted-foreground">{p.category}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{p.name}</h1>
          {showRating && p.rating && (
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-warning text-warning" />
              {p.rating} · {p.reviews} reviews
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-semibold">{formatPrice(p.price, p.currency)}</span>
          {p.compareAtPrice && (
            <>
              <span className="text-muted-foreground line-through">
                {formatPrice(p.compareAtPrice, p.currency)}
              </span>
              <Badge variant="destructive">Save ${p.compareAtPrice - p.price}</Badge>
            </>
          )}
        </div>
        <p className="text-muted-foreground">{p.description}</p>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-md border border-input">
            <Button variant="ghost" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-10 text-center text-sm tabular-nums">{qty}</span>
            <Button variant="ghost" size="icon" onClick={() => setQty((q) => q + 1)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button size="lg" className="flex-1" disabled={!p.inStock}>
            <ShoppingBag className="h-4 w-4" />
            {p.inStock ? cta : "Sold out"}
          </Button>
          <Button size="lg" variant="outline">
            <Heart className="h-4 w-4" />
          </Button>
        </div>

        {showTrustBadges && (
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-5 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 text-foreground" />
              <div>
                <div className="font-medium text-foreground">Free shipping</div>
                <div className="text-xs">On orders over $75</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-foreground" />
              <div>
                <div className="font-medium text-foreground">30-day returns</div>
                <div className="text-xs">Hassle-free policy</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
