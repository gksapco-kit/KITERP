import { useMemo, useState } from "react";
import { Minus, Plus, Users, Calendar, Mail, Phone, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Service } from "../types";
import { formatPrice } from "../mock";

/* ---------------- Group Booking ---------------- */

export interface GroupBookingProps {
  service: Service;
  perPerson?: boolean;
  flatPrice?: number;
  maxGroupSize?: number;
  onSubmit?: (data: { attendees: number; total: number }) => void;
}

export function GroupBookingFlow({
  service,
  perPerson = true,
  flatPrice,
  maxGroupSize = 12,
  onSubmit,
}: GroupBookingProps) {
  const [count, setCount] = useState(2);
  const total = perPerson ? service.price * count : flatPrice ?? service.price;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Group booking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="font-medium">{service.name}</div>
          <p className="text-sm text-muted-foreground">{service.shortDescription}</p>
        </div>
        <div>
          <Label>Attendees (max {maxGroupSize})</Label>
          <div className="mt-2 inline-flex items-center border rounded-md">
            <Button variant="ghost" size="icon" onClick={() => setCount(Math.max(1, count - 1))}><Minus /></Button>
            <span className="w-10 text-center text-sm">{count}</span>
            <Button variant="ghost" size="icon" onClick={() => setCount(Math.min(maxGroupSize, count + 1))}><Plus /></Button>
          </div>
        </div>
        <Separator />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Pricing model</span><span>{perPerson ? "Per person" : "Flat group rate"}</span></div>
          {perPerson && <div className="flex justify-between"><span className="text-muted-foreground">Price per person</span><span>{formatPrice(service.price)}</span></div>}
          <div className="flex justify-between font-semibold pt-2"><span>Total</span><span>{formatPrice(total)}</span></div>
        </div>
        <Button className="w-full" onClick={() => onSubmit?.({ attendees: count, total })}>Continue</Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- Recurring Booking ---------------- */

type Frequency = "weekly" | "biweekly" | "monthly";

export interface RecurringBookingProps {
  service: Service;
  startDate?: Date;
  onSubmit?: (data: { frequency: Frequency; occurrences: Date[]; total: number }) => void;
}

export function RecurringBookingFlow({ service, startDate, onSubmit }: RecurringBookingProps) {
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [mode, setMode] = useState<"count" | "until">("count");
  const [count, setCount] = useState(4);
  const [endDate, setEndDate] = useState<string>("");
  const start = startDate ?? new Date();

  const occurrences = useMemo(() => {
    const list: Date[] = [];
    const stepDays = frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : 30;
    if (mode === "count") {
      for (let i = 0; i < count; i++) {
        const d = new Date(start); d.setDate(d.getDate() + stepDays * i);
        list.push(d);
      }
    } else if (endDate) {
      const end = new Date(endDate);
      let d = new Date(start);
      while (d <= end && list.length < 52) {
        list.push(new Date(d));
        d.setDate(d.getDate() + stepDays);
      }
    }
    return list;
  }, [frequency, mode, count, endDate, start]);

  const total = service.price * occurrences.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Recurring booking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Repeats</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Every 2 weeks</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode("count")}
            className={`px-3 py-2 rounded-md border text-sm text-left ${mode === "count" ? "border-primary bg-primary/5" : ""}`}
          >End after occurrences</button>
          <button
            onClick={() => setMode("until")}
            className={`px-3 py-2 rounded-md border text-sm text-left ${mode === "until" ? "border-primary bg-primary/5" : ""}`}
          >End on date</button>
        </div>
        {mode === "count" ? (
          <div>
            <Label>Occurrences</Label>
            <Input type="number" min={1} max={52} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} className="mt-2" />
          </div>
        ) : (
          <div>
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-2" />
          </div>
        )}

        <Separator />
        <div>
          <div className="text-sm font-medium mb-2">Summary ({occurrences.length} sessions)</div>
          <ul className="text-sm text-muted-foreground space-y-1 max-h-40 overflow-auto">
            {occurrences.map((d, i) => (
              <li key={i}>#{i + 1} — {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</li>
            ))}
          </ul>
          <div className="flex justify-between font-semibold pt-3"><span>Total</span><span>{formatPrice(total)}</span></div>
        </div>

        <Button className="w-full" onClick={() => onSubmit?.({ frequency, occurrences, total })} disabled={!occurrences.length}>
          Confirm recurring booking
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- Waitlist ---------------- */

export interface WaitlistProps {
  service: Service;
  onJoin?: (data: { email: string; phone: string }) => Promise<{ position: number }> | { position: number };
}

export function WaitlistFlow({ service, onJoin }: WaitlistProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = (await (onJoin?.({ email, phone }) ?? { position: Math.floor(Math.random() * 25) + 1 })) as { position: number };
    setPosition(res.position);
    setLoading(false);
  };

  if (position !== null) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">You're on the waitlist</h3>
          <p className="text-sm text-muted-foreground">
            For <span className="font-medium text-foreground">{service.name}</span>. We'll text and email you when a slot opens.
          </p>
          <div className="inline-block px-4 py-2 rounded-md bg-muted">
            Position <span className="font-semibold">#{position}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join waitlist — {service.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="wl-email">Email</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="wl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-8" />
            </div>
          </div>
          <div>
            <Label htmlFor="wl-phone">Phone</Label>
            <div className="relative mt-1">
              <Phone className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="wl-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-8" />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Joining..." : "Join waitlist"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
