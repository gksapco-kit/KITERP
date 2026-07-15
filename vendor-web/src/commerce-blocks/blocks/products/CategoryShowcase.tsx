import { mockCategories } from "@/commerce-blocks/mock/products";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface Props {
  layout?: "grid" | "carousel";
  showCount?: boolean;
  title?: string;
  /** Builder Card text — when set, overrides the default light overlay labels. */
  tile_text?: string | null;
}

export function CategoryShowcase({
  layout = "grid",
  showCount = true,
  title = "Shop by category",
  tile_text,
}: Props) {
  const overlayTextColor =
    typeof tile_text === "string" && tile_text.trim() ? tile_text.trim() : undefined;
  const labelStyle: CSSProperties | undefined = overlayTextColor
    ? { color: overlayTextColor }
    : undefined;

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    layout === "carousel" ? (
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">{children}</div>
    ) : (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{children}</div>
    );

  return (
    <section className="px-6 py-10">
      {title && (
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>
      )}
      <Wrapper>
        {mockCategories.map((c) => (
          <div
            key={c.id}
            className={cn(
              "builder-tile-card group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-lg border border-border bg-muted",
              layout === "carousel" && "w-56 shrink-0",
            )}
          >
            {c.image && (
              <img
                src={c.image}
                alt={c.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 p-4",
                !overlayTextColor && "text-background",
              )}
              style={labelStyle}
            >
              <div className="builder-tile-overlay-title text-lg font-semibold">{c.name}</div>
              {showCount && (
                <div className="builder-tile-overlay-title text-xs opacity-90">{c.count} products</div>
              )}
            </div>
          </div>
        ))}
      </Wrapper>
    </section>
  );
}
