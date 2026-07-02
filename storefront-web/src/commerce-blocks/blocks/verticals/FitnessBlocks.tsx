import { Activity, Clock, Users, Flame, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockFitnessClasses, type FitnessClass } from "@/commerce-blocks/mock/verticals";
import { catalogGridClassName } from "@/lib/commerceCatalogLayout";
import {
  catalogVariantStyle,
  normalizeVerticalVariant,
  type CatalogVariantStyle,
} from "@/commerce-blocks/lib/verticalVariants";

/** Variants that render as the timetable/table view; everything else uses class cards. */
const SCHEDULE_VARIANTS = new Set(["default", "compact", "minimal"]);

const TYPE_COLOR: Record<FitnessClass["type"], string> = {
  Yoga: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  HIIT: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  Cycle: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  Pilates: "bg-primary/15 text-primary dark:text-primary/80",
  Strength: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Boxing: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

interface FitnessSchedulerProps {
  variant?: string;
  layout?: "schedule" | "grid";
  showInstructor?: boolean;
  cta?: string;
  classes?: FitnessClass[];
}

export function FitnessScheduler({
  variant,
  layout,
  showInstructor = true,
  cta = "Reserve",
  classes,
}: FitnessSchedulerProps) {
  const v = normalizeVerticalVariant(variant ?? layout ?? "default");
  const asSchedule = layout === "schedule" ? true : layout === "grid" ? false : SCHEDULE_VARIANTS.has(v);
  const style = catalogVariantStyle(v);
  const list = classes && classes.length ? classes : mockFitnessClasses;

  if (!asSchedule) {
    if (style.mode === "featured") {
      const [first, ...rest] = list;
      return (
        <div className="bg-background p-6">
          <Header hero={style.hero} count={list.length} />
          {first && <FeaturedClass c={first} showInstructor={showInstructor} cta={cta} />}
          <div className={cn("mt-4 grid grid-cols-1", catalogGridClassName(style.columns))} style={{ gap: style.gap }}>
            {rest.map((c) => (
              <ClassCard key={c.id} c={c} showInstructor={showInstructor} cta={cta} style={style} />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="bg-background p-6">
        <Header hero={style.hero} count={list.length} />
        <div className={cn("grid grid-cols-1", catalogGridClassName(style.columns))} style={{ gap: style.gap }}>
          {list.map((c) => (
            <ClassCard key={c.id} c={c} showInstructor={showInstructor} cta={cta} style={style} />
          ))}
        </div>
      </div>
    );
  }

  const dense = v === "compact";
  const bare = v === "minimal";
  return (
    <div className="bg-background p-6">
      <Header hero={style.hero} count={list.length} />
      <div className={cn("overflow-hidden rounded-lg", !bare && "border border-border")}>
        <div className="grid grid-cols-[110px_1fr_120px_140px_120px] items-center gap-4 border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <div>Time</div>
          <div>Class</div>
          <div>Intensity</div>
          <div>Spots</div>
          <div className="text-right">Action</div>
        </div>
        {list.map((c) => {
          const remaining = c.capacity - c.booked;
          const isFull = remaining === 0;
          return (
            <div
              key={c.id}
              className={cn(
                "grid grid-cols-[110px_1fr_120px_140px_120px] items-center gap-4 border-b border-border px-4 last:border-b-0",
                dense ? "py-2" : "py-3",
              )}
            >
              <div>
                <div className="text-sm font-semibold tabular-nums">{c.time}</div>
                <div className="text-xs text-muted-foreground">{c.duration} min</div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={cn("text-xs", TYPE_COLOR[c.type])}>
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

function Header({ hero, count }: { hero?: boolean; count?: number }) {
  const total = count ?? mockFitnessClasses.length;
  if (hero) {
    return (
      <div className="mb-6 rounded-xl border border-border bg-gradient-to-r from-primary/10 to-transparent p-6">
        <h2 className="text-3xl font-bold tracking-tight">Today's classes · Mon, May 4</h2>
        <p className="mt-1 text-sm text-muted-foreground">{total} sessions — book your spot</p>
      </div>
    );
  }
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h2 className="text-xl font-semibold">Today's classes · Mon, May 4</h2>
        <p className="text-sm text-muted-foreground">{total} sessions</p>
      </div>
      <Button variant="outline" size="sm">View week</Button>
    </div>
  );
}

function ClassCard({
  c,
  showInstructor,
  cta,
  style,
}: {
  c: FitnessClass;
  showInstructor: boolean;
  cta: string;
  style: CatalogVariantStyle;
}) {
  const remaining = c.capacity - c.booked;
  const isFull = remaining === 0;
  return (
    <div className={cn("overflow-hidden p-4", style.cardClass)}>
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className={cn("text-xs", TYPE_COLOR[c.type])}>
          {c.type}
        </Badge>
        <div className="text-xs text-muted-foreground">{c.duration} min</div>
      </div>
      <h3 className={cn("mt-2 font-semibold", style.bigTitle ? "text-lg" : "text-base")}>{c.name}</h3>
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

function FeaturedClass({ c, showInstructor, cta }: { c: FitnessClass; showInstructor: boolean; cta: string }) {
  const remaining = c.capacity - c.booked;
  const isFull = remaining === 0;
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn("text-xs", TYPE_COLOR[c.type])}>{c.type}</Badge>
          <span className="text-xs uppercase tracking-wider text-primary">Featured session</span>
        </div>
        <h3 className="mt-1 text-2xl font-bold">{c.name}</h3>
        {showInstructor && <div className="text-sm text-muted-foreground">with {c.instructor}</div>}
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{c.time} · {c.duration} min</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{c.studio}</span>
          <Intensity value={c.intensity} />
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <span className="text-2xl font-semibold">{formatPrice(c.price, c.currency)}</span>
        <span className="text-xs text-muted-foreground">
          {isFull ? "Class full" : `${remaining} of ${c.capacity} spots left`}
        </span>
        <Button variant={isFull ? "outline" : "default"}>{isFull ? "Join waitlist" : cta}</Button>
      </div>
    </div>
  );
}

function Intensity({ value }: { value: number }) {
  const level = Number(value) || 0;
  return (
    <div className="inline-flex items-center gap-0.5">
      <Activity className="mr-1 h-3 w-3 text-muted-foreground" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Flame
          key={i}
          className={cn("h-3 w-3", i < level ? "fill-warning text-warning" : "text-muted-foreground/30")}
        />
      ))}
    </div>
  );
}
