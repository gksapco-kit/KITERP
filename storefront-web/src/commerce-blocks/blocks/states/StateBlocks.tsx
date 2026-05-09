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
  preset?: EmptyPreset;
  size?: "sm" | "md" | "lg";
  showSecondary?: boolean;
}

export function EmptyState({
  preset = "emptyCart",
  size = "md",
  showSecondary = true,
}: EmptyStateProps) {
  const p = EMPTY_PRESETS[preset];
  const Icon = p.icon;

  const sizes = {
    sm: { wrap: "py-10", icon: "h-10 w-10 p-2.5", title: "text-base", desc: "text-xs" },
    md: { wrap: "py-16", icon: "h-14 w-14 p-3.5", title: "text-lg", desc: "text-sm" },
    lg: { wrap: "py-24", icon: "h-20 w-20 p-5", title: "text-2xl", desc: "text-base" },
  }[size];

  return (
    <div className="bg-background">
      <div className={cn("flex flex-col items-center justify-center px-6 text-center", sizes.wrap)}>
        {/* Decorative circles */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="absolute inset-0 -m-3 rounded-full bg-accent/30" />
          <div className="absolute inset-0 -m-1.5 rounded-full bg-accent/50" />
          <div
            className={cn(
              "relative flex items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border",
              sizes.icon,
            )}
          >
            <Icon className="h-full w-full" />
          </div>
        </div>
        <h3 className={cn("font-semibold", sizes.title)}>{p.title}</h3>
        <p className={cn("mt-1 max-w-sm text-muted-foreground", sizes.desc)}>{p.description}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button>
            <Plus className="h-4 w-4" />
            {p.primaryCta}
          </Button>
          {showSecondary && p.secondaryCta && (
            <Button variant="outline">{p.secondaryCta}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Skeleton loaders ---------- */

interface SkeletonLoaderProps {
  preset?: "productGrid" | "productList" | "detail" | "cart" | "calendar" | "table";
  count?: number;
}

export function SkeletonLoader({ preset = "productGrid", count = 6 }: SkeletonLoaderProps) {
  if (preset === "productGrid") return <SkProductGrid count={count} />;
  if (preset === "productList") return <SkProductList count={count} />;
  if (preset === "detail") return <SkDetail />;
  if (preset === "cart") return <SkCart count={count} />;
  if (preset === "calendar") return <SkCalendar />;
  return <SkTable count={count} />;
}

function SkProductGrid({ count }: { count: number }) {
  return (
    <div className="bg-background p-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-3">
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

function SkProductList({ count }: { count: number }) {
  return (
    <div className="bg-background p-6">
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-lg border border-border p-4">
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

function SkDetail() {
  return (
    <div className="bg-background p-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
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

function SkCart({ count }: { count: number }) {
  return (
    <div className="bg-background p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-lg border border-border p-4">
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
        <div className="space-y-3 rounded-lg border border-border p-5">
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

function SkCalendar() {
  return (
    <div className="bg-background p-6">
      <div className="mx-auto max-w-md space-y-4">
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

function SkTable({ count }: { count: number }) {
  return (
    <div className="bg-background p-6">
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex gap-4 border-b border-border bg-muted/30 p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-border p-3 last:border-b-0">
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
  preset?: ErrorPreset;
  layout?: "full" | "card";
  showSecondary?: boolean;
}

export function ErrorState({
  preset = "generic",
  layout = "full",
  showSecondary = true,
}: ErrorStateProps) {
  const e = ERROR_PRESETS[preset];
  const Icon = e.icon;

  const Body = (
    <>
      <div className="relative mb-4 flex items-center justify-center">
        <div className="absolute inset-0 -m-3 rounded-full bg-destructive/10" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-card text-destructive ring-1 ring-destructive/20">
          <Icon className="h-7 w-7" />
        </div>
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-destructive">
        {e.code}
      </div>
      <h3 className="mt-1 text-xl font-semibold">{e.title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{e.description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button>
          <RefreshCw className="h-4 w-4" />
          {e.cta}
        </Button>
        {showSecondary && (
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
        )}
      </div>
    </>
  );

  if (layout === "card") {
    return (
      <div className="bg-background p-6">
        <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          {Body}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center">
        {Body}
      </div>
    </div>
  );
}
