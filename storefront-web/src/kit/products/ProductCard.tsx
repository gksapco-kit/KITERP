import { Link } from "react-router-dom";
import { Star, ShoppingCart, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Product } from "../types";
import { formatPrice } from "../mock";

export interface ProductCardProps {
  product: Product;
  layout?: "vertical" | "horizontal";
  showRating?: boolean;
  showTags?: boolean;
  onAddToCart?: (p: Product) => void;
  onToggleWishlist?: (p: Product) => void;
}

export function ProductCard({
  product,
  layout = "vertical",
  showRating = true,
  showTags = true,
  onAddToCart,
  onToggleWishlist,
}: ProductCardProps) {
  const horizontal = layout === "horizontal";
  return (
    <Card className={cn("overflow-hidden group", horizontal && "flex")}>
      <Link to={`/products/${product.slug}`} className={cn("block relative", horizontal ? "w-44 shrink-0" : "")}>
        {/* Fixed-ratio frame on the wrapper (not the <img>) so cards stay even in
            height even when a product has no image — the image just covers the frame. */}
        <div className={cn("relative w-full overflow-hidden bg-muted", horizontal ? "h-full" : "aspect-[4/3]")}>
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <ShoppingCart className="h-8 w-8 opacity-25" />
            </div>
          )}
        </div>
        {showTags && product.tags?.[0] && (
          <Badge className="absolute top-2 left-2 capitalize">{product.tags[0]}</Badge>
        )}
        {product.compareAtPrice && (
          <Badge variant="destructive" className="absolute top-2 right-2">
            -{Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}%
          </Badge>
        )}
      </Link>
      <CardContent className={cn("p-4 flex flex-col gap-2 flex-1", horizontal && "p-4")}>
        <Link to={`/products/${product.slug}`} className="font-medium line-clamp-2 hover:underline">
          {product.name}
        </Link>
        {showRating && product.rating && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-current text-yellow-500" />
            {product.rating.toFixed(1)} <span>({product.reviewCount})</span>
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">{formatPrice(product.price, product.currency)}</span>
          {product.compareAtPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.compareAtPrice, product.currency)}
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={!product.inStock}
            onClick={() => onAddToCart?.(product)}
          >
            <ShoppingCart /> {product.inStock ? "Add to cart" : "Out of stock"}
          </Button>
          <Button size="icon" variant="outline" onClick={() => onToggleWishlist?.(product)} aria-label="Wishlist">
            <Heart />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export interface ProductGridProps {
  products: Product[];
  columns?: 2 | 3 | 4 | 5;
  onAddToCart?: (p: Product) => void;
  onToggleWishlist?: (p: Product) => void;
}

export function ProductGrid({ products, columns = 4, onAddToCart, onToggleWishlist }: ProductGridProps) {
  const colMap: Record<number, string> = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  };
  return (
    <div className={cn("grid gap-4 grid-cols-1", colMap[columns])}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
      ))}
    </div>
  );
}

export function ProductList({ products, onAddToCart }: { products: Product[]; onAddToCart?: (p: Product) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} layout="horizontal" onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}
