import { useState } from "react";
import {
  Car,
  Fuel,
  Gauge,
  Cog,
  Calendar,
  Heart,
  CheckCircle2,
  Sparkles,
  Calculator,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockVehicles, type Vehicle } from "@/commerce-blocks/mock/verticals";
import { catalogGridClassName } from "@/lib/commerceCatalogLayout";
import {
  catalogVariantStyle,
  detailVariantStyle,
  DetailShell,
  verticalSwatch,
  type CatalogVariantStyle,
} from "@/commerce-blocks/lib/verticalVariants";

const CONDITION_STYLE: Record<string, string> = {
  New: "bg-success/15 text-success hover:bg-success/15",
  Certified: "bg-primary/15 text-primary hover:bg-primary/15",
  Used: "bg-secondary text-secondary-foreground",
};

const withVehicleImage = (v: Vehicle): Vehicle => ({
  ...v,
  image: v.image || verticalSwatch(v.id || `${v.make}-${v.model}`),
});

interface AutoInventoryProps {
  variant?: string;
  layout?: "grid" | "list";
  columns?: number;
  gap?: number;
  itemLimit?: number;
  showFilters?: boolean;
  cta?: string;
  cta_url?: string;
  vehicles?: Vehicle[];
  header_title?: string;
  header_subtitle?: string;
  /** Live vehicles synced from Sales → Vehicle Inventory — takes priority over static `vehicles`. */
  liveVehicles?: Vehicle[];
}

export function AutoInventory({
  variant,
  layout,
  itemLimit,
  showFilters = true,
  cta,
  cta_url,
  vehicles,
  header_title,
  header_subtitle,
  liveVehicles,
}: AutoInventoryProps) {
  const [maxPrice, setMaxPrice] = useState(90000);
  const style = catalogVariantStyle(variant ?? layout ?? "default");
  const source = (liveVehicles && liveVehicles.length ? liveVehicles : vehicles && vehicles.length ? vehicles : mockVehicles).map(withVehicleImage);
  const filtered = showFilters ? source.filter((v) => v.price <= maxPrice) : source;
  const items = filtered.slice(0, itemLimit ?? filtered.length);
  const title = header_title ?? "Available inventory";
  const subtitle = header_subtitle
    ?? `${items.length} vehicle${items.length === 1 ? "" : "s"} match your filters`;

  const header = (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {title && <h2 className="text-xl font-semibold">{title}</h2>}
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {showFilters && (
        <div className="flex w-full items-center gap-3 sm:w-72">
          <span className="shrink-0 text-xs text-muted-foreground">Up to</span>
          <Slider
            value={[maxPrice]}
            min={20000}
            max={90000}
            step={1000}
            onValueChange={(v) => setMaxPrice(v[0])}
            className="flex-1"
          />
          <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums">
            ${(maxPrice / 1000).toFixed(0)}K
          </span>
        </div>
      )}
    </div>
  );

  if (style.mode === "list") {
    return (
      <div className="bg-background p-6">
        {header}
        <div className="flex flex-col" style={{ gap: style.gap }}>
          {items.map((v) => (
            <VehicleRow key={v.id} v={v} cta={cta} ctaUrl={cta_url} cardClass={style.cardClass} />
          ))}
        </div>
      </div>
    );
  }

  if (style.mode === "featured") {
    const [first, ...rest] = items;
    return (
      <div className="bg-background p-6">
        {header}
        {first && <FeaturedVehicle v={first} cta={cta} ctaUrl={cta_url} />}
        <div className={cn("mt-5 grid grid-cols-1", catalogGridClassName(style.columns))} style={{ gap: style.gap }}>
          {rest.map((v) => (
            <VehicleCard key={v.id} v={v} cta={cta} ctaUrl={cta_url} style={style} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background p-6">
      {header}
      <div className={cn("grid grid-cols-1", catalogGridClassName(style.columns))} style={{ gap: style.gap }}>
        {items.map((v) => (
          <VehicleCard key={v.id} v={v} cta={cta} ctaUrl={cta_url} style={style} />
        ))}
      </div>
    </div>
  );
}

function VehicleCard({ v, cta, ctaUrl, style }: { v: Vehicle; cta?: string; ctaUrl?: string; style: CatalogVariantStyle }) {
  return (
    <div className={cn("group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md", style.cardClass)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
        <img src={v.image} alt={`${v.make} ${v.model}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        {v.condition && (
          <Badge className={cn("absolute left-3 top-3 text-xs", CONDITION_STYLE[v.condition] ?? "bg-secondary text-secondary-foreground")}>
            {v.condition}
          </Badge>
        )}
        <button className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background">
          <Heart className="h-4 w-4" />
        </button>
      </div>
      <div className={cn("flex flex-1 flex-col", style.card === "plain" || style.card === "editorial" ? "pt-3" : "p-4")}>
        <div className="text-xs text-muted-foreground">{v.year} · {v.bodyStyle}</div>
        <h3 className={cn("font-semibold", style.bigTitle ? "text-lg" : "text-base")}>{v.make} {v.model}</h3>
        <p className="text-xs text-muted-foreground">{v.trim} · {v.exteriorColor}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-semibold">{formatPrice(v.price, v.currency)}</span>
          <span className="text-xs text-muted-foreground">
            est. ${Math.round((v.price * 0.018) / 5).toLocaleString()}/mo
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <Spec icon={Gauge}>{(v.mileage / 1000).toFixed(0)}k mi</Spec>
          <Spec icon={Fuel}>{v.fuel}</Spec>
          <Spec icon={Cog}>{v.transmission}</Spec>
        </div>
        {cta && (
          <Button variant="outline" size="sm" className="mt-3 w-full" asChild={!!ctaUrl}>
            {ctaUrl ? <a href={ctaUrl}>{cta}</a> : <>{cta}</>}
          </Button>
        )}
      </div>
    </div>
  );
}

function VehicleRow({ v, cta, ctaUrl, cardClass }: { v: Vehicle; cta?: string; ctaUrl?: string; cardClass: string }) {
  return (
    <div className={cn("flex flex-col gap-4 p-3 sm:flex-row", cardClass)}>
      <div className="relative h-40 shrink-0 overflow-hidden rounded-md bg-muted sm:h-28 sm:w-44">
        <img src={v.image} alt="" className="h-full w-full object-cover" />
        {v.condition && (
          <Badge className={cn("absolute left-2 top-2 text-xs", CONDITION_STYLE[v.condition] ?? "bg-secondary text-secondary-foreground")}>
            {v.condition}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{v.year} · {v.bodyStyle}</div>
            <h3 className="text-base font-semibold">{v.make} {v.model} <span className="text-sm font-normal text-muted-foreground">{v.trim}</span></h3>
            <p className="text-xs text-muted-foreground">{v.exteriorColor}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">{formatPrice(v.price, v.currency)}</div>
            <div className="text-xs text-muted-foreground">
              est. ${Math.round((v.price * 0.018) / 5).toLocaleString()}/mo
            </div>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-xs text-muted-foreground">
          <Spec icon={Gauge}>{v.mileage.toLocaleString()} mi</Spec>
          <Spec icon={Fuel}>{v.fuel}</Spec>
          <Spec icon={Cog}>{v.transmission}</Spec>
          {cta && (
            <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" asChild={!!ctaUrl}>
              {ctaUrl ? <a href={ctaUrl}>{cta}</a> : <>{cta}</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FeaturedVehicle({ v, cta, ctaUrl }: { v: Vehicle; cta?: string; ctaUrl?: string }) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-2">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted md:aspect-auto">
        <img src={v.image} alt="" className="h-full w-full object-cover" />
        {v.condition && (
          <Badge className={cn("absolute left-4 top-4", CONDITION_STYLE[v.condition] ?? "bg-secondary text-secondary-foreground")}>
            {v.condition}
          </Badge>
        )}
      </div>
      <div className="flex flex-col justify-center p-6">
        <div className="text-xs uppercase tracking-wider text-primary">Featured · {v.year}</div>
        <h3 className="mt-1 text-2xl font-bold">{v.make} {v.model}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{v.trim} · {v.exteriorColor}</p>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <Spec icon={Gauge}>{v.mileage.toLocaleString()} mi</Spec>
          <Spec icon={Fuel}>{v.fuel}</Spec>
          <Spec icon={Cog}>{v.transmission}</Spec>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-2xl font-semibold">{formatPrice(v.price, v.currency)}</span>
          {cta && (
            <Button asChild={!!ctaUrl}>
              {ctaUrl ? <a href={ctaUrl}>{cta}</a> : <>{cta}</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

/* ---------- Vehicle detail ---------- */

const DEFAULT_VEHICLE_HIGHLIGHTS = [
  "One-owner, clean title",
  "Free CARFAX history report",
  "Multi-point safety inspection",
  "Remaining factory warranty",
  "Apple CarPlay & Android Auto",
  "Heated front seats",
];

/**
 * Highlights may arrive as string[] (mock) or {text}[] (builder item editor).
 * `fallbackToDefault` only applies to the unsynced/demo vehicle — live vehicles with no
 * highlights entered in Vehicle Inventory simply render without a Highlights section.
 */
function normalizeHighlights(highlights: unknown, fallbackToDefault = true): string[] {
  if (!Array.isArray(highlights) || highlights.length === 0) {
    return fallbackToDefault ? DEFAULT_VEHICLE_HIGHLIGHTS : [];
  }
  return highlights
    .map((h) => (typeof h === "string" ? h : (h as { text?: string })?.text ?? ""))
    .filter(Boolean);
}

const numOrMock = (val: number | string | undefined, mockVal: number): number => {
  if (val === undefined || val === "") return mockVal;
  const n = Number(val);
  return Number.isFinite(n) ? n : mockVal;
};

interface VehicleDetailProps {
  variant?: string;
  vehicleId?: string;
  image_url?: string;
  condition?: string;
  year?: number | string;
  make?: string;
  model?: string;
  trim?: string;
  exteriorColor?: string;
  bodyStyle?: string;
  mileage?: number | string;
  fuel?: string;
  transmission?: string;
  price?: number | string;
  currency?: string;
  stock_number?: string;
  location_note?: string;
  cta?: string;
  cta_url?: string;
  highlights?: Array<{ text: string }> | string[];
  itemLimit?: number;
  header_title?: string;
  header_subtitle?: string;
  /** Live vehicles synced from Sales → Vehicle Inventory — when present, EVERY active vehicle renders as its own detail card. */
  liveVehicles?: Vehicle[];
}

type ResolvedVehicleDetail = {
  key: string;
  v: Vehicle;
  stockNumber: string;
  locationNote: string;
  highlightList: string[];
  ctaLabel: string;
};

/** One vehicle's full spec/highlights/pricing card, laid out per the chosen section style. The CTA label comes
 * from the resolved vehicle itself (its own "Button label" set in Sales → Vehicle Inventory), so each card can
 * show a different call-to-action instead of one shared override across every synced vehicle. */
function VehicleDetailCard({
  resolved,
  style,
  ctaUrl,
}: {
  resolved: ResolvedVehicleDetail;
  style: ReturnType<typeof detailVariantStyle>;
  ctaUrl?: string;
}) {
  const { v, stockNumber, locationNote, highlightList, ctaLabel } = resolved;
  const monthly = Math.round((v.price * 0.018) / 5);
  const metaLine = [v.year ? String(v.year) : "", v.bodyStyle].filter(Boolean).join(" · ");
  const subLine = [v.trim, v.exteriorColor].filter(Boolean).join(" · ");
  const specs = [
    { icon: Gauge, label: "Mileage", value: `${v.mileage.toLocaleString()} mi` },
    ...(v.fuel ? [{ icon: Fuel, label: "Fuel", value: v.fuel }] : []),
    ...(v.transmission ? [{ icon: Cog, label: "Transmission", value: v.transmission }] : []),
    ...(v.bodyStyle ? [{ icon: Car, label: "Body", value: v.bodyStyle }] : []),
  ];

  const banner = (
    <div className={cn("relative overflow-hidden rounded-xl bg-muted", style.hero ? "aspect-[21/9]" : "aspect-[16/10]")}>
      <img src={v.image} alt="" className="h-full w-full object-cover" />
      {v.condition && (
        <Badge className={cn("absolute left-4 top-4", CONDITION_STYLE[v.condition] ?? "bg-secondary text-secondary-foreground")}>
          {v.condition}
        </Badge>
      )}
      {style.hero && (
        <div className="absolute inset-x-5 bottom-5 text-background">
          {metaLine && <div className="text-xs opacity-90">{metaLine}</div>}
          <h1 className="text-3xl font-bold">{v.make} {v.model}</h1>
          {subLine && <p className="text-sm opacity-90">{subLine}</p>}
        </div>
      )}
    </div>
  );

  const main = (
    <div>
      {!style.hero && banner}

      {!style.hero && (
        <div className="mt-5">
          {metaLine && <div className="text-xs text-muted-foreground">{metaLine}</div>}
          <h1 className="text-2xl font-semibold">{v.make} {v.model}</h1>
          {subLine && <p className="text-sm text-muted-foreground">{subLine}</p>}
        </div>
      )}

      <div className={cn("mt-5 grid grid-cols-2 gap-3 p-4 sm:grid-cols-4", style.cardClass)}>
        {specs.map((s) => (
          <Stat key={s.label} icon={s.icon} label={s.label} value={s.value} />
        ))}
      </div>

      {highlightList.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Highlights</h3>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {highlightList.map((f) => (
              <li key={f} className="inline-flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const aside = (
    <div className="space-y-4">
      <div className={cn("p-5", style.cardClass)}>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Sale price</div>
        <div className="text-3xl font-semibold">{formatPrice(v.price, v.currency)}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          or <span className="font-medium text-foreground">${monthly.toLocaleString()}/mo</span> for 60 mo
        </div>
        <div className="mt-4 space-y-2">
          {ctaLabel && (
            <Button className="w-full" asChild={!!ctaUrl}>
              {ctaUrl ? (
                <a href={ctaUrl}>
                  <Calendar className="h-4 w-4" />
                  {ctaLabel}
                </a>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  {ctaLabel}
                </>
              )}
            </Button>
          )}
          <Button variant="outline" className="w-full">
            <Calculator className="h-4 w-4" />
            Estimate payment
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Get trade-in value
          </Button>
        </div>
      </div>
      {(stockNumber || locationNote) && (
        <div className={cn("p-5", style.cardClass, "bg-muted/30")}>
          {stockNumber && (
            <>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Stock #</div>
              <div className="mt-1 font-mono text-sm">{stockNumber}</div>
            </>
          )}
          {locationNote && (
            <div className="mt-3 text-xs text-muted-foreground">{locationNote}</div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {style.hero && <div className={cn(style.containerClass, "mb-6")}>{banner}</div>}
      <DetailShell style={style} main={main} aside={aside} />
    </div>
  );
}

export function VehicleDetail({
  variant,
  vehicleId = "v1",
  image_url,
  condition,
  year,
  make,
  model,
  trim,
  exteriorColor,
  bodyStyle,
  mileage,
  fuel,
  transmission,
  price,
  currency,
  stock_number,
  location_note,
  cta,
  cta_url,
  highlights,
  itemLimit,
  header_title,
  header_subtitle,
  liveVehicles,
}: VehicleDetailProps) {
  const style = detailVariantStyle(variant);
  const isLive = !!(liveVehicles && liveVehicles.length);
  // Section heading only applies once connected to Sales → Vehicle Inventory — the single demo
  // vehicle below already has its own banner/title, so no separate heading is needed there.
  const headerTitle = header_title ?? (isLive ? "Available vehicles" : "");
  const headerSubtitle = header_subtitle ?? (isLive ? `${liveVehicles!.length} vehicle${liveVehicles!.length === 1 ? "" : "s"} in stock` : "");

  // Connected to Sales → Vehicle Inventory: every active vehicle gets its own full detail card,
  // stacked in the page using the same section style (sidebar position, hero banner, card treatment).
  const cards: ResolvedVehicleDetail[] = isLive
    ? (liveVehicles as Vehicle[]).slice(0, itemLimit ?? liveVehicles!.length).map((lv) => {
        const meta = lv as Vehicle & { stock_number?: string; location_note?: string; highlights?: unknown; ctaLabel?: string };
        return {
          key: lv.id,
          v: withVehicleImage(lv),
          stockNumber: meta.stock_number ?? "",
          locationNote: meta.location_note ?? "",
          highlightList: normalizeHighlights(meta.highlights, false),
          ctaLabel: meta.ctaLabel ?? "",
        };
      })
    : (() => {
        // No live data yet — fall back to the single manually-edited/demo vehicle (existing behavior).
        const mock = mockVehicles.find((x) => x.id === vehicleId) ?? mockVehicles[0];
        const v: Vehicle = {
          ...mock,
          image: image_url || mock.image,
          condition: (condition || mock.condition) as Vehicle["condition"],
          year: numOrMock(year, mock.year),
          make: make ?? mock.make,
          model: model ?? mock.model,
          trim: trim !== undefined ? trim : mock.trim ?? "",
          exteriorColor: exteriorColor !== undefined ? exteriorColor : mock.exteriorColor,
          bodyStyle: bodyStyle !== undefined ? bodyStyle : mock.bodyStyle,
          mileage: numOrMock(mileage, mock.mileage),
          fuel: fuel !== undefined ? fuel : mock.fuel,
          transmission: transmission !== undefined ? transmission : mock.transmission,
          price: numOrMock(price, mock.price),
          currency: currency ?? mock.currency,
        };
        const stockNumber = stock_number !== undefined ? stock_number : `AC-${mock.id.toUpperCase()}-${v.year}`;
        const locationNote = location_note !== undefined
          ? location_note
          : "Located at our Williamsburg showroom · Available for delivery";
        return [{ key: mock.id, v, stockNumber, locationNote, highlightList: normalizeHighlights(highlights), ctaLabel: cta ?? "Schedule test drive" }];
      })();

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
            <VehicleDetailCard resolved={card} style={style} ctaUrl={cta_url} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
