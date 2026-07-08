import { Mail, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCheckoutConfig } from "../config";
import { Customer } from "../types";
import { useAuthStore } from "@/stores/authStore";

type Props = {
  customer: Partial<Customer>;
  onChange: (next: Partial<Customer>) => void;
  onSignInClick?: () => void;
  fieldErrors?: Record<string, string>;
};

export function ContactStep({ customer, onChange, onSignInClick, fieldErrors = {} }: Props) {
  const { allowGuest } = useCheckoutConfig();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const showNameFields = customer.isGuest !== false;
  const navigate = useNavigate();
  const location = useLocation();

  // `login` and `checkout` are sibling routes in every context (live store,
  // storefront preview, template browser), so swap the last path segment.
  const handleSignIn = () => {
    if (onSignInClick) return onSignInClick();
    const loginPath = location.pathname.replace(/\/[^/]*$/, "/login");
    navigate(loginPath, { state: { from: location.pathname + location.search } });
  };

  return (
    <div className="space-y-3">
      {allowGuest && (
        <div className="ck-text-muted flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <User size={14} /> Checking out as guest
          </span>
          {!isAuthenticated && (
            <button type="button" className="ck-btn-ghost" onClick={handleSignIn}>
              Have an account? Sign in
            </button>
          )}
        </div>
      )}

      {showNameFields && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name" error={fieldErrors.firstName} fieldKey="firstName">
            <input
              className="ck-input"
              autoComplete="given-name"
              placeholder="First name"
              value={customer.firstName ?? ""}
              aria-invalid={!!fieldErrors.firstName}
              data-checkout-field="firstName"
              onChange={(e) => onChange({ ...customer, firstName: e.target.value })}
            />
          </Field>
          <Field label="Last name" error={fieldErrors.lastName} fieldKey="lastName">
            <input
              className="ck-input"
              autoComplete="family-name"
              placeholder="Last name"
              value={customer.lastName ?? ""}
              aria-invalid={!!fieldErrors.lastName}
              data-checkout-field="lastName"
              onChange={(e) => onChange({ ...customer, lastName: e.target.value })}
            />
          </Field>
        </div>
      )}

      <Field label="Email address" error={fieldErrors.email} fieldKey="email">
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
            aria-invalid={!!fieldErrors.email}
            data-checkout-field="email"
            onChange={(e) => onChange({ ...customer, email: e.target.value })}
          />
        </div>
      </Field>
    </div>
  );
}

function Field({
  label,
  error,
  fieldKey,
  children,
}: {
  label: string;
  error?: string;
  fieldKey?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block" data-checkout-field={fieldKey}>
      <span className="ck-label">{label}</span>
      {children}
      {error && <span className="ck-field-error">{error}</span>}
    </label>
  );
}
