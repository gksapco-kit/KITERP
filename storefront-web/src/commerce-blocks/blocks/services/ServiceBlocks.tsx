import { Check, Clock, ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockServices, type MockService } from "@/commerce-blocks/mock/services";
import { useVendor } from "@/contexts/VendorContext";
import { shouldShowServiceBookCta } from "@/lib/serviceStorefrontCta";
import type { DisplayFieldMap } from "@/lib/storefrontDisplayFields";
import { cn } from "@/lib/utils";
import { catalogGridClassName } from "@/lib/commerceCatalogLayout";
import { cardStylePadding } from "@/lib/commerceCatalogLayout";

function serviceShowsBookCta(
  service: MockService,
  showBookLink: boolean,
  showCta: boolean,
  serviceDisplayFields?: DisplayFieldMap,
): boolean {
  if (!showBookLink || !showCta) return false;
  return shouldShowServiceBookCta(
    {
      allow_quote_request: service.allowQuoteRequest,
      requires_booking: service.requiresBooking,
    },
    serviceDisplayFields,
  );
}

interface ListProps {
  showFeatures?: boolean;
  showImage?: boolean;
  showBookLink?: boolean;
  showCta?: boolean;
  cta?: string;
  title?: string;
  gap?: number;
  cardPadding?: number;
  itemLimit?: number;
}

export function ServiceList({
  showFeatures = true,
  showImage = true,
  showBookLink = true,
  showCta = true,
  cta = "Book now",
  title = "Our services",
  gap = 16,
  cardPadding = 20,
  itemLimit,
}: ListProps) {
  const { displayFields } = useVendor();
  const items = itemLimit ? mockServices.slice(0, itemLimit) : mockServices;
  return (
    <section className="px-6 py-10">
      {title && <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>}
      <div className="space-y-4" style={{ gap }}>
        {items.map((s) => (
          <article
            key={s.id}
            className="flex flex-col gap-4 rounded-lg border border-border bg-card md:flex-row md:items-center"
            style={{ padding: cardPadding }}
          >
            {showImage && s.image && (
              <div className="h-32 w-full overflow-hidden rounded-md bg-muted md:h-24 md:w-32 md:shrink-0">
                <img src={s.image} alt={s.name} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{s.name}</h3>
                {s.popular && (
                  <Badge variant="secondary" className="bg-warning/15 text-warning-foreground">
                    Popular
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{s.category}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {s.duration}
                </span>
              </div>
              {showFeatures && (
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {s.features.map((f) => (
                    <li key={f} className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-success" /> {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
              <div className="text-right">
                <div className="text-xl font-semibold">{formatPrice(s.price, s.currency)}</div>
                <div className="text-xs text-muted-foreground">starting from</div>
              </div>
              <Button>
                {serviceShowsBookCta(s, showBookLink, showCta, displayFields.service) ? cta : 'View'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

interface GridProps {
  columns?: number;
  gap?: number;
  itemLimit?: number;
  cardPadding?: number;
  cardStyle?: string;
  showFeatures?: boolean;
  showBookLink?: boolean;
  showCta?: boolean;
  cta?: string;
  title?: string;
}

export function ServiceCardGrid({
  columns = 3,
  gap = 16,
  itemLimit,
  cardPadding,
  cardStyle,
  showFeatures = true,
  showBookLink = true,
  showCta = true,
  cta = "Learn more",
  title = "Services we offer",
}: GridProps) {
  const { displayFields } = useVendor();
  const pad = cardStylePadding(cardStyle ?? "default", cardPadding);
  const isMinimal = cardStyle === "minimal";
  const items = itemLimit ? mockServices.slice(0, itemLimit) : mockServices;
  return (
    <section className="px-6 py-10">
      {title && <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>}
      <div className={cn("grid", catalogGridClassName(columns, "services_cards"))} style={{ gap }}>
        {items.map((s) => (
          <div
            key={s.id}
            className={cn(
              "flex flex-col rounded-lg border border-border bg-card transition-shadow hover:shadow-md",
              isMinimal && "text-sm",
            )}
            style={{ padding: pad }}
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {s.category}
            </div>
            <h3 className="mt-1 text-lg font-semibold">{s.name}</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.description}</p>
            {showFeatures && (
              <ul className="mt-3 space-y-1 text-sm">
                {s.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-success" /> {f}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
              <div>
                <div className="text-lg font-semibold">{formatPrice(s.price, s.currency)}</div>
                <div className="text-xs text-muted-foreground">{s.duration}</div>
              </div>
              <Button variant="outline" size="sm">
                {serviceShowsBookCta(s, showBookLink, showCta, displayFields.service) ? cta : 'View'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface DetailProps {
  serviceId?: string;
  cta?: string;
  showFeatures?: boolean;
}

export function ServiceDetail({
  serviceId,
  cta = "Book this service",
  showFeatures = true,
}: DetailProps) {
  const s = mockServices.find((x) => x.id === serviceId) ?? mockServices[0];
  return (
    <section className="grid gap-8 p-6 md:grid-cols-[1fr_320px] md:p-10">
      <div>
        {s.image && (
          <div className="mb-6 aspect-[16/9] overflow-hidden rounded-lg bg-muted">
            <img src={s.image} alt={s.name} className="h-full w-full object-cover" />
          </div>
        )}
        <Badge variant="secondary">{s.category}</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{s.name}</h1>
        <p className="mt-3 text-muted-foreground">{s.description}</p>
        {showFeatures && (
          <>
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              What's included
            </h3>
            <ul className="mt-3 space-y-2">
              {s.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-success" />
                  <span className="text-sm">{f}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <aside className="h-fit space-y-4 rounded-lg border border-border bg-muted/30 p-5">
        <div>
          <div className="text-3xl font-semibold">{formatPrice(s.price, s.currency)}</div>
          <div className="text-sm text-muted-foreground">{s.duration}</div>
        </div>
        <Button className="w-full" size="lg">
          {cta}
        </Button>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3 fill-warning text-warning" /> 4.9 average rating
        </div>
      </aside>
    </section>
  );
}
