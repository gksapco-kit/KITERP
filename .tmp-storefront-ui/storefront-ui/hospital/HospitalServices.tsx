import { Link } from "react-router-dom";

const all = [
  ["Cardiology","Heart, vessels, rhythm.","12"],
  ["Neurology","Brain, spine, nerves.","8"],
  ["Paediatrics","Newborn through 18.","14"],
  ["Family Medicine","Annual check-ups, day-to-day.","22"],
  ["Ophthalmology","Eye exams and surgery.","6"],
  ["Diagnostics","Labs, imaging, screening.","18"],
  ["Orthopaedics","Bones, joints, injury.","9"],
  ["Dermatology","Skin, hair, nails.","7"],
  ["Oncology","Cancer care, second opinions.","11"],
  ["Endocrinology","Hormones, thyroid, diabetes.","5"],
  ["Mental Health","Therapy and psychiatry.","16"],
  ["Maternity","Pregnancy and birth.","10"],
];

const HospitalServices = () => (
  <main className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
    <p className="text-xs uppercase tracking-[0.3em] text-hosp-accent mb-6">14 services</p>
    <h1 className="font-display text-6xl md:text-7xl mb-14 tracking-tight">Find the right care.</h1>
    <div className="divide-y divide-hosp-ink/15 border-y border-hosp-ink/15">
      {all.map(([n,d,c]) => (
        <Link key={n} to="/hospital/book" className="py-8 grid md:grid-cols-12 items-baseline gap-4 group">
          <div className="md:col-span-1 text-sm opacity-50">{c} drs</div>
          <h3 className="md:col-span-4 font-display text-3xl group-hover:text-hosp-accent transition">{n}</h3>
          <p className="md:col-span-5 opacity-70">{d}</p>
          <span className="md:col-span-2 text-sm md:text-right border-b border-hosp-ink/30 pb-0.5 inline-block">Book →</span>
        </Link>
      ))}
    </div>
  </main>
);
export default HospitalServices;
