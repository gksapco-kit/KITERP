import { Star, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockProducts } from "@/commerce-blocks/mock/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ProductCardProps {
  productId?: string;
  showPrice?: boolean;
  showTags?: boolean;
  showRating?: boolean;
  cta?: string;
  aspect?: "square" | "tall" | "wide";
}

const aspectClass = {
  square: "aspect-square",
  tall: "aspect-[3/4]",
  wide: "aspect-[4/3]",
};

export function ProductCard({
  productId,
  showPrice = true,
  showTags = true,
  showRating = false,
  cta = "Add to cart",
  aspect = "square",
}: ProductCardProps) {
  const product =
    mockProducts.find((p) => p.id === productId) ?? mockProducts[0];
  const onSale = product.compareAtPrice && product.compareAtPrice > product.price;

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-shadow hover:shadow-md">
      <div className={cn("relative overflow-hidden bg-muted", aspectClass[aspect])}>
        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        {showTags && (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {onSale && (
              <Badge variant="destructive" className="text-[10px]">
                Sale
              </Badge>
            )}
            {product.tags.slice(0, 1).map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground">
              Sold out
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="text-xs text-muted-foreground">{product.category}</div>
        <h3 className="line-clamp-1 text-sm font-medium">{product.name}</h3>
        {showRating && product.rating && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {product.rating}
            <span>({product.reviews})</span>
          </div>
        )}
        {showPrice && (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm font-semibold">
              {formatPrice(product.price, product.currency)}
            </span>
            {onSale && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice!, product.currency)}
              </span>
            )}
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          disabled={!product.inStock}
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          {cta}
        </Button>
      </div>
    </div>
  );
}
