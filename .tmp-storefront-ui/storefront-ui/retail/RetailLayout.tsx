import { Outlet, Link } from "react-router-dom";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

const RetailLayout = () => (
  <div className="min-h-screen bg-retail-bg text-retail-ink">
    <SiteHeader
      theme="retail"
      brand="Atelier"
      links={[
        { label: "Shop", to: "/retail/shop" },
        { label: "Journal", to: "/retail" },
        { label: "About", to: "/retail" },
        { label: "Stores", to: "/retail" },
      ]}
      cta={
        <Link to="/retail/shop" className="text-sm bg-retail-ink text-retail-bg px-4 py-2 rounded-full">Bag (0)</Link>
      }
    />
    <Outlet />
    <SiteFooter theme="retail" brand="Atelier" tagline="Slow goods for fast lives." />
  </div>
);
export default RetailLayout;
