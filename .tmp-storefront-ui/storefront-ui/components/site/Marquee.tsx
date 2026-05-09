export const Marquee = ({ items, className = "" }: { items: string[]; className?: string }) => (
  <div className={`marquee-mask overflow-hidden ${className}`}>
    <div className="ticker flex gap-12 whitespace-nowrap w-max">
      {[...items, ...items].map((t, i) => (
        <span key={i} className="font-display text-2xl md:text-4xl flex items-center gap-12 opacity-90">
          {t} <span className="opacity-40">✦</span>
        </span>
      ))}
    </div>
  </div>
);
