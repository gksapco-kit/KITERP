import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";

const sections = [
  { to: "/kit", label: "Overview", end: true },
  { to: "/kit/header", label: "Header & Nav" },
  { to: "/kit/footer", label: "Footer" },
  { to: "/kit/products", label: "Products" },
  { to: "/kit/services", label: "Services" },
  { to: "/kit/bookings", label: "Bookings" },
  { to: "/kit/checkout", label: "Checkout & Payments" },
  { to: "/kit/account", label: "Account" },
  { to: "/kit/blog", label: "Blog" },
  { to: "/kit/marketing", label: "Marketing blocks" },
  { to: "/kit/states", label: "State screens" },
];

export default function KitLayout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r bg-muted/20 p-4 sticky top-0 h-screen overflow-auto hidden md:block">
        <div className="px-2 py-3">
          <div className="text-lg font-semibold">ERP UI Kit</div>
          <p className="text-xs text-muted-foreground mt-1">Drop-in components for your ERP.</p>
        </div>
        <nav className="mt-2 flex flex-col gap-1">
          {sections.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                cn(
                  "px-3 py-2 rounded-md text-sm hover:bg-muted",
                  isActive && "bg-primary text-primary-foreground hover:bg-primary",
                )
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-b py-10 px-6 md:px-10">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

export function Page({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div>
      <header className="px-6 md:px-10 py-8 border-b bg-background sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
          {intro && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{intro}</p>}
        </div>
      </header>
      {children}
    </div>
  );
}
