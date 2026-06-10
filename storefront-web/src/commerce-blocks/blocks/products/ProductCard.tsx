import { Star, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockProducts } from "@/commerce-blocks/mock/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  productCardBodyClass,
  productCardImageShell,
  productCardPadding,
} from "@/lib/commerceProductCardLayout";

interface ProductCardProps {
  productId?: string;
  showPrice?: boolean;
  showTags?: boolean;
  showRating?: boolean;
  showCta?: boolean;
  cta?: string;
  aspect?: "square" | "tall" | "wide";
  imageHeightPct?: number;
  cardPadding?: number;
  cardStyle?: string;
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
  showCta = true,
  cta = "Add to cart",
  aspect = "square",
  imageHeightPct,
  cardPadding,
  cardStyle,
}: ProductCardProps) {
  const product =
    mockProducts.find((p) => p.id === productId) ?? mockProducts[0];
  const onSale = product.compareAtPrice && product.compareAtPrice > product.price;
  const pad = productCardPadding(cardStyle, cardPadding);
  const isMinimal = cardStyle === "minimal";
  const isCompact = cardStyle === "compact";
  const imageShell = productCardImageShell(imageHeightPct, aspectClass[aspect]);

  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden border border-border bg-card text-card-foreground transition-shadow hover:shadow-md",
        isMinimal ? "rounded-md" : isCompact ? "rounded-lg" : "rounded-lg",
      )}
    >
      <div className={imageShell.wrapperClass} style={imageShell.wrapperStyle}>
        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            className={imageShell.imageClass}
          />
        )}
        {showTags && (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {onSale && (
              <Badge variant="destructive" className="text-xs">
                Sale
              </Badge>
            )}
            {product.tags.slice(0, 1).map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
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
      <div className="flex flex-1 flex-col" style={{ padding: pad }}>
        {!isMinimal && (
          <div className="text-xs text-muted-foreground">{product.category}</div>
        )}
        <h3 className={productCardBodyClass(cardStyle)}>{product.name}</h3>
        {showRating && product.rating && !isMinimal && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {product.rating}
            <span>({product.reviews})</span>
          </div>
        )}
        {showPrice && (
          <div className={cn("flex items-baseline gap-2", isMinimal ? "mt-1" : "mt-2")}>
            <span className={cn("font-semibold", isMinimal ? "text-xs" : "text-sm")}>
              {formatPrice(product.price, product.currency)}
            </span>
            {onSale && !isMinimal && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice!, product.currency)}
              </span>
            )}
          </div>
        )}
        {showCta && (
          <Button
            size="sm"
            variant="outline"
            className={cn("w-full", isMinimal ? "mt-2 h-7 text-[11px]" : "mt-3")}
            disabled={!product.inStock}
          >
            <ShoppingBag className={isMinimal ? "h-3 w-3" : "h-3.5 w-3.5"} />
            {isMinimal ? "Add" : cta}
          </Button>
        )}
      </div>
    </div>
  );
}
