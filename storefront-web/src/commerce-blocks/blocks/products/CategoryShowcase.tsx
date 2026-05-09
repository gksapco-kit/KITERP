import { mockCategories } from "@/commerce-blocks/mock/products";
import { cn } from "@/lib/utils";

interface Props {
  layout?: "grid" | "carousel";
  showCount?: boolean;
  title?: string;
}

export function CategoryShowcase({
  layout = "grid",
  showCount = true,
  title = "Shop by category",
}: Props) {
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
              "group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-lg border border-border bg-muted",
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
            <div className="absolute inset-x-0 bottom-0 p-4 text-background">
              <div className="text-lg font-semibold">{c.name}</div>
              {showCount && (
                <div className="text-xs opacity-90">{c.count} products</div>
              )}
            </div>
          </div>
        ))}
      </Wrapper>
    </section>
  );
}
