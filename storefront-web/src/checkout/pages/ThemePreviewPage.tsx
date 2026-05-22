import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check } from "lucide-react";
import { CheckoutHeader, CheckoutFooter } from "../components/Header";
import { CheckoutConfigProvider } from "../config";
import { OrderSummary } from "../components/OrderSummary";
import { mockCart } from "../mock/data";

type Token = {
  key: string;
  label: string;
  type: "color" | "text" | "number";
  default: string;
};

const TOKENS: Token[] = [
  { key: "--brand-primary", label: "Brand primary", type: "color", default: "222 47% 11%" },
  { key: "--brand-primary-foreground", label: "Brand text on primary", type: "color", default: "0 0% 100%" },
  { key: "--surface", label: "Surface", type: "color", default: "0 0% 100%" },
  { key: "--surface-muted", label: "Muted surface", type: "color", default: "220 14% 97%" },
  { key: "--border-token", label: "Border", type: "color", default: "220 13% 91%" },
  { key: "--text", label: "Text", type: "color", default: "222 47% 11%" },
  { key: "--text-muted", label: "Text muted", type: "color", default: "215 16% 47%" },
  { key: "--radius-md", label: "Radius (md)", type: "text", default: "10px" },
  { key: "--font-heading", label: "Heading font", type: "text", default: "ui-sans-serif, system-ui, sans-serif" },
  { key: "--font-body", label: "Body font", type: "text", default: "ui-sans-serif, system-ui, sans-serif" },
];

const PRESETS = {
  Default: {} as Record<string, string>,
  Sunset: {
    "--brand-primary": "12 90% 55%",
    "--brand-primary-foreground": "0 0% 100%",
    "--surface-muted": "30 60% 97%",
    "--radius-md": "14px",
  },
  Forest: {
    "--brand-primary": "150 50% 25%",
    "--brand-primary-foreground": "0 0% 100%",
    "--surface-muted": "150 30% 97%",
    "--radius-md": "6px",
  },
  Midnight: {
    "--brand-primary": "230 80% 60%",
    "--brand-primary-foreground": "0 0% 100%",
    "--surface": "222 30% 8%",
    "--surface-muted": "222 30% 12%",
    "--surface-elevated": "222 30% 10%",
    "--border-token": "222 20% 20%",
    "--text": "0 0% 98%",
    "--text-muted": "215 16% 70%",
    "--text-subtle": "215 16% 60%",
    "--radius-md": "10px",
  },
  Editorial: {
    "--brand-primary": "0 0% 12%",
    "--brand-primary-foreground": "0 0% 100%",
    "--radius-md": "2px",
    "--radius-sm": "0px",
    "--radius-lg": "4px",
    "--font-heading": "Georgia, 'Times New Roman', serif",
  },
};

export default function ThemePreviewPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  function applyPreset(name: keyof typeof PRESETS) {
    setValues({ ...PRESETS[name] });
  }

  function reset() {
    setValues({});
  }

  function copy() {
    const css = `.checkout-root {\n${Object.entries(values)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n")}\n}`;
    navigator.clipboard?.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const styleVars = values as React.CSSProperties;

  return (
    <CheckoutConfigProvider>
      <div className="min-h-screen" style={{ background: "hsl(220 14% 96%)" }}>
        <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:px-6 lg:grid-cols-[340px_1fr]">
          <aside className="ck-surface ck-border ck-radius-md self-start p-4" style={{ background: "white" }}>
            <Link to="/" className="ck-btn-ghost mb-4 inline-block no-underline">
              ← Back
            </Link>
            <h1 className="mb-1 text-lg font-semibold">Theme preview</h1>
            <p className="ck-text-muted mb-4 text-sm">
              Tweak any token, see the checkout re-skin instantly. Copy the CSS into your tenant config.
            </p>

            <div className="mb-4">
              <div className="ck-label">Presets</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((p) => (
                  <button key={p} type="button" className="ck-btn-secondary" onClick={() => applyPreset(p)} style={{ padding: "6px 12px" }}>
                    {p}
                  </button>
                ))}
                <button type="button" className="ck-btn-ghost" onClick={reset}>
                  Reset
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {TOKENS.map((t) => {
                const v = values[t.key] ?? t.default;
                return (
                  <label key={t.key} className="block">
                    <span className="ck-label flex items-center justify-between">
                      <span>{t.label}</span>
                      <span className="ck-text-subtle font-mono text-xs">{t.key}</span>
                    </span>
                    <input
                      className="ck-input"
                      value={v}
                      onChange={(e) => setValues((prev) => ({ ...prev, [t.key]: e.target.value }))}
                      placeholder={t.default}
                    />
                  </label>
                );
              })}
            </div>

            <button type="button" className="ck-btn-primary mt-4 flex items-center justify-center gap-2" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied!" : "Copy CSS"}
            </button>
          </aside>

          <section className="space-y-4">
            <div
              className="checkout-root ck-radius-lg overflow-hidden"
              style={{ ...styleVars, boxShadow: "0 10px 30px rgba(0,0,0,0.06)" }}
            >
              <CheckoutHeader />
              <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 p-4 md:p-6">
                <div className="ck-surface ck-border ck-radius-md p-4">
                  <h2 className="mb-2 text-base font-semibold">Live preview</h2>
                  <p className="ck-text-muted text-sm">
                    All buttons, inputs, badges, and surfaces below are token-driven.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button className="ck-btn-primary">Primary action</button>
                    <button className="ck-btn-secondary">Secondary</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="ck-badge">Badge</span>
                    <span className="ck-badge ck-badge-success">Success</span>
                    <span className="ck-badge ck-badge-warning">Warning</span>
                    <span className="ck-badge ck-badge-danger">Danger</span>
                  </div>
                  <div className="mt-3">
                    <input className="ck-input" placeholder="Sample input" />
                  </div>
                </div>

                <OrderSummary cart={mockCart} showItems />
              </div>
              <CheckoutFooter />
            </div>
          </section>
        </main>
      </div>
    </CheckoutConfigProvider>
  );
}
