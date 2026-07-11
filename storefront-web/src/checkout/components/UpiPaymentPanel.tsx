import { useMemo } from "react";
import { Copy, Smartphone } from "lucide-react";
import { formatMoney, type ManualUpiConfig } from "../config";
import type { Money } from "../types";

type Props = {
  manualUpi: ManualUpiConfig;
  total?: Money;
};

function buildUpiQrUrl(upiId: string, amount: number, businessName?: string) {
  const params = new URLSearchParams({
    pa: upiId,
    am: (amount / 100).toFixed(2),
    cu: "INR",
  });
  if (businessName) params.set("pn", businessName.slice(0, 50));
  const payload = `upi://pay?${params.toString()}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
}

export function UpiPaymentPanel({ manualUpi, total }: Props) {
  const amountLabel = total ? formatMoney(total) : null;
  const qrSrc = useMemo(() => {
    if (manualUpi.qr_code_url) return manualUpi.qr_code_url;
    if (manualUpi.upi_id && total) {
      return buildUpiQrUrl(manualUpi.upi_id, total.amount, manualUpi.business_name);
    }
    return null;
  }, [manualUpi, total]);

  const copyUpi = async () => {
    if (!manualUpi.upi_id) return;
    try {
      await navigator.clipboard.writeText(manualUpi.upi_id);
    } catch {
      // ignore
    }
  };

  return (
    <div className="ck-border ck-radius-md space-y-4 p-4">
      <div className="flex items-center gap-3">
        {manualUpi.logo_url ? (
          <img
            src={manualUpi.logo_url}
            alt=""
            className="h-10 w-10 rounded-full border object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-[hsl(var(--surface-muted))]">
            <Smartphone size={18} />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold">{manualUpi.business_name || "Pay via UPI"}</p>
          {amountLabel && (
            <p className="ck-text-muted text-sm">Amount: <strong>{amountLabel}</strong></p>
          )}
        </div>
      </div>

      {qrSrc ? (
        <div className="text-center">
          <img
            src={qrSrc}
            alt="UPI QR code"
            className="mx-auto rounded-md border"
            width={220}
            height={220}
          />
          <p className="ck-text-muted mt-2 text-xs">Scan with GPay, PhonePe, Paytm, or any UPI app</p>
        </div>
      ) : (
        <p className="ck-text-muted text-sm">UPI QR is not configured yet. Ask the store to add their UPI details.</p>
      )}

      {manualUpi.upi_id && (
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
          <span className="ck-text-muted">UPI ID</span>
          <div className="flex items-center gap-2">
            <code className="font-medium">{manualUpi.upi_id}</code>
            <button
              type="button"
              onClick={() => void copyUpi()}
              className="ck-text-muted hover:ck-text inline-flex items-center gap-1 text-xs"
              aria-label="Copy UPI ID"
            >
              <Copy size={12} /> Copy
            </button>
          </div>
        </div>
      )}

      <p className="ck-text-muted text-xs">
        After paying, enter your UTR / transaction ID and upload your payment screenshot below.
      </p>
    </div>
  );
}
