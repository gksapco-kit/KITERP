import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AvailabilityCalendarProps {
  value?: Date;
  onChange?: (date: Date) => void;
  blockedDates?: string[]; // YYYY-MM-DD
  minDate?: Date;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AvailabilityCalendar({ value, onChange, blockedDates = [], minDate }: AvailabilityCalendarProps) {
  const [view, setView] = useState(value ?? new Date());
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const min = minDate ?? today;

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startDay = first.getDay();
    const lastDay = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= lastDay; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
    return cells;
  }, [view]);

  const monthLabel = view.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><ChevronLeft /></Button>
        <div className="font-medium">{monthLabel}</div>
        <Button variant="ghost" size="icon" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><ChevronRight /></Button>
      </div>
      <div className="grid grid-cols-7 text-xs text-muted-foreground mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="p-2 text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const blocked = blockedDates.includes(ymd(d)) || d < min;
          const selected = value && ymd(value) === ymd(d);
          return (
            <button
              key={i}
              disabled={blocked}
              onClick={() => onChange?.(d)}
              className={cn(
                "aspect-square rounded-md text-sm flex items-center justify-center",
                blocked ? "text-muted-foreground/40 line-through cursor-not-allowed" : "hover:bg-muted",
                selected && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface TimeSlot { start: string; end: string; available: boolean }

export function TimeSlotPicker({ slots, value, onChange }: { slots: TimeSlot[]; value?: string; onChange?: (start: string) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {slots.map((s) => {
        const label = new Date(s.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const selected = value === s.start;
        return (
          <button
            key={s.start}
            disabled={!s.available}
            onClick={() => onChange?.(s.start)}
            className={cn(
              "px-3 py-2 rounded-md border text-sm",
              !s.available && "opacity-40 line-through cursor-not-allowed",
              selected && "bg-primary text-primary-foreground border-primary",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
