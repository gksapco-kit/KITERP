import { useState } from "react";
import {
  Users,
  Repeat,
  Hourglass,
  Calendar,
  Clock,
  MapPin,
  Bell,
  Plus,
  Minus,
  Check,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/commerce-blocks/lib/format";
import {
  mockGroupBooking,
  mockRecurring,
  mockWaitlist,
} from "@/commerce-blocks/mock/commerceFlow";
import {
  detailVariantStyle,
  DetailShell,
} from "@/commerce-blocks/lib/verticalVariants";

/* ---------- Group booking ---------- */

interface GroupBookingProps {
  showAddons?: boolean;
  cta?: string;
}

export function GroupBooking({ showAddons = true, cta = "Reserve for group" }: GroupBookingProps) {
  const g = mockGroupBooking;
  const [adults, setAdults] = useState(6);
  const [children, setChildren] = useState(2);
  const total = (adults + children) * g.pricePerPerson;
  const groupSize = adults + children;
  const valid = groupSize >= g.minSize && groupSize <= g.maxSize;

  return (
    <div className="bg-background p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div>
            <Badge variant="secondary" className="mb-2">
              <Users className="h-3 w-3" />
              Group booking
            </Badge>
            <h2 className="text-2xl font-semibold">{g.service}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              For {g.minSize}–{g.maxSize} guests · {formatPrice(g.pricePerPerson, g.currency)} per person
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Counter
              label="Adults"
              sub="Ages 18+"
              value={adults}
              onChange={setAdults}
              min={1}
              max={g.maxSize}
            />
            <Counter
              label="Children"
              sub="Ages 5–17"
              value={children}
              onChange={setChildren}
              min={0}
              max={g.maxSize}
            />
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Date & time
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {g.date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {g.time}
              </span>
              <Button variant="ghost" size="sm" className="ml-auto h-7">
                Change
              </Button>
            </div>
          </div>

          {showAddons && (
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Group requests
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Group name / occasion">
                  <Input placeholder="Mira's birthday" />
                </Field>
                <Field label="Lead contact">
                  <Input placeholder="Mira Patel" />
                </Field>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Dietary or accessibility notes
                  </Label>
                  <Input placeholder="2 vegetarian, 1 wheelchair access" />
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-3 rounded-lg border border-border bg-muted/30 p-5">
          <h3 className="text-sm font-semibold">Group summary</h3>
          <div className="space-y-1.5 text-sm">
            <Row label={`Adults × ${adults}`} value={formatPrice(adults * g.pricePerPerson, g.currency)} />
            <Row label={`Children × ${children}`} value={formatPrice(children * g.pricePerPerson, g.currency)} />
          </div>
          <Separator />
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-semibold">{formatPrice(total, g.currency)}</span>
          </div>
          {!valid && (
            <div className="flex items-start gap-2 rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <span>Group must be {g.minSize}–{g.maxSize} guests. Currently {groupSize}.</span>
            </div>
          )}
          <Button className="w-full" size="lg" disabled={!valid}>
            {cta}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Hold for 15 min · No charge until you confirm
          </p>
        </aside>
      </div>
    </div>
  );
}

function Counter({
  label,
  sub,
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-6 text-center text-sm font-medium tabular-nums">{value}</span>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Recurring booking ---------- */

export interface RecurringPreset {
  id?: string;
  name: string;
  description?: string;
  discount_pct?: number;
}

/** Recurring plan synced from Sales → Recurring Bookings — one plan renders as one full booking widget. */
export interface LiveRecurringPlan {
  id: string;
  title: string;
  image_url?: string;
  /** Raw ISO date (YYYY-MM-DD) used to compute real upcoming sessions; absent for the static demo. */
  startDateIso?: string;
  /** Human display fallback shown next to the title (e.g. "Mon, May 4"). */
  startDateLabel?: string;
  timeLabel?: string;
  pricePerSession: number;
  currency: string;
  defaultSessionCount: number;
  minSessions: number;
  maxSessions: number;
  showUpcoming: boolean;
  presets: RecurringPreset[];
  ctaLabel?: string;
}

type ResolvedRecurringPlan = {
  key: string;
  title: string;
  image?: string;
  startDateLabel: string;
  startDateIso?: string;
  timeLabel: string;
  pricePerSession: number;
  currency: string;
  defaultSessionCount: number;
  minSessions: number;
  maxSessions: number;
  showUpcoming: boolean;
  presets: RecurringPreset[];
  ctaLabel: string;
};

/** Infers a step size from a preset's id/name so vendor-authored frequency options still drive real date math. */
function presetStep(preset?: RecurringPreset): number | "month" {
  const key = `${preset?.id ?? ""} ${preset?.name ?? ""}`.toLowerCase();
  if (key.includes("month")) return "month";
  if (key.includes("week") && (key.includes("bi") || key.includes("2") || key.includes("fortnight"))) return 14;
  if (key.includes("week")) return 7;
  if (key.includes("day")) return 1;
  return 7;
}

function stepDate(d: Date, step: number | "month"): Date {
  const next = new Date(d);
  if (step === "month") next.setMonth(next.getMonth() + 1);
  else next.setDate(next.getDate() + step);
  return next;
}

function parseAnchorDate(iso?: string): Date {
  if (iso) {
    const d = new Date(`${iso}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Rolls the anchor date forward by whole steps until today or later, so "upcoming" never shows the past. */
function firstUpcoming(anchor: Date, step: number | "month"): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cur = new Date(anchor);
  cur.setHours(0, 0, 0, 0);
  let guard = 0;
  while (cur < today && guard < 500) {
    cur = stepDate(cur, step);
    guard += 1;
  }
  return cur;
}

function generateUpcomingSessions(anchor: Date, preset: RecurringPreset | undefined, count: number): Date[] {
  const step = presetStep(preset);
  let cur = firstUpcoming(anchor, step);
  const dates: Date[] = [];
  for (let i = 0; i < count; i += 1) {
    dates.push(cur);
    cur = stepDate(cur, step);
  }
  return dates;
}

function formatSessionDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** One plan's full frequency-picker + counter + upcoming-sessions + price-summary widget, laid out per the
 * chosen section style. Every synced plan is fully self-contained (its own presets, pricing, CTA label), so
 * stacking several plans on one page never lets one plan's settings bleed into another's. */
function RecurringPlanCard({
  resolved,
  style,
  ctaUrl,
}: {
  resolved: ResolvedRecurringPlan;
  style: ReturnType<typeof detailVariantStyle>;
  ctaUrl?: string;
}) {
  const {
    title, image, startDateLabel, startDateIso, timeLabel,
    pricePerSession, currency, defaultSessionCount, minSessions, maxSessions,
    showUpcoming, presets, ctaLabel,
  } = resolved;
  const [presetKey, setPresetKey] = useState(presets[0]?.id ?? presets[0]?.name ?? "weekly");
  const [count, setCount] = useState(clamp(defaultSessionCount, minSessions, maxSessions));

  const activePreset = presets.find((p) => (p.id ?? p.name) === presetKey) ?? presets[0];
  const total = count * pricePerSession;
  const discountPct = activePreset?.discount_pct ?? 0;
  const discount = discountPct > 0 ? total * (discountPct / 100) : 0;

  const upcoming = showUpcoming
    ? generateUpcomingSessions(parseAnchorDate(startDateIso), activePreset, count)
    : [];

  const banner = image ? (
    <div className={cn("relative overflow-hidden rounded-xl bg-muted", style.hero ? "aspect-[21/9]" : "aspect-[16/7]")}>
      <img src={image} alt="" className="h-full w-full object-cover" />
      {style.hero && (
        <div className="absolute inset-x-5 bottom-5 text-background">
          <h1 className="text-3xl font-bold">{title}</h1>
          {(startDateLabel || timeLabel) && (
            <p className="text-sm opacity-90">
              {[startDateLabel && `Starting ${startDateLabel}`, timeLabel].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  ) : null;

  const main = (
    <div>
      {!style.hero && banner}

      {!style.hero && (
        <div className={banner ? "mt-5" : undefined}>
          <Badge variant="secondary" className="mb-2">
            <Repeat className="h-3 w-3" />
            Recurring booking
          </Badge>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {(startDateLabel || timeLabel) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {[startDateLabel && `Starting ${startDateLabel}`, timeLabel].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}

      {presets.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            How often
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {presets.map((preset) => {
              const key = preset.id ?? preset.name;
              const active = presetKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setPresetKey(key)}
                  className={cn(
                    "rounded-lg border border-border p-3 text-left transition-colors",
                    active && "border-primary bg-primary/5 ring-1 ring-primary",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{preset.name}</span>
                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  {preset.description && (
                    <div className="text-xs text-muted-foreground">{preset.description}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={cn("mt-5 p-4", style.cardClass)}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Number of sessions</div>
            <div className="text-xs text-muted-foreground">
              Pause or cancel any session up to 24h ahead
            </div>
          </div>
          <Counter
            label=""
            sub=""
            value={count}
            onChange={(n) => setCount(clamp(n, minSessions, maxSessions))}
            min={minSessions}
            max={maxSessions}
          />
        </div>
      </div>

      {showUpcoming && upcoming.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Your next sessions
          </div>
          <ul className="space-y-2">
            {upcoming.map((d, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3"
              >
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{formatSessionDate(d)}</span>
                {timeLabel && <span className="text-xs text-muted-foreground">{timeLabel}</span>}
                <Badge variant="outline" className="ml-auto text-xs capitalize">
                  scheduled
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const aside = (
    <div className={cn("space-y-3", style.cardClass, "p-5")}>
      <h3 className="text-sm font-semibold">Series summary</h3>
      <div className="space-y-1.5 text-sm">
        <Row label="Per session" value={formatPrice(pricePerSession, currency)} />
        <Row label={`Sessions × ${count}`} value={formatPrice(total, currency)} />
        {discount > 0 && (
          <Row
            label={`${activePreset?.name ?? "Frequency"} discount`}
            value={`−${formatPrice(discount, currency)}`}
            valueClass="text-success"
          />
        )}
      </div>
      <Separator />
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-semibold">{formatPrice(total - discount, currency)}</span>
      </div>
      {ctaLabel && (
        <Button className="w-full" size="lg" asChild={!!ctaUrl}>
          {ctaUrl ? <a href={ctaUrl}>{ctaLabel}</a> : <>{ctaLabel}</>}
        </Button>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Charged before each session · Cancel anytime
      </p>
    </div>
  );

  return (
    <div>
      {style.hero && banner && <div className={cn(style.containerClass, "mb-6")}>{banner}</div>}
      <DetailShell style={style} main={main} aside={aside} />
    </div>
  );
}

interface RecurringBookingProps {
  variant?: string;
  showUpcoming?: boolean;
  cta?: string;
  cta_url?: string;
  header_title?: string;
  header_subtitle?: string;
  image_url?: string;
  title?: string;
  startDate?: string;
  time?: string;
  pricePerSession?: number | string;
  currency?: string;
  defaultSessionCount?: number | string;
  minSessions?: number | string;
  maxSessions?: number | string;
  presets?: RecurringPreset[];
  itemLimit?: number;
  /** Live plans synced from Sales → Recurring Bookings — when present, EVERY active plan renders as its own full booking widget. */
  liveRecurringPlans?: LiveRecurringPlan[];
}

export function RecurringBooking({
  variant,
  showUpcoming = true,
  cta = "Confirm series",
  cta_url,
  header_title,
  header_subtitle,
  image_url,
  title,
  startDate,
  time,
  pricePerSession,
  currency,
  defaultSessionCount,
  minSessions,
  maxSessions,
  presets,
  itemLimit,
  liveRecurringPlans,
}: RecurringBookingProps) {
  const style = detailVariantStyle(variant);
  const isLive = !!(liveRecurringPlans && liveRecurringPlans.length);
  // Section heading only applies once connected to Sales → Recurring Bookings — the single demo
  // plan below already has its own banner/title, so no separate heading is needed there.
  const headerTitle = header_title ?? (isLive ? "Available plans" : "");
  const headerSubtitle = header_subtitle
    ?? (isLive ? `${liveRecurringPlans!.length} recurring plan${liveRecurringPlans!.length === 1 ? "" : "s"} available` : "");

  const cards: ResolvedRecurringPlan[] = isLive
    ? (liveRecurringPlans as LiveRecurringPlan[]).slice(0, itemLimit ?? liveRecurringPlans!.length).map((lp) => ({
        key: lp.id,
        title: lp.title,
        image: lp.image_url,
        startDateLabel: lp.startDateLabel ?? "",
        startDateIso: lp.startDateIso,
        timeLabel: lp.timeLabel ?? "",
        pricePerSession: lp.pricePerSession,
        currency: lp.currency,
        defaultSessionCount: lp.defaultSessionCount,
        minSessions: lp.minSessions,
        maxSessions: lp.maxSessions,
        showUpcoming: lp.showUpcoming,
        // Real synced plan — show exactly what was configured in Recurring Bookings, even if that's
        // no frequency options at all. Never substitute the generic mock presets on live customer data.
        presets: lp.presets,
        ctaLabel: lp.ctaLabel ?? "",
      }))
    : [{
        key: "demo",
        title: title ?? mockRecurring.service,
        image: image_url || undefined,
        startDateLabel: startDate ?? mockRecurring.startDate,
        timeLabel: time ?? mockRecurring.time,
        pricePerSession: pricePerSession !== undefined ? Number(pricePerSession) : mockRecurring.pricePerSession,
        currency: currency ?? mockRecurring.currency,
        defaultSessionCount: defaultSessionCount !== undefined ? Number(defaultSessionCount) : 8,
        minSessions: minSessions !== undefined ? Number(minSessions) : 2,
        maxSessions: maxSessions !== undefined ? Number(maxSessions) : 24,
        showUpcoming: showUpcoming !== false,
        // Only the never-configured case (prop entirely absent) shows the demo presets — once the
        // vendor has touched the list (including emptying it), respect exactly what they left.
        presets: presets === undefined ? mockRecurring.presets : presets,
        ctaLabel: cta ?? "Confirm series",
      }];

  return (
    <div className="bg-background p-6">
      {(headerTitle || headerSubtitle) && (
        <div className="mb-6">
          {headerTitle && <h2 className="text-2xl font-bold tracking-tight">{headerTitle}</h2>}
          {headerSubtitle && <p className="mt-1 text-sm text-muted-foreground">{headerSubtitle}</p>}
        </div>
      )}
      <div className={cards.length > 1 ? "space-y-10" : undefined}>
        {cards.map((card, idx) => (
          <div key={card.key} className={idx > 0 ? "border-t border-border pt-10" : undefined}>
            <RecurringPlanCard resolved={card} style={style} ctaUrl={cta_url} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Waitlist ---------- */

interface WaitlistBlockProps {
  layout?: "joined" | "join";
  showOthers?: boolean;
  cta?: string;
}

export function WaitlistBlock({
  layout = "joined",
  showOthers = true,
  cta = "Join waitlist",
}: WaitlistBlockProps) {
  const w = mockWaitlist;

  if (layout === "join") {
    return (
      <div className="bg-background p-6">
        <div className="mx-auto max-w-md rounded-xl border border-border p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Hourglass className="h-6 w-6" />
          </div>
          <h2 className="mt-3 text-lg font-semibold">This session is fully booked</h2>
          <p className="mt-1 text-sm text-muted-foreground">{w.service}</p>
          <p className="mt-4 text-sm">
            Join the waitlist and we'll text or email you the moment a spot opens.
          </p>
          <div className="mt-4 space-y-3 text-left">
            <Field label="Your name"><Input placeholder="Alex Morgan" /></Field>
            <Field label="Email"><Input placeholder="you@example.com" /></Field>
            <Field label="Mobile (for fastest notice)">
              <Input placeholder="+1 (555) 014 2280" />
            </Field>
          </div>
          <Button className="mt-4 w-full" size="lg">
            <Bell className="h-4 w-4" />
            {cta}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            No charge unless a spot opens & you accept
          </p>
        </div>
      </div>
    );
  }

  const progress = ((w.totalWaiting - w.position + 1) / w.totalWaiting) * 100;
  return (
    <div className="bg-background p-6">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Hourglass className="h-6 w-6" />
          </div>
          <div>
            <Badge variant="secondary" className="mb-1">You're on the waitlist</Badge>
            <h2 className="text-xl font-semibold">{w.service}</h2>
            <p className="text-sm text-muted-foreground">Joined {w.joinedAt}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Your position</span>
            <span className="text-2xl font-semibold tabular-nums">
              #{w.position}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                of {w.totalWaiting}
              </span>
            </span>
          </div>
          <Progress value={progress} className="mt-3 h-2" />
          <p className="mt-3 text-xs text-muted-foreground">
            Estimated notice: {w.estimatedNotice} before the session
          </p>
        </div>

        {showOthers && (
          <div className="rounded-lg border border-border">
            <div className="border-b border-border p-3 text-xs font-medium uppercase text-muted-foreground">
              Others waiting
            </div>
            <ul>
              {w.others.map((o, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between border-b border-border p-3 text-sm last:border-b-0"
                >
                  <span>{o.name}</span>
                  <span className="text-xs text-muted-foreground">Joined {o.joinedAt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="flex-1">Notify settings</Button>
          <Button variant="ghost" className="flex-1 text-muted-foreground">Leave waitlist</Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", valueClass)}>{value}</span>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
