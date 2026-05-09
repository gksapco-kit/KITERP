import { Page, Section } from "../KitLayout";
import {
  EmptyCart, EmptySearch, EmptyWishlist, EmptyBookings, EmptyOrders, OutOfStock,
  ProductGridSkeleton, TableSkeleton,
  NotFoundScreen, ServerErrorScreen, ForbiddenScreen, NetworkErrorScreen, MaintenanceScreen,
} from "@/kit/states/StateScreens";

export default function StatesShowcase() {
  return (
    <Page title="State screens" intro="Empty states, skeleton loaders and error pages.">
      <Section title="Empty states">
        <div className="grid md:grid-cols-2 gap-4">
          {[<EmptyCart />, <EmptySearch />, <EmptyWishlist />, <EmptyBookings />, <EmptyOrders />, <OutOfStock />].map((el, i) => (
            <div key={i} className="rounded-lg border">{el}</div>
          ))}
        </div>
      </Section>
      <Section title="Skeleton — product grid"><ProductGridSkeleton /></Section>
      <Section title="Skeleton — table"><TableSkeleton /></Section>
      <Section title="Error pages">
        <div className="grid md:grid-cols-2 gap-4">
          {[<NotFoundScreen />, <ServerErrorScreen />, <ForbiddenScreen />, <NetworkErrorScreen />, <MaintenanceScreen />].map((el, i) => (
            <div key={i} className="rounded-lg border">{el}</div>
          ))}
        </div>
      </Section>
    </Page>
  );
}
