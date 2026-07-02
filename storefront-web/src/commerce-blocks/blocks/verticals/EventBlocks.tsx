import { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  Users,
  Plus,
  Minus,
  Music2,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockEvent, mockEventList, type EventTier } from "@/commerce-blocks/mock/verticals";
import { catalogGridClassName } from "@/lib/commerceCatalogLayout";
import {
  catalogVariantStyle,
  detailVariantStyle,
  DetailShell,
  verticalSwatch,
  type CatalogVariantStyle,
} from "@/commerce-blocks/lib/verticalVariants";

type EventItem = (typeof mockEventList)[number];

const withEventImage = (e: EventItem): EventItem => ({
  ...e,
  image: e.image || verticalSwatch(e.id || e.title || "event"),
  // Builder number fields persist strings; coerce so the `=== 0` "Free" check works.
  fromPrice: Number(e.fromPrice) || 0,
});

/** Ticket tier perks can arrive as a string[] (mock) or newline string (builder textarea). */
function normalizePerks(perks: unknown): string[] {
  if (Array.isArray(perks)) return perks.map(String).filter(Boolean);
  return String(perks ?? "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
}

interface EventListingProps {
  variant?: string;
  layout?: "grid" | "list";
  columns?: number;
  gap?: number;
  itemLimit?: number;
  showTag?: boolean;
  cta?: string;
  events?: EventItem[];
  header_title?: string;
  header_subtitle?: string;
  all_events_label?: string;
}

export function EventListing({
  variant,
  layout,
  itemLimit,
  showTag = true,
  cta,
  events,
  header_title,
  header_subtitle,
  all_events_label,
}: EventListingProps) {
  const style = catalogVariantStyle(variant ?? layout ?? "default");
  const source = events && events.length ? events : mockEventList;
  const items = source.slice(0, itemLimit ?? source.length).map(withEventImage);
  const headerProps = {
    hero: style.hero,
    count: items.length,
    title: header_title,
    subtitle: header_subtitle,
    allEventsLabel: all_events_label ?? "All events",
  };

  if (style.mode === "list") {
    return (
      <div className="bg-background p-6">
        <Header {...headerProps} />
        <div className="flex flex-col" style={{ gap: style.gap }}>
          {items.map((e) => (
            <EventRow key={e.id} e={e} showTag={showTag} cta={cta} cardClass={style.cardClass} />
          ))}
        </div>
      </div>
    );
  }

  if (style.mode === "featured") {
    const [first, ...rest] = items;
    return (
      <div className="bg-background p-6">
        <Header {...headerProps} />
        {first && <FeaturedEvent e={first} showTag={showTag} cta={cta} />}
        <div className={cn("mt-5 grid grid-cols-1", catalogGridClassName(style.columns))} style={{ gap: style.gap }}>
          {rest.map((e) => (
            <EventCard key={e.id} e={e} showTag={showTag} cta={cta} style={style} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background p-6">
      <Header {...headerProps} />
      <div className={cn("grid grid-cols-1", catalogGridClassName(style.columns))} style={{ gap: style.gap }}>
        {items.map((e) => (
          <EventCard key={e.id} e={e} showTag={showTag} cta={cta} style={style} />
        ))}
      </div>
    </div>
  );
}

function EventCard({
  e,
  showTag,
  cta,
  style,
}: {
  e: EventItem;
  showTag: boolean;
  cta?: string;
  style: CatalogVariantStyle;
}) {
  return (
    <div className={cn("group overflow-hidden transition-shadow hover:shadow-md", style.cardClass)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
        <img src={e.image} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        {showTag && (
          <Badge className="absolute left-3 top-3 bg-background/90 text-foreground hover:bg-background/90">
            {e.tag}
          </Badge>
        )}
        <div className="absolute bottom-3 left-3 rounded-md bg-foreground/90 px-2 py-1 text-xs font-medium text-background backdrop-blur">
          {e.date}
        </div>
      </div>
      <div className={cn(style.card === "plain" || style.card === "editorial" ? "pt-3" : "p-4")}>
        <h3 className={cn("line-clamp-2 font-semibold", style.bigTitle ? "text-lg" : "text-sm")}>{e.title}</h3>
        <div className="mt-1 line-clamp-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {e.venue}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm font-semibold">
            {e.fromPrice === 0 ? "Free" : `from ${formatPrice(e.fromPrice, e.currency)}`}
          </span>
          {cta && <Button size="sm" variant="outline">{cta}</Button>}
        </div>
      </div>
    </div>
  );
}

function EventRow({
  e,
  showTag,
  cta,
  cardClass,
}: {
  e: EventItem;
  showTag: boolean;
  cta?: string;
  cardClass: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 p-3 sm:flex-row", cardClass)}>
      <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-md bg-muted sm:h-24 sm:w-40">
        <img src={e.image} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            {showTag && <Badge variant="secondary" className="mb-1 text-xs">{e.tag}</Badge>}
            <h3 className="text-base font-semibold">{e.title}</h3>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{e.date}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{e.venue}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">From</div>
            <div className="text-base font-semibold">
              {e.fromPrice === 0 ? "Free" : formatPrice(e.fromPrice, e.currency)}
            </div>
          </div>
        </div>
        {cta && <Button variant="outline" size="sm" className="mt-auto self-end">{cta}</Button>}
      </div>
    </div>
  );
}

function FeaturedEvent({ e, showTag, cta }: { e: EventItem; showTag: boolean; cta?: string }) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-2">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted md:aspect-auto">
        <img src={e.image} alt="" className="h-full w-full object-cover" />
        {showTag && (
          <Badge className="absolute left-4 top-4 bg-background/90 text-foreground hover:bg-background/90">{e.tag}</Badge>
        )}
      </div>
      <div className="flex flex-col justify-center p-6">
        <div className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-primary">
          <Calendar className="h-3.5 w-3.5" />
          Featured · {e.date}
        </div>
        <h3 className="mt-1 text-2xl font-bold">{e.title}</h3>
        <div className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {e.venue}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xl font-semibold">
            {e.fromPrice === 0 ? "Free" : `from ${formatPrice(e.fromPrice, e.currency)}`}
          </span>
          {cta && <Button>{cta}</Button>}
        </div>
      </div>
    </div>
  );
}

function Header({
  hero,
  count,
  title,
  subtitle,
  allEventsLabel,
}: {
  hero?: boolean;
  count: number;
  title?: string;
  subtitle?: string;
  allEventsLabel?: string;
}) {
  const displayTitle = title ?? "Upcoming events";
  const displaySubtitle = subtitle ?? (hero
    ? `${count} event${count === 1 ? "" : "s"} near you — grab your spot`
    : `${count} event${count === 1 ? "" : "s"} near you`);
  if (hero) {
    return (
      <div className="mb-6 rounded-xl border border-border bg-gradient-to-r from-primary/10 to-transparent p-6">
        {displayTitle && <h2 className="text-3xl font-bold tracking-tight">{displayTitle}</h2>}
        {displaySubtitle && <p className="mt-1 text-sm text-muted-foreground">{displaySubtitle}</p>}
      </div>
    );
  }
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        {displayTitle && <h2 className="text-xl font-semibold">{displayTitle}</h2>}
        {displaySubtitle && <p className="text-sm text-muted-foreground">{displaySubtitle}</p>}
      </div>
      {allEventsLabel && <Button variant="outline" size="sm">{allEventsLabel}</Button>}
    </div>
  );
}

/* ---------- Ticket Picker ---------- */

interface TicketPickerProps {
  variant?: string;
  showSeating?: boolean;
  cta?: string;
  tiers?: EventTier[];
  title?: string;
  tagline?: string;
  image_url?: string;
  date?: string;
  doors?: string;
  start?: string;
  venue?: string;
  address?: string;
  order_title?: string;
  age_note?: string;
  seating_title?: string;
  max_per_order?: number | string;
}

export function TicketPicker({
  variant,
  showSeating = true,
  cta,
  tiers,
  title,
  tagline,
  image_url,
  date,
  doors,
  start,
  venue,
  address,
  order_title,
  age_note,
  seating_title,
  max_per_order,
}: TicketPickerProps) {
  const e = mockEvent;
  const ev = {
    title: title ?? e.title,
    tagline: tagline ?? e.tagline,
    image: image_url || e.image,
    date: date ?? e.date,
    doors: doors ?? e.doors,
    start: start ?? e.start,
    venue: venue ?? e.venue,
    address: address ?? e.address,
  };
  const orderTitle = order_title ?? "Your order";
  const ageNote = age_note ?? `${e.ageRestriction} event · ID required at door`;
  const seatingTitleText = seating_title ?? "Seating chart";
  const maxPerOrder = (() => {
    if (max_per_order === undefined) return 8;
    const n = Number(max_per_order);
    return Number.isFinite(n) && n > 0 ? n : 8;
  })();
  const checkoutLabel = cta ?? "Continue to checkout";
  const infoItems = [
    ev.date ? { icon: Calendar, label: "Date", value: ev.date } : null,
    [ev.doors, ev.start].filter(Boolean).length
      ? { icon: Clock, label: "Doors / Start", value: [ev.doors, ev.start].filter(Boolean).join(" / ") }
      : null,
    ev.venue || ev.address
      ? { icon: MapPin, label: "Venue", value: [ev.venue, ev.address].filter(Boolean).join(" · ") }
      : null,
  ].filter((item): item is { icon: typeof Calendar; label: string; value: string } => item !== null);
  const style = detailVariantStyle(variant);
  const tierList: EventTier[] = tiers && tiers.length ? tiers : e.tiers;
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries(tierList.map((t) => [t.id, t.id === "seated" ? 2 : 0])),
  );
  const total = tierList.reduce((sum, t) => sum + (qty[t.id] ?? 0) * t.price, 0);
  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);

  const banner = (
    <div className={cn("relative overflow-hidden rounded-xl bg-muted", style.hero ? "aspect-[21/9]" : "aspect-[16/9]")}>
      <img src={ev.image} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 to-transparent" />
      <div className="absolute inset-x-5 bottom-5 text-background">
        <Badge className="mb-2 bg-background text-foreground hover:bg-background">
          <Music2 className="h-3 w-3" />
          Live event
        </Badge>
        {ev.title && <h1 className={cn("font-semibold", style.hero ? "text-3xl" : "text-2xl")}>{ev.title}</h1>}
        {ev.tagline && <p className="text-sm opacity-90">{ev.tagline}</p>}
      </div>
    </div>
  );

  const main = (
    <div>
      {!style.hero && banner}

      {infoItems.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {infoItems.map((item) => (
            <Info key={item.label} icon={item.icon} label={item.label} value={item.value} />
          ))}
        </div>
      )}

          <div className="mt-6">
            <h3 className="text-sm font-semibold">Choose your tickets</h3>
            <div className="mt-3 space-y-3">
              {tierList.map((t) => {
                const sold = qty[t.id] ?? 0;
                const perks = normalizePerks(t.perks);
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4",
                      t.popular && "border-primary",
                      sold > 0 && "ring-1 ring-primary",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{t.name}</span>
                        {t.popular && <Badge className="text-xs">Popular</Badge>}
                      </div>
                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                        {perks.map((p) => (
                          <li key={p}>· {p}</li>
                        ))}
                      </ul>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {t.remaining < 20 ? (
                          <span className="text-warning">Only {t.remaining} left</span>
                        ) : (
                          <span>{t.remaining} available</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-lg font-semibold">{formatPrice(t.price, t.currency)}</div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          disabled={sold === 0}
                          onClick={() => setQty((q) => ({ ...q, [t.id]: Math.max(0, sold - 1) }))}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium tabular-nums">{sold}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          disabled={sold >= maxPerOrder}
                          onClick={() => setQty((q) => ({ ...q, [t.id]: sold + 1 }))}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {showSeating && (
            <div className="mt-6 overflow-hidden rounded-lg border border-border">
              {seatingTitleText && (
                <div className="border-b border-border bg-muted/30 p-3 text-xs font-medium uppercase text-muted-foreground">
                  {seatingTitleText}
                </div>
              )}
              <div className="p-6">
                <div className="mx-auto h-2 w-3/4 rounded-full bg-foreground/80" />
                <div className="mt-1 text-center text-xs uppercase tracking-wider text-muted-foreground">Stage</div>
                <div className="mt-6 grid gap-1.5">
                  {Array.from({ length: 6 }).map((_, row) => (
                    <div key={row} className="flex justify-center gap-1">
                      {Array.from({ length: 14 }).map((_, col) => {
                        const taken = (row * 14 + col) % 7 === 0;
                        const reserved = row === 1 && col >= 6 && col <= 7;
                        return (
                          <div
                            key={col}
                            className={cn(
                              "h-4 w-4 rounded-sm",
                              taken ? "bg-muted" : "bg-primary/30 hover:bg-primary/60",
                              reserved && "bg-primary",
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  <Legend className="bg-primary/30" label="Available" />
                  <Legend className="bg-primary" label="Selected" />
                  <Legend className="bg-muted" label="Taken" />
                </div>
              </div>
            </div>
          )}
        </div>
  );

  const aside = (
    <div className={cn("space-y-3 p-5", style.cardClass)}>
      {orderTitle && (
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Ticket className="h-4 w-4" />
          {orderTitle}
        </h3>
      )}
      {totalQty === 0 ? (
        <p className="text-sm text-muted-foreground">No tickets selected yet.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {tierList
            .filter((t) => (qty[t.id] ?? 0) > 0)
            .map((t) => (
              <li key={t.id} className="flex justify-between">
                <span>
                  {t.name} <span className="text-muted-foreground">× {qty[t.id]}</span>
                </span>
                <span className="font-medium">
                  {formatPrice((qty[t.id] ?? 0) * t.price, t.currency)}
                </span>
              </li>
            ))}
        </ul>
      )}
      <Separator />
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-semibold">{formatPrice(total, tierList[0]?.currency ?? "USD")}</span>
      </div>
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{totalQty} {totalQty === 1 ? "ticket" : "tickets"} · max {maxPerOrder} per order</span>
      </div>
      {ageNote && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{ageNote}</span>
        </div>
      )}
      {checkoutLabel && (
        <Button className="w-full" size="lg" disabled={totalQty === 0}>
          {checkoutLabel}
        </Button>
      )}
    </div>
  );

  return (
    <div className="bg-background p-6">
      {style.hero && <div className={cn(style.containerClass, "mb-6")}>{banner}</div>}
      <DetailShell style={style} main={main} aside={aside} />
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm", className)} />
      {label}
    </span>
  );
}
