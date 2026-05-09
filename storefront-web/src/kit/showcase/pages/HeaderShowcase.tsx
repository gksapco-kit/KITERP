import { Page, Section } from "../KitLayout";
import { UnifiedNav, AnnouncementBar } from "@/kit/header/UnifiedNav";
import { mockNavLinks, mockUser } from "@/kit/mock";

export default function HeaderShowcase() {
  return (
    <Page title="Header & Nav" intro="Unified header with optional search, cart and account. Replaces the broken NavBlock pattern.">
      <Section title="Full header — signed in">
        <div className="rounded-lg border overflow-hidden">
          <AnnouncementBar message="Free shipping over ₹999." ctaLabel="Shop now" ctaHref="/products" />
          <UnifiedNav links={mockNavLinks} cartCount={3} user={mockUser} cta={{ label: "Get started", href: "/sign-up" }} sticky={false} />
        </div>
      </Section>
      <Section title="Header — guest, no search">
        <div className="rounded-lg border overflow-hidden">
          <UnifiedNav links={mockNavLinks} cartCount={0} showSearch={false} sticky={false} />
        </div>
      </Section>
      <Section title="Centered logo, no cart">
        <div className="rounded-lg border overflow-hidden">
          <UnifiedNav links={mockNavLinks} variant="centered" showCart={false} sticky={false} />
        </div>
      </Section>
    </Page>
  );
}
