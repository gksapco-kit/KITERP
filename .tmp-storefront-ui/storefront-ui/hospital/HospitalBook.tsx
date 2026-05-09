import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const HospitalBook = () => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [service, setService] = useState("Family Medicine");
  const [doctor, setDoctor] = useState("Dr. Mei Ojala");
  const [time, setTime] = useState("10:30");

  const services = ["Cardiology","Family Medicine","Paediatrics","Dermatology","Ophthalmology"];
  const doctors = ["Dr. Mei Ojala","Dr. Idris Vargas","Dr. Helena Park"];
  const times = ["09:00","09:30","10:00","10:30","11:00","11:30","14:00","14:30","15:00","15:30","16:00","16:30"];

  return (
    <main className="max-w-4xl mx-auto px-6 lg:px-10 py-20">
      <p className="text-xs uppercase tracking-[0.3em] text-hosp-accent mb-6">Book an appointment</p>
      <h1 className="font-display text-5xl md:text-6xl mb-10 leading-[1.05]">Three small steps.</h1>

      <div className="flex gap-2 mb-10">
        {[1,2,3].map(n => (
          <div key={n} className={`flex-1 h-1 rounded-full ${n<=step ? "bg-hosp-accent" : "bg-hosp-ink/15"}`} />
        ))}
      </div>

      {step === 1 && (
        <section className="space-y-8">
          <div>
            <p className="text-sm opacity-60 mb-3">Service</p>
            <div className="flex flex-wrap gap-2">
              {services.map(s => (
                <button key={s} onClick={()=>setService(s)} className={`px-4 py-2 rounded-full border text-sm ${service===s ? "bg-hosp-accent text-hosp-bg border-hosp-accent" : "border-hosp-ink/20"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm opacity-60 mb-3">Doctor</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {doctors.map(d => (
                <button key={d} onClick={()=>setDoctor(d)} className={`p-4 rounded-2xl text-left border ${doctor===d ? "border-hosp-accent bg-hosp-accent/10" : "border-hosp-ink/15"}`}>
                  <div className="w-10 h-10 rounded-full bg-hosp-accent/30 mb-3" />
                  <p className="font-display text-lg">{d}</p>
                  <p className="text-xs opacity-60">15 yrs · English, Spanish</p>
                </button>
              ))}
            </div>
          </div>
          <button onClick={()=>setStep(2)} className="bg-hosp-accent text-hosp-bg px-6 py-3 rounded-full text-sm">Continue</button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-8">
          <div className="grid sm:grid-cols-2 gap-6">
            <label className="block">
              <span className="text-sm opacity-60">Date</span>
              <input type="date" required className="w-full mt-2 bg-transparent border-b border-hosp-ink/20 py-2" />
            </label>
            <label className="block">
              <span className="text-sm opacity-60">Visit type</span>
              <select className="w-full mt-2 bg-transparent border-b border-hosp-ink/20 py-2"><option>In-person</option><option>Telehealth</option></select>
            </label>
          </div>
          <div>
            <p className="text-sm opacity-60 mb-3">Available times</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {times.map(t => (
                <button key={t} onClick={()=>setTime(t)} className={`py-3 rounded-full border text-sm ${time===t ? "bg-hosp-accent text-hosp-bg border-hosp-accent" : "border-hosp-ink/20"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={()=>setStep(1)} className="border border-hosp-ink/20 px-6 py-3 rounded-full text-sm">Back</button>
            <button onClick={()=>setStep(3)} className="bg-hosp-accent text-hosp-bg px-6 py-3 rounded-full text-sm">Continue</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <form
          onSubmit={(e)=>{e.preventDefault(); toast({title:"Appointment requested", description:`${service} with ${doctor} at ${time}.`});}}
          className="space-y-6"
        >
          <div className="grid sm:grid-cols-2 gap-6">
            <label className="block"><span className="text-sm opacity-60">Full name</span><input required className="w-full mt-2 bg-transparent border-b border-hosp-ink/20 py-2"/></label>
            <label className="block"><span className="text-sm opacity-60">Date of birth</span><input type="date" required className="w-full mt-2 bg-transparent border-b border-hosp-ink/20 py-2"/></label>
            <label className="block"><span className="text-sm opacity-60">Email</span><input type="email" required className="w-full mt-2 bg-transparent border-b border-hosp-ink/20 py-2"/></label>
            <label className="block"><span className="text-sm opacity-60">Phone</span><input required className="w-full mt-2 bg-transparent border-b border-hosp-ink/20 py-2"/></label>
          </div>
          <label className="block"><span className="text-sm opacity-60">Reason for visit</span><textarea rows={3} className="w-full mt-2 bg-transparent border border-hosp-ink/20 rounded-2xl p-3"/></label>

          <div className="rounded-2xl bg-hosp-accent/10 p-5 text-sm">
            <p className="font-display text-lg mb-1">{service} · {doctor}</p>
            <p className="opacity-70">Today · {time} · In-person · Solace Main Campus</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={()=>setStep(2)} className="border border-hosp-ink/20 px-6 py-3 rounded-full text-sm">Back</button>
            <button className="bg-hosp-accent text-hosp-bg px-6 py-3 rounded-full text-sm">Confirm appointment</button>
          </div>
        </form>
      )}
    </main>
  );
};
export default HospitalBook;
