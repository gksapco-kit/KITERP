import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import retailHero from "@/assets/retail-hero.jpg";
import { Marquee } from "@/components/site/Marquee";

const products = [
  { id: "linen-shirt", name: "Stonewashed Linen Shirt", price: "$148", tag: "New" },
  { id: "ceramic-vase", name: "Hand-thrown Vessel No. 3", price: "$92", tag: "" },
  { id: "wool-throw", name: "Undyed Merino Throw", price: "$220", tag: "Limited" },
  { id: "leather-tote", name: "Vegetable-tanned Tote", price: "$310", tag: "" },
];

const RetailHome = () => (
  <main>
    {/* Hero */}
    <section className="px-6 lg:px-10 pt-10 pb-16">
      <div className="grid lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 relative aspect-[4/5] lg:aspect-auto rounded-3xl overflow-hidden grain">
          <img src={retailHero} alt="Editorial product still life" className="w-full h-full object-cover" />
        </div>
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-6">Spring Edit · Vol 04</p>
            <h1 className="font-display font-light tracking-[-0.02em] text-[clamp(3rem,7vw,6.5rem)] leading-[0.95]">
              Quiet objects<br/>for <em className="font-serif-it text-retail-accent">loud</em> seasons.
            </h1>
            <p className="mt-8 text-lg leading-relaxed opacity-75 max-w-md">
              A small collection of garments and homewares, made by hand in studios we know by name.
            </p>
          </div>
          <div className="mt-10 flex gap-4">
            <Link to="/retail/shop" className="bg-retail-ink text-retail-bg px-6 py-3 rounded-full text-sm inline-flex items-center gap-2">Shop the edit <ArrowUpRight className="w-4 h-4" /></Link>
            <Link to="/retail/shop" className="border border-retail-ink/20 px-6 py-3 rounded-full text-sm">Lookbook</Link>
          </div>
        </div>
      </div>
    </section>

    <section className="py-8 border-y border-retail-ink/10">
      <Marquee items={["Free returns within 30 days","Made in small batches","Carbon-aware shipping","New drops every Friday"]} />
    </section>

    {/* Featured grid */}
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
      <div className="flex items-end justify-between mb-10">
        <h2 className="font-display text-5xl md:text-6xl tracking-tight">Featured.</h2>
        <Link to="/retail/shop" className="text-sm border-b border-retail-ink/30 pb-1">See all 124 →</Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {products.map(p => (
          <Link key={p.id} to={`/retail/product/${p.id}`} className="group">
            <div className="aspect-[3/4] bg-secondary rounded-2xl mb-4 overflow-hidden relative">
              <div className="w-full h-full bg-gradient-to-br from-secondary to-muted group-hover:scale-105 transition-transform duration-700" />
              {p.tag && <span className="absolute top-3 left-3 text-[10px] uppercase tracking-widest bg-retail-ink text-retail-bg px-2 py-1 rounded-full">{p.tag}</span>}
            </div>
            <div className="flex justify-between text-sm">
              <span>{p.name}</span>
              <span className="opacity-70">{p.price}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>

    {/* Editorial split */}
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 grid md:grid-cols-2 gap-10 items-center">
      <div className="aspect-[4/5] rounded-3xl bg-gradient-to-br from-retail-accent/30 to-secondary" />
      <div>
        <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-4">A note from the studio</p>
        <h2 className="font-display text-5xl md:text-6xl mb-6 leading-[1.05]">Made slowly,<br/><em className="font-serif-it">on purpose.</em></h2>
        <p className="text-lg opacity-75 leading-relaxed mb-8">Every piece passes through fewer than ten hands. We think that shows.</p>
        <Link to="/retail/shop" className="text-sm border-b border-retail-ink/30 pb-1">Read the journal →</Link>
      </div>
    </section>
  </main>
);
export default RetailHome;
