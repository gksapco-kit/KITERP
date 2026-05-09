import { useState } from "react";
import {
  Users,
  Check,
  Mail,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Sparkles,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  mockResources,
  mockWizardSteps,
  mockEmailPreview,
  mockPastBookings,
} from "@/commerce-blocks/mock/bookingExtras";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { cn } from "@/lib/utils";

/* ---------------- Resource Picker ---------------- */

interface ResourceProps {
  showFeatures?: boolean;
  showPrice?: boolean;
  cta?: string;
}

export function ResourcePicker({
  showFeatures = true,
  showPrice = true,
  cta = "Reserve",
}: ResourceProps) {
  const [selected, setSelected] = useState<string>(mockResources[0].id);

  return (
    <section className="px-6 py-10">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight">Pick a resource</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {mockResources.map((r) => {
          const active = selected === r.id;
          return (
            <button
              key={r.id}
              onClick={() => r.available && setSelected(r.id)}
              disabled={!r.available}
              className={cn(
                "flex flex-col rounded-lg border bg-card p-5 text-left transition-all",
                active && r.available
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50",
                !r.available && "cursor-not-allowed opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {r.type}
                  </div>
                  <h3 className="font-semibold">{r.name}</h3>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    r.available
                      ? "bg-success/15 text-success-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {r.available ? "Available" : "Booked"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> Up to {r.capacity}
                </span>
              </div>
              {showFeatures && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {r.features.map((f) => (
                    <Badge key={f} variant="outline" className="text-[10px] font-normal">
                      {f}
                    </Badge>
                  ))}
                </ul>
              )}
              {showPrice && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <div className="text-lg font-semibold">
                    {formatPrice(r.pricePerHour, r.currency)}
                    <span className="text-xs font-normal text-muted-foreground"> / hour</span>
                  </div>
                  {active && r.available && <Button size="sm">{cta}</Button>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Booking Wizard (multi-step progress) ---------------- */

interface WizardProps {
  layout?: "horizontal" | "vertical";
  showLabels?: boolean;
}

export function BookingWizard({ layout = "horizontal", showLabels = true }: WizardProps) {
  const [step, setStep] = useState(2);

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold">New booking</h3>
          <span className="text-xs text-muted-foreground">
            Step {step + 1} of {mockWizardSteps.length}
          </span>
        </div>

        {layout === "horizontal" ? (
          <ol className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${mockWizardSteps.length}, 1fr)` }}>
            <div className="absolute left-0 right-0 top-3 h-0.5 bg-border" />
            <div
              className="absolute left-0 top-3 h-0.5 bg-primary transition-all"
              style={{ width: `${(step / (mockWizardSteps.length - 1)) * 100}%` }}
            />
            {mockWizardSteps.map((s, i) => {
              const reached = i <= step;
              return (
                <li key={s.id} className="relative z-10 flex flex-col items-center text-center">
                  <button
                    onClick={() => setStep(i)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border-2 bg-card text-xs font-semibold transition-colors",
                      reached
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {reached ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </button>
                  {showLabels && (
                    <>
                      <div className="mt-2 text-xs font-medium">{s.label}</div>
                      <div className="text-[10px] text-muted-foreground">{s.description}</div>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <ol className="space-y-4">
            {mockWizardSteps.map((s, i) => {
              const reached = i <= step;
              return (
                <li key={s.id} className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                      reached
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {reached ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-8 flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          <Button
            onClick={() => setStep((s) => Math.min(mockWizardSteps.length - 1, s + 1))}
          >
            {step === mockWizardSteps.length - 1 ? "Confirm" : "Continue"}
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Confirmation Email Preview ---------------- */

interface EmailProps {
  showHeader?: boolean;
}

export function ConfirmationEmail({ showHeader = true }: EmailProps) {
  return (
    <section className="p-6">
      <div className="mx-auto max-w-xl overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {showHeader && (
          <div className="border-b border-border bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-4 w-4" /> Email preview
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <div>
                <span className="text-muted-foreground">From: </span>
                <span className="font-medium">{mockEmailPreview.from}</span>
              </div>
              <div>
                <span className="text-muted-foreground">To: </span>
                <span className="font-medium">{mockEmailPreview.to}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Subject: </span>
                <span className="font-medium">{mockEmailPreview.subject}</span>
              </div>
            </div>
          </div>
        )}
        <div className="p-6">
          <div className="flex items-center gap-2 text-success">
            <Sparkles className="h-5 w-5" />
            <h3 className="text-xl font-semibold text-foreground">You're all set!</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{mockEmailPreview.preheader}</p>

          <div className="mt-5 space-y-2 rounded-md border border-border bg-muted/30 p-4 text-sm">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              Tue, May 14 · 2:00 PM
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              2 hours
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Studio · 14 Mercer St
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm leading-relaxed">
            {mockEmailPreview.body.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button>Add to calendar</Button>
            <Button variant="outline">Reschedule</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Past Bookings List ---------------- */

interface PastProps {
  filter?: "all" | "upcoming" | "completed" | "cancelled";
  showRebook?: boolean;
  title?: string;
}

const STATUS_META = {
  upcoming: { label: "Upcoming", className: "bg-primary/15 text-primary", icon: CalendarIcon },
  completed: { label: "Completed", className: "bg-success/15 text-success-foreground", icon: Check },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive", icon: XCircle },
  no_show: { label: "No-show", className: "bg-warning/15 text-warning-foreground", icon: AlertCircle },
} as const;

export function PastBookings({
  filter = "all",
  showRebook = true,
  title = "Your bookings",
}: PastProps) {
  const items =
    filter === "all"
      ? mockPastBookings
      : mockPastBookings.filter((b) => b.status === filter);

  return (
    <section className="px-6 py-10">
      {title && (
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <span className="text-sm text-muted-foreground">{items.length} bookings</span>
        </div>
      )}
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((b) => {
          const meta = STATUS_META[b.status];
          const Icon = meta.icon;
          return (
            <li
              key={b.id}
              className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium">{b.service}</h4>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      meta.className,
                    )}
                  >
                    <Icon className="h-3 w-3" /> {meta.label}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {b.date} · {b.time}
                  {b.withWho && ` · with ${b.withWho}`}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{b.id}</div>
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                <div className="text-right text-sm font-semibold">
                  {formatPrice(b.price, b.currency)}
                </div>
                {showRebook && b.status !== "upcoming" && (
                  <Button size="sm" variant="outline">
                    Book again
                  </Button>
                )}
                {b.status === "upcoming" && (
                  <Button size="sm">Manage</Button>
                )}
              </div>
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="p-10 text-center text-sm text-muted-foreground">
            No bookings to show.
          </li>
        )}
      </ul>
    </section>
  );
}
