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

const CONDITION_STYLE: Record<Vehicle["condition"], string> = {
  New: "bg-success/15 text-success hover:bg-success/15",
  Certified: "bg-primary/15 text-primary hover:bg-primary/15",
  Used: "bg-secondary text-secondary-foreground",
};

interface AutoInventoryProps {
  layout?: "grid" | "list";
  showFilters?: boolean;
  cta?: string;
}

export function AutoInventory({
  layout = "grid",
  showFilters = true,
  cta = "View vehicle",
}: AutoInventoryProps) {
  const [maxPrice, setMaxPrice] = useState(90000);
  const filtered = mockVehicles.filter((v) => v.price <= maxPrice);

  return (
    <div className="bg-background p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Available inventory</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} vehicles match your filters</p>
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

      {layout === "list" ? (
        <div className="space-y-3">
          {filtered.map((v) => (
            <VehicleRow key={v.id} v={v} cta={cta} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <VehicleCard key={v.id} v={v} cta={cta} />
          ))}
        </div>
      )}
    </div>
  );
}

function VehicleCard({ v, cta }: { v: Vehicle; cta: string }) {
  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img src={v.image} alt={`${v.make} ${v.model}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        <Badge className={cn("absolute left-3 top-3 text-xs", CONDITION_STYLE[v.condition])}>
          {v.condition}
        </Badge>
        <button className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background">
          <Heart className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">
        <div className="text-xs text-muted-foreground">{v.year} · {v.bodyStyle}</div>
        <h3 className="text-base font-semibold">{v.make} {v.model}</h3>
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
        <Button variant="outline" size="sm" className="mt-3 w-full">{cta}</Button>
      </div>
    </div>
  );
}

function VehicleRow({ v, cta }: { v: Vehicle; cta: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-3 sm:flex-row">
      <div className="relative h-40 shrink-0 overflow-hidden rounded-md bg-muted sm:h-28 sm:w-44">
        <img src={v.image} alt="" className="h-full w-full object-cover" />
        <Badge className={cn("absolute left-2 top-2 text-xs", CONDITION_STYLE[v.condition])}>
          {v.condition}
        </Badge>
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
          <Button variant="outline" size="sm" className="ml-auto h-7 text-xs">{cta}</Button>
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

interface VehicleDetailProps {
  vehicleId?: string;
  cta?: string;
}

export function VehicleDetail({ vehicleId = "v1", cta = "Schedule test drive" }: VehicleDetailProps) {
  const v = mockVehicles.find((x) => x.id === vehicleId) ?? mockVehicles[0];
  const monthly = Math.round((v.price * 0.018) / 5);

  return (
    <div className="bg-background p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
            <img src={v.image} alt="" className="h-full w-full object-cover" />
            <Badge className={cn("absolute left-4 top-4", CONDITION_STYLE[v.condition])}>
              {v.condition}
            </Badge>
          </div>

          <div className="mt-5">
            <div className="text-xs text-muted-foreground">{v.year} · {v.bodyStyle}</div>
            <h1 className="text-2xl font-semibold">{v.make} {v.model}</h1>
            <p className="text-sm text-muted-foreground">{v.trim} · {v.exteriorColor}</p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-border p-4 sm:grid-cols-4">
            <Stat icon={Gauge} label="Mileage" value={`${v.mileage.toLocaleString()} mi`} />
            <Stat icon={Fuel} label="Fuel" value={v.fuel} />
            <Stat icon={Cog} label="Transmission" value={v.transmission} />
            <Stat icon={Car} label="Body" value={v.bodyStyle} />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold">Highlights</h3>
            <ul className="mt-2 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
              {[
                "One-owner, clean title",
                "Free CARFAX history report",
                "Multi-point safety inspection",
                "Remaining factory warranty",
                "Apple CarPlay & Android Auto",
                "Heated front seats",
              ].map((f) => (
                <li key={f} className="inline-flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Sale price</div>
            <div className="text-3xl font-semibold">{formatPrice(v.price, v.currency)}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              or <span className="font-medium text-foreground">${monthly.toLocaleString()}/mo</span> for 60 mo
            </div>
            <div className="mt-4 space-y-2">
              <Button className="w-full">
                <Calendar className="h-4 w-4" />
                {cta}
              </Button>
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
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Stock #</div>
            <div className="mt-1 font-mono text-sm">AC-{v.id.toUpperCase()}-{v.year}</div>
            <div className="mt-3 text-xs text-muted-foreground">
              Located at our Williamsburg showroom · Available for delivery
            </div>
          </div>
        </aside>
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
