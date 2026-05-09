import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const RestaurantReserve = () => {
  const { toast } = useToast();
  const [party, setParty] = useState(2);
  const times = ["17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30"];
  const [time, setTime] = useState("19:30");

  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-10 py-20">
      <p className="text-xs uppercase tracking-[0.3em] text-resto-accent mb-6">Reserve</p>
      <h1 className="font-display text-6xl md:text-7xl mb-4 leading-[1.05]">Hold a table.</h1>
      <p className="opacity-70 mb-12 max-w-md">Walk-ins are welcome at the counter. For the dining room, a reservation is kind.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); toast({title:"Table requested", description:`Party of ${party} at ${time}. We'll confirm shortly.`}); }}
        className="space-y-8 bg-resto-ink/5 p-8 md:p-10 rounded-3xl border border-resto-ink/10"
      >
        <div className="grid sm:grid-cols-2 gap-6">
          <label className="block">
            <span className="text-xs uppercase tracking-widest opacity-60">Date</span>
            <input type="date" required className="w-full mt-2 bg-transparent border-b border-resto-ink/20 py-2 text-resto-ink" />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest opacity-60">Party size</span>
            <div className="flex items-center gap-4 mt-2">
              <button type="button" onClick={()=>setParty(Math.max(1,party-1))} className="w-9 h-9 rounded-full border border-resto-ink/30">−</button>
              <span className="font-display text-2xl w-6 text-center">{party}</span>
              <button type="button" onClick={()=>setParty(Math.min(12,party+1))} className="w-9 h-9 rounded-full border border-resto-ink/30">+</button>
            </div>
          </label>
        </div>

        <div>
          <span className="text-xs uppercase tracking-widest opacity-60">Time</span>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
            {times.map(t => (
              <button type="button" key={t} onClick={()=>setTime(t)} className={`py-3 rounded-full text-sm border ${time===t ? "bg-resto-accent text-resto-bg border-resto-accent" : "border-resto-ink/20"}`}>{t}</button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <label className="block">
            <span className="text-xs uppercase tracking-widest opacity-60">Name</span>
            <input required className="w-full mt-2 bg-transparent border-b border-resto-ink/20 py-2" />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest opacity-60">Phone</span>
            <input required className="w-full mt-2 bg-transparent border-b border-resto-ink/20 py-2" />
          </label>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-widest opacity-60">Special requests</span>
          <textarea rows={3} className="w-full mt-2 bg-transparent border border-resto-ink/20 rounded-2xl p-3" placeholder="Allergies, occasion..." />
        </label>

        <button className="bg-resto-accent text-resto-bg w-full py-4 rounded-full text-sm">Request reservation</button>
      </form>
    </main>
  );
};
export default RestaurantReserve;
