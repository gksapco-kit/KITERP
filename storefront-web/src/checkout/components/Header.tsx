import { Link, useLocation } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useBranch } from "@/contexts/BranchContext";
import { useLayoutOwnsShell } from "@/contexts/LayoutOwnsShellContext";
import { useCheckoutConfig } from "../config";

function useHideCheckoutChrome(): boolean {
  const layoutOwnsShell = useLayoutOwnsShell();
  const { pathname } = useLocation();
  // Store routes already render UnifiedNav or builder NavBlock — avoid double headers.
  const isStoreRoute = /^\/store\/[^/]+/.test(pathname);
  return layoutOwnsShell || isStoreRoute;
}

export function CheckoutHeader({ rightSlot }: { rightSlot?: React.ReactNode }) {
  const { storeName, logoUrl } = useCheckoutConfig();
  const { storePath } = useBranch();
  const hideChrome = useHideCheckoutChrome();

  if (hideChrome) return null;

  return (
    <header className="ck-border-b" style={{ background: "hsl(var(--surface))" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-4 sm:py-4 md:px-6">
        <Link to={storePath("/")} className="flex min-w-0 items-center gap-2 no-underline" style={{ color: "hsl(var(--text))" }}>
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="max-h-[var(--logo-height)] w-auto max-w-[200px] object-contain sm:max-w-[280px]" style={{ height: "var(--logo-height)" }} />
          ) : (
            <>
              <ShoppingBag size={20} className="shrink-0" />
              <span className="truncate" style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18 }}>{storeName}</span>
            </>
          )}
        </Link>
        {rightSlot}
      </div>
    </header>
  );
}

export function CheckoutFooter() {
  const { legalLinks, storeName } = useCheckoutConfig();
  const hideChrome = useHideCheckoutChrome();

  if (hideChrome) return null;

  return (
    <footer className="ck-border-t mt-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-6 text-sm sm:px-4 md:flex-row md:items-center md:justify-between md:px-6">
        <span className="ck-text-subtle">
          © {new Date().getFullYear()} {storeName}
        </span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {legalLinks?.map((l) => (
            <a key={l.label} href={l.href} className="ck-text-muted no-underline hover:underline">
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
