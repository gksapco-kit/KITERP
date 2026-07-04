import { Link } from "react-router-dom";
import { Clock, ArrowRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { themeUi } from "@/lib/themeColors";
import { cn } from "@/lib/utils";
import type { Service } from "../types";
import { formatPrice } from "../mock";

export interface ServiceCardProps {
  service: Service;
  layout?: "row" | "card";
  onBook?: (s: Service) => void;
  onView?: (s: Service) => void;
}

export function ServiceCard({ service, layout = "card", onBook, onView }: ServiceCardProps) {
  const row = layout === "row";
  return (
    <Card
      className={cn(
        "overflow-hidden border-2 shadow-sm",
        themeUi.cardBorder, themeUi.catalogSurface, row && "flex",
        onView && "cursor-pointer transition-shadow hover:shadow-md",
      )}
      onClick={onView ? () => onView(service) : undefined}
      role={onView ? "link" : undefined}
    >
      {service.image && (
        <div className={cn(row ? "w-56 shrink-0" : "aspect-[16/9]")}>
          <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
        </div>
      )}
      <CardContent className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className={cn("text-lg font-semibold", themeUi.titleOnSurface)}>{service.name}</h3>
            {service.shortDescription && (
              <p className={cn("text-base mt-1.5 line-clamp-2", themeUi.mutedOnSurface)}>{service.shortDescription}</p>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0 text-sm">
            <Clock className="h-3.5 w-3.5 mr-1" />{service.durationMinutes}m
          </Badge>
        </div>
        {service.features && (
          <ul className="space-y-1.5">
            {service.features.slice(0, 3).map((f) => (
              <li key={f} className={cn("text-sm flex gap-2", themeUi.mutedOnSurface)}><Check className={cn("h-4 w-4 mt-0.5 shrink-0", themeUi.iconPrimary)} />{f}</li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-center justify-between pt-3 gap-3">
          <div className={cn("text-lg font-bold", themeUi.priceOnSurface)}>{formatPrice(service.price, service.currency)}</div>
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onBook?.(service); }}>
            Book <ArrowRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ServiceCardGrid({ services, columns = 3, onBook, onView }: { services: Service[]; columns?: 2 | 3 | 4; onBook?: (s: Service) => void; onView?: (s: Service) => void }) {
  const colMap = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;
  return (
    <div className={cn("grid gap-4 grid-cols-1", colMap[columns])}>
      {services.map((s) => <ServiceCard key={s.id} service={s} onBook={onBook} onView={onView} />)}
    </div>
  );
}

export function ServiceList({ services, onBook, onView }: { services: Service[]; onBook?: (s: Service) => void; onView?: (s: Service) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {services.map((s) => <ServiceCard key={s.id} service={s} layout="row" onBook={onBook} onView={onView} />)}
    </div>
  );
}

export interface PricingTier {
  name: string;
  price: number;
  period?: string;
  features: string[];
  highlight?: boolean;
  cta?: { label: string; href: string };
}

export function PricingTiers({ tiers }: { tiers: PricingTier[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {tiers.map((t) => (
        <Card key={t.name} className={cn("p-6 flex flex-col", t.highlight && "border-primary ring-2 ring-primary/20 shadow-lg")}>
          <div className="text-sm font-medium text-muted-foreground">{t.name}</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-semibold">{formatPrice(t.price)}</span>
            {t.period && <span className="text-sm text-muted-foreground">/{t.period}</span>}
          </div>
          <ul className="mt-4 space-y-2 flex-1">
            {t.features.map((f) => (
              <li key={f} className="flex gap-2 text-sm"><Check className="h-4 w-4 text-primary mt-0.5" />{f}</li>
            ))}
          </ul>
          {t.cta && (
            <Button asChild className="mt-6" variant={t.highlight ? "default" : "outline"}>
              <Link to={t.cta.href}>{t.cta.label}</Link>
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}
