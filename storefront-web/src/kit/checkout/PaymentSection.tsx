import { useEffect, useState } from "react";
import { CreditCard, Smartphone, QrCode, Wallet, Banknote, ShieldCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatPrice } from "../mock";

export type PaymentMethod = "razorpay" | "stripe" | "upi" | "qr" | "wallet" | "cod";

export interface PaymentSectionProps {
  amount: number;
  codFee?: number;
  enabledMethods?: PaymentMethod[];
  onPay?: (method: PaymentMethod, payload: any) => void;
}

export function PaymentSection({
  amount,
  codFee = 49,
  enabledMethods = ["razorpay", "stripe", "upi", "qr", "wallet", "cod"],
  onPay,
}: PaymentSectionProps) {
  const [method, setMethod] = useState<PaymentMethod>(enabledMethods[0]);

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Secure checkout. Your details are encrypted.
        </div>

        <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="grid sm:grid-cols-2 gap-2">
          {enabledMethods.includes("razorpay") && <MethodRadio value="razorpay" current={method} icon={<CreditCard className="h-4 w-4" />} label="Razorpay" sub="Cards, UPI, Netbanking" />}
          {enabledMethods.includes("stripe") && <MethodRadio value="stripe" current={method} icon={<CreditCard className="h-4 w-4" />} label="Card (Stripe)" sub="Visa / Mastercard / Amex" />}
          {enabledMethods.includes("upi") && <MethodRadio value="upi" current={method} icon={<Smartphone className="h-4 w-4" />} label="UPI" sub="GPay, PhonePe, BHIM" />}
          {enabledMethods.includes("qr") && <MethodRadio value="qr" current={method} icon={<QrCode className="h-4 w-4" />} label="UPI QR" sub="Scan & pay" />}
          {enabledMethods.includes("wallet") && <MethodRadio value="wallet" current={method} icon={<Wallet className="h-4 w-4" />} label="Wallets" sub="Paytm, GPay, Amazon Pay" />}
          {enabledMethods.includes("cod") && <MethodRadio value="cod" current={method} icon={<Banknote className="h-4 w-4" />} label="Cash on delivery" sub={`+ ${formatPrice(codFee)} fee`} />}
        </RadioGroup>

        <div className="rounded-lg border p-4">
          {method === "razorpay" && <RazorpayPanel amount={amount} onPay={(p) => onPay?.("razorpay", p)} />}
          {method === "stripe" && <StripePanel amount={amount} onPay={(p) => onPay?.("stripe", p)} />}
          {method === "upi" && <UpiPanel amount={amount} onPay={(p) => onPay?.("upi", p)} />}
          {method === "qr" && <UpiQrPanel amount={amount} onPay={(p) => onPay?.("qr", p)} />}
          {method === "wallet" && <WalletPanel amount={amount} onPay={(p) => onPay?.("wallet", p)} />}
          {method === "cod" && <CodPanel amount={amount} fee={codFee} onPay={(p) => onPay?.("cod", p)} />}
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Amount due</span>
          <span className="font-semibold">{formatPrice(method === "cod" ? amount + codFee : amount)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function MethodRadio({ value, current, icon, label, sub }: { value: string; current: string; icon: React.ReactNode; label: string; sub: string }) {
  const selected = value === current;
  return (
    <Label htmlFor={`pm-${value}`} className={cn("flex items-start gap-3 rounded-md border p-3 cursor-pointer", selected && "border-primary bg-primary/5")}>
      <RadioGroupItem id={`pm-${value}`} value={value} className="mt-1" />
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">{icon}{label}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </Label>
  );
}

function RazorpayPanel({ amount, onPay }: { amount: number; onPay: (p: any) => void }) {
  const [loading, setLoading] = useState(false);
  const start = async () => {
    setLoading(true);
    // Mock: in your ERP, POST to /api/razorpay/order then open checkout.
    setTimeout(() => { setLoading(false); onPay({ provider: "razorpay", amount }); }, 800);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">You'll be redirected to Razorpay to complete the payment of <strong>{formatPrice(amount)}</strong>.</p>
      <Button className="w-full" onClick={start} disabled={loading}>{loading ? "Creating order..." : "Pay with Razorpay"}</Button>
    </div>
  );
}

function StripePanel({ amount, onPay }: { amount: number; onPay: (p: any) => void }) {
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onPay({ provider: "stripe", last4: num.slice(-4) }); }} className="space-y-3">
      <div>
        <Label htmlFor="ccname">Cardholder name</Label>
        <Input id="ccname" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="ccnum">Card number</Label>
        <Input id="ccnum" required inputMode="numeric" placeholder="1234 5678 9012 3456" value={num} onChange={(e) => setNum(e.target.value)} className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ccexp">Expiry</Label>
          <Input id="ccexp" required placeholder="MM/YY" value={exp} onChange={(e) => setExp(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="cccvc">CVC</Label>
          <Input id="cccvc" required placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value)} className="mt-1" />
        </div>
      </div>
      <Button type="submit" className="w-full">Pay {formatPrice(amount)}</Button>
    </form>
  );
}

function UpiPanel({ amount, onPay }: { amount: number; onPay: (p: any) => void }) {
  const [vpa, setVpa] = useState("");
  const [provider, setProvider] = useState<"payu" | "phonepe">("payu");
  return (
    <div className="space-y-3">
      <Tabs value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="payu">PayU</TabsTrigger>
          <TabsTrigger value="phonepe">PhonePe</TabsTrigger>
        </TabsList>
        <TabsContent value="payu" className="pt-3 text-xs text-muted-foreground">
          Enter your UPI ID. You'll receive a collect request in your UPI app.
        </TabsContent>
        <TabsContent value="phonepe" className="pt-3 text-xs text-muted-foreground">
          You'll be redirected to PhonePe to authorize the payment.
        </TabsContent>
      </Tabs>
      <div>
        <Label htmlFor="vpa">UPI ID</Label>
        <Input id="vpa" placeholder="name@bank" value={vpa} onChange={(e) => setVpa(e.target.value)} className="mt-1" />
      </div>
      <Button className="w-full" onClick={() => onPay({ provider, vpa, amount })} disabled={!vpa.includes("@")}>
        Send {formatPrice(amount)} request
      </Button>
    </div>
  );
}

function UpiQrPanel({ amount, onPay }: { amount: number; onPay: (p: any) => void }) {
  const [seconds, setSeconds] = useState(120);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=merchant@upi%26am=${amount}`;
  return (
    <div className="space-y-3 text-center">
      <img src={qrUrl} alt="UPI QR code" className="mx-auto rounded-md border" width={200} height={200} />
      <div className="text-sm">Scan with any UPI app to pay <strong>{formatPrice(amount)}</strong></div>
      <div className="text-xs text-muted-foreground">Waiting for payment... {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</div>
      <Button variant="outline" size="sm" onClick={() => onPay({ provider: "upi-qr", amount })}>I've paid</Button>
    </div>
  );
}

function WalletPanel({ amount, onPay }: { amount: number; onPay: (p: any) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {["Paytm", "GPay", "Amazon Pay", "Mobikwik", "Freecharge", "Airtel"].map((w) => (
        <Button key={w} variant="outline" onClick={() => onPay({ wallet: w, amount })}>{w}</Button>
      ))}
    </div>
  );
}

function CodPanel({ amount, fee, onPay }: { amount: number; fee: number; onPay: (p: any) => void }) {
  return (
    <div className="space-y-3">
      <div className="text-sm">Pay in cash when your order arrives.</div>
      <div className="rounded-md bg-muted p-3 text-sm space-y-1">
        <div className="flex justify-between"><span>Order total</span><span>{formatPrice(amount)}</span></div>
        <div className="flex justify-between"><span>COD handling fee</span><span>{formatPrice(fee)}</span></div>
        <div className="flex justify-between font-semibold pt-1 border-t"><span>To pay on delivery</span><span>{formatPrice(amount + fee)}</span></div>
      </div>
      <Button className="w-full" onClick={() => onPay({ provider: "cod", amount: amount + fee })}>
        <Check /> Place order — Cash on delivery
      </Button>
    </div>
  );
}
