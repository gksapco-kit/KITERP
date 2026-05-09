import { Page, Section } from "../KitLayout";
import { ProductGrid, ProductList } from "@/kit/products/ProductCard";
import { ProductDetail } from "@/kit/products/ProductDetail";
import { MiniCart } from "@/kit/products/MiniCart";
import { mockProducts, mockCartLines } from "@/kit/mock";

export default function ProductsShowcase() {
  return (
    <Page title="Products" intro="Cards, grids, lists, detail layout, mini-cart drawer body.">
      <Section title="Product grid (4 columns)"><ProductGrid products={mockProducts} columns={4} /></Section>
      <Section title="Product grid (3 columns)"><ProductGrid products={mockProducts.slice(0, 6)} columns={3} /></Section>
      <Section title="Product list (horizontal cards)"><ProductList products={mockProducts.slice(0, 4)} /></Section>
      <Section title="Product detail — split layout"><ProductDetail product={mockProducts[0]} /></Section>
      <Section title="Mini cart">
        <div className="max-w-md rounded-lg border h-[28rem] overflow-hidden"><MiniCart lines={mockCartLines} /></div>
      </Section>
    </Page>
  );
}
