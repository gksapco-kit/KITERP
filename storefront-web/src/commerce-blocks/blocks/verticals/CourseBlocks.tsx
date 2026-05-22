import {
  GraduationCap,
  Star,
  Clock,
  PlayCircle,
  CheckCircle2,
  Award,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockCourses, mockCourseDetail, type Course } from "@/commerce-blocks/mock/verticals";

const LEVEL_STYLE: Record<Course["level"], string> = {
  Beginner: "bg-success/15 text-success hover:bg-success/15",
  Intermediate: "bg-primary/15 text-primary hover:bg-primary/15",
  Advanced: "bg-destructive/15 text-destructive hover:bg-destructive/15",
};

interface CourseCatalogProps {
  layout?: "grid" | "list";
  columns?: number;
  showInstructor?: boolean;
  cta?: string;
}

export function CourseCatalog({
  layout = "grid",
  columns = 3,
  showInstructor = true,
  cta = "Enroll",
}: CourseCatalogProps) {
  if (layout === "list") {
    return (
      <div className="bg-background p-6">
        <Header />
        <div className="space-y-3">
          {mockCourses.map((c) => (
            <div key={c.id} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-3 sm:flex-row">
              <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-md bg-muted sm:h-32 sm:w-48">
                <img src={c.image} alt="" className="h-full w-full object-cover" />
                <Badge className={cn("absolute left-2 top-2 text-xs", LEVEL_STYLE[c.level])}>{c.level}</Badge>
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">{c.category}</div>
                    <h3 className="text-base font-semibold">{c.title}</h3>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{c.description}</p>
                    {showInstructor && (
                      <div className="mt-1 text-xs text-muted-foreground">by {c.instructor}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold">{formatPrice(c.price, c.currency)}</div>
                    <div className="mt-1 inline-flex items-center gap-0.5 text-xs">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      <span className="font-medium">{c.rating}</span>
                      <span className="text-muted-foreground">({c.reviews})</span>
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.duration}</span>
                    <span className="inline-flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" />{c.lessons} lessons</span>
                  </div>
                  <Button variant="outline" size="sm">{cta}</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cols =
    columns === 2 ? "sm:grid-cols-2"
    : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4"
    : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="bg-background p-6">
      <Header />
      <div className={cn("grid grid-cols-1 gap-5", cols)}>
        {mockCourses.map((c) => (
          <CourseCard key={c.id} c={c} showInstructor={showInstructor} cta={cta} />
        ))}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h2 className="text-xl font-semibold">Featured courses</h2>
        <p className="text-sm text-muted-foreground">{mockCourses.length} hand-picked classes for spring</p>
      </div>
      <Button variant="outline" size="sm">All courses</Button>
    </div>
  );
}

function CourseCard({ c, showInstructor, cta }: { c: Course; showInstructor: boolean; cta: string }) {
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img src={c.image} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        <Badge className={cn("absolute left-3 top-3 text-xs", LEVEL_STYLE[c.level])}>{c.level}</Badge>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="text-xs text-muted-foreground">{c.category}</div>
        <h3 className="line-clamp-2 text-sm font-semibold">{c.title}</h3>
        {showInstructor && (
          <div className="mt-0.5 text-xs text-muted-foreground">by {c.instructor}</div>
        )}
        <div className="mt-2 flex items-center gap-1 text-xs">
          <Star className="h-3 w-3 fill-warning text-warning" />
          <span className="font-medium">{c.rating}</span>
          <span className="text-muted-foreground">({c.reviews})</span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.duration}</span>
          <span className="inline-flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" />{c.lessons}</span>
        </div>
        <div className="mt-auto flex items-end justify-between pt-3">
          <span className="text-base font-semibold">{formatPrice(c.price, c.currency)}</span>
          <Button size="sm" variant="outline">{cta}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Course detail ---------- */

interface CourseDetailProps {
  showOutcomes?: boolean;
  cta?: string;
}

export function CourseDetail({ showOutcomes = true, cta = "Enroll for" }: CourseDetailProps) {
  const c = mockCourseDetail;
  return (
    <div className="bg-background p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
            <img src={c.image} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
            <div className="absolute inset-x-5 bottom-5 text-background">
              <Badge className={cn("mb-2", LEVEL_STYLE[c.level])}>{c.level}</Badge>
              <h1 className="text-2xl font-semibold">{c.title}</h1>
              <p className="text-sm opacity-90">{c.description}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
            <div className="inline-flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <span className="font-semibold">{c.rating}</span>
              <span className="text-muted-foreground">({c.reviews} reviews)</span>
            </div>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Taught by <span className="font-medium text-foreground">{c.instructor}</span></span>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Users className="h-4 w-4" />
              2,400+ enrolled
            </span>
          </div>

          {showOutcomes && (
            <div className="mt-5 rounded-lg border border-border p-5">
              <h3 className="text-sm font-semibold">By the end, you'll be able to:</h3>
              <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {c.outcomes.map((o) => (
                  <li key={o} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5">
            <h3 className="text-sm font-semibold">Syllabus</h3>
            <div className="mt-3 overflow-hidden rounded-lg border border-border">
              {c.syllabus.map((s, i) => (
                <div
                  key={s.week}
                  className="flex items-center gap-4 border-b border-border p-4 last:border-b-0"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-medium">
                    W{s.week}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.lessons} lessons · {s.duration}
                    </div>
                  </div>
                  <PlayCircle className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-border p-5">
            <div className="text-3xl font-semibold">{formatPrice(c.price, c.currency)}</div>
            <div className="mt-1 text-xs text-muted-foreground">One-time · Lifetime access</div>
            <Button className="mt-4 w-full" size="lg">
              <GraduationCap className="h-4 w-4" />
              {cta} {formatPrice(c.price, c.currency)}
            </Button>
            <Button variant="outline" className="mt-2 w-full">Try free preview</Button>
            <Separator className="my-4" />
            <ul className="space-y-2 text-sm">
              <Perk icon={Clock}>{c.duration} of lessons</Perk>
              <Perk icon={PlayCircle}>{c.lessons} on-demand videos</Perk>
              <Perk icon={Award}>Certificate of completion</Perk>
              <Perk icon={Users}>Access to private community</Perk>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Perk({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span>{children}</span>
    </li>
  );
}
