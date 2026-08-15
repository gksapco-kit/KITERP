import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockProducts } from "@/commerce-blocks/mock/products";
import { Button } from "@/components/ui/button";
import { ProductCard } from "./ProductCard";

interface Props {
  columns?: number;
  showPrice?: boolean;
  showTags?: boolean;
  showRating?: boolean;
  title?: string;
  cta?: string;
}

const colsClass: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-5",
};

export function ProductGrid({
  columns = 3,
  showPrice = true,
  showTags = true,
  showRating = false,
  title = "Shop our latest",
  cta = "Add to cart",
}: Props) {
  return (
    <section className="px-6 py-10">
      {title && (
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>
      )}
      <div className={cn("grid gap-4", colsClass[columns] ?? colsClass[3])}>
        {mockProducts.slice(0, columns * 2).map((p) => (
          <ProductCard
            key={p.id}
            productId={p.id}
            showPrice={showPrice}
            showTags={showTags}
            showRating={showRating}
            cta={cta}
          />
        ))}
      </div>
    </section>
  );
}

export function ProductList({
  showPrice = true,
  showTags = true,
  showRating = true,
  title = "All products",
  cta = "Add to cart",
}: Props) {
  return (
    <section className="px-6 py-10">
      {title && (
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>
      )}
      <ul className="divide-y divide-border">
        {mockProducts.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center gap-4 py-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
              {p.image && (
                <img src={p.image} alt={p.name} className="h-full w-full object-cover object-center" />
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
                {showRating && (p.rating ?? 0) > 0 && (
                  <div className="text-xs text-muted-foreground">★ {p.rating}</div>
                )}
              </div>
            )}
            <Button size="sm" variant="outline">
              {cta}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductCarousel({
  showPrice = true,
  showTags = true,
  showRating = false,
  title = "Featured this week",
  cta = "Add",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
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
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-thin"
      >
        {mockProducts.map((p) => (
          <div key={p.id} className="w-60 shrink-0 snap-start">
            <ProductCard
              productId={p.id}
              showPrice={showPrice}
              showTags={showTags}
              showRating={showRating}
              cta={cta}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
