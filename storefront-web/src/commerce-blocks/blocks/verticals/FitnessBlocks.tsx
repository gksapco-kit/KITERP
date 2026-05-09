import { Activity, Clock, Users, Flame, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockFitnessClasses, type FitnessClass } from "@/commerce-blocks/mock/verticals";

const TYPE_COLOR: Record<FitnessClass["type"], string> = {
  Yoga: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  HIIT: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  Cycle: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  Pilates: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  Strength: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Boxing: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

interface FitnessSchedulerProps {
  layout?: "schedule" | "grid";
  showInstructor?: boolean;
  cta?: string;
}

export function FitnessScheduler({
  layout = "schedule",
  showInstructor = true,
  cta = "Reserve",
}: FitnessSchedulerProps) {
  if (layout === "grid") {
    return (
      <div className="bg-background p-6">
        <Header />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mockFitnessClasses.map((c) => (
            <ClassCard key={c.id} c={c} showInstructor={showInstructor} cta={cta} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background p-6">
      <Header />
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[110px_1fr_120px_140px_120px] items-center gap-4 border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Time</div>
          <div>Class</div>
          <div>Intensity</div>
          <div>Spots</div>
          <div className="text-right">Action</div>
        </div>
        {mockFitnessClasses.map((c) => {
          const remaining = c.capacity - c.booked;
          const isFull = remaining === 0;
          return (
            <div
              key={c.id}
              className="grid grid-cols-[110px_1fr_120px_140px_120px] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <div>
                <div className="text-sm font-semibold tabular-nums">{c.time}</div>
                <div className="text-xs text-muted-foreground">{c.duration} min</div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={cn("text-[10px]", TYPE_COLOR[c.type])}>
                    {c.type}
                  </Badge>
                  <span className="truncate text-sm font-medium">{c.name}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {showInstructor && <span>{c.instructor}</span>}
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {c.studio}
                  </span>
                </div>
              </div>
              <Intensity value={c.intensity} />
              <div>
                <div className={cn("text-xs font-medium", isFull ? "text-destructive" : remaining <= 3 ? "text-warning" : "text-muted-foreground")}>
                  {isFull ? "Waitlist" : `${remaining} of ${c.capacity} left`}
                </div>
                <Progress value={(c.booked / c.capacity) * 100} className="mt-1 h-1.5" />
              </div>
              <div className="text-right">
                <Button size="sm" variant={isFull ? "outline" : "default"}>
                  {isFull ? "Waitlist" : cta}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h2 className="text-xl font-semibold">Today's classes · Mon, May 4</h2>
        <p className="text-sm text-muted-foreground">{mockFitnessClasses.length} sessions</p>
      </div>
      <Button variant="outline" size="sm">View week</Button>
    </div>
  );
}

function ClassCard({ c, showInstructor, cta }: { c: FitnessClass; showInstructor: boolean; cta: string }) {
  const remaining = c.capacity - c.booked;
  const isFull = remaining === 0;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className={cn("text-[10px]", TYPE_COLOR[c.type])}>
          {c.type}
        </Badge>
        <div className="text-xs text-muted-foreground">{c.duration} min</div>
      </div>
      <h3 className="mt-2 text-base font-semibold">{c.name}</h3>
      {showInstructor && (
        <div className="text-xs text-muted-foreground">with {c.instructor}</div>
      )}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {c.time}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {c.studio}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Intensity value={c.intensity} />
        <span className="text-sm font-semibold">{formatPrice(c.price, c.currency)}</span>
      </div>
      <div className="mt-3">
        <div className={cn("flex items-center justify-between text-xs", isFull ? "text-destructive" : remaining <= 3 ? "text-warning" : "text-muted-foreground")}>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {isFull ? "Class full" : `${remaining} spots left`}
          </span>
          <span className="tabular-nums">{c.booked}/{c.capacity}</span>
        </div>
        <Progress value={(c.booked / c.capacity) * 100} className="mt-1.5 h-1.5" />
      </div>
      <Button className="mt-3 w-full" variant={isFull ? "outline" : "default"} size="sm">
        {isFull ? "Join waitlist" : cta}
      </Button>
    </div>
  );
}

function Intensity({ value }: { value: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      <Activity className="mr-1 h-3 w-3 text-muted-foreground" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Flame
          key={i}
          className={cn("h-3 w-3", i < value ? "fill-warning text-warning" : "text-muted-foreground/30")}
        />
      ))}
    </div>
  );
}
