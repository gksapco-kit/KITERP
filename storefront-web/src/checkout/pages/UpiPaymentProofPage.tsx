import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Mail, Upload } from "lucide-react";
import { storeApi } from "@/api/store";
import { resetCartAfterOrder, storeKeys } from "@/hooks/useStore";
import { useBranch } from "@/contexts/BranchContext";
import { useStoreInfo } from "@/hooks/useStore";
import { useVendor } from "@/contexts/VendorContext";
import { useAuthStore } from "@/stores/authStore";
import { UpiPaymentPanel } from "@/checkout/components/UpiPaymentPanel";
import { Confetti } from "@/checkout/components/Confetti";
import { CheckoutHeader, CheckoutFooter } from "@/checkout/components/Header";
import type { ManualUpiConfig } from "@/checkout/config";

function manualUpiFromStoreInfo(storeInfo: unknown): ManualUpiConfig | null {
  const theme = (storeInfo as { theme_config?: Record<string, unknown> } | undefined)?.theme_config;
  const checkout = theme?.checkout as Record<string, unknown> | undefined;
  const raw = checkout?.manual_upi as Record<string, unknown> | undefined;
  if (!raw?.enabled) return null;
  return {
    enabled: true,
    upi_id: (raw.upi_id as string) || null,
    qr_code_url: (raw.qr_code_url as string) || null,
    label: (raw.label as string) || "UPI",
    business_name:
      (storeInfo as { display_name?: string; business_name?: string } | undefined)?.display_name
      ?? (storeInfo as { business_name?: string } | undefined)?.business_name,
    logo_url: (storeInfo as { logo_url?: string } | undefined)?.logo_url ?? null,
  };
}

export default function UpiPaymentProofPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { storePath } = useBranch();
  const { vendorSlug } = useVendor();
  const qc = useQueryClient();
  const { data: storeInfo } = useStoreInfo();
  const customer = useAuthStore((s) => s.customer);
  const [utr, setUtr] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: storeKeys.order(orderId!),
    queryFn: () => storeApi.getOrder(orderId!),
    enabled: !!orderId,
  });

  const manualUpi = manualUpiFromStoreInfo(storeInfo);
  const customerEmail = customer?.email ?? "";

  useEffect(() => {
    if (order?.payment_method === "pay_later") {
      navigate(storePath(`/order/${orderId}/confirmation`), { replace: true });
    }
  }, [order?.payment_method, orderId, navigate, storePath]);

  // If proof was already submitted (e.g. refresh), ensure local cart is cleared
  useEffect(() => {
    if (
      order?.payment_proof?.status === "submitted"
      || order?.payment_status === "paid"
      || order?.payment_status === "pending_verification"
    ) {
      void resetCartAfterOrder(qc, vendorSlug);
    }
  }, [order?.payment_proof?.status, order?.payment_status, qc, vendorSlug]);

  const totalMoney = order
    ? { amount: Math.round(Number(order.total) * 100), currency: "INR" }
    : undefined;

  const handleFile = async (file: File | null) => {
    if (!file || !orderId) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await storeApi.uploadOrderMedia(orderId, file);
      setScreenshotUrl(uploaded.url);
    } catch {
      setError("Could not upload screenshot. Please try a JPG or PNG under 5 MB.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!orderId || !utr.trim() || !screenshotUrl) {
      setError("Enter your UTR / transaction ID and upload a payment screenshot.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await storeApi.submitPaymentProof(orderId, {
        utr: utr.trim(),
        screenshot_url: screenshotUrl,
      });
      await resetCartAfterOrder(qc, vendorSlug);
      await qc.invalidateQueries({ queryKey: storeKeys.order(orderId) });
      setDone(true);
    } catch {
      setError("Could not submit payment proof. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !order || order.payment_method === "pay_later") {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const proofSubmitted = order.payment_proof?.status === "submitted";

  if (done || proofSubmitted || order.payment_status === "paid") {
    return (
      <div className="checkout-root min-h-screen">
        <Confetti />
        <CheckoutHeader />
        <main className="mx-auto max-w-lg px-3 py-12 text-center sm:px-4 sm:py-16">
          <div className="mx-auto flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Thank you for placing your order!</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your order <strong>{order.order_number}</strong> has been received.
          </p>
          {customerEmail ? (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-gray-600">
              <Mail size={14} />
              A confirmation email is on its way to {customerEmail}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              A confirmation email will be sent to you shortly.
            </p>
          )}
          <p className="mt-3 text-sm text-gray-500">
            The store will verify your payment and confirm your order.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              className="ck-btn-primary"
              onClick={() => navigate(storePath("/products"))}
            >
              Continue shopping
            </button>
            <button
              type="button"
              className="ck-btn-secondary"
              onClick={() => navigate(storePath(`/order/${orderId}/status`))}
            >
              View order status
            </button>
          </div>
        </main>
        <CheckoutFooter />
      </div>
    );
  }

  return (
    <div className="checkout-root min-h-screen">
      <CheckoutHeader />
      <main className="mx-auto max-w-xl px-3 py-8 sm:px-4 sm:py-10">
        <h1 className="text-2xl font-semibold">Complete UPI payment</h1>
        <p className="ck-text-muted mt-1 text-sm">
          Order <strong>{order.order_number}</strong> · Pay{" "}
          <strong>₹{Number(order.total).toFixed(2)}</strong>
        </p>

        {manualUpi ? (
          <div className="mt-6">
            <UpiPaymentPanel manualUpi={manualUpi} total={totalMoney} />
          </div>
        ) : null}

        <div className="ck-border ck-radius-md mt-6 space-y-4 p-4">
          <div>
            <label htmlFor="utr" className="text-sm font-medium">
              UTR / Transaction ID
            </label>
            <input
              id="utr"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="e.g. 123456789012"
              className="ck-input mt-1 w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Payment screenshot</label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="ck-btn-secondary inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-sm">
                <Upload size={16} />
                {uploading ? "Uploading…" : screenshotUrl ? "Change screenshot" : "Upload screenshot"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {screenshotUrl && (
                <img src={screenshotUrl} alt="Payment proof" className="h-16 w-16 rounded border object-cover" />
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            className="ck-btn-primary w-full"
            disabled={submitting || uploading}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Submitting…" : "I have paid — submit proof"}
          </button>
        </div>
      </main>
      <CheckoutFooter />
    </div>
  );
}
