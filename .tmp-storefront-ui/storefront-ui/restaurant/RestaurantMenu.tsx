const sections = [
  { name: "To Begin", items: [
    ["Bread & cultured butter","6"],
    ["Marinated olives, lemon zest","8"],
    ["Oysters, mignonette","4 ea"],
  ]},
  { name: "Smaller", items: [
    ["Charred leek, hazelnut, brown butter","18"],
    ["Hand-cut beef tartare, smoked yolk","22"],
    ["Burrata, stone fruit, basil oil","19"],
    ["Tuna crudo, green strawberry, shiso","24"],
  ]},
  { name: "Larger", items: [
    ["Wood-grilled branzino, fennel, salsa verde","42"],
    ["Slow-cooked lamb shoulder, smoked eggplant","46"],
    ["Hand-rolled tagliatelle, brown butter, sage","32"],
    ["Cauliflower steak, almond, currants","28"],
  ]},
  { name: "To End", items: [
    ["Olive oil cake, rosemary cream","14"],
    ["Dark chocolate, fleur de sel","13"],
    ["Selection of cheeses","18"],
  ]},
];

const RestaurantMenu = () => (
  <main className="max-w-4xl mx-auto px-6 lg:px-10 py-20">
    <p className="text-xs uppercase tracking-[0.3em] text-resto-accent mb-6 text-center">Tonight's Menu · Updated daily</p>
    <h1 className="font-display text-6xl md:text-8xl text-center mb-16">À la carte.</h1>

    {sections.map(s => (
      <section key={s.name} className="mb-16">
        <h2 className="font-serif-it text-3xl text-resto-accent mb-8 text-center">{s.name}</h2>
        <ul className="space-y-6">
          {s.items.map(([n,p]) => (
            <li key={n} className="flex items-baseline gap-4 border-b border-dashed border-resto-ink/15 pb-4">
              <span className="font-display text-xl">{n}</span>
              <span className="flex-1 border-b border-dotted border-resto-ink/20 mx-2 translate-y-[-4px]" />
              <span className="opacity-70">{p}</span>
            </li>
          ))}
        </ul>
      </section>
    ))}

    <p className="text-center text-sm opacity-60 italic mt-16">Please inform your server of any allergies. A 20% gratuity is added for parties of six or more.</p>
  </main>
);
export default RestaurantMenu;
