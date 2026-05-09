import { Link } from "react-router-dom";

const cats = ["All","Apparel","Home","Ceramics","Accessories","Sale"];
const products = Array.from({length: 9}).map((_,i)=> ({
  id: `item-${i}`,
  name: ["Linen Overshirt","Ceramic Tumbler","Wool Cardigan","Leather Belt","Glass Carafe","Canvas Apron","Cashmere Beanie","Stoneware Bowl","Cotton Throw"][i],
  price: `$${[148,38,260,95,72,84,120,46,180][i]}`,
  hue: ["from-amber-100 to-orange-200","from-stone-100 to-stone-300","from-rose-100 to-rose-200","from-neutral-200 to-neutral-400","from-sky-100 to-sky-200","from-yellow-100 to-amber-200","from-zinc-200 to-zinc-400","from-emerald-100 to-emerald-200","from-orange-100 to-red-200"][i]
}));

const RetailShop = () => (
  <main className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
    <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-3">124 products</p>
        <h1 className="font-display text-6xl md:text-7xl tracking-tight">The Shop.</h1>
      </div>
      <select className="bg-transparent border border-retail-ink/20 rounded-full px-4 py-2 text-sm">
        <option>Sort: Newest</option><option>Price ↑</option><option>Price ↓</option>
      </select>
    </div>
    <div className="flex gap-2 flex-wrap mb-10">
      {cats.map((c,i) => (
        <button key={c} className={`text-sm px-4 py-2 rounded-full border ${i===0 ? "bg-retail-ink text-retail-bg border-retail-ink" : "border-retail-ink/20"}`}>{c}</button>
      ))}
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map(p => (
        <Link key={p.id} to={`/retail/product/${p.id}`} className="group">
          <div className={`aspect-[4/5] rounded-2xl mb-4 overflow-hidden bg-gradient-to-br ${p.hue} grain`} />
          <div className="flex justify-between text-sm">
            <span>{p.name}</span><span className="opacity-70">{p.price}</span>
          </div>
        </Link>
      ))}
    </div>
  </main>
);
export default RetailShop;
