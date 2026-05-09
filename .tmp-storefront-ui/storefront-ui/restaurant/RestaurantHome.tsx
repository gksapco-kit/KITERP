import { Link } from "react-router-dom";
import restoHero from "@/assets/restaurant-hero.jpg";
import { Marquee } from "@/components/site/Marquee";

const RestaurantHome = () => (
  <main>
    <section className="relative h-[88vh] min-h-[560px] overflow-hidden">
      <img src={restoHero} alt="A plated dish" className="absolute inset-0 w-full h-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-resto-bg/40 via-transparent to-resto-bg" />
      <div className="relative h-full max-w-7xl mx-auto px-6 lg:px-10 flex flex-col justify-end pb-20">
        <p className="text-xs uppercase tracking-[0.3em] text-resto-accent mb-6">Est. 2024 · Brooklyn</p>
        <h1 className="font-display font-light text-[clamp(3.5rem,11vw,11rem)] leading-[0.88] tracking-tight max-w-5xl">
          Seasonal,<br/>quietly <em className="font-serif-it text-resto-accent">seasonal.</em>
        </h1>
        <div className="mt-10 flex gap-4">
          <Link to="/restaurant/reserve" className="bg-resto-accent text-resto-bg px-6 py-3 rounded-full text-sm">Reserve a table</Link>
          <Link to="/restaurant/menu" className="border border-resto-ink/30 px-6 py-3 rounded-full text-sm">View tonight's menu</Link>
        </div>
      </div>
    </section>

    <section className="py-8 border-y border-resto-ink/10">
      <Marquee items={["Open Tue–Sun · 17:00–23:00","Counter seating from 17:00","Wine list updated weekly","Walk-ins welcome at the bar"]} />
    </section>

    <section className="max-w-5xl mx-auto px-6 lg:px-10 py-32 text-center">
      <p className="text-xs uppercase tracking-[0.3em] opacity-60 mb-8">Tonight</p>
      <h2 className="font-display text-5xl md:text-7xl leading-[1.05] mb-10">
        Charred leek,<br/>
        <em className="font-serif-it text-resto-accent">brown butter,</em><br/>
        toasted hazelnut.
      </h2>
      <p className="text-lg opacity-70 max-w-xl mx-auto leading-relaxed">A six-course tasting menu that changes with the markets. Eat what we found this morning.</p>
      <Link to="/restaurant/menu" className="inline-block mt-10 text-sm border-b border-resto-ink/30 pb-1">See the full menu →</Link>
    </section>

    <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-32 grid md:grid-cols-3 gap-px bg-resto-ink/15 rounded-3xl overflow-hidden">
      {[
        ["Dining Room","An eight-table room. Candlelight, low music, no rush."],
        ["The Counter","Six seats facing the open fire. Watch dinner happen."],
        ["Private","A back room for ten. Bring your people."],
      ].map(([h,d]) => (
        <div key={h} className="bg-resto-bg p-10">
          <h3 className="font-display text-3xl mb-3">{h}</h3>
          <p className="text-sm opacity-70 leading-relaxed">{d}</p>
        </div>
      ))}
    </section>
  </main>
);
export default RestaurantHome;
