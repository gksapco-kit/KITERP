import { Page, Section } from "../KitLayout";
import { PaymentSection } from "@/kit/checkout/PaymentSection";

export default function CheckoutShowcase() {
  return (
    <Page title="Checkout & Payments" intro="Real PSP-shaped payment UI: Razorpay, Stripe, UPI, UPI QR, wallets, COD with extra fee.">
      <Section title="Payment section — all methods enabled">
        <div className="max-w-2xl"><PaymentSection amount={4250} onPay={(m, p) => console.log("pay", m, p)} /></div>
      </Section>
      <Section title="Payment section — only Razorpay & UPI">
        <div className="max-w-2xl"><PaymentSection amount={799} enabledMethods={["razorpay", "upi"]} /></div>
      </Section>
    </Page>
  );
}
