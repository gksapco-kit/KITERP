import { useState } from "react";
import { Star, Quote, ChevronDown, Check, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockTestimonials, mockProcess, mockFaq, mockTeam, mockAddons } from "@/commerce-blocks/mock/serviceExtras";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { cn } from "@/lib/utils";

/* ---------------- Testimonials ---------------- */

interface TestimonialsProps {
  layout?: "grid" | "carousel" | "spotlight";
  showRating?: boolean;
  title?: string;
}

export function Testimonials({
  layout = "grid",
  showRating = true,
  title = "What clients say",
}: TestimonialsProps) {
  const [active, setActive] = useState(0);

  if (layout === "spotlight") {
    const t = mockTestimonials[active];
    return (
      <section className="px-6 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <Quote className="mx-auto h-10 w-10 text-primary" />
          <blockquote className="mt-6 text-2xl font-medium leading-snug tracking-tight md:text-3xl">
            "{t.quote}"
          </blockquote>
          <div className="mt-6 flex items-center justify-center gap-3">
            {t.avatar && (
              <img src={t.avatar} alt={t.name} className="h-12 w-12 rounded-full object-cover" />
            )}
            <div className="text-left">
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.role}</div>
            </div>
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setActive((i) => (i - 1 + mockTestimonials.length) % mockTestimonials.length)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setActive((i) => (i + 1) % mockTestimonials.length)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-10">
      {title && <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">{title}</h2>}
      <div
        className={cn(
          layout === "grid"
            ? "mx-auto grid max-w-6xl gap-6 md:grid-cols-3"
            : "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2",
        )}
      >
        {mockTestimonials.map((t) => (
          <figure
            key={t.id}
            className={cn(
              "flex flex-col rounded-lg border border-border bg-card p-6",
              layout === "carousel" && "w-80 shrink-0 snap-start",
            )}
          >
            <Quote className="h-6 w-6 text-primary" />
            {showRating && t.rating && (
              <div className="mt-3 flex text-warning">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn("h-3.5 w-3.5", i < t.rating! ? "fill-warning" : "fill-none")}
                  />
                ))}
              </div>
            )}
            <blockquote className="mt-3 flex-1 text-sm leading-relaxed">{t.quote}</blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
              {t.avatar && (
                <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
              )}
              <div>
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Process Steps ---------------- */

interface ProcessStep {
  id?: string;
  title: string;
  description: string;
}

interface ProcessProps {
  layout?: "horizontal" | "vertical" | "cards";
  title?: string;
  steps?: ProcessStep[];
}

export function ProcessSteps({
  layout = "horizontal",
  title = "How we work together",
  steps,
}: ProcessProps) {
  const items = steps !== undefined ? steps : mockProcess;

  return (
    <section className="px-6 py-12">
      {title && <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight">{title}</h2>}
      {items.length > 0 && (
        <div
          className={cn(
            "mx-auto max-w-5xl",
            layout === "horizontal" && "grid gap-6 md:grid-cols-4",
            layout === "vertical" && "space-y-6",
            layout === "cards" && "grid gap-5 sm:grid-cols-2 md:grid-cols-4",
          )}
        >
          {items.map((s, i) => (
            <div
              key={s.id ?? i}
              className={cn(
                "relative",
                layout === "vertical" && "flex gap-5",
                layout === "cards" && "rounded-xl border border-border bg-card p-5 shadow-sm",
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground",
                  layout === "cards" && "mb-4 h-10 w-10 text-base",
                )}
              >
                {i + 1}
              </div>
              <div className={cn(layout === "horizontal" ? "mt-4" : "")}>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              </div>
              {layout === "horizontal" && i < items.length - 1 && (
                <div className="absolute -right-3 top-6 hidden h-px w-6 bg-border md:block" />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- FAQ ---------------- */

interface FaqProps {
  layout?: "single" | "twoColumn";
  title?: string;
  faqs?: Array<{ question: string; answer: string; id?: string }>;
}

export function FAQBlock({ layout = "single", title = "Frequently asked", faqs }: FaqProps) {
  const items = faqs?.length ? faqs : mockFaq;
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? "0");
  return (
    <section className="px-6 py-10">
      {title && <h2 className="mb-8 text-2xl font-semibold tracking-tight">{title}</h2>}
      <div
        className={cn(
          "mx-auto max-w-4xl",
          layout === "twoColumn" ? "grid gap-x-8 md:grid-cols-2" : "space-y-2",
        )}
      >
        {items.map((f, index) => {
          const itemId = f.id ?? String(index);
          const isOpen = open === itemId;
          return (
            <div key={itemId} className="border-b border-border">
              <button
                onClick={() => setOpen(isOpen ? null : itemId)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
              >
                <span className="font-medium">{f.question}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen && (
                <p className="pb-4 pr-8 text-sm text-muted-foreground">{f.answer}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Team / Practitioner Picker ---------------- */

interface TeamMember {
  id?: string;
  name: string;
  role: string;
  bio?: string;
  avatar?: string;
  rating?: number;
  reviews?: number;
  available?: boolean;
  nextAvailable?: string;
}

interface TeamProps {
  layout?: "grid" | "list" | "compact";
  showAvailability?: boolean;
  cta?: string;
  title?: string;
  members?: TeamMember[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Consistent circular avatar — falls back to initials so rows/chips never jump around when a photo is missing. */
function TeamAvatar({ member, className }: { member: TeamMember; className?: string }) {
  if (member.avatar) {
    return <img src={member.avatar} alt={member.name} className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        className,
      )}
    >
      {initials(member.name)}
    </div>
  );
}

export function TeamPicker({
  layout = "grid",
  showAvailability = true,
  cta = "Book with",
  title = "Choose a practitioner",
  members,
}: TeamProps) {
  const items = members !== undefined ? members : mockTeam;
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const activeId = selected ?? items[0]?.id ?? items[0]?.name;

  if (items.length === 0) {
    return (
      <section className="px-6 py-10">
        {title && <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>}
      </section>
    );
  }

  if (layout === "list") {
    return (
      <section className="px-6 py-10">
        {title && <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>}
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {items.map((m, i) => {
            const id = m.id ?? String(i);
            const active = activeId === id;
            return (
              <button
                key={id}
                onClick={() => setSelected(id)}
                disabled={m.available === false}
                className={cn(
                  "flex items-center gap-4 rounded-lg border bg-card p-4 text-left transition-all",
                  active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                  m.available === false && "cursor-not-allowed opacity-60",
                )}
              >
                <TeamAvatar member={m} className="h-14 w-14 text-base" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.role}</span>
                  </div>
                  {m.bio && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{m.bio}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs">
                  {typeof m.rating === "number" && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-warning text-warning" /> {m.rating}
                      {typeof m.reviews === "number" ? ` (${m.reviews})` : ""}
                    </span>
                  )}
                  {showAvailability && (m.available !== undefined || m.nextAvailable) && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium",
                        m.available === false
                          ? "bg-muted text-muted-foreground"
                          : "bg-success/15 text-success-foreground",
                      )}
                    >
                      {m.available === false ? "Booked" : m.nextAvailable || "Available"}
                    </span>
                  )}
                </div>
                {active && (
                  <Button size="sm" className="shrink-0">
                    {cta} {m.name.split(" ")[0]}
                  </Button>
                )}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (layout === "compact") {
    const active = items.find((m, i) => (m.id ?? String(i)) === activeId) ?? items[0];
    return (
      <section className="px-6 py-10">
        {title && <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>}
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-2.5 overflow-x-auto pb-2">
            {items.map((m, i) => {
              const id = m.id ?? String(i);
              const isActive = activeId === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelected(id)}
                  disabled={m.available === false}
                  className={cn(
                    "flex w-24 shrink-0 flex-col items-center gap-2 rounded-lg border bg-card px-3 py-3 text-center transition-all",
                    isActive ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                    m.available === false && "cursor-not-allowed opacity-60",
                  )}
                >
                  <TeamAvatar member={m} className="h-12 w-12 text-sm" />
                  <div className="w-full">
                    <div className="truncate text-sm font-semibold">{m.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.role}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {active && (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
              <TeamAvatar member={active} className="h-12 w-12 shrink-0 text-sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold">{active.name}</span>
                  <span className="text-xs text-muted-foreground">{active.role}</span>
                </div>
                {active.bio && <p className="mt-1 text-sm text-muted-foreground">{active.bio}</p>}
                <div className="mt-1.5 flex items-center gap-3 text-xs">
                  {typeof active.rating === "number" && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-warning text-warning" /> {active.rating}
                      {typeof active.reviews === "number" ? ` (${active.reviews})` : ""}
                    </span>
                  )}
                  {showAvailability && (active.available !== undefined || active.nextAvailable) && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium",
                        active.available === false
                          ? "bg-muted text-muted-foreground"
                          : "bg-success/15 text-success-foreground",
                      )}
                    >
                      {active.available === false ? "Booked" : active.nextAvailable || "Available"}
                    </span>
                  )}
                </div>
              </div>
              <Button size="sm" className="shrink-0" disabled={active.available === false}>
                {cta} {active.name.split(" ")[0]}
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-10">
      {title && <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>}
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((m, i) => {
          const id = m.id ?? String(i);
          const active = activeId === id;
          return (
            <button
              key={id}
              onClick={() => setSelected(id)}
              disabled={m.available === false}
              className={cn(
                "group flex flex-col rounded-lg border bg-card p-5 text-left transition-all",
                active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                m.available === false && "cursor-not-allowed opacity-60",
              )}
            >
              <div className="flex items-center gap-3">
                <TeamAvatar member={m} className="h-14 w-14 text-base" />
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.role}</div>
                </div>
              </div>
              {m.bio && <p className="mt-3 flex-1 text-sm text-muted-foreground">{m.bio}</p>}
              <div className="mt-3 flex items-center justify-between text-xs">
                {typeof m.rating === "number" && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-warning text-warning" /> {m.rating}
                    {typeof m.reviews === "number" ? ` (${m.reviews})` : ""}
                  </span>
                )}
                {showAvailability && (m.available !== undefined || m.nextAvailable) && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      m.available === false
                        ? "bg-muted text-muted-foreground"
                        : "bg-success/15 text-success-foreground",
                    )}
                  >
                    {m.available === false ? "Booked" : m.nextAvailable || "Available"}
                  </span>
                )}
              </div>
              {active && (
                <Button size="sm" className="mt-4 w-full" disabled={m.available === false}>
                  {cta} {m.name.split(" ")[0]}
                </Button>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Add-ons Selector ---------------- */

interface AddonsProps {
  cta?: string;
  title?: string;
}

export function AddonsSelector({
  cta = "Continue",
  title = "Enhance your package",
}: AddonsProps) {
  const [selected, setSelected] = useState<string[]>(["ad1"]);
  const total = mockAddons
    .filter((a) => selected.includes(a.id))
    .reduce((s, a) => s + a.price, 0);

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <section className="px-6 py-10">
      {title && <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>}
      <div className="mx-auto max-w-2xl space-y-3">
        {mockAddons.map((a) => {
          const isSelected = selected.includes(a.id);
          return (
            <button
              key={a.id}
              onClick={() => toggle(a.id)}
              className={cn(
                "flex w-full items-start gap-4 rounded-lg border bg-card p-5 text-left transition-all",
                isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3 text-muted-foreground" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.name}</span>
                  {a.recommended && (
                    <Badge variant="secondary" className="bg-primary/15 text-xs">
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
              </div>
              <div className="text-right text-sm font-semibold tabular-nums">
                +{formatPrice(a.price, a.currency)}
              </div>
            </button>
          );
        })}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {selected.length} add-on{selected.length === 1 ? "" : "s"} selected
            </div>
            <div className="text-2xl font-semibold">{formatPrice(total, "USD")}</div>
          </div>
          <Button size="lg">{cta}</Button>
        </div>
      </div>
    </section>
  );
}
