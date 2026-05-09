type Theme = "retail" | "resto" | "hosp";
const map = {
  retail: "bg-retail-ink text-retail-bg",
  resto:  "bg-resto-ink text-resto-bg",
  hosp:   "bg-hosp-ink text-hosp-bg",
};
export const SiteFooter = ({ theme, brand, tagline }: { theme: Theme; brand: string; tagline: string }) => (
  <footer className={`${map[theme]} mt-24`}>
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 grid md:grid-cols-4 gap-10">
      <div className="md:col-span-2">
        <p className="font-display text-4xl md:text-5xl leading-[1.05]">{tagline}</p>
      </div>
      <div className="text-sm space-y-2 opacity-80">
        <p className="opacity-60 mb-3 uppercase tracking-widest text-xs">Visit</p>
        <p>221 Atelier Street</p>
        <p>Brooklyn, NY 11211</p>
        <p>Tue–Sun · 10–20</p>
      </div>
      <div className="text-sm space-y-2 opacity-80">
        <p className="opacity-60 mb-3 uppercase tracking-widest text-xs">Contact</p>
        <p>hello@{brand.toLowerCase().replace(/\s/g,"")}.co</p>
        <p>+1 (212) 555 0142</p>
        <p>Instagram · TikTok</p>
      </div>
    </div>
    <div className="border-t border-current/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex justify-between text-xs opacity-60">
        <span>© 2026 {brand}</span>
        <span>Powered by your ERP</span>
      </div>
    </div>
  </footer>
);
