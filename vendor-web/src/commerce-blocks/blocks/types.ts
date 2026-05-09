import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { z, ZodTypeAny } from "zod";

export type BlockCategory =
  | "products"
  | "services"
  | "menu"
  | "bookings"
  | "commerce"
  | "verticals"
  | "states";

export interface BlockVariant<P = Record<string, unknown>> {
  id: string;
  name: string;
  description?: string;
  Component: ComponentType<P>;
}

export interface BlockDefinition<S extends ZodTypeAny = ZodTypeAny> {
  id: string;
  slug: string;
  category: BlockCategory;
  name: string;
  description: string;
  icon: LucideIcon;
  isLive?: boolean;
  propsSchema: S;
  defaultProps: z.infer<S>;
  variants: BlockVariant<z.infer<S>>[];
  defaultVariantId?: string;
}

export const CATEGORY_META: Record<
  BlockCategory,
  { label: string; description: string }
> = {
  products: { label: "Products", description: "Storefront product blocks" },
  services: { label: "Services", description: "Service catalog blocks" },
  menu: { label: "Menu", description: "Restaurant menu blocks" },
  bookings: { label: "Bookings", description: "Scheduling & reservations" },
  commerce: { label: "Commerce", description: "Checkout, orders & gift cards" },
  verticals: { label: "Verticals", description: "Industry-specific blocks" },
  states: { label: "States", description: "Empty, loading & error states" },
};
