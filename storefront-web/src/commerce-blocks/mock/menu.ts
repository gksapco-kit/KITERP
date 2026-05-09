export type Diet = "veg" | "vegan" | "gf" | "spicy" | "nuts" | "dairy";

export interface MockMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  diet: Diet[];
  popular?: boolean;
  image?: string;
}

export interface MockMenuSection {
  id: string;
  name: string;
  description?: string;
  items: MockMenuItem[];
}

const swatch = (h: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' fill='hsl(${h},45%,82%)'/></svg>`,
  )}`;

export const mockMenu: MockMenuSection[] = [
  {
    id: "starters",
    name: "Starters",
    description: "Small plates to share",
    items: [
      {
        id: "m1",
        name: "Charred Sourdough",
        description: "Cultured butter, sea salt, smoked olive oil.",
        price: 9,
        currency: "USD",
        diet: ["veg", "dairy"],
        image: swatch(40),
      },
      {
        id: "m2",
        name: "Burrata & Stone Fruit",
        description: "Heirloom peaches, basil oil, aged balsamic.",
        price: 16,
        currency: "USD",
        diet: ["veg", "gf", "dairy"],
        popular: true,
        image: swatch(20),
      },
      {
        id: "m3",
        name: "Roasted Carrot Hummus",
        description: "Smoked paprika, dukkah, warm flatbread.",
        price: 12,
        currency: "USD",
        diet: ["vegan", "nuts"],
        image: swatch(25),
      },
    ],
  },
  {
    id: "mains",
    name: "Mains",
    items: [
      {
        id: "m4",
        name: "Wild Mushroom Risotto",
        description: "Carnaroli rice, taleggio, crispy shallot.",
        price: 26,
        currency: "USD",
        diet: ["veg", "gf", "dairy"],
        image: swatch(35),
      },
      {
        id: "m5",
        name: "Coal-Roasted Branzino",
        description: "Salsa verde, charred lemon, fennel slaw.",
        price: 34,
        currency: "USD",
        diet: ["gf"],
        popular: true,
        image: swatch(200),
      },
      {
        id: "m6",
        name: "Smashed Bean Burger",
        description: "House brioche, pickled onion, harissa aioli.",
        price: 18,
        currency: "USD",
        diet: ["vegan", "spicy"],
        image: swatch(15),
      },
    ],
  },
  {
    id: "desserts",
    name: "Desserts",
    items: [
      {
        id: "m7",
        name: "Olive Oil Cake",
        description: "Whipped mascarpone, candied citrus.",
        price: 11,
        currency: "USD",
        diet: ["veg", "dairy"],
        image: swatch(50),
      },
      {
        id: "m8",
        name: "Dark Chocolate Pot",
        description: "Sea salt, hazelnut praline, crème fraîche.",
        price: 12,
        currency: "USD",
        diet: ["veg", "nuts", "dairy"],
        image: swatch(28),
      },
    ],
  },
];

export const dietLabels: Record<Diet, { label: string; description: string }> = {
  veg: { label: "V", description: "Vegetarian" },
  vegan: { label: "VG", description: "Vegan" },
  gf: { label: "GF", description: "Gluten-free" },
  spicy: { label: "🌶", description: "Spicy" },
  nuts: { label: "N", description: "Contains nuts" },
  dairy: { label: "D", description: "Contains dairy" },
};

export const mockSpecials = [
  {
    id: "sp1",
    name: "Tasting Menu — Tuesday",
    description: "Five-course chef's selection paired with natural wines.",
    price: 95,
    currency: "USD",
    badge: "Tonight",
  },
  {
    id: "sp2",
    name: "Brunch Bowl",
    description: "Smashed avo, soft egg, sourdough crumb, herb salsa.",
    price: 18,
    currency: "USD",
    badge: "Weekend",
  },
];
