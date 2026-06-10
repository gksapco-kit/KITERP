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
import { mockEvent, mockEventList } from "@/commerce-blocks/mock/verticals";
import { catalogGridClassName } from "@/lib/commerceCatalogLayout";

interface EventListingProps {
  layout?: "grid" | "list";
  columns?: number;
  gap?: number;
  itemLimit?: number;
  showTag?: boolean;
  cta?: string;
}

export function EventListing({
  layout = "grid",
  columns = 4,
  gap = 20,
  itemLimit,
  showTag = true,
  cta = "Get tickets",
}: EventListingProps) {
  const items = mockEventList.slice(0, itemLimit ?? mockEventList.length);

  if (layout === "list") {
    return (
      <div className="bg-background p-6">
        <Header />
        <div className="space-y-3" style={{ gap }}>
          {items.map((e) => (
            <div key={e.id} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-3 sm:flex-row">
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
                <Button variant="outline" size="sm" className="mt-auto self-end">{cta}</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background p-6">
      <Header />
      <div className={cn("grid grid-cols-1", catalogGridClassName(columns))} style={{ gap }}>
        {items.map((e) => (
          <div key={e.id} className="group overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md">
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
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
            <div className="p-4">
              <h3 className="line-clamp-2 text-sm font-semibold">{e.title}</h3>
              <div className="mt-1 line-clamp-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {e.venue}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {e.fromPrice === 0 ? "Free" : `from ${formatPrice(e.fromPrice, e.currency)}`}
                </span>
                <Button size="sm" variant="outline">{cta}</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h2 className="text-xl font-semibold">Upcoming events</h2>
        <p className="text-sm text-muted-foreground">{mockEventList.length} events near you</p>
      </div>
      <Button variant="outline" size="sm">All events</Button>
    </div>
  );
}

/* ---------- Ticket Picker ---------- */

interface TicketPickerProps {
  showSeating?: boolean;
  cta?: string;
}

export function TicketPicker({ showSeating = true, cta = "Continue to checkout" }: TicketPickerProps) {
  const e = mockEvent;
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries(e.tiers.map((t) => [t.id, t.id === "seated" ? 2 : 0])),
  );
  const total = e.tiers.reduce((sum, t) => sum + (qty[t.id] ?? 0) * t.price, 0);
  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-background p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
            <img src={e.image} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 to-transparent" />
            <div className="absolute inset-x-5 bottom-5 text-background">
              <Badge className="mb-2 bg-background text-foreground hover:bg-background">
                <Music2 className="h-3 w-3" />
                Live event
              </Badge>
              <h1 className="text-2xl font-semibold">{e.title}</h1>
              <p className="text-sm opacity-90">{e.tagline}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Info icon={Calendar} label="Date" value={e.date} />
            <Info icon={Clock} label="Doors / Start" value={`${e.doors} / ${e.start}`} />
            <Info icon={MapPin} label="Venue" value={`${e.venue} · ${e.address}`} />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold">Choose your tickets</h3>
            <div className="mt-3 space-y-3">
              {e.tiers.map((t) => {
                const sold = qty[t.id] ?? 0;
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
                        {t.perks.map((p) => (
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
                          disabled={sold >= 8}
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
              <div className="border-b border-border bg-muted/30 p-3 text-xs font-medium uppercase text-muted-foreground">
                Seating chart
              </div>
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

        <aside className="space-y-3 rounded-lg border border-border bg-muted/30 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Ticket className="h-4 w-4" />
            Your order
          </h3>
          {totalQty === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets selected yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {e.tiers
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
            <span className="text-xl font-semibold">{formatPrice(total, e.tiers[0].currency)}</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{totalQty} {totalQty === 1 ? "ticket" : "tickets"} · max 8 per order</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{e.ageRestriction} event · ID required at door</span>
          </div>
          <Button className="w-full" size="lg" disabled={totalQty === 0}>
            {cta}
          </Button>
        </aside>
      </div>
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
