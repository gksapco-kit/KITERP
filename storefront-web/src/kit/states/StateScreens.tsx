import { Link } from "react-router-dom";
import { ShoppingCart, Search, Heart, Calendar, Package, AlertTriangle, WifiOff, Wrench, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon, title, description, action,
}: { icon?: React.ReactNode; title: string; description?: string; action?: { label: string; href: string } }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        {icon ?? <Package />}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>}
      {action && <Button asChild className="mt-5"><Link to={action.href}>{action.label}</Link></Button>}
    </div>
  );
}

export const EmptyCart = () => <EmptyState icon={<ShoppingCart />} title="Your cart is empty" description="Browse the catalogue to add your first item." action={{ label: "Shop now", href: "/products" }} />;
export const EmptySearch = () => <EmptyState icon={<Search />} title="No results found" description="Try a different keyword or browse categories." />;
export const EmptyWishlist = () => <EmptyState icon={<Heart />} title="No wishlist items" description="Save products you love to find them later." action={{ label: "Browse products", href: "/products" }} />;
export const EmptyBookings = () => <EmptyState icon={<Calendar />} title="No bookings yet" description="Book a service and it will appear here." action={{ label: "Book a service", href: "/services" }} />;
export const EmptyOrders = () => <EmptyState icon={<Package />} title="No orders yet" description="Once you place an order it will show here." />;
export const OutOfStock = () => <EmptyState icon={<AlertTriangle />} title="Out of stock" description="This product is unavailable. Notify me when back in stock." />;

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-square w-full rounded-none" />
          <CardContent className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-8 w-full mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-md border">
      <div className="p-3 border-b"><Skeleton className="h-5 w-40" /></div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-3 flex gap-4 items-center">
            <Skeleton className="h-10 w-10 rounded" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorScreen({
  code, title, description, action,
}: { code: string; title: string; description?: string; action?: { label: string; href: string } }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center space-y-3 max-w-md">
        <div className="text-6xl font-bold text-muted-foreground">{code}</div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {action && <Button asChild><Link to={action.href}>{action.label}</Link></Button>}
      </div>
    </div>
  );
}

export const NotFoundScreen = () => <ErrorScreen code="404" title="Page not found" description="The page you are looking for doesn't exist." action={{ label: "Go home", href: "/" }} />;
export const ServerErrorScreen = () => <ErrorScreen code="500" title="Something broke on our end" description="Our team has been notified. Please try again." action={{ label: "Reload", href: "/" }} />;
export const ForbiddenScreen = () => <ErrorScreen code="403" title="Access denied" description="You don't have permission to view this page." action={{ label: "Sign in", href: "/sign-in" }} />;
export const NetworkErrorScreen = () => (
  <div className="min-h-[40vh] flex items-center justify-center p-6">
    <div className="text-center space-y-3"><WifiOff className="h-10 w-10 mx-auto text-muted-foreground" /><h2 className="text-lg font-semibold">No internet connection</h2><p className="text-sm text-muted-foreground">Check your network and try again.</p></div>
  </div>
);
export const MaintenanceScreen = () => (
  <div className="min-h-[60vh] flex items-center justify-center p-6">
    <div className="text-center space-y-3"><Wrench className="h-10 w-10 mx-auto text-muted-foreground" /><h2 className="text-2xl font-semibold">We'll be back soon</h2><p className="text-sm text-muted-foreground">Scheduled maintenance in progress.</p></div>
  </div>
);
export const LockedScreen = () => <ErrorScreen code="🔒" title="Locked" description="This content is restricted." />;
