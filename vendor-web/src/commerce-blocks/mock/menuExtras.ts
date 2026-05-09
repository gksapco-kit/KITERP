export interface MockWine {
  id: string;
  name: string;
  region: string;
  varietal: string;
  glassPrice: number;
  bottlePrice: number;
  currency: string;
  pairs: string[];
  notes: string;
}

export const mockWines: MockWine[] = [
  {
    id: "w1",
    name: "Cantina della Pieve · Vermentino",
    region: "Tuscany, Italy",
    varietal: "Vermentino",
    glassPrice: 14,
    bottlePrice: 56,
    currency: "USD",
    pairs: ["Burrata & Stone Fruit", "Coal-Roasted Branzino"],
    notes: "Crisp, saline, white peach.",
  },
  {
    id: "w2",
    name: "Domaine Plageoles · Mauzac Nature",
    region: "Gaillac, France",
    varietal: "Mauzac",
    glassPrice: 16,
    bottlePrice: 64,
    currency: "USD",
    pairs: ["Charred Sourdough", "Wild Mushroom Risotto"],
    notes: "Pet-nat, green apple, brioche.",
  },
  {
    id: "w3",
    name: "Bodega Chacra · Pinot Noir",
    region: "Patagonia, Argentina",
    varietal: "Pinot Noir",
    glassPrice: 18,
    bottlePrice: 78,
    currency: "USD",
    pairs: ["Smashed Bean Burger", "Dark Chocolate Pot"],
    notes: "Bright cherry, forest floor.",
  },
];

export const mockCombos = [
  {
    id: "c1",
    name: "Lunch combo",
    description: "One main, one side, one drink — under 30 minutes.",
    price: 22,
    currency: "USD",
    includes: [
      { label: "Choose a main", options: ["Smashed Bean Burger", "Wild Mushroom Risotto"] },
      { label: "Choose a side", options: ["House salad", "Crispy potatoes", "Charred greens"] },
      { label: "Choose a drink", options: ["Iced tea", "Sparkling water", "House lemonade"] },
    ],
    badge: "Weekdays · 12–2 PM",
  },
  {
    id: "c2",
    name: "Family dinner",
    description: "Two starters, two mains, one dessert. Serves 4.",
    price: 89,
    currency: "USD",
    includes: [
      { label: "Two starters", options: ["Charred Sourdough", "Roasted Carrot Hummus", "Burrata & Stone Fruit"] },
      { label: "Two mains", options: ["Risotto", "Branzino", "Bean Burger"] },
      { label: "One dessert", options: ["Olive Oil Cake", "Dark Chocolate Pot"] },
    ],
    badge: "Best value",
  },
];

export interface MockNutritionRow {
  itemId: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number;
}

export const mockNutrition: MockNutritionRow[] = [
  { itemId: "m1", name: "Charred Sourdough", calories: 280, protein: 7, carbs: 38, fat: 11, sodium: 480 },
  { itemId: "m2", name: "Burrata & Stone Fruit", calories: 410, protein: 18, carbs: 22, fat: 28, sodium: 520 },
  { itemId: "m3", name: "Roasted Carrot Hummus", calories: 320, protein: 9, carbs: 36, fat: 16, sodium: 410 },
  { itemId: "m4", name: "Wild Mushroom Risotto", calories: 620, protein: 18, carbs: 72, fat: 26, sodium: 780 },
  { itemId: "m5", name: "Coal-Roasted Branzino", calories: 540, protein: 42, carbs: 8, fat: 34, sodium: 620 },
  { itemId: "m6", name: "Smashed Bean Burger", calories: 680, protein: 24, carbs: 64, fat: 32, sodium: 890 },
  { itemId: "m7", name: "Olive Oil Cake", calories: 380, protein: 5, carbs: 44, fat: 21, sodium: 220 },
  { itemId: "m8", name: "Dark Chocolate Pot", calories: 420, protein: 6, carbs: 38, fat: 28, sodium: 180 },
];
