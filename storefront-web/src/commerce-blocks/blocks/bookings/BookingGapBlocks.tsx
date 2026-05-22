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

interface RecurringBookingProps {
  showUpcoming?: boolean;
  cta?: string;
}

export function RecurringBooking({
  showUpcoming = true,
  cta = "Confirm series",
}: RecurringBookingProps) {
  const r = mockRecurring;
  const [preset, setPreset] = useState(r.presets[0].id);
  const [count, setCount] = useState(8);

  const total = count * r.pricePerSession;
  const discount = preset === "biweekly" ? total * 0.1 : 0;

  return (
    <div className="bg-background p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div>
            <Badge variant="secondary" className="mb-2">
              <Repeat className="h-3 w-3" />
              Recurring booking
            </Badge>
            <h2 className="text-2xl font-semibold">{r.service}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Starting {r.startDate} · {r.time}
            </p>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              How often
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {r.presets.map((p) => {
                const active = preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className={cn(
                      "rounded-lg border border-border p-3 text-left transition-colors",
                      active && "border-primary bg-primary/5 ring-1 ring-primary",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{p.name}</span>
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Number of sessions</div>
                <div className="text-xs text-muted-foreground">
                  Pause or cancel any session up to 24h ahead
                </div>
              </div>
              <Counter label="" sub="" value={count} onChange={setCount} min={2} max={24} />
            </div>
          </div>

          {showUpcoming && (
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your next sessions
              </div>
              <ul className="space-y-2">
                {r.upcoming.slice(0, Math.min(count, r.upcoming.length)).map((u, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3"
                  >
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{u.date}</span>
                    <span className="text-xs text-muted-foreground">{r.time}</span>
                    <Badge variant="outline" className="ml-auto text-xs capitalize">
                      {u.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-3 rounded-lg border border-border bg-muted/30 p-5">
          <h3 className="text-sm font-semibold">Series summary</h3>
          <div className="space-y-1.5 text-sm">
            <Row label="Per session" value={formatPrice(r.pricePerSession, r.currency)} />
            <Row label={`Sessions × ${count}`} value={formatPrice(total, r.currency)} />
            {discount > 0 && (
              <Row
                label="Bi-weekly discount"
                value={`−${formatPrice(discount, r.currency)}`}
                valueClass="text-success"
              />
            )}
          </div>
          <Separator />
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-semibold">{formatPrice(total - discount, r.currency)}</span>
          </div>
          <Button className="w-full" size="lg">{cta}</Button>
          <p className="text-center text-xs text-muted-foreground">
            Charged before each session · Cancel anytime
          </p>
        </aside>
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
