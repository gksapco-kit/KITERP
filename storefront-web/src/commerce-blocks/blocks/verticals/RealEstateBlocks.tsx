import {
  Bed,
  Bath,
  Maximize2,
  MapPin,
  Heart,
  Phone,
  Mail,
  Calendar,
  Home,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockProperties, type Property } from "@/commerce-blocks/mock/verticals";

const STATUS_LABEL: Record<Property["status"], { label: string; className: string }> = {
  "for-sale": { label: "For sale", className: "bg-secondary text-secondary-foreground" },
  "new": { label: "New", className: "bg-success/15 text-success hover:bg-success/15" },
  "open-house": { label: "Open house", className: "bg-warning/15 text-warning-foreground" },
  "pending": { label: "Pending", className: "bg-muted text-muted-foreground" },
};

interface PropertyListingProps {
  layout?: "grid" | "list" | "map";
  columns?: number;
  showAgent?: boolean;
  cta?: string;
}

export function PropertyListing({
  layout = "grid",
  columns = 3,
  showAgent = true,
  cta = "View details",
}: PropertyListingProps) {
  if (layout === "list") {
    return (
      <div className="bg-background p-6">
        <Header />
        <div className="space-y-3">
          {mockProperties.map((p) => (
            <PropertyRow key={p.id} property={p} showAgent={showAgent} cta={cta} />
          ))}
        </div>
      </div>
    );
  }

  if (layout === "map") {
    return (
      <div className="bg-background p-6">
        <Header />
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-gradient-to-br from-emerald-100 via-sky-100 to-amber-100 lg:aspect-auto lg:min-h-[500px]">
            {/* Decorative map */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute left-[20%] top-[30%] h-1 w-[60%] rotate-12 bg-foreground/40" />
              <div className="absolute left-[10%] top-[60%] h-1 w-[70%] -rotate-6 bg-foreground/40" />
              <div className="absolute left-[40%] top-[10%] h-[80%] w-1 rotate-6 bg-foreground/30" />
            </div>
            {mockProperties.slice(0, 5).map((p, i) => (
              <button
                key={p.id}
                className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
                style={{
                  left: `${15 + (i * 17) % 70}%`,
                  top: `${25 + (i * 23) % 55}%`,
                }}
              >
                <span className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background shadow-md">
                  {formatPrice(p.price / 1000, p.currency).replace(/\.\d+/, "")}K
                </span>
                <span className="h-2 w-2 rotate-45 -translate-y-1 bg-foreground" />
              </button>
            ))}
          </div>
          <div className="space-y-3 lg:max-h-[500px] lg:overflow-auto">
            {mockProperties.slice(0, 4).map((p) => (
              <PropertyRow key={p.id} property={p} showAgent={false} cta="View" compact />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // grid
  const cols =
    columns === 2 ? "sm:grid-cols-2"
    : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4"
    : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className="bg-background p-6">
      <Header />
      <div className={cn("grid grid-cols-1 gap-5", cols)}>
        {mockProperties.map((p) => (
          <PropertyCard key={p.id} property={p} showAgent={showAgent} cta={cta} />
        ))}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h2 className="text-xl font-semibold">Featured listings</h2>
        <p className="text-sm text-muted-foreground">{mockProperties.length} homes available in your area</p>
      </div>
      <Button variant="outline" size="sm">
        <MapPin className="h-4 w-4" />
        Refine search
      </Button>
    </div>
  );
}

function PropertyCard({ property, showAgent, cta }: { property: Property; showAgent: boolean; cta: string }) {
  const status = STATUS_LABEL[property.status];
  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img src={property.image} alt={property.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        <Badge className={cn("absolute left-3 top-3 text-xs", status.className)}>{status.label}</Badge>
        <button className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background">
          <Heart className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-semibold">{formatPrice(property.price, property.currency)}</span>
          <span className="text-xs uppercase text-muted-foreground">{property.type}</span>
        </div>
        <h3 className="mt-1 line-clamp-1 text-sm font-medium">{property.title}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">{property.address}</p>
        <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{property.beds}</span>
          <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{property.baths}</span>
          <span className="inline-flex items-center gap-1"><Maximize2 className="h-3.5 w-3.5" />{property.sqft.toLocaleString()} sqft</span>
        </div>
        {showAgent && property.agent && (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Listed by {property.agent}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs">{cta}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyRow({
  property,
  showAgent,
  cta,
  compact = false,
}: {
  property: Property;
  showAgent: boolean;
  cta: string;
  compact?: boolean;
}) {
  const status = STATUS_LABEL[property.status];
  return (
    <div className={cn("flex gap-4 rounded-lg border border-border bg-card p-3", compact && "p-2")}>
      <div className={cn("relative shrink-0 overflow-hidden rounded-md bg-muted", compact ? "h-20 w-28" : "h-32 w-44")}>
        <img src={property.image} alt={property.title} className="h-full w-full object-cover" />
        <Badge className={cn("absolute left-1.5 top-1.5 text-xs", status.className)}>{status.label}</Badge>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={cn("font-semibold", compact ? "text-sm" : "text-lg")}>
              {formatPrice(property.price, property.currency)}
            </div>
            <h3 className="line-clamp-1 text-sm font-medium">{property.title}</h3>
            <p className="line-clamp-1 text-xs text-muted-foreground">{property.address}</p>
          </div>
          {!compact && showAgent && property.agent && (
            <Button variant="outline" size="sm">{cta}</Button>
          )}
        </div>
        <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{property.beds}</span>
          <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{property.baths}</span>
          <span className="inline-flex items-center gap-1"><Maximize2 className="h-3.5 w-3.5" />{property.sqft.toLocaleString()} sqft</span>
          <span className="inline-flex items-center gap-1 capitalize"><Home className="h-3.5 w-3.5" />{property.type}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Property detail ---------- */

interface PropertyDetailProps {
  propertyId?: string;
  cta?: string;
}

export function PropertyDetail({ propertyId = "re1", cta = "Schedule tour" }: PropertyDetailProps) {
  const p = mockProperties.find((x) => x.id === propertyId) ?? mockProperties[0];
  const status = STATUS_LABEL[p.status];

  return (
    <div className="bg-background p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
            <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
            <Badge className={cn("absolute left-4 top-4", status.className)}>{status.label}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[4/3] overflow-hidden rounded-md bg-muted">
                <img src={p.image} alt="" className="h-full w-full object-cover opacity-80" />
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-1">
            <div className="text-3xl font-semibold">{formatPrice(p.price, p.currency)}</div>
            <h1 className="text-xl font-medium">{p.title}</h1>
            <div className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {p.address}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 rounded-lg border border-border p-4">
            <Stat icon={Bed} label="Bedrooms" value={p.beds} />
            <Stat icon={Bath} label="Bathrooms" value={p.baths} />
            <Stat icon={Maximize2} label="Sq ft" value={p.sqft.toLocaleString()} />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold">About this home</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A meticulously restored {p.type} on a quiet, tree-lined block. Original
              hardwood, restored crown moldings, and a chef's kitchen open to a sun-filled
              great room. The primary suite features a soaking tub and walk-in closet.
              Steps from transit, parks, and neighborhood favorites.
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border p-5">
            {p.agent && (
              <>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Listing agent</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
                    {p.agent.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{p.agent}</div>
                    <div className="text-xs text-muted-foreground">Lic. #2104882</div>
                  </div>
                </div>
              </>
            )}
            <div className="mt-4 space-y-2">
              <Button className="w-full">
                <Calendar className="h-4 w-4" />
                {cta}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm">
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </Button>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Estimated mortgage</div>
            <div className="mt-2 text-2xl font-semibold">
              {formatPrice(Math.round(p.price * 0.005), p.currency)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Based on 20% down, 30-yr fixed @ 6.8%</p>
            <Button variant="outline" className="mt-3 w-full" size="sm">Get pre-approved</Button>
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
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}
