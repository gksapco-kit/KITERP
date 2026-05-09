import { useState } from "react";
import { Address } from "../types";
import { useCheckoutConfig } from "../config";

type Props = {
  initial?: Partial<Address>;
  onSubmit?: (address: Address) => void;
  hideSubmit?: boolean;
  formId?: string;
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

export function AddressForm({ initial, onSubmit, hideSubmit, formId }: Props) {
  const { requirePhone } = useCheckoutConfig();
  const [v, setV] = useState<Address>({
    fullName: initial?.fullName ?? "",
    company: initial?.company ?? "",
    line1: initial?.line1 ?? "",
    line2: initial?.line2 ?? "",
    city: initial?.city ?? "",
    region: initial?.region ?? "",
    postalCode: initial?.postalCode ?? "",
    country: initial?.country ?? "US",
    phone: initial?.phone ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update<K extends keyof Address>(key: K, value: Address[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
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
    if (requirePhone && !v.phone?.trim()) e.phone = "Required";
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
      <Field label="Full name" error={errors.fullName}>
        <input
          className="ck-input"
          autoComplete="name"
          value={v.fullName}
          aria-invalid={!!errors.fullName}
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

      <Field label="Address" error={errors.line1}>
        <input
          className="ck-input"
          autoComplete="address-line1"
          value={v.line1}
          aria-invalid={!!errors.line1}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="City" error={errors.city}>
          <input
            className="ck-input"
            autoComplete="address-level2"
            value={v.city}
            aria-invalid={!!errors.city}
            onChange={(e) => update("city", e.target.value)}
          />
        </Field>
        <Field label="State / Region" error={errors.region}>
          <input
            className="ck-input"
            autoComplete="address-level1"
            value={v.region}
            aria-invalid={!!errors.region}
            onChange={(e) => update("region", e.target.value)}
          />
        </Field>
        <Field label="Postal code" error={errors.postalCode}>
          <input
            className="ck-input"
            autoComplete="postal-code"
            value={v.postalCode}
            aria-invalid={!!errors.postalCode}
            onChange={(e) => update("postalCode", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Country" error={errors.country}>
          <select
            className="ck-input"
            autoComplete="country"
            value={v.country}
            onChange={(e) => update("country", e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Phone${requirePhone ? "" : " (optional)"}`} error={errors.phone}>
          <input
            className="ck-input"
            autoComplete="tel"
            type="tel"
            value={v.phone}
            aria-invalid={!!errors.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </Field>
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
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="ck-label">{label}</span>
      {children}
      {error && <span className="ck-field-error">{error}</span>}
    </label>
  );
}
