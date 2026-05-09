import { Link } from "react-router-dom";
import { Page, Section } from "../KitLayout";

const groups = [
  { title: "Storefront shell", items: [["Header & Nav", "/kit/header"], ["Footer", "/kit/footer"]] },
  { title: "Commerce", items: [["Products", "/kit/products"], ["Checkout & Payments", "/kit/checkout"], ["Account", "/kit/account"]] },
  { title: "Services", items: [["Services", "/kit/services"], ["Bookings", "/kit/bookings"]] },
  { title: "Content & marketing", items: [["Blog", "/kit/blog"], ["Marketing blocks", "/kit/marketing"]] },
  { title: "System", items: [["State screens", "/kit/states"]] },
] as const;

export default function KitOverview() {
  return (
    <Page title="ERP UI Kit" intro="A drop-in, presentational component library you can copy into your ERP. Pure props in, callbacks out — no data fetching inside components.">
      <Section title="Categories">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.title} className="rounded-lg border p-5">
              <div className="text-sm font-semibold mb-3">{g.title}</div>
              <ul className="space-y-1">
                {g.items.map(([label, href]) => (
                  <li key={href}><Link to={href} className="text-sm text-primary hover:underline">{label} →</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Conventions">
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>Built on shadcn/ui + Tailwind tokens. Theme via <code>src/index.css</code>.</li>
          <li>Each block accepts data via props and emits actions via callbacks (<code>onAddToCart</code>, <code>onBook</code>, <code>onPay</code>…).</li>
          <li>Mock data lives in <code>src/kit/mock.ts</code>. Delete when integrating with your ERP APIs.</li>
          <li>Types in <code>src/kit/types.ts</code> — map them to your ERP DTOs.</li>
        </ul>
      </Section>
    </Page>
  );
}
