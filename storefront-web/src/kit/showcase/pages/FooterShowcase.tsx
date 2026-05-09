import { Page, Section } from "../KitLayout";
import { ColumnFooter } from "@/kit/footer/ColumnFooter";

const columns = [
  { title: "Shop", links: [{ label: "All products", href: "/products" }, { label: "New arrivals", href: "/products?sort=new" }, { label: "Bestsellers", href: "/products?sort=top" }] },
  { title: "Help", links: [{ label: "Shipping", href: "/help/shipping" }, { label: "Returns", href: "/help/returns" }, { label: "Contact", href: "/contact" }] },
  { title: "Company", links: [{ label: "About", href: "/about" }, { label: "Careers", href: "/careers" }, { label: "Blog", href: "/blog" }] },
];

export default function FooterShowcase() {
  return (
    <Page title="Footer" intro="Multi-column footer with real anchor/router links (fixes the span-only bug).">
      <Section title="Full footer — newsletter + payments + social">
        <div className="rounded-lg border overflow-hidden">
          <ColumnFooter variant="full" description="The operating system for modern commerce, services and bookings." columns={columns} />
        </div>
      </Section>
      <Section title="Standard footer">
        <div className="rounded-lg border overflow-hidden">
          <ColumnFooter variant="standard" description="A streamlined footer for content-heavy sites." columns={columns} />
        </div>
      </Section>
      <Section title="Simple footer">
        <div className="rounded-lg border overflow-hidden">
          <ColumnFooter variant="simple" columns={columns} showSocial={false} />
        </div>
      </Section>
    </Page>
  );
}
