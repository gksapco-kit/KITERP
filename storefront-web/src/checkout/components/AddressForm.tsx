import { useState } from "react";
import { Address } from "../types";
import { useCheckoutConfig } from "../config";
import { PhoneInput } from "@/components/ui/PhoneInput";

type Props = {
  initial?: Partial<Address>;
  onSubmit?: (address: Address) => void;
  onChange?: (address: Address) => void;
  hideSubmit?: boolean;
  formId?: string;
  fieldErrors?: Record<string, string>;
  /** Phone is collected on the Contact step. */
  hidePhone?: boolean;
};

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "AU", name: "Australia" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
];

function defaultCountry(initial?: Partial<Address>): string {
  const c = initial?.country?.trim()
  if (!c) return "IN"
  if (c.toLowerCase() === "india") return "IN"
  return c.length === 2 ? c.toUpperCase() : c
}

export function AddressForm({ initial, onSubmit, onChange, hideSubmit, formId, fieldErrors = {}, hidePhone = false }: Props) {
  const { requirePhone } = useCheckoutConfig();
  const [v, setV] = useState<Address>({
    fullName: initial?.fullName ?? "",
    company: initial?.company ?? "",
    line1: initial?.line1 ?? "",
    line2: initial?.line2 ?? "",
    city: initial?.city ?? "",
    region: initial?.region ?? "",
    postalCode: initial?.postalCode ?? "",
    country: defaultCountry(initial),
    phone: initial?.phone ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const displayErrors = { ...errors, ...fieldErrors };

  function update<K extends keyof Address>(key: K, value: Address[K]) {
    setV((prev) => {
      const next = { ...prev, [key]: value }
      if (hideSubmit) onChange?.(next)
      return next
    });
    if (errors[key as string]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!v.fullName.trim()) e.fullName = "Required";
    if (!v.line1.trim()) e.line1 = "Required";
    if (!v.city.trim()) e.city = "Required";
    if (!v.region.trim()) e.region = "Required";
    if (!v.postalCode.trim()) e.postalCode = "Required";
    if (!v.country.trim()) e.country = "Required";
    if (!hidePhone && requirePhone && !v.phone?.trim()) e.phone = "Phone is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <form
      id={formId}
      onSubmit={(ev) => {
        ev.preventDefault();
        if (validate()) onSubmit?.(v);
      }}
      className="space-y-3"
      noValidate
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Full name" error={displayErrors.fullName} fieldKey="fullName">
          <input
            className="ck-input"
            autoComplete="name"
            value={v.fullName}
            aria-invalid={!!displayErrors.fullName}
            data-checkout-field="fullName"
            onChange={(e) => update("fullName", e.target.value)}
          />
        </Field>

        <Field label="Company (optional)">
          <input
            className="ck-input"
            autoComplete="organization"
            value={v.company}
            onChange={(e) => update("company", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Address" error={displayErrors.line1} fieldKey="line1">
          <input
            className="ck-input"
            autoComplete="address-line1"
            value={v.line1}
            aria-invalid={!!displayErrors.line1}
            data-checkout-field="line1"
            onChange={(e) => update("line1", e.target.value)}
          />
        </Field>
        <Field label="Apartment, suite, etc. (optional)">
          <input
            className="ck-input"
            autoComplete="address-line2"
            value={v.line2}
            onChange={(e) => update("line2", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="City" error={displayErrors.city} fieldKey="city">
          <input
            className="ck-input"
            autoComplete="address-level2"
            value={v.city}
            aria-invalid={!!displayErrors.city}
            data-checkout-field="city"
            onChange={(e) => update("city", e.target.value)}
          />
        </Field>
        <Field label="State / Region" error={displayErrors.region} fieldKey="region">
          <input
            className="ck-input"
            autoComplete="address-level1"
            value={v.region}
            aria-invalid={!!displayErrors.region}
            data-checkout-field="region"
            onChange={(e) => update("region", e.target.value)}
          />
        </Field>
        <Field label="Postal code" error={displayErrors.postalCode} fieldKey="postalCode">
          <input
            className="ck-input"
            autoComplete="postal-code"
            value={v.postalCode}
            aria-invalid={!!displayErrors.postalCode}
            data-checkout-field="postalCode"
            onChange={(e) => update("postalCode", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Country" error={displayErrors.country} fieldKey="country">
          <select
            className="ck-input"
            autoComplete="country"
            value={v.country}
            aria-invalid={!!displayErrors.country}
            data-checkout-field="country"
            onChange={(e) => update("country", e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {!hidePhone && (
          <Field label={requirePhone ? "Phone" : "Phone (optional)"} error={displayErrors.phone} fieldKey="phone">
            <PhoneInput
              value={v.phone}
              onChange={(phone) => update("phone", phone)}
              defaultCountryIso="IN"
              autoComplete="tel"
              name="phone"
              showStatusHints={false}
              showErrorMessage={false}
              error={displayErrors.phone}
              className={displayErrors.phone ? "ck-phone-error" : undefined}
            />
          </Field>
        )}
      </div>

      {!hideSubmit && (
        <button type="submit" className="ck-btn-primary" style={{ marginTop: 8 }}>
          Continue
        </button>
      )}
    </form>
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
