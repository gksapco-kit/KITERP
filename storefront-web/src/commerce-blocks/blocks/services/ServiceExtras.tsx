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

interface ProcessProps {
  layout?: "horizontal" | "vertical";
  title?: string;
}

export function ProcessSteps({
  layout = "horizontal",
  title = "How we work together",
}: ProcessProps) {
  return (
    <section className="px-6 py-12">
      {title && <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight">{title}</h2>}
      <div
        className={cn(
          "mx-auto max-w-5xl",
          layout === "horizontal" ? "grid gap-6 md:grid-cols-4" : "space-y-6",
        )}
      >
        {mockProcess.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "relative",
              layout === "vertical" && "flex gap-5",
            )}
          >
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground",
              )}
            >
              {s.step}
            </div>
            <div className={cn(layout === "horizontal" ? "mt-4" : "")}>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
            </div>
            {layout === "horizontal" && i < mockProcess.length - 1 && (
              <div className="absolute -right-3 top-6 hidden h-px w-6 bg-border md:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

interface FaqProps {
  layout?: "single" | "twoColumn";
  title?: string;
}

export function FAQBlock({ layout = "single", title = "Frequently asked" }: FaqProps) {
  const [open, setOpen] = useState<string | null>(mockFaq[0].id);
  return (
    <section className="px-6 py-10">
      {title && <h2 className="mb-8 text-2xl font-semibold tracking-tight">{title}</h2>}
      <div
        className={cn(
          "mx-auto max-w-4xl",
          layout === "twoColumn" ? "grid gap-x-8 md:grid-cols-2" : "space-y-2",
        )}
      >
        {mockFaq.map((f) => {
          const isOpen = open === f.id;
          return (
            <div key={f.id} className="border-b border-border">
              <button
                onClick={() => setOpen(isOpen ? null : f.id)}
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

interface TeamProps {
  showAvailability?: boolean;
  cta?: string;
  title?: string;
}

export function TeamPicker({
  showAvailability = true,
  cta = "Book with",
  title = "Choose a practitioner",
}: TeamProps) {
  const [selected, setSelected] = useState<string>(mockTeam[0].id);
  return (
    <section className="px-6 py-10">
      {title && <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>}
      <div className="grid gap-4 md:grid-cols-3">
        {mockTeam.map((m) => {
          const active = selected === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              disabled={!m.available}
              className={cn(
                "group flex flex-col rounded-lg border bg-card p-5 text-left transition-all",
                active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                !m.available && "cursor-not-allowed opacity-60",
              )}
            >
              <div className="flex items-center gap-3">
                <img src={m.avatar} alt={m.name} className="h-14 w-14 rounded-full object-cover" />
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.role}</div>
                </div>
              </div>
              <p className="mt-3 flex-1 text-sm text-muted-foreground">{m.bio}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-warning text-warning" /> {m.rating} ({m.reviews})
                </span>
                {showAvailability && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      m.available
                        ? "bg-success/15 text-success-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {m.available ? m.nextAvailable : "Booked"}
                  </span>
                )}
              </div>
              {active && (
                <Button size="sm" className="mt-4 w-full">
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
