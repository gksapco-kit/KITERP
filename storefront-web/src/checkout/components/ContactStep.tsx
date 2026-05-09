import { Mail, User } from "lucide-react";
import { useCheckoutConfig } from "../config";
import { Customer } from "../types";

type Props = {
  customer: Partial<Customer>;
  onChange: (next: Partial<Customer>) => void;
  onSignInClick?: () => void;
};

export function ContactStep({ customer, onChange, onSignInClick }: Props) {
  const { allowGuest } = useCheckoutConfig();
  return (
    <div className="space-y-3">
      {allowGuest && (
        <div className="ck-text-muted flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <User size={14} /> Checking out as guest
          </span>
          <button type="button" className="ck-btn-ghost" onClick={onSignInClick}>
            Have an account? Sign in
          </button>
        </div>
      )}
      <label className="block">
        <span className="ck-label">Email address</span>
        <div className="relative">
          <Mail
            size={16}
            className="ck-text-muted pointer-events-none absolute"
            style={{ top: "50%", left: 12, transform: "translateY(-50%)" }}
          />
          <input
            className="ck-input"
            style={{ paddingLeft: 36 }}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={customer.email ?? ""}
            onChange={(e) => onChange({ ...customer, email: e.target.value })}
          />
        </div>
      </label>
    </div>
  );
}
