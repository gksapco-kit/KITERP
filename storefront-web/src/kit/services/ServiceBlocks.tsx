import { Link, type MouseEvent } from "react-router-dom";
import { Clock, CalendarDays, Check, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVendor } from "@/contexts/VendorContext";
import { shouldShowServiceBookCta, serviceBookingListCtaLabel } from "@/lib/serviceStorefrontCta";
import { readCatalogCardLayout } from "@/lib/catalogCardLayout";
import {
  resolveCatalogAddButtonPresentation,
} from "@/lib/catalogAddButtonStyle";
import { cn, imgUrl } from "@/lib/utils";
import type { Service } from "../types";
import { formatPrice } from "../mock";
import { isPricedAmount, servicePriceFallbackLabel, isPriceNotApplicable } from "@/lib/servicePricing";

export interface ServiceCardProps {
  service: Service;
  layout?: "row" | "card";
  linkTo?: string;
  onNavigateClick?: (e: MouseEvent) => void;
  onBook?: (s: Service) => void;
  /** Legacy navigation handler — prefer linkTo */
  onView?: (s: Service) => void;
  showDuration?: boolean;
  showFeatures?: boolean;
}

export function ServiceCard({
  service,
  layout = "card",
  linkTo,
  onNavigateClick,
  onBook,
  onView,
  showDuration = true,
  showFeatures = false,
}: ServiceCardProps) {
  const { displayFields } = useVendor();
  const cardLayout = readCatalogCardLayout({});
  const row = layout === "row";
  const serviceHref = linkTo ?? `/services/${service.slug}`;
  const showBookCta = shouldShowServiceBookCta(
    {
      allow_quote_request: service.allowQuoteRequest,
      requires_booking: service.requiresBooking,
    },
    displayFields.service,
  );
  const addBtn = resolveCatalogAddButtonPresentation({
    style: cardLayout.addButtonStyle,
    isMinimalCard: cardLayout.isMinimalCard,
    isCompactCard: cardLayout.isCompactCard,
  });

  const handleNavClick = (e: MouseEvent) => {
    if (onNavigateClick) {
      onNavigateClick(e);
      return;
    }
    if (onView) {
      e.preventDefault();
      onView(service);
    }
  };

  const imageBlock = (
    <div
      className={cn(
        "relative w-full shrink-0 overflow-hidden bg-muted",
        row ? "h-full min-h-[11rem]" : "aspect-[16/10]",
      )}
      style={row ? undefined : { aspectRatio: "16 / 10" }}
    >
      {service.image ? (
        <img
          src={imgUrl(service.image)}
          alt={service.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full max-w-none object-cover object-center transition-transform duration-300 group-hover:scale-105"
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Wrench className="h-8 w-8 opacity-25" />
        </div>
      )}
    </div>
  );

  return (
    <Card className={cn("overflow-hidden group flex h-full flex-col", row && "flex-row")}>
      <div className={cn("relative shrink-0", row ? "w-44" : "w-full")}>
        <Link to={serviceHref} className="block" onClick={handleNavClick}>
          {imageBlock}
        </Link>
        {showDuration && service.durationMinutes > 0 && (
          <Badge variant="secondary" className="absolute top-2 left-2 z-10 pointer-events-none gap-1">
            <Clock className="h-3 w-3" />
            {service.durationMinutes}m
          </Badge>
        )}
      </div>
      <CardContent className={cn("flex flex-1 flex-col gap-2 p-4", row && "p-4")}>
        <Link
          to={serviceHref}
          className="font-medium line-clamp-2 hover:underline"
          onClick={handleNavClick}
        >
          {service.name}
        </Link>
        {!row && service.shortDescription && (
          <p className="text-sm text-muted-foreground line-clamp-2">{service.shortDescription}</p>
        )}
        {showFeatures && service.features && service.features.length > 0 && (
          <ul className="space-y-1">
            {service.features.slice(0, 3).map((f) => (
              <li key={f} className="text-sm flex gap-2 text-muted-foreground">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-baseline gap-2">
          {!isPriceNotApplicable(service.price_type) && (
            <span className="font-semibold">
              {isPricedAmount(service.price)
                ? formatPrice(service.price, service.currency)
                : (servicePriceFallbackLabel(service.price, service.price_type, "Get Quote") ?? "")}
            </span>
          )}
        </div>
        {showBookCta && onBook && (
          <div className="mt-auto flex items-center gap-2 pt-2">
            <button
              type="button"
              className={cn(addBtn.className, !addBtn.iconOnly && "w-full", "hover:opacity-90")}
              style={addBtn.style}
              aria-label={addBtn.iconOnly ? serviceBookingListCtaLabel(service.bookingLabel) : undefined}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBook(service);
              }}
            >
              <CalendarDays className={addBtn.iconClassName} />
              {addBtn.showLabel ? serviceBookingListCtaLabel(service.bookingLabel) : null}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ServiceCardGrid({ services, columns = 3, onBook, onView, linkTo }: {
  services: Service[];
  columns?: 2 | 3 | 4;
  onBook?: (s: Service) => void;
  onView?: (s: Service) => void;
  linkTo?: (s: Service) => string;
}) {
  const colMap = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;
  return (
    <div className={cn("grid gap-4 grid-cols-1 items-stretch", colMap[columns])}>
      {services.map((s) => (
        <ServiceCard
          key={s.id}
          service={s}
          linkTo={linkTo?.(s)}
          onBook={onBook}
          onView={onView}
        />
      ))}
    </div>
  );
}

export function ServiceList({ services, onBook, onView, linkTo }: {
  services: Service[];
  onBook?: (s: Service) => void;
  onView?: (s: Service) => void;
  linkTo?: (s: Service) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {services.map((s) => (
        <ServiceCard
          key={s.id}
          service={s}
          layout="row"
          linkTo={linkTo?.(s)}
          onBook={onBook}
          onView={onView}
          showFeatures
        />
      ))}
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
            <Link
              to={t.cta.href}
              className="mt-6 inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              {t.cta.label}
            </Link>
          )}
        </Card>
      ))}
    </div>
  );
}
