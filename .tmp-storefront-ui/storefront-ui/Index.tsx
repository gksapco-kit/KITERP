import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import retailHero from "@/assets/retail-hero.jpg";
import restoHero from "@/assets/restaurant-hero.jpg";
import hospHero from "@/assets/hospital-hero.jpg";
import gradientBg from "@/assets/gradient-bg.jpg";

const templates = [
  { id: "retail", name: "Atelier", kind: "Online Retail", desc: "Editorial commerce for fashion, home & lifestyle.", img: retailHero, to: "/retail", tone: "Warm linen", count: "12 sections" },
  { id: "resto", name: "Verde", kind: "Restaurant", desc: "Moody, candlelit menu & reservations.", img: restoHero, to: "/restaurant", tone: "Forest green", count: "9 sections" },
  { id: "hosp", name: "Solace", kind: "Hospital", desc: "Calm healthcare with appointment booking.", img: hospHero, to: "/hospital", tone: "Sage clinical", count: "10 sections" },
];

const Index = () => (
  <div className="min-h-screen bg-background text-foreground">
    {/* Top bar */}
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <span className="font-display text-2xl tracking-tight">Storefronts<span className="text-accent">.</span></span>
        <nav className="hidden md:flex gap-8 text-sm opacity-70">
          <a href="#templates">Templates</a>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
        </nav>
        <a href="#templates" className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-full hover:opacity-90 transition">Browse</a>
      </div>
    </header>

    {/* HERO */}
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-20 pb-28 grid lg:grid-cols-12 gap-10 items-end">
        <div className="lg:col-span-8 reveal-up">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-60 mb-8">
            <span className="w-8 h-px bg-current" /> ERP Storefront Library · 2026
          </div>
          <h1 className="font-display font-light tracking-[-0.03em] text-[clamp(3rem,9vw,9rem)] leading-[0.92]">
            Pick a <span className="font-serif-it text-accent">storefront.</span><br/>
            Plug in your <em className="font-serif-it">ERP</em>.<br/>
            Open today.
          </h1>
        </div>
        <div className="lg:col-span-4 lg:pb-6">
          <p className="text-lg leading-relaxed opacity-75 max-w-sm">
            Three meticulously crafted, trend-forward web fronts — Retail, Restaurant, Hospital — wired to the same back office your team already runs.
          </p>
        </div>
      </div>

      <div className="relative h-[60vh] min-h-[380px] mx-6 lg:mx-10 rounded-[2rem] overflow-hidden grain">
        <img src={gradientBg} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent" />
        <div className="absolute bottom-8 left-8 right-8 flex flex-wrap items-end justify-between gap-4 text-primary-foreground">
          <p className="font-display text-3xl md:text-5xl max-w-2xl leading-tight">One back office. <em className="font-serif-it">Infinite</em> customer experiences.</p>
          <div className="text-xs uppercase tracking-widest opacity-80">↓ Scroll to explore</div>
        </div>
      </div>
    </section>

    {/* MARQUEE strip */}
    <section className="py-10 border-y border-border">
      <div className="marquee-mask overflow-hidden">
        <div className="ticker flex gap-16 whitespace-nowrap w-max font-display text-2xl">
          {Array(2).fill(0).map((_,r)=> (
            <span key={r} className="flex gap-16">
              <span>Inventory sync</span><span className="opacity-30">●</span>
              <span>POS connected</span><span className="opacity-30">●</span>
              <span>Real-time orders</span><span className="opacity-30">●</span>
              <span>Multi-location</span><span className="opacity-30">●</span>
              <span>Built-in loyalty</span><span className="opacity-30">●</span>
            </span>
          ))}
        </div>
      </div>
    </section>

    {/* Templates */}
    <section id="templates" className="max-w-7xl mx-auto px-6 lg:px-10 py-28">
      <div className="flex items-end justify-between mb-14">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-4">Three verticals</p>
          <h2 className="font-display text-5xl md:text-7xl tracking-tight">The collection.</h2>
        </div>
        <p className="hidden md:block max-w-xs text-sm opacity-70">Each template ships with home, listing & detail pages — and a soul of its own.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {templates.map((t, i) => (
          <Link key={t.id} to={t.to} className="group relative block rounded-3xl overflow-hidden bg-secondary aspect-[4/5] reveal-up" style={{ animationDelay: `${i*120}ms` }}>
            <img src={t.img} alt={t.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/20 to-transparent" />
            <div className="absolute top-5 left-5 right-5 flex justify-between text-primary-foreground text-xs uppercase tracking-widest">
              <span>0{i+1} / {t.kind}</span>
              <span className="opacity-70">{t.count}</span>
            </div>
            <div className="absolute bottom-6 left-6 right-6 text-primary-foreground">
              <h3 className="font-display text-5xl mb-2">{t.name}</h3>
              <p className="opacity-80 mb-6 max-w-[20ch]">{t.desc}</p>
              <span className="inline-flex items-center gap-2 text-sm border-b border-current/40 pb-1 group-hover:gap-4 transition-all">
                Preview template <ArrowUpRight className="w-4 h-4" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>

    {/* HOW */}
    <section id="how" className="bg-secondary">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-28 grid md:grid-cols-12 gap-10">
        <h2 className="md:col-span-5 font-display text-5xl md:text-6xl leading-[1.05] tracking-tight">
          From login<br/>to live in <em className="font-serif-it text-accent">an afternoon</em>.
        </h2>
        <ol className="md:col-span-7 grid sm:grid-cols-2 gap-8">
          {[
            ["01","Pick a vertical","Owner selects Retail, Restaurant or Hospital from the ERP dashboard."],
            ["02","Brand it","Logo, colors, copy and hero imagery — no developer required."],
            ["03","Sync inventory","Products, menus or services pull from the ERP in real time."],
            ["04","Open for business","Public URL, custom domain, payments and receipts already wired."],
          ].map(([n,t,d]) => (
            <li key={n} className="border-t border-border pt-5">
              <span className="text-xs opacity-50">{n}</span>
              <h3 className="font-display text-2xl mt-1 mb-2">{t}</h3>
              <p className="text-sm opacity-70 leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>

    {/* features grid */}
    <section id="features" className="max-w-7xl mx-auto px-6 lg:px-10 py-28">
      <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-4">Inside every template</p>
      <h2 className="font-display text-5xl md:text-6xl mb-14 tracking-tight">Everything connected.</h2>
      <div className="grid md:grid-cols-3 gap-px bg-border rounded-3xl overflow-hidden">
        {[
          ["Real-time inventory","Stock, prices and availability sync straight from your ERP — no double entry."],
          ["Unified orders","Web, in-store and phone orders land in the same queue with the same SLAs."],
          ["Customer 360","Loyalty, history and preferences travel with the guest across touchpoints."],
          ["Multi-location","Switch storefronts, kitchens or clinics from a single owner cockpit."],
          ["Payments built-in","Cards, wallets and split payments — refunds reconciled automatically."],
          ["Reports that move","Dashboards refresh as orders happen. Decide before the day ends."],
        ].map(([h,d],i) => (
          <div key={i} className="bg-background p-10">
            <span className="text-xs opacity-50">0{i+1}</span>
            <h3 className="font-display text-2xl mt-2 mb-3">{h}</h3>
            <p className="text-sm opacity-70 leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-28">
      <div className="rounded-[2rem] bg-primary text-primary-foreground p-12 md:p-20 grain relative overflow-hidden">
        <h2 className="font-display text-5xl md:text-7xl max-w-3xl leading-[1.02]">
          Ready to dress up<br/>your <em className="font-serif-it text-accent">ERP?</em>
        </h2>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link to="/retail" className="bg-accent text-accent-foreground px-6 py-3 rounded-full text-sm hover:opacity-90 transition">Open Retail demo</Link>
          <Link to="/restaurant" className="border border-current/30 px-6 py-3 rounded-full text-sm hover:bg-current/10 transition">Restaurant demo</Link>
          <Link to="/hospital" className="border border-current/30 px-6 py-3 rounded-full text-sm hover:bg-current/10 transition">Hospital demo</Link>
        </div>
      </div>
    </section>

    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 flex justify-between text-xs opacity-60">
        <span>© 2026 ERP Storefronts</span>
        <span>Three templates. One back office.</span>
      </div>
    </footer>
  </div>
);

export default Index;
