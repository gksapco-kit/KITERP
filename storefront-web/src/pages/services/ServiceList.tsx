import ProductList from '@/pages/products/ProductList'

/** Services catalogue — same filters as Products, with Type defaulted to Services. */
export default function ServiceList() {
  return <ProductList defaultFilterType="services" />
}
