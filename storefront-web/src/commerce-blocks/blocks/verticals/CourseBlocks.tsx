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
import { catalogGridClassName } from "@/lib/commerceCatalogLayout";
import {
  catalogVariantStyle,
  detailVariantStyle,
  DetailShell,
  verticalSwatch,
  type CatalogVariantStyle,
} from "@/commerce-blocks/lib/verticalVariants";

const withCourseImage = (c: Course): Course => ({
  ...c,
  image: c.image || verticalSwatch(c.id || c.title || "course"),
});

const LEVEL_STYLE: Record<Course["level"], string> = {
  Beginner: "bg-success/15 text-success hover:bg-success/15",
  Intermediate: "bg-primary/15 text-primary hover:bg-primary/15",
  Advanced: "bg-destructive/15 text-destructive hover:bg-destructive/15",
};

interface CourseCatalogProps {
  variant?: string;
  layout?: "grid" | "list";
  columns?: number;
  gap?: number;
  itemLimit?: number;
  showInstructor?: boolean;
  cta?: string;
  courses?: Course[];
  header_title?: string;
  header_subtitle?: string;
  all_courses_label?: string;
}

export function CourseCatalog({
  variant,
  layout,
  itemLimit,
  showInstructor = true,
  cta,
  courses,
  header_title,
  header_subtitle,
  all_courses_label,
}: CourseCatalogProps) {
  const style = catalogVariantStyle(variant ?? layout ?? "default");
  const source = courses && courses.length ? courses : mockCourses;
  const items = source.slice(0, itemLimit ?? source.length).map(withCourseImage);
  const headerProps = {
    hero: style.hero,
    count: items.length,
    title: header_title,
    subtitle: header_subtitle,
    allCoursesLabel: all_courses_label ?? "All courses",
  };

  if (style.mode === "list") {
    return (
      <div className="bg-background p-6">
        <Header {...headerProps} />
        <div className="flex flex-col" style={{ gap: style.gap }}>
          {items.map((c) => (
            <CourseRow key={c.id} c={c} showInstructor={showInstructor} cta={cta} cardClass={style.cardClass} />
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
        {first && <FeaturedCourse c={first} showInstructor={showInstructor} cta={cta} />}
        <div className={cn("mt-5 grid grid-cols-1", catalogGridClassName(style.columns))} style={{ gap: style.gap }}>
          {rest.map((c) => (
            <CourseCard key={c.id} c={c} showInstructor={showInstructor} cta={cta} style={style} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background p-6">
      <Header {...headerProps} />
      <div className={cn("grid grid-cols-1", catalogGridClassName(style.columns))} style={{ gap: style.gap }}>
        {items.map((c) => (
          <CourseCard key={c.id} c={c} showInstructor={showInstructor} cta={cta} style={style} />
        ))}
      </div>
    </div>
  );
}

function Header({
  hero,
  count,
  title,
  subtitle,
  allCoursesLabel,
}: {
  hero?: boolean;
  count: number;
  title?: string;
  subtitle?: string;
  allCoursesLabel?: string;
}) {
  const displayTitle = title ?? "Featured courses";
  const displaySubtitle = subtitle ?? (hero
    ? `${count} hand-picked class${count === 1 ? "" : "es"} for spring — learn something new today`
    : `${count} hand-picked class${count === 1 ? "" : "es"} for spring`);
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
      {allCoursesLabel && <Button variant="outline" size="sm">{allCoursesLabel}</Button>}
    </div>
  );
}

function CourseCard({
  c,
  showInstructor,
  cta,
  style,
}: {
  c: Course;
  showInstructor: boolean;
  cta?: string;
  style: CatalogVariantStyle;
}) {
  return (
    <div className={cn("group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md", style.cardClass)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
        <img src={c.image} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        <Badge className={cn("absolute left-3 top-3 text-xs", LEVEL_STYLE[c.level])}>{c.level}</Badge>
      </div>
      <div className={cn("flex flex-1 flex-col", style.card === "plain" || style.card === "editorial" ? "pt-3" : "p-4")}>
        <div className="text-xs text-muted-foreground">{c.category}</div>
        <h3 className={cn("line-clamp-2 font-semibold", style.bigTitle ? "text-lg" : "text-sm")}>{c.title}</h3>
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
          {cta && <Button size="sm" variant="outline">{cta}</Button>}
        </div>
      </div>
    </div>
  );
}

function CourseRow({
  c,
  showInstructor,
  cta,
  cardClass,
}: {
  c: Course;
  showInstructor: boolean;
  cta?: string;
  cardClass: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 p-3 sm:flex-row", cardClass)}>
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
          {cta && <Button variant="outline" size="sm">{cta}</Button>}
        </div>
      </div>
    </div>
  );
}

function FeaturedCourse({ c, showInstructor, cta }: { c: Course; showInstructor: boolean; cta?: string }) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-2">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted md:aspect-auto">
        <img src={c.image} alt="" className="h-full w-full object-cover" />
        <Badge className={cn("absolute left-4 top-4", LEVEL_STYLE[c.level])}>{c.level}</Badge>
      </div>
      <div className="flex flex-col justify-center p-6">
        <div className="text-xs uppercase tracking-wider text-primary">Featured · {c.category}</div>
        <h3 className="mt-1 text-2xl font-bold">{c.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
        {showInstructor && <div className="mt-2 text-sm text-muted-foreground">by {c.instructor}</div>}
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" />{c.rating} ({c.reviews})</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{c.duration}</span>
          <span className="inline-flex items-center gap-1"><PlayCircle className="h-4 w-4" />{c.lessons} lessons</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-2xl font-semibold">{formatPrice(c.price, c.currency)}</span>
          {cta && <Button>{cta}</Button>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Course detail ---------- */

interface SyllabusWeek {
  week: number;
  title: string;
  lessons: number;
  duration: string;
}

interface PerkItem {
  icon?: string;
  text: string;
}

const PERK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  clock: Clock,
  video: PlayCircle,
  award: Award,
  users: Users,
};

function defaultPerks(duration: string, lessons: number): PerkItem[] {
  return [
    { icon: "clock", text: `${duration} of lessons` },
    { icon: "video", text: `${lessons} on-demand videos` },
    { icon: "award", text: "Certificate of completion" },
    { icon: "users", text: "Access to private community" },
  ];
}

interface CourseDetailProps {
  variant?: string;
  showOutcomes?: boolean;
  cta?: string;
  cta_url?: string;
  preview_cta?: string;
  preview_cta_url?: string;
  syllabus?: SyllabusWeek[];
  outcomes?: string[];
  perks?: PerkItem[];
  title?: string;
  instructor?: string;
  level?: Course["level"];
  category?: string;
  description?: string;
  image_url?: string;
  duration?: string;
  lessons?: number | string;
  rating?: number | string;
  reviews?: number | string;
  price?: number | string;
  currency?: string;
  enrolled_label?: string;
}

export function CourseDetail({
  variant,
  showOutcomes = true,
  cta,
  cta_url,
  preview_cta,
  preview_cta_url,
  syllabus,
  outcomes,
  perks,
  title,
  instructor,
  level,
  category,
  description,
  image_url,
  duration,
  lessons,
  rating,
  reviews,
  price,
  currency,
  enrolled_label,
}: CourseDetailProps) {
  const m = mockCourseDetail;
  const c = {
    title: title ?? m.title,
    instructor: instructor ?? m.instructor,
    level: (level as Course["level"] | undefined) ?? m.level,
    category: category ?? m.category,
    description: description ?? m.description,
    image: image_url || m.image,
    duration: duration ?? m.duration,
    lessons: lessons !== undefined ? Number(lessons) || 0 : m.lessons,
    rating: rating !== undefined ? Number(rating) || 0 : m.rating,
    reviews: reviews !== undefined ? Number(reviews) || 0 : m.reviews,
    price: price !== undefined ? Number(price) || 0 : m.price,
    currency: currency || m.currency,
  };
  const style = detailVariantStyle(variant);
  const syllabusItems = syllabus && syllabus.length ? syllabus : m.syllabus;
  const outcomeItems = outcomes && outcomes.length ? outcomes : m.outcomes;
  const perkItems = perks && perks.length ? perks : defaultPerks(c.duration, c.lessons);
  const checkoutLabel = cta ?? "Enroll for";
  const previewLabel = preview_cta ?? "Try free preview";
  const enrolledText = enrolled_label ?? "2,400+ enrolled";

  const banner = (
    <div className={cn("relative overflow-hidden rounded-xl bg-muted", style.hero ? "aspect-[21/9]" : "aspect-[16/9]")}>
      <img src={c.image} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
      <div className="absolute inset-x-5 bottom-5 text-background">
        {c.level && <Badge className={cn("mb-2", LEVEL_STYLE[c.level])}>{c.level}</Badge>}
        {c.title && <h1 className={cn("font-semibold", style.hero ? "text-3xl" : "text-2xl")}>{c.title}</h1>}
        {c.description && <p className="text-sm opacity-90">{c.description}</p>}
      </div>
    </div>
  );

  const main = (
    <div>
      {!style.hero && banner}

      <div className={cn("flex flex-wrap items-center gap-4 text-sm", style.hero ? "" : "mt-5")}>
        {c.rating > 0 && (
          <div className="inline-flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-warning text-warning" />
            <span className="font-semibold">{c.rating}</span>
            <span className="text-muted-foreground">({c.reviews} reviews)</span>
          </div>
        )}
        {c.instructor && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Taught by <span className="font-medium text-foreground">{c.instructor}</span></span>
          </>
        )}
        {enrolledText && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Users className="h-4 w-4" />
              {enrolledText}
            </span>
          </>
        )}
      </div>

      {showOutcomes && outcomeItems.length > 0 && (
        <div className={cn("mt-5 p-5", style.cardClass)}>
          <h3 className="text-sm font-semibold">By the end, you'll be able to:</h3>
          <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {outcomeItems.map((o, i) => (
              <li key={`${o}-${i}`} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {syllabusItems.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Syllabus</h3>
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            {syllabusItems.map((s, i) => (
              <div
                key={`${s.week}-${i}`}
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
      )}
    </div>
  );

  const aside = (
    <div className="space-y-4">
      <div className={cn("p-5", style.cardClass)}>
        <div className="text-3xl font-semibold">{formatPrice(c.price, c.currency)}</div>
        <div className="mt-1 text-xs text-muted-foreground">One-time · Lifetime access</div>
        {checkoutLabel && (
          <Button className="mt-4 w-full" size="lg" asChild={!!cta_url}>
            {cta_url ? (
              <a href={cta_url}>
                <GraduationCap className="h-4 w-4" />
                {checkoutLabel} {formatPrice(c.price, c.currency)}
              </a>
            ) : (
              <>
                <GraduationCap className="h-4 w-4" />
                {checkoutLabel} {formatPrice(c.price, c.currency)}
              </>
            )}
          </Button>
        )}
        {previewLabel && (
          <Button variant="outline" className="mt-2 w-full" asChild={!!preview_cta_url}>
            {preview_cta_url ? <a href={preview_cta_url}>{previewLabel}</a> : <>{previewLabel}</>}
          </Button>
        )}
        {perkItems.length > 0 && (
          <>
            <Separator className="my-4" />
            <ul className="space-y-2 text-sm">
              {perkItems.map((perk, i) => (
                <Perk key={`${perk.text}-${i}`} icon={PERK_ICONS[perk.icon ?? "clock"] ?? CheckCircle2}>
                  {perk.text}
                </Perk>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-background p-6">
      {style.hero && <div className={cn(style.containerClass, "mb-6")}>{banner}</div>}
      <DetailShell style={style} main={main} aside={aside} />
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
