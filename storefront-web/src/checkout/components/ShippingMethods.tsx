import { ShippingMethod } from "../types";
import { formatMoney, useCheckoutConfig } from "../config";
import { Truck } from "lucide-react";

type Props = {
  methods: ShippingMethod[];
  selectedId?: string;
  onSelect?: (id: string) => void;
};

export function ShippingMethods({ methods, selectedId, onSelect }: Props) {
  const { locale } = useCheckoutConfig();
  if (methods.length === 0)
    return (
      <div className="ck-text-muted text-sm">Enter a shipping address to see available methods.</div>
    );
  return (
    <div className="space-y-2">
      {methods.map((m) => {
        const selected = selectedId === m.id;
        return (
          <button
            key={m.id}
            type="button"
            className="ck-selectable flex w-full items-center justify-between text-left"
            data-selected={selected}
            onClick={() => onSelect?.(m.id)}
          >
            <div className="flex items-center gap-3">
              <Truck size={18} className="ck-text-muted" />
              <div>
                <div className="text-sm font-medium">{m.label}</div>
                {m.description && <div className="ck-text-muted text-xs">{m.description}</div>}
              </div>
            </div>
            <div className="text-sm font-medium">
              {m.price.amount === 0 ? "Free" : formatMoney(m.price, locale)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
