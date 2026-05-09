import { Page, Section } from "../KitLayout";
import { ServiceCardGrid, ServiceList, PricingTiers } from "@/kit/services/ServiceBlocks";
import { mockServices } from "@/kit/mock";

export default function ServicesShowcase() {
  return (
    <Page title="Services" intro="Service cards, lists and pricing tiers.">
      <Section title="Service card grid"><ServiceCardGrid services={mockServices} columns={3} /></Section>
      <Section title="Service list"><ServiceList services={mockServices} /></Section>
      <Section title="Pricing tiers (highlight middle)">
        <PricingTiers tiers={[
          { name: "Starter", price: 999, period: "mo", features: ["Up to 100 bookings", "Email support", "1 location"], cta: { label: "Choose Starter", href: "#" } },
          { name: "Growth", price: 2499, period: "mo", features: ["Unlimited bookings", "Priority support", "5 locations", "Recurring & group flows"], highlight: true, cta: { label: "Choose Growth", href: "#" } },
          { name: "Scale", price: 6999, period: "mo", features: ["Multi-team", "API access", "SLA", "Custom integrations"], cta: { label: "Talk to sales", href: "#" } },
        ]} />
      </Section>
    </Page>
  );
}
