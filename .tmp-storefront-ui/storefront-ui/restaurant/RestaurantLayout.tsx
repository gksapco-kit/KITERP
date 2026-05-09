import { Outlet, Link } from "react-router-dom";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

const RestaurantLayout = () => (
  <div className="min-h-screen bg-resto-bg text-resto-ink">
    <SiteHeader
      theme="resto"
      brand="Verde"
      links={[
        { label: "Menu", to: "/restaurant/menu" },
        { label: "Reserve", to: "/restaurant/reserve" },
        { label: "About", to: "/restaurant" },
        { label: "Private Dining", to: "/restaurant" },
      ]}
      cta={<Link to="/restaurant/reserve" className="text-sm bg-resto-accent text-resto-ink px-4 py-2 rounded-full">Book a table</Link>}
    />
    <Outlet />
    <SiteFooter theme="resto" brand="Verde" tagline="A small green room that serves dinner." />
  </div>
);
export default RestaurantLayout;
