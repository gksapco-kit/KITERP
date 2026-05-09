import { Link } from "react-router-dom";
import { ArrowRight, Star, ShieldCheck, Truck, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function HeroBlock({
  eyebrow, title, subtitle, image, primary, secondary,
}: {
  eyebrow?: string; title: string; subtitle?: string; image?: string;
  primary?: { label: string; href: string }; secondary?: { label: string; href: string };
}) {
  return (
    <section className="grid lg:grid-cols-2 gap-8 items-center py-12">
      <div className="space-y-5">
        {eyebrow && <Badge variant="secondary">{eyebrow}</Badge>}
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-lg text-muted-foreground max-w-xl">{subtitle}</p>}
        <div className="flex gap-3">
          {primary && <Button asChild size="lg"><Link to={primary.href}>{primary.label} <ArrowRight /></Link></Button>}
          {secondary && <Button asChild size="lg" variant="outline"><Link to={secondary.href}>{secondary.label}</Link></Button>}
        </div>
      </div>
      {image && <img src={image} alt="" className="w-full rounded-2xl aspect-square object-cover" />}
    </section>
  );
}

export function CTABlock({ title, subtitle, primary }: { title: string; subtitle?: string; primary: { label: string; href: string } }) {
  return (
    <section className="rounded-2xl bg-primary text-primary-foreground p-8 md:p-12 text-center space-y-4">
      <h2 className="text-2xl md:text-3xl font-semibold">{title}</h2>
      {subtitle && <p className="opacity-90 max-w-xl mx-auto">{subtitle}</p>}
      <Button asChild size="lg" variant="secondary"><Link to={primary.href}>{primary.label}</Link></Button>
    </section>
  );
}

export function FeaturesBlock({ items }: { items: { icon?: React.ReactNode; title: string; description: string }[] }) {
  return (
    <section className="grid gap-6 md:grid-cols-3">
      {items.map((it) => (
        <Card key={it.title}><CardContent className="p-6 space-y-2">
          <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">{it.icon ?? <Star className="h-4 w-4" />}</div>
          <div className="font-semibold">{it.title}</div>
          <p className="text-sm text-muted-foreground">{it.description}</p>
        </CardContent></Card>
      ))}
    </section>
  );
}

export function StatsBlock({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-2xl border p-6">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <div className="text-3xl font-semibold">{s.value}</div>
          <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
        </div>
      ))}
    </section>
  );
}

export function TestimonialsBlock({ items }: { items: { quote: string; name: string; role?: string; avatarUrl?: string }[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {items.map((t, i) => (
        <Card key={i}><CardContent className="p-6 space-y-3">
          <div className="flex gap-1 text-yellow-500">{Array.from({ length: 5 }).map((_, j) => <Star key={j} className="h-4 w-4 fill-current" />)}</div>
          <p className="text-sm">"{t.quote}"</p>
          <div className="flex items-center gap-2 pt-2">
            {t.avatarUrl && <img src={t.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />}
            <div className="text-sm"><div className="font-medium">{t.name}</div>{t.role && <div className="text-xs text-muted-foreground">{t.role}</div>}</div>
          </div>
        </CardContent></Card>
      ))}
    </section>
  );
}

export function NewsletterBlock() {
  return (
    <section className="rounded-2xl border p-8 text-center space-y-3">
      <h3 className="text-xl font-semibold">Subscribe to our newsletter</h3>
      <p className="text-sm text-muted-foreground">Monthly product updates, no spam.</p>
      <form onSubmit={(e) => e.preventDefault()} className="flex gap-2 max-w-md mx-auto">
        <Input type="email" placeholder="you@example.com" required />
        <Button type="submit">Subscribe</Button>
      </form>
    </section>
  );
}

export function TrustLogosBlock({ logos }: { logos: string[] }) {
  return (
    <section className="grid grid-cols-3 md:grid-cols-6 gap-6 items-center opacity-70">
      {logos.map((l) => <div key={l} className="text-center text-sm font-semibold tracking-widest">{l}</div>)}
    </section>
  );
}

export function FAQBlock({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section className="max-w-3xl mx-auto divide-y rounded-lg border">
      {items.map((it) => (
        <details key={it.q} className="p-4 group">
          <summary className="cursor-pointer font-medium flex justify-between items-center">{it.q}<span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span></summary>
          <p className="mt-2 text-sm text-muted-foreground">{it.a}</p>
        </details>
      ))}
    </section>
  );
}

export function MarqueeStrip({ items }: { items: string[] }) {
  return (
    <div className="overflow-hidden border-y bg-muted/30 py-3">
      <div className="flex gap-10 whitespace-nowrap animate-[marquee_25s_linear_infinite]">
        {[...items, ...items].map((it, i) => <span key={i} className="text-sm text-muted-foreground">{it}</span>)}
      </div>
      <style>{`@keyframes marquee { from {transform:translateX(0)} to {transform:translateX(-50%)} }`}</style>
    </div>
  );
}

export function PaymentMethodsStrip() {
  return (
    <div className="flex flex-wrap items-center gap-2 justify-center text-xs text-muted-foreground">
      {["Visa", "Mastercard", "Amex", "UPI", "PayPal", "Razorpay", "Stripe"].map((p) => (
        <span key={p} className="px-2 py-1 rounded border bg-background">{p}</span>
      ))}
    </div>
  );
}

export function TrustRow() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { icon: Truck, label: "Free shipping over ₹999" },
        { icon: ShieldCheck, label: "Secure payments" },
        { icon: Award, label: "2-year warranty" },
      ].map(({ icon: Icon, label }) => (
        <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div>
      ))}
    </div>
  );
}
