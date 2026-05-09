import { Outlet, Link } from "react-router-dom";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

const HospitalLayout = () => (
  <div className="min-h-screen bg-hosp-bg text-hosp-ink">
    <SiteHeader
      theme="hosp"
      brand="Solace"
      links={[
        { label: "Services", to: "/hospital/services" },
        { label: "Doctors", to: "/hospital" },
        { label: "Patient Portal", to: "/hospital" },
        { label: "Contact", to: "/hospital" },
      ]}
      cta={<Link to="/hospital/book" className="text-sm bg-hosp-accent text-hosp-bg px-4 py-2 rounded-full">Book appointment</Link>}
    />
    <Outlet />
    <SiteFooter theme="hosp" brand="Solace" tagline="A calmer kind of care." />
  </div>
);
export default HospitalLayout;
