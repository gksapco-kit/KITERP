import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, CalendarCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mockAvailability, mockSlots, mockBookingService } from "@/commerce-blocks/mock/bookings";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  available: "bg-success/15 text-success-foreground hover:bg-success/25",
  limited: "bg-warning/15 text-warning-foreground hover:bg-warning/25",
  full: "bg-destructive/10 text-destructive line-through cursor-not-allowed",
  closed: "bg-muted text-muted-foreground cursor-not-allowed",
};

interface CalendarProps {
  showLegend?: boolean;
  title?: string;
}

export function AvailabilityCalendar({
  showLegend = true,
  title = "Choose a date",
}: CalendarProps) {
  const [monthOffset, setMonthOffset] = useState(0);
  const today = new Date();
  const viewMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthLabel = viewMonth.toLocaleString(undefined, { month: "long", year: "numeric" });
  const startDay = viewMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const [selected, setSelected] = useState<string | null>(null);

  const availabilityMap = useMemo(() => {
    const m = new Map<string, (typeof mockAvailability)[number]>();
    mockAvailability.forEach((d) => m.set(d.date, d));
    return m;
  }, []);

  const cells: (Date | null)[] = [
    ...Array(startDay).fill(null),
    ...Array(daysInMonth)
      .fill(null)
      .map((_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ];

  return (
    <section className="p-6">
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-5">
        {title && <h3 className="mb-4 text-lg font-semibold">{title}</h3>}
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset((m) => m - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{monthLabel}</span>
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset((m) => m + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const iso = d.toISOString().slice(0, 10);
            const info = availabilityMap.get(iso);
            const status = info?.status ?? "available";
            const disabled = status === "full" || status === "closed";
            const isSelected = selected === iso;
            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() => setSelected(iso)}
                className={cn(
                  "flex h-9 items-center justify-center rounded-md text-sm transition-colors",
                  STATUS_STYLE[status],
                  isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        {showLegend && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success" /> Available
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-warning" /> Limited
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-destructive" /> Full
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Closed
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

interface SlotProps {
  columns?: number;
  showDuration?: boolean;
  cta?: string;
}

const slotColsClass: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-6",
};

export function TimeSlotPicker({
  columns = 4,
  showDuration = true,
  cta = "Continue",
}: SlotProps) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <section className="p-6">
      <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">Available times</h3>
          {showDuration && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {mockBookingService.duration}
            </span>
          )}
        </div>
        <div
          className={cn(
            "mt-4 grid gap-2",
            slotColsClass[columns] ?? slotColsClass[4],
          )}
        >
          {mockSlots.map((s) => (
            <button
              key={s.time}
              disabled={!s.available}
              onClick={() => setSelected(s.time)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm transition-colors",
                !s.available && "cursor-not-allowed border-border bg-muted text-muted-foreground line-through",
                s.available && "border-input hover:border-primary hover:bg-accent",
                selected === s.time && "border-primary bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {s.time}
            </button>
          ))}
        </div>
        <Button className="mt-5 w-full" disabled={!selected}>
          {cta}
        </Button>
      </div>
    </section>
  );
}

interface FormProps {
  showNotes?: boolean;
  showPhone?: boolean;
  cta?: string;
}

export function BookingForm({
  showNotes = true,
  showPhone = true,
  cta = "Confirm booking",
}: FormProps) {
  return (
    <section className="p-6">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="mx-auto max-w-lg space-y-4 rounded-lg border border-border bg-card p-6"
      >
        <h3 className="text-lg font-semibold">Your details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bf-first">First name</Label>
            <Input id="bf-first" placeholder="Jane" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bf-last">Last name</Label>
            <Input id="bf-last" placeholder="Doe" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bf-email">Email</Label>
          <Input id="bf-email" type="email" placeholder="jane@example.com" />
        </div>
        {showPhone && (
          <div className="space-y-1.5">
            <Label htmlFor="bf-phone">Phone</Label>
            <Input id="bf-phone" type="tel" placeholder="+1 (555) 010-1234" />
          </div>
        )}
        {showNotes && (
          <div className="space-y-1.5">
            <Label htmlFor="bf-notes">Notes (optional)</Label>
            <Textarea id="bf-notes" placeholder="Anything we should know?" rows={3} />
          </div>
        )}
        <Button type="submit" className="w-full" size="lg">
          <Check className="h-4 w-4" />
          {cta}
        </Button>
      </form>
    </section>
  );
}

interface SummaryProps {
  showLocation?: boolean;
  showPrice?: boolean;
  cta?: string;
}

export function BookingSummary({
  showLocation = true,
  showPrice = true,
  cta = "Pay & confirm",
}: SummaryProps) {
  return (
    <section className="p-6">
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-success">
          <CalendarCheck className="h-5 w-5" />
          <h3 className="text-lg font-semibold text-foreground">Almost done</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Review the details below.</p>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Service</dt>
            <dd className="font-medium">{mockBookingService.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">When</dt>
            <dd className="font-medium">Tue, May 14 · 14:00</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Duration</dt>
            <dd>{mockBookingService.duration}</dd>
          </div>
          {showLocation && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="flex items-center gap-1 text-right">
                <MapPin className="h-3 w-3" /> {mockBookingService.location}
              </dd>
            </div>
          )}
          {showPrice && (
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="text-lg font-semibold">
                {formatPrice(mockBookingService.price, mockBookingService.currency)}
              </dd>
            </div>
          )}
        </dl>

        <Badge variant="secondary" className="mt-4">
          Free cancellation up to 24h before
        </Badge>

        <Button className="mt-5 w-full" size="lg">
          {cta}
        </Button>
      </div>
    </section>
  );
}
