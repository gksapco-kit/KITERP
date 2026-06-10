import { mockCategories } from "@/commerce-blocks/mock/products";
import { cn } from "@/lib/utils";
import { catalogGridClassName } from "@/lib/commerceCatalogLayout";

interface Props {
  layout?: "grid" | "carousel";
  showCount?: boolean;
  title?: string;
  columns?: number;
  gap?: number;
  imageHeightPct?: number;
  itemLimit?: number;
}

export function CategoryShowcase({
  layout = "grid",
  showCount = true,
  title = "Shop by category",
  columns = 4,
  gap = 16,
  imageHeightPct = 100,
  itemLimit,
}: Props) {
  const items = mockCategories.slice(0, itemLimit ?? mockCategories.length);
  const gridClass = catalogGridClassName(columns, "category_cards");
  const imagePad = Math.min(150, Math.max(50, imageHeightPct));

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    layout === "carousel" ? (
      <div className="flex overflow-x-auto pb-2 scrollbar-none" style={{ gap }}>{children}</div>
    ) : (
      <div className={cn("grid", gridClass)} style={{ gap }}>{children}</div>
    );

  return (
    <section className="px-6 py-10">
      {title && (
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>
      )}
      <Wrapper>
        {items.map((c) => (
          <div
            key={c.id}
            className={cn(
              "builder-tile-card group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card",
              layout === "carousel" && "w-56 shrink-0",
            )}
          >
            <div className="relative w-full bg-card" style={{ paddingBottom: `${imagePad}%` }}>
              {c.image && (
                <img
                  src={c.image}
                  alt={c.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-background">
                <div className="text-lg font-semibold">{c.name}</div>
                {showCount && (
                  <div className="text-xs opacity-90">{c.count} products</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </Wrapper>
    </section>
  );
}
