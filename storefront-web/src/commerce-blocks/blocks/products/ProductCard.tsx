import { Link } from "react-router-dom";
import { Star, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockProducts } from "@/commerce-blocks/mock/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStorePath } from "@/hooks/useStorePath";
import {
  productCardBodyClass,
  productCardImageShell,
  productCardPadding,
} from "@/lib/commerceProductCardLayout";

interface ProductCardProps {
  productId?: string;
  productSlug?: string;
  showPrice?: boolean;
  showTags?: boolean;
  showRating?: boolean;
  showCta?: boolean;
  cta?: string;
  aspect?: "square" | "tall" | "wide";
  imageHeightPct?: number;
  cardPadding?: number;
  cardStyle?: string;
  onAddToCart?: (e: React.MouseEvent) => void;
}

const aspectClass = {
  square: "aspect-square",
  tall: "aspect-[3/4]",
  wide: "aspect-[4/3]",
};

export function ProductCard({
  productId,
  productSlug,
  showPrice = true,
  showTags = true,
  showRating = false,
  showCta = true,
  cta = "Add to cart",
  aspect = "square",
  imageHeightPct,
  cardPadding,
  cardStyle,
  onAddToCart,
}: ProductCardProps) {
  const storePath = useStorePath();
  const product =
    mockProducts.find((p) => p.id === productId) ?? mockProducts[0];
  const onSale = Number(product.compareAtPrice) > Number(product.price);
  const pad = productCardPadding(cardStyle, cardPadding);
  const isMinimal = cardStyle === "minimal";
  const isCompact = cardStyle === "compact";
  const imageShell = productCardImageShell(imageHeightPct, aspectClass[aspect]);
  const slug = productSlug || product.slug || product.id;
  const detailHref = storePath(`/products/${slug}`);

  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden border border-border bg-card text-card-foreground transition-shadow hover:shadow-md",
        isMinimal ? "rounded-md" : isCompact ? "rounded-lg" : "rounded-lg",
      )}
    >
      <Link to={detailHref} className="block">
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
        </div>
      </Link>
      <div className="flex flex-1 flex-col" style={{ padding: pad }}>
        {!isMinimal && (
          <div className="text-xs text-muted-foreground">{product.category}</div>
        )}
        <Link to={detailHref} className="no-underline hover:no-underline">
          <h3 className={productCardBodyClass(cardStyle)}>{product.name}</h3>
        </Link>
        {showRating && (product.rating ?? 0) > 0 && !isMinimal && (
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
        {!product.inStock ? (
          <span className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            Out of Stock
          </span>
        ) : showCta ? (
          <Button
            size="sm"
            variant="outline"
            className={cn("w-full", isMinimal ? "mt-2 h-7 text-[11px]" : "mt-3")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddToCart?.(e);
            }}
          >
            <ShoppingBag className={isMinimal ? "h-3 w-3" : "h-3.5 w-3.5"} />
            {isMinimal ? "Add" : cta}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
