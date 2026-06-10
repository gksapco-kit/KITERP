import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockProducts } from "@/commerce-blocks/mock/products";
import { Button } from "@/components/ui/button";
import { ProductCard } from "./ProductCard";
import { catalogGridClassName, carouselCardWidthClass } from "@/lib/commerceCatalogLayout";

interface Props {
  columns?: number;
  gap?: number;
  itemLimit?: number;
  imageHeightPct?: number;
  cardPadding?: number;
  cardStyle?: string;
  showPrice?: boolean;
  showTags?: boolean;
  showRating?: boolean;
  showCta?: boolean;
  cta?: string;
  title?: string;
}

export function ProductGrid({
  columns = 3,
  gap = 16,
  itemLimit,
  imageHeightPct,
  cardPadding,
  cardStyle,
  showPrice = true,
  showTags = true,
  showRating = false,
  showCta = true,
  cta = "Add to cart",
  title = "Shop our latest",
}: Props) {
  const limit = itemLimit ?? columns * 2;
  const cardProps = { imageHeightPct, cardPadding, cardStyle, showCta };

  return (
    <section className="px-6 py-10">
      {title && (
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>
      )}
      <div className={cn("grid", catalogGridClassName(columns))} style={{ gap }}>
        {mockProducts.slice(0, limit).map((p) => (
          <ProductCard
            key={p.id}
            productId={p.id}
            showPrice={showPrice}
            showTags={showTags}
            showRating={showRating}
            cta={cta}
            {...cardProps}
          />
        ))}
      </div>
    </section>
  );
}

export function ProductList({
  gap = 0,
  itemLimit = 5,
  cardPadding,
  cardStyle,
  showPrice = true,
  showTags = true,
  showRating = true,
  showCta = true,
  cta = "Add to cart",
  title = "All products",
}: Props) {
  return (
    <section className="px-6 py-10">
      {title && (
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>
      )}
      <ul className="divide-y divide-border" style={{ gap }}>
        {mockProducts.slice(0, itemLimit).map((p) => (
          <li key={p.id} className="flex items-center gap-4 py-4">
            <div
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted"
              style={cardPadding ? { padding: Math.max(0, cardPadding - 8) } : undefined}
            >
              {p.image && (
                <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">{p.category}</div>
              <div className="truncate font-medium">{p.name}</div>
              <div className="line-clamp-1 text-sm text-muted-foreground">{p.description}</div>
              {showTags && p.tags.length > 0 && (
                <div className="mt-1 flex gap-1">
                  {p.tags.slice(0, 2).map((t) => (
                    <span key={t} className="rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {showPrice && (
              <div className="text-right">
                <div className="font-semibold">${p.price}</div>
                {showRating && p.rating && (
                  <div className="text-xs text-muted-foreground">★ {p.rating}</div>
                )}
              </div>
            )}
            {showCta && (
              <Button size="sm" variant="outline">
                {cta}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductCarousel({
  columns = 4,
  gap = 16,
  itemLimit,
  imageHeightPct,
  cardPadding,
  cardStyle,
  showPrice = true,
  showTags = true,
  showRating = false,
  showCta = true,
  cta = "Add",
  title = "Featured this week",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const limit = itemLimit ?? mockProducts.length;
  const cardWidthClass = carouselCardWidthClass(columns);
  const cardProps = { imageHeightPct, cardPadding, cardStyle, showCta };

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <section className="px-6 py-10">
      <div className="mb-4 flex items-center justify-between">
        {title && <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>}
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scroll(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scroll(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory overflow-x-auto pb-2 scrollbar-none"
        style={{ gap }}
      >
        {mockProducts.slice(0, limit).map((p) => (
          <div key={p.id} className={cn("shrink-0 snap-start", cardWidthClass)}>
            <ProductCard
              productId={p.id}
              showPrice={showPrice}
              showTags={showTags}
              showRating={showRating}
              cta={cta}
              {...cardProps}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
