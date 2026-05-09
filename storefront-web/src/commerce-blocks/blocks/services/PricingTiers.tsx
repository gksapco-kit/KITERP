import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockPricingTiers } from "@/commerce-blocks/mock/services";
import { cn } from "@/lib/utils";

interface Props {
  highlightMiddle?: boolean;
  cta?: string;
  title?: string;
  subtitle?: string;
}

export function PricingTiers({
  highlightMiddle = true,
  cta = "Get started",
  title = "Pick your plan",
  subtitle = "Simple pricing. Upgrade or downgrade anytime.",
}: Props) {
  return (
    <section className="px-6 py-12 text-center">
      {title && <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>}
      {subtitle && <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{subtitle}</p>}
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
        {mockPricingTiers.map((t) => {
          const featured = highlightMiddle && t.highlighted;
          return (
            <div
              key={t.id}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-6 text-left",
                featured
                  ? "border-primary shadow-lg ring-1 ring-primary"
                  : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t.name}</h3>
                {featured && <Badge>Most popular</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">${t.price}</span>
                <span className="text-sm text-muted-foreground">/{t.period}</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-6" variant={featured ? "default" : "outline"}>
                {cta}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
