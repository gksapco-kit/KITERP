import { useState } from "react";
import { Heart, ShoppingCart, ShieldCheck, Truck, RotateCcw, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Product } from "../types";
import { formatPrice } from "../mock";

export interface ProductDetailProps {
  product: Product;
  layout?: "split" | "stacked";
  onAddToCart?: (p: Product, qty: number, variant?: string) => void;
}

export function ProductDetail({ product, layout = "split", onAddToCart }: ProductDetailProps) {
  const images = product.images?.length ? product.images : [product.image];
  const [active, setActive] = useState(images[0]);
  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState(product.variants?.find((v) => v.available !== false)?.value);

  return (
    <div className={cn("grid gap-8", layout === "split" ? "lg:grid-cols-2" : "")}>
      <div className="space-y-3">
        <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
          <img src={active} alt={product.name} className="w-full h-full object-contain object-center p-4" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {images.map((src) => (
            <button
              key={src}
              onClick={() => setActive(src)}
              className={cn("aspect-square rounded-md overflow-hidden border", active === src && "ring-2 ring-primary")}
            >
              <img src={src} alt="" className="w-full h-full object-contain object-center p-1" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {product.tags?.map((t) => <Badge key={t} variant="secondary" className="capitalize">{t}</Badge>)}
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{product.name}</h1>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold">{formatPrice(product.price, product.currency)}</span>
          {product.compareAtPrice && (
            <span className="text-muted-foreground line-through">{formatPrice(product.compareAtPrice, product.currency)}</span>
          )}
        </div>
        {product.description && <p className="text-muted-foreground">{product.description}</p>}

        {product.variants && product.variants.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Variant</div>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  disabled={v.available === false}
                  onClick={() => setVariant(v.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md border text-sm",
                    variant === v.value && "bg-primary text-primary-foreground border-primary",
                    v.available === false && "opacity-40 line-through cursor-not-allowed",
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <div className="inline-flex items-center border rounded-md">
            <Button variant="ghost" size="icon" onClick={() => setQty(Math.max(1, qty - 1))}><Minus /></Button>
            <span className="w-8 text-center text-sm">{qty}</span>
            <Button variant="ghost" size="icon" onClick={() => setQty(qty + 1)}><Plus /></Button>
          </div>
          <Button className="flex-1" onClick={() => onAddToCart?.(product, qty, variant)} disabled={!product.inStock}>
            <ShoppingCart /> Add to cart
          </Button>
          <Button variant="outline" size="icon" aria-label="Wishlist"><Heart /></Button>
        </div>

        <Separator />

        <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2"><Truck className="h-4 w-4" />Free shipping</div>
          <div className="flex items-center gap-2"><RotateCcw className="h-4 w-4" />30-day returns</div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />2-year warranty</div>
        </div>
      </div>
    </div>
  );
}
