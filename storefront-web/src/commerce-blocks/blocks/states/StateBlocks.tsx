import {
  PackageOpen,
  ShoppingCart,
  Search,
  Heart,
  CalendarX,
  WifiOff,
  AlertTriangle,
  ServerCrash,
  Lock,
  Construction,
  Inbox,
  RefreshCw,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { normalizeVerticalVariant } from "@/commerce-blocks/lib/verticalVariants";

/* ---------- Empty state (configurable) ---------- */

const EMPTY_PRESETS = {
  emptyCart: {
    icon: ShoppingCart,
    title: "Your cart is empty",
    description: "Looks like you haven't added anything yet. Browse our latest arrivals.",
    primaryCta: "Start shopping",
    secondaryCta: "View wishlist",
  },
  noResults: {
    icon: Search,
    title: "No results found",
    description: "Try adjusting your filters or searching for something else.",
    primaryCta: "Clear filters",
    secondaryCta: "Browse all",
  },
  emptyWishlist: {
    icon: Heart,
    title: "Your wishlist is empty",
    description: "Save items you love and we'll keep them right here for next time.",
    primaryCta: "Browse products",
    secondaryCta: "",
  },
  noBookings: {
    icon: CalendarX,
    title: "No bookings yet",
    description: "Your upcoming appointments will appear here once you book.",
    primaryCta: "Book a session",
    secondaryCta: "",
  },
  noOrders: {
    icon: Inbox,
    title: "No orders yet",
    description: "When you place your first order, it'll show up here.",
    primaryCta: "Continue shopping",
    secondaryCta: "",
  },
  outOfStock: {
    icon: PackageOpen,
    title: "Currently out of stock",
    description: "We're restocking this soon. Get notified the moment it's back.",
    primaryCta: "Notify me",
    secondaryCta: "Browse alternatives",
  },
} as const;

type EmptyPreset = keyof typeof EMPTY_PRESETS;

interface EmptyStateProps {
  variant?: string;
  preset?: EmptyPreset;
  size?: "sm" | "md" | "lg";
  showSecondary?: boolean;
  title?: string;
  description?: string;
  cta?: string;
  cta_url?: string;
  secondary_cta?: string;
  secondary_cta_url?: string;
}

export function EmptyState({
  variant,
  preset = "emptyCart",
  size = "md",
  showSecondary = true,
  title,
  description,
  cta,
  cta_url,
  secondary_cta,
  secondary_cta_url,
}: EmptyStateProps) {
  const v = normalizeVerticalVariant(variant);
  const p = EMPTY_PRESETS[preset];
  const Icon = p.icon;

  const titleText = title ?? p.title;
  const descText = description ?? p.description;
  const ctaText = cta ?? p.primaryCta;
  const secondaryText = secondary_cta ?? p.secondaryCta;

  const sizes = {
    sm: { title: "text-base", desc: "text-xs" },
    md: { title: "text-lg", desc: "text-sm" },
    lg: { title: "text-2xl", desc: "text-base" },
  }[size];

  const PrimaryButton = ctaText ? (
    <Button asChild={!!cta_url}>
      {cta_url ? (
        <a href={cta_url}>
          <Plus className="h-4 w-4" />
          {ctaText}
        </a>
      ) : (
        <>
          <Plus className="h-4 w-4" />
          {ctaText}
        </>
      )}
    </Button>
  ) : null;

  const SecondaryButton = showSecondary && secondaryText ? (
    <Button variant="outline" asChild={!!secondary_cta_url}>
      {secondary_cta_url ? <a href={secondary_cta_url}>{secondaryText}</a> : <>{secondaryText}</>}
    </Button>
  ) : null;

  const Buttons = (justify: string = "justify-center") => (
    <div className={cn("mt-5 flex flex-wrap items-center gap-2", justify)}>
      {PrimaryButton}
      {SecondaryButton}
    </div>
  );

  const ICON_DIMS: Record<"sm" | "md" | "lg", string> = {
    sm: "h-10 w-10 p-2.5",
    md: "h-14 w-14 p-3.5",
    lg: "h-20 w-20 p-5",
  };

  const IconBadge = (dims: "sm" | "md" | "lg" = size, dark = false) => (
    <div className="relative flex items-center justify-center">
      <div className={cn("absolute inset-0 -m-3 rounded-full", dark ? "bg-white/10" : "bg-accent/30")} />
      <div className={cn("absolute inset-0 -m-1.5 rounded-full", dark ? "bg-white/10" : "bg-accent/50")} />
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full ring-1",
          ICON_DIMS[dims],
          dark ? "bg-white/10 text-white ring-white/20" : "bg-card text-muted-foreground ring-border",
        )}
      >
        <Icon className="h-full w-full" />
      </div>
    </div>
  );

  if (v === "card" || v === "featured") {
    return (
      <div className="bg-background p-6">
        <div
          className={cn(
            "mx-auto flex max-w-md flex-col items-center p-8 text-center",
            v === "featured" ? "rounded-2xl border-2 border-primary/20 bg-card shadow-lg" : "rounded-xl border border-border bg-card shadow-sm",
          )}
        >
          <div className="mb-4">{IconBadge(v === "featured" ? "lg" : "md")}</div>
          {titleText && <h3 className={cn("font-semibold", sizes.title)}>{titleText}</h3>}
          {descText && <p className={cn("mt-1 max-w-sm text-muted-foreground", sizes.desc)}>{descText}</p>}
          {Buttons()}
        </div>
      </div>
    );
  }

  if (v === "minimal") {
    return (
      <div className="bg-background px-6 py-14 text-center">
        {titleText && <h3 className={cn("font-medium", sizes.title)}>{titleText}</h3>}
        {descText && <p className={cn("mx-auto mt-2 max-w-sm text-muted-foreground", sizes.desc)}>{descText}</p>}
        {Buttons()}
      </div>
    );
  }

  if (v === "compact") {
    return (
      <div className="bg-background p-6">
        <div className="mx-auto flex max-w-lg items-center gap-4 rounded-lg border border-border bg-card p-4">
          {IconBadge("sm")}
          <div className="min-w-0 flex-1 text-left">
            {titleText && <h3 className="text-sm font-semibold">{titleText}</h3>}
            {descText && <p className="line-clamp-1 text-xs text-muted-foreground">{descText}</p>}
          </div>
          {Buttons("justify-end shrink-0")}
        </div>
      </div>
    );
  }

  if (v === "list") {
    return (
      <div className="bg-background p-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-lg bg-accent/10 p-4 ring-1 ring-accent/30 sm:flex-row sm:text-left">
          {IconBadge("sm")}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            {titleText && <h3 className="text-sm font-semibold">{titleText}</h3>}
            {descText && <p className="text-xs text-muted-foreground">{descText}</p>}
          </div>
          {Buttons("justify-center sm:justify-end shrink-0")}
        </div>
      </div>
    );
  }

  if (v === "split") {
    return (
      <div className="bg-background p-6">
        <div className="mx-auto grid max-w-3xl grid-cols-1 overflow-hidden rounded-xl border border-border md:grid-cols-2">
          <div className="flex items-center justify-center bg-accent/20 p-10">
            {IconBadge("lg")}
          </div>
          <div className="flex flex-col justify-center p-8 text-left">
            {titleText && <h3 className={cn("font-semibold", sizes.title)}>{titleText}</h3>}
            {descText && <p className={cn("mt-2 text-muted-foreground", sizes.desc)}>{descText}</p>}
            {Buttons("justify-start")}
          </div>
        </div>
      </div>
    );
  }

  if (v === "editorial") {
    return (
      <div className="bg-background px-6 py-16">
        <div className="mx-auto max-w-2xl border-t-2 border-foreground pt-6 text-left">
          {titleText && <h3 className="text-2xl font-semibold">{titleText}</h3>}
          {descText && <p className="mt-3 max-w-md text-sm text-muted-foreground">{descText}</p>}
          {Buttons("justify-start")}
        </div>
      </div>
    );
  }

  if (v === "hero") {
    return (
      <div className="bg-foreground px-6 py-24 text-center text-background">
        <div className="mx-auto max-w-lg">
          <div className="mb-5 flex justify-center">{IconBadge("lg", true)}</div>
          {titleText && <h3 className="mt-2 text-3xl font-bold">{titleText}</h3>}
          {descText && <p className="mx-auto mt-3 max-w-sm text-sm text-background/70">{descText}</p>}
          {Buttons()}
        </div>
      </div>
    );
  }

  if (v === "grid") {
    return (
      <div className="bg-background bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-[length:20px_20px] px-6 py-16 text-center">
        <div className="mx-auto max-w-md rounded-xl bg-background/90 p-6 backdrop-blur-sm">
          <div className="mb-4 flex justify-center">{IconBadge("md")}</div>
          {titleText && <h3 className={cn("font-semibold", sizes.title)}>{titleText}</h3>}
          {descText && <p className={cn("mt-1 text-muted-foreground", sizes.desc)}>{descText}</p>}
          {Buttons()}
        </div>
      </div>
    );
  }

  const wrapPad = { sm: "py-10", md: "py-16", lg: "py-24" }[size];
  return (
    <div className="bg-background">
      <div className={cn("flex flex-col items-center justify-center px-6 text-center", wrapPad)}>
        <div className="mb-4">{IconBadge(size)}</div>
        {titleText && <h3 className={cn("font-semibold", sizes.title)}>{titleText}</h3>}
        {descText && <p className={cn("mt-1 max-w-sm text-muted-foreground", sizes.desc)}>{descText}</p>}
        {Buttons()}
      </div>
    </div>
  );
}

/* ---------- Skeleton loaders ---------- */

interface SkeletonStyle {
  wrapClass: string;
  gap: string;
  columns: number;
  cardClass: string;
  dark: boolean;
}

function skeletonVariantStyle(variant: unknown): SkeletonStyle {
  const v = normalizeVerticalVariant(variant);
  switch (v) {
    case "compact":
      return { wrapClass: "bg-background p-4", gap: "gap-2", columns: 5, cardClass: "", dark: false };
    case "featured":
      return { wrapClass: "bg-background p-8", gap: "gap-6", columns: 3, cardClass: "rounded-xl border border-border p-3 shadow-sm", dark: false };
    case "minimal":
      return { wrapClass: "bg-background p-10", gap: "gap-8", columns: 3, cardClass: "", dark: false };
    case "card":
      return { wrapClass: "bg-background p-6", gap: "gap-5", columns: 3, cardClass: "rounded-xl border border-border bg-card p-3 shadow-md", dark: false };
    case "split":
      return { wrapClass: "bg-background p-6", gap: "gap-4", columns: 2, cardClass: "rounded-lg border border-border p-3", dark: false };
    case "editorial":
      return { wrapClass: "bg-background p-10", gap: "gap-6", columns: 2, cardClass: "border-b border-border pb-4", dark: false };
    case "list":
      return { wrapClass: "bg-background p-6", gap: "gap-3", columns: 1, cardClass: "rounded-lg border border-border p-3", dark: false };
    case "grid":
      return { wrapClass: "bg-background p-6", gap: "gap-3", columns: 5, cardClass: "rounded-lg border border-border p-2", dark: false };
    case "hero":
      return { wrapClass: "bg-foreground p-10", gap: "gap-6", columns: 3, cardClass: "rounded-xl border border-white/10 p-3", dark: true };
    case "default":
    default:
      return { wrapClass: "bg-background p-6", gap: "gap-4", columns: 4, cardClass: "", dark: false };
  }
}

function skGridColsClass(n: number): string {
  const map: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6",
  };
  return map[n] ?? map[4];
}

interface SkeletonLoaderProps {
  variant?: string;
  preset?: "productGrid" | "productList" | "detail" | "cart" | "calendar" | "table";
  count?: number;
}

export function SkeletonLoader({ variant, preset = "productGrid", count = 6 }: SkeletonLoaderProps) {
  const style = skeletonVariantStyle(variant);
  const content = (() => {
    if (preset === "productGrid") return <SkProductGrid count={count} style={style} />;
    if (preset === "productList") return <SkProductList count={count} style={style} />;
    if (preset === "detail") return <SkDetail style={style} />;
    if (preset === "cart") return <SkCart count={count} style={style} />;
    if (preset === "calendar") return <SkCalendar style={style} />;
    return <SkTable count={count} style={style} />;
  })();

  return (
    <div className={cn(style.dark && "[&_.animate-pulse]:bg-white/15")}>
      {content}
    </div>
  );
}

function SkProductGrid({ count, style }: { count: number; style: SkeletonStyle }) {
  return (
    <div className={style.wrapClass}>
      <div className={cn("grid", skGridColsClass(style.columns), style.gap)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cn("space-y-3", style.cardClass)}>
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkProductList({ count, style }: { count: number; style: SkeletonStyle }) {
  return (
    <div className={style.wrapClass}>
      <div className={cn("flex flex-col", style.gap)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cn("flex gap-4 p-4", style.cardClass || "rounded-lg border border-border")}>
            <Skeleton className="h-20 w-20 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkDetail({ style }: { style: SkeletonStyle }) {
  return (
    <div className={style.wrapClass}>
      <div className={cn("grid lg:grid-cols-2", style.gap)}>
        <Skeleton className={cn("aspect-square w-full", style.cardClass)} />
        <div className="space-y-4">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-6 w-1/4" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="flex gap-2 pt-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
          </div>
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

function SkCart({ count, style }: { count: number; style: SkeletonStyle }) {
  return (
    <div className={style.wrapClass}>
      <div className={cn("grid lg:grid-cols-[1fr_320px]", style.gap)}>
        <div className={cn("flex flex-col", style.gap)}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className={cn("flex items-center gap-4 p-4", style.cardClass || "rounded-lg border border-border")}>
              <Skeleton className="h-16 w-16" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
        <div className={cn("space-y-3 p-5", style.cardClass || "rounded-lg border border-border")}>
          <Skeleton className="h-4 w-1/2" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          ))}
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

function SkCalendar({ style }: { style: SkeletonStyle }) {
  return (
    <div className={style.wrapClass}>
      <div className={cn("mx-auto max-w-md space-y-4", style.cardClass)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkTable({ count, style }: { count: number; style: SkeletonStyle }) {
  return (
    <div className={style.wrapClass}>
      <div className={cn("overflow-hidden", style.cardClass || "rounded-lg border border-border")}>
        <div className={cn("flex gap-4 border-b border-border bg-muted/30 p-3", style.gap)}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cn("flex gap-4 border-b border-border p-3 last:border-b-0", style.gap)}>
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Error states ---------- */

const ERROR_PRESETS = {
  generic: {
    icon: AlertTriangle,
    code: "Oops",
    title: "Something went wrong",
    description: "We hit an unexpected snag. Try again, or contact support if it persists.",
    cta: "Try again",
  },
  network: {
    icon: WifiOff,
    code: "Offline",
    title: "Can't reach the network",
    description: "Check your connection and try again. Your changes are saved locally.",
    cta: "Retry",
  },
  notFound: {
    icon: Search,
    code: "404",
    title: "We couldn't find that",
    description: "The page or product you're looking for has moved or no longer exists.",
    cta: "Back to home",
  },
  serverError: {
    icon: ServerCrash,
    code: "500",
    title: "Our servers are having a moment",
    description: "We're on it. Please try again in a few seconds.",
    cta: "Refresh",
  },
  forbidden: {
    icon: Lock,
    code: "403",
    title: "You don't have access here",
    description: "Sign in with the right account, or ask an admin to invite you.",
    cta: "Sign in",
  },
  maintenance: {
    icon: Construction,
    code: "Hold tight",
    title: "We'll be right back",
    description: "Quick maintenance in progress. Check back in a few minutes.",
    cta: "Check status",
  },
} as const;

type ErrorPreset = keyof typeof ERROR_PRESETS;

interface ErrorStateProps {
  variant?: string;
  preset?: ErrorPreset;
  /** @deprecated use `variant` — kept so older saved sections keep working. */
  layout?: "full" | "card";
  showSecondary?: boolean;
  error_code?: string;
  title?: string;
  description?: string;
  cta?: string;
  cta_url?: string;
  secondary_cta?: string;
  secondary_cta_url?: string;
}

export function ErrorState({
  variant,
  preset = "generic",
  layout,
  showSecondary = true,
  error_code,
  title,
  description,
  cta,
  cta_url,
  secondary_cta,
  secondary_cta_url,
}: ErrorStateProps) {
  const v = normalizeVerticalVariant(variant ?? (layout === "card" ? "card" : "default"));
  const e = ERROR_PRESETS[preset];
  const Icon = e.icon;

  const codeText = error_code ?? e.code;
  const titleText = title ?? e.title;
  const descText = description ?? e.description;
  const ctaText = cta ?? e.cta;
  const secondaryText = secondary_cta ?? "Go back";

  const PrimaryButton = ctaText ? (
    <Button asChild={!!cta_url}>
      {cta_url ? (
        <a href={cta_url}>
          <RefreshCw className="h-4 w-4" />
          {ctaText}
        </a>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          {ctaText}
        </>
      )}
    </Button>
  ) : null;

  const SecondaryButton = showSecondary && secondaryText ? (
    <Button variant="outline" asChild={!!secondary_cta_url}>
      {secondary_cta_url ? (
        <a href={secondary_cta_url}>
          <ArrowLeft className="h-4 w-4" />
          {secondaryText}
        </a>
      ) : (
        <>
          <ArrowLeft className="h-4 w-4" />
          {secondaryText}
        </>
      )}
    </Button>
  ) : null;

  const Buttons = (justify: string = "justify-center") => (
    <div className={cn("mt-5 flex flex-wrap items-center gap-2", justify)}>
      {PrimaryButton}
      {SecondaryButton}
    </div>
  );

  const IconBadge = (size: "sm" | "md" | "lg" = "md", dark = false) => {
    const dims = { sm: "h-10 w-10", md: "h-14 w-14", lg: "h-20 w-20" }[size];
    const iconDims = { sm: "h-5 w-5", md: "h-7 w-7", lg: "h-10 w-10" }[size];
    return (
      <div className="relative flex items-center justify-center">
        <div className={cn("absolute inset-0 -m-3 rounded-full", dark ? "bg-white/10" : "bg-destructive/10")} />
        <div
          className={cn(
            "relative flex items-center justify-center rounded-full ring-1",
            dims,
            dark ? "bg-white/10 text-white ring-white/20" : "bg-card text-destructive ring-destructive/20",
          )}
        >
          <Icon className={iconDims} />
        </div>
      </div>
    );
  };

  const CodeLabel = (dark = false) =>
    codeText && (
      <div className={cn("text-xs font-medium uppercase tracking-wider", dark ? "text-white/70" : "text-destructive")}>
        {codeText}
      </div>
    );

  if (v === "card" || v === "featured") {
    return (
      <div className="bg-background p-6">
        <div
          className={cn(
            "mx-auto flex max-w-md flex-col items-center p-8 text-center",
            v === "featured" ? "rounded-2xl border-2 border-destructive/20 bg-card shadow-lg" : "rounded-xl border border-border bg-card shadow-sm",
          )}
        >
          <div className="mb-4">{IconBadge(v === "featured" ? "lg" : "md")}</div>
          {CodeLabel()}
          {titleText && <h3 className="mt-1 text-xl font-semibold">{titleText}</h3>}
          {descText && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{descText}</p>}
          {Buttons()}
        </div>
      </div>
    );
  }

  if (v === "minimal") {
    return (
      <div className="bg-background px-6 py-14 text-center">
        {CodeLabel()}
        {titleText && <h3 className="mt-1 text-lg font-medium">{titleText}</h3>}
        {descText && <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{descText}</p>}
        {Buttons()}
      </div>
    );
  }

  if (v === "compact") {
    return (
      <div className="bg-background p-6">
        <div className="mx-auto flex max-w-lg items-center gap-4 rounded-lg border border-border bg-card p-4">
          {IconBadge("sm")}
          <div className="min-w-0 flex-1 text-left">
            {titleText && <h3 className="text-sm font-semibold">{titleText}</h3>}
            {descText && <p className="line-clamp-1 text-xs text-muted-foreground">{descText}</p>}
          </div>
          {Buttons("justify-end shrink-0")}
        </div>
      </div>
    );
  }

  if (v === "list") {
    return (
      <div className="bg-background p-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-lg bg-destructive/5 p-4 ring-1 ring-destructive/20 sm:flex-row sm:text-left">
          {IconBadge("sm")}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            {titleText && <h3 className="text-sm font-semibold">{titleText}</h3>}
            {descText && <p className="text-xs text-muted-foreground">{descText}</p>}
          </div>
          {Buttons("justify-center sm:justify-end shrink-0")}
        </div>
      </div>
    );
  }

  if (v === "split") {
    return (
      <div className="bg-background p-6">
        <div className="mx-auto grid max-w-3xl grid-cols-1 overflow-hidden rounded-xl border border-border md:grid-cols-2">
          <div className="flex items-center justify-center bg-foreground p-10">
            {IconBadge("lg", true)}
          </div>
          <div className="flex flex-col justify-center p-8 text-left">
            {CodeLabel()}
            {titleText && <h3 className="mt-1 text-xl font-semibold">{titleText}</h3>}
            {descText && <p className="mt-2 text-sm text-muted-foreground">{descText}</p>}
            {Buttons("justify-start")}
          </div>
        </div>
      </div>
    );
  }

  if (v === "editorial") {
    return (
      <div className="bg-background px-6 py-16">
        <div className="mx-auto max-w-2xl border-t-2 border-foreground pt-6 text-left">
          {codeText && <div className="text-6xl font-bold tracking-tight text-muted-foreground/30">{codeText}</div>}
          {titleText && <h3 className="mt-2 text-2xl font-semibold">{titleText}</h3>}
          {descText && <p className="mt-3 max-w-md text-sm text-muted-foreground">{descText}</p>}
          {Buttons("justify-start")}
        </div>
      </div>
    );
  }

  if (v === "hero") {
    return (
      <div className="bg-foreground px-6 py-24 text-center text-background">
        <div className="mx-auto max-w-lg">
          <div className="mb-5 flex justify-center">{IconBadge("lg", true)}</div>
          {codeText && <div className="text-xs font-medium uppercase tracking-widest text-background/60">{codeText}</div>}
          {titleText && <h3 className="mt-2 text-3xl font-bold">{titleText}</h3>}
          {descText && <p className="mx-auto mt-3 max-w-sm text-sm text-background/70">{descText}</p>}
          {Buttons()}
        </div>
      </div>
    );
  }

  if (v === "grid") {
    return (
      <div
        className="bg-background bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-[length:20px_20px] px-6 py-16 text-center"
      >
        <div className="mx-auto max-w-md rounded-xl bg-background/90 p-6 backdrop-blur-sm">
          <div className="mb-4 flex justify-center">{IconBadge("md")}</div>
          {CodeLabel()}
          {titleText && <h3 className="mt-1 text-xl font-semibold">{titleText}</h3>}
          {descText && <p className="mt-2 text-sm text-muted-foreground">{descText}</p>}
          {Buttons()}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4">{IconBadge("md")}</div>
        {CodeLabel()}
        {titleText && <h3 className="mt-1 text-xl font-semibold">{titleText}</h3>}
        {descText && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{descText}</p>}
        {Buttons()}
      </div>
    </div>
  );
}
