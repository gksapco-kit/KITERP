import { ShoppingBag } from "lucide-react";
import { useCheckoutConfig } from "../config";

export function CheckoutHeader({ rightSlot }: { rightSlot?: React.ReactNode }) {
  const { storeName, logoUrl } = useCheckoutConfig();
  return (
    <header className="ck-border-b" style={{ background: "hsl(var(--surface))" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <a href="/" className="flex items-center gap-2 no-underline" style={{ color: "hsl(var(--text))" }}>
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} style={{ height: "var(--logo-height)" }} />
          ) : (
            <>
              <ShoppingBag size={20} />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18 }}>{storeName}</span>
            </>
          )}
        </a>
        {rightSlot}
      </div>
    </header>
  );
}

export function CheckoutFooter() {
  const { legalLinks, storeName } = useCheckoutConfig();
  return (
    <footer className="ck-border-t mt-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm md:flex-row md:items-center md:justify-between md:px-6">
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
