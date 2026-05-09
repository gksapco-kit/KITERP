import { Page, Section } from "../KitLayout";
import {
  HeroBlock, CTABlock, FeaturesBlock, StatsBlock, TestimonialsBlock, NewsletterBlock,
  TrustLogosBlock, FAQBlock, MarqueeStrip, PaymentMethodsStrip, TrustRow,
} from "@/kit/marketing/MarketingBlocks";
import { Calendar, ShieldCheck, Truck } from "lucide-react";

export default function MarketingShowcase() {
  return (
    <Page title="Marketing blocks" intro="Composable hero, CTA, features, stats, testimonials, FAQ, newsletter and more.">
      <Section title="Hero">
        <HeroBlock eyebrow="New release" title="Run your store and your services from one place" subtitle="The all-in-one ERP for modern commerce, bookings and back office." image="https://picsum.photos/seed/hero/800/800" primary={{ label: "Get started", href: "#" }} secondary={{ label: "See pricing", href: "#" }} />
      </Section>
      <Section title="Features"><FeaturesBlock items={[
        { icon: <Truck className="h-4 w-4" />, title: "Faster fulfilment", description: "Pick, pack and ship in minutes, not hours." },
        { icon: <Calendar className="h-4 w-4" />, title: "Smart bookings", description: "Group, recurring and waitlist flows out of the box." },
        { icon: <ShieldCheck className="h-4 w-4" />, title: "Built-in trust", description: "Secure payments and PCI-aware checkout." },
      ]} /></Section>
      <Section title="Stats"><StatsBlock stats={[{ label: "Orders / day", value: "12k+" }, { label: "Bookings / mo", value: "3.4M" }, { label: "Uptime", value: "99.99%" }, { label: "Countries", value: "42" }]} /></Section>
      <Section title="Testimonials"><TestimonialsBlock items={[
        { quote: "Replaced four tools in a quarter.", name: "Mira Iyer", role: "Ops Lead, Lumen" },
        { quote: "Recurring bookings alone paid for the year.", name: "Devansh Rao", role: "Owner, Studio 21" },
        { quote: "The cleanest ERP UI I've used.", name: "Noor Khan", role: "CTO, Hatch" },
      ]} /></Section>
      <Section title="CTA"><CTABlock title="Ready to consolidate your stack?" subtitle="Talk to our team or start a 14-day trial." primary={{ label: "Start free trial", href: "#" }} /></Section>
      <Section title="Trust logos"><TrustLogosBlock logos={["ACME", "LUMEN", "HATCH", "STUDIO21", "NORTH", "VESPER"]} /></Section>
      <Section title="FAQ"><FAQBlock items={[
        { q: "Can I import my existing data?", a: "Yes — CSV import for products, services, customers and bookings." },
        { q: "Do you support multi-location?", a: "Growth plan and above support up to 5 locations; Scale is unlimited." },
      ]} /></Section>
      <Section title="Newsletter"><NewsletterBlock /></Section>
      <Section title="Marquee strip"><MarqueeStrip items={["Free shipping over ₹999", "30-day returns", "24/7 support", "Trusted by 12,000+ teams"]} /></Section>
      <Section title="Payment methods strip"><PaymentMethodsStrip /></Section>
      <Section title="Trust row"><TrustRow /></Section>
    </Page>
  );
}
