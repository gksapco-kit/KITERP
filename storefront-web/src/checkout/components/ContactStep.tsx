import { Mail, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCheckoutConfig } from "../config";
import { Customer } from "../types";
import { useIsCustomerLoggedIn } from "@/hooks/useAuthHydrated";
import { PhoneInput } from "@/components/ui/PhoneInput";

type Props = {
  customer: Partial<Customer>;
  onChange: (next: Partial<Customer>) => void;
  onSignInClick?: () => void;
  fieldErrors?: Record<string, string>;
};

export function ContactStep({ customer, onChange, onSignInClick, fieldErrors = {} }: Props) {
  const { allowGuest, requirePhone } = useCheckoutConfig();
  const { isLoggedIn } = useIsCustomerLoggedIn();
  const showGuestContactFields = allowGuest || isLoggedIn;
  const showNameFields = showGuestContactFields && !isLoggedIn && customer.isGuest !== false;
  const showPhoneField = showGuestContactFields && (showNameFields || !customer.phone?.trim());
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
      {isLoggedIn ? (
        <div className="ck-text-muted flex flex-wrap items-center gap-2 text-sm">
          <User size={14} />
          <span>
            Signed in{customer.email ? <> as <strong className="text-foreground font-medium">{customer.email}</strong></> : null}
          </span>
        </div>
      ) : allowGuest ? (
        <div className="ck-text-muted flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <User size={14} /> Checking out as guest
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <button type="button" className="ck-btn-ghost" onClick={handleSignIn}>
              Have an account? Sign in
            </button>
            <button
              type="button"
              className="ck-btn-ghost"
              onClick={() => {
                const registerPath = location.pathname.replace(/\/[^/]*$/, "/register")
                navigate(registerPath, { state: { from: location.pathname + location.search } })
              }}
            >
              Create account
            </button>
          </span>
        </div>
      ) : (
        <div className="ck-surface ck-border ck-radius-md space-y-3 p-4">
          <p className="text-sm font-semibold text-foreground">Sign in required</p>
          <p className="ck-text-muted text-sm">
            This store requires an account before checkout. Sign in or create one to continue.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ck-btn-primary" onClick={handleSignIn}>
              Sign in
            </button>
            <button
              type="button"
              className="ck-btn-ghost"
              onClick={() => {
                const registerPath = location.pathname.replace(/\/[^/]*$/, '/register')
                navigate(registerPath, { state: { from: location.pathname + location.search } })
              }}
            >
              Create account
            </button>
          </div>
        </div>
      )}

      {showNameFields && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name *" error={fieldErrors.firstName} fieldKey="firstName">
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
          <Field label="Last name *" error={fieldErrors.lastName} fieldKey="lastName">
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

      {showGuestContactFields && (
        <>
          <Field label="Email address *" error={fieldErrors.email} fieldKey="email">
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

          {showPhoneField && (
            <Field
              label={requirePhone ? "Phone number *" : "Phone number"}
              error={fieldErrors.phone}
              fieldKey="phone"
            >
              <PhoneInput
                value={customer.phone ?? ""}
                onChange={(phone) => onChange({ ...customer, phone })}
                defaultCountryIso="IN"
                autoComplete="tel"
                name="phone"
                showStatusHints={false}
                showErrorMessage={false}
                error={fieldErrors.phone}
                className={fieldErrors.phone ? "ck-phone-error" : undefined}
              />
            </Field>
          )}
        </>
      )}
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
