import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockProducts } from "@/commerce-blocks/mock/products";
import { cn } from "@/lib/utils";

interface Props {
  productId?: string;
  layout?: "imageLeft" | "imageRight";
  background?: "muted" | "accent" | "transparent";
  cta?: string;
  showCompareAt?: boolean;
}

const bgClass = {
  muted: "bg-muted",
  accent: "bg-accent",
  transparent: "",
};

export function FeaturedProduct({
  productId,
  layout = "imageLeft",
  background = "muted",
  cta = "Shop now",
  showCompareAt = true,
}: Props) {
  const p =
    mockProducts.find((x) => x.id === productId) ??
    mockProducts.find((x) => x.compareAtPrice) ??
    mockProducts[0];

  return (
    <section className={cn("grid items-center gap-0 md:grid-cols-2", bgClass[background])}>
      <div
        className={cn(
          "aspect-[4/3] bg-card md:aspect-auto md:h-[420px]",
          layout === "imageRight" && "md:order-2",
        )}
      >
        {p.image && (
          <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-col justify-center gap-4 p-8 md:p-12">
        <div className="flex flex-wrap gap-2">
          {p.tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{p.name}</h2>
        <p className="text-muted-foreground md:text-lg">{p.description}</p>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold">{formatPrice(p.price, p.currency)}</span>
          {showCompareAt && p.compareAtPrice && (
            <span className="text-muted-foreground line-through">
              {formatPrice(p.compareAtPrice, p.currency)}
            </span>
          )}
        </div>
        <div>
          <Button size="lg">
            {cta}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
