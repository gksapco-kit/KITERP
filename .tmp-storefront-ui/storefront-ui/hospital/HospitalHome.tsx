import { Link } from "react-router-dom";
import hospHero from "@/assets/hospital-hero.jpg";
import { Heart, Stethoscope, Activity, Brain, Baby, Eye } from "lucide-react";

const services = [
  { i: Heart, name: "Cardiology" },
  { i: Brain, name: "Neurology" },
  { i: Baby, name: "Paediatrics" },
  { i: Stethoscope, name: "Family Medicine" },
  { i: Eye, name: "Ophthalmology" },
  { i: Activity, name: "Diagnostics" },
];

const HospitalHome = () => (
  <main>
    <section className="px-6 lg:px-10 pt-12 pb-20">
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
          <p className="text-xs uppercase tracking-[0.3em] text-hosp-accent mb-6">Independent care · since 1998</p>
          <h1 className="font-display font-light text-[clamp(3rem,8.5vw,8rem)] leading-[0.92] tracking-tight">
            Quiet rooms.<br/>
            <em className="font-serif-it text-hosp-accent">Patient</em> hands.<br/>
            Modern medicine.
          </h1>
          <p className="mt-8 max-w-md text-lg opacity-75 leading-relaxed">A 90-bed independent hospital built around the unhurried appointment. Same-day bookings across 14 specialties.</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/hospital/book" className="bg-hosp-accent text-hosp-bg px-6 py-3 rounded-full text-sm">Book an appointment</Link>
            <Link to="/hospital/services" className="border border-hosp-ink/20 px-6 py-3 rounded-full text-sm">Browse services</Link>
          </div>
        </div>
        <div className="lg:col-span-5 relative aspect-[4/5] rounded-3xl overflow-hidden grain">
          <img src={hospHero} alt="Hospital corridor" className="w-full h-full object-cover" />
        </div>
      </div>
    </section>

    <section className="bg-hosp-ink text-hosp-bg py-6">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 grid sm:grid-cols-3 gap-6 text-sm">
        <div><span className="text-hosp-accent">●</span> Emergency open 24/7 · +1 (212) 555 0142</div>
        <div className="opacity-80">Walk-in lab · Mon–Sat 7:00–19:00</div>
        <div className="opacity-80">Pharmacy on site</div>
      </div>
    </section>

    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
      <div className="flex items-end justify-between mb-10">
        <h2 className="font-display text-5xl md:text-6xl tracking-tight">Care, by department.</h2>
        <Link to="/hospital/services" className="text-sm border-b border-hosp-ink/30 pb-1">All 14 services →</Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-hosp-ink/15 rounded-3xl overflow-hidden">
        {services.map(({i:Icon,name}) => (
          <Link to="/hospital/book" key={name} className="bg-hosp-bg p-8 hover:bg-hosp-accent/5 transition group">
            <Icon className="w-8 h-8 text-hosp-accent mb-6" />
            <h3 className="font-display text-2xl mb-2">{name}</h3>
            <p className="text-sm opacity-70">Same-day & next-day appointments. 12 specialists.</p>
            <span className="inline-block mt-4 text-sm border-b border-hosp-ink/30 pb-0.5 group-hover:border-hosp-accent">Book →</span>
          </Link>
        ))}
      </div>
    </section>

    <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-24">
      <div className="rounded-3xl bg-hosp-accent/10 p-10 md:p-16 grid md:grid-cols-3 gap-10">
        {[["120+","specialists in residence"],["14","departments under one roof"],["98%","of patients seen on time"]].map(([n,d]) => (
          <div key={n}>
            <div className="font-display text-6xl md:text-7xl text-hosp-accent">{n}</div>
            <p className="opacity-70 mt-2">{d}</p>
          </div>
        ))}
      </div>
    </section>
  </main>
);
export default HospitalHome;
