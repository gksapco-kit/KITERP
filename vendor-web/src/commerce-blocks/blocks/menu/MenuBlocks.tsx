import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mockMenu, dietLabels, type Diet, type MockMenuItem, mockSpecials } from "@/commerce-blocks/mock/menu";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { cn } from "@/lib/utils";

function DietTags({ diet }: { diet: Diet[] }) {
  if (!diet?.length) return null;
  return (
    <div className="flex gap-1">
      {diet.map((d) => (
        <span
          key={d}
          title={dietLabels[d].description}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-background px-1 text-xs font-medium text-muted-foreground"
        >
          {dietLabels[d].label}
        </span>
      ))}
    </div>
  );
}

function MenuRow({ item, showImage }: { item: MockMenuItem; showImage: boolean }) {
  return (
    <div className="flex gap-4 py-4">
      {showImage && item.image && (
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{item.name}</h4>
            {item.popular && <Flame className="h-3.5 w-3.5 text-warning" />}
          </div>
          <span className="font-medium tabular-nums">
            {formatPrice(item.price, item.currency)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        <div className="mt-1.5">
          <DietTags diet={item.diet} />
        </div>
      </div>
    </div>
  );
}

interface MenuProps {
  showImages?: boolean;
  layout?: "single" | "twoColumn";
  title?: string;
}

export function CategorizedMenu({
  showImages = true,
  layout = "single",
  title = "Menu",
}: MenuProps) {
  return (
    <section className="px-6 py-10">
      {title && (
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">{title}</h2>
      )}
      <div
        className={cn(
          "mx-auto max-w-4xl",
          layout === "twoColumn" ? "grid gap-x-10 md:grid-cols-2" : "space-y-10",
        )}
      >
        {mockMenu.map((section) => (
          <div key={section.id} className={layout === "twoColumn" ? "" : ""}>
            <div className="mb-2 border-b border-border pb-2">
              <h3 className="text-xl font-semibold">{section.name}</h3>
              {section.description && (
                <p className="text-xs text-muted-foreground">{section.description}</p>
              )}
            </div>
            <div className="divide-y divide-border">
              {section.items.map((item) => (
                <MenuRow key={item.id} item={item} showImage={showImages} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface DetailProps {
  itemId?: string;
}

export function MenuItemDetail({ itemId }: DetailProps) {
  const all = mockMenu.flatMap((s) => s.items);
  const item = all.find((i) => i.id === itemId) ?? all[1];
  return (
    <section className="grid gap-6 p-6 md:grid-cols-2 md:p-10">
      <div className="aspect-square overflow-hidden rounded-lg bg-muted">
        {item.image && (
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{item.name}</h1>
            {item.popular && (
              <Badge variant="secondary" className="bg-warning/15">
                <Flame className="h-3 w-3" /> Popular
              </Badge>
            )}
          </div>
          <p className="mt-2 text-muted-foreground">{item.description}</p>
        </div>
        <div className="text-2xl font-semibold">{formatPrice(item.price, item.currency)}</div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Dietary
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.diet.map((d) => (
              <Badge key={d} variant="outline">
                {dietLabels[d].description}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

interface SpecialsProps {
  layout?: "row" | "stacked";
  title?: string;
}

export function DailySpecials({
  layout = "row",
  title = "Today's specials",
}: SpecialsProps) {
  return (
    <section className="px-6 py-10">
      {title && (
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>
      )}
      <div
        className={cn(
          "grid gap-4",
          layout === "row" ? "md:grid-cols-2" : "grid-cols-1 max-w-xl",
        )}
      >
        {mockSpecials.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-border bg-gradient-to-br from-accent to-card p-5"
          >
            <Badge variant="secondary">{s.badge}</Badge>
            <h3 className="mt-3 text-xl font-semibold">{s.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
            <div className="mt-3 text-lg font-semibold">{formatPrice(s.price, s.currency)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface LegendProps {
  compact?: boolean;
}

export function AllergenLegend({ compact = false }: LegendProps) {
  const entries = Object.entries(dietLabels) as [Diet, { label: string; description: string }][];
  return (
    <section className="p-6">
      <div
        className={cn(
          "rounded-lg border border-border bg-muted/30 p-4",
          compact ? "" : "p-6",
        )}
      >
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Allergen & dietary key
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {entries.map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border bg-background px-1.5 text-xs font-medium">
                {val.label}
              </span>
              <span className="text-muted-foreground">{val.description}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
