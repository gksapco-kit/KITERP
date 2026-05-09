import { useParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const RetailProduct = () => {
  const { id } = useParams();
  const { toast } = useToast();
  return (
    <main className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
      <Link to="/retail/shop" className="text-sm opacity-60">← Back to shop</Link>
      <div className="grid lg:grid-cols-2 gap-10 mt-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 aspect-square rounded-3xl bg-gradient-to-br from-amber-100 to-orange-200 grain" />
          <div className="aspect-square rounded-2xl bg-gradient-to-br from-stone-100 to-stone-300" />
          <div className="aspect-square rounded-2xl bg-gradient-to-br from-rose-100 to-rose-200" />
        </div>
        <div className="lg:pl-10">
          <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-4">Apparel · Spring 04</p>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05] tracking-tight mb-4">
            {id?.replace(/-/g," ").replace(/\b\w/g, c => c.toUpperCase()) ?? "Product"}
          </h1>
          <p className="text-2xl mb-8">$148</p>
          <p className="opacity-75 leading-relaxed mb-8">Cut from heavyweight European linen, stonewashed for an instantly-broken-in feel. Mother-of-pearl buttons. Cut and sewn in Porto.</p>

          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest opacity-60 mb-3">Size</p>
            <div className="flex gap-2">
              {["XS","S","M","L","XL"].map((s,i) => (
                <button key={s} className={`w-12 h-12 rounded-full border ${i===2 ? "bg-retail-ink text-retail-bg border-retail-ink" : "border-retail-ink/20"}`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mb-10">
            <button onClick={() => toast({title:"Added to bag",description:"We'll hold it for 15 minutes."})} className="flex-1 bg-retail-ink text-retail-bg py-4 rounded-full text-sm">Add to bag — $148</button>
            <button className="px-6 border border-retail-ink/20 rounded-full text-sm">♡</button>
          </div>

          <details className="border-t border-retail-ink/10 py-4 text-sm">
            <summary className="cursor-pointer">Materials & care</summary>
            <p className="opacity-70 mt-3">100% European linen. Machine wash cold, line dry, warm iron.</p>
          </details>
          <details className="border-t border-retail-ink/10 py-4 text-sm">
            <summary className="cursor-pointer">Shipping & returns</summary>
            <p className="opacity-70 mt-3">Free shipping on orders over $150. Returns within 30 days.</p>
          </details>
          <details className="border-t border-b border-retail-ink/10 py-4 text-sm">
            <summary className="cursor-pointer">In stock at</summary>
            <p className="opacity-70 mt-3">Brooklyn flagship · LA Studio · Synced live from ERP.</p>
          </details>
        </div>
      </div>
    </main>
  );
};
export default RetailProduct;
