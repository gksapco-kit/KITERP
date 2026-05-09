import { Plus } from "lucide-react";
import { Address } from "../types";

type Props = {
  addresses: Address[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onAddNew?: () => void;
};

export function AddressBook({ addresses, selectedId, onSelect, onAddNew }: Props) {
  return (
    <div className="space-y-2">
      {addresses.map((a) => {
        const selected = selectedId === a.id;
        return (
          <button
            key={a.id}
            type="button"
            className="ck-selectable w-full text-left"
            data-selected={selected}
            onClick={() => a.id && onSelect?.(a.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium">
                  {a.label ? `${a.label} · ` : ""}
                  {a.fullName}
                </div>
                <div className="ck-text-muted text-xs">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.region} {a.postalCode}, {a.country}
                </div>
                {a.phone && <div className="ck-text-subtle text-xs">{a.phone}</div>}
              </div>
              {a.isDefault && <span className="ck-badge">Default</span>}
            </div>
          </button>
        );
      })}
      <button type="button" className="ck-btn-secondary flex w-full items-center justify-center gap-2" onClick={onAddNew}>
        <Plus size={16} /> Add new address
      </button>
    </div>
  );
}
