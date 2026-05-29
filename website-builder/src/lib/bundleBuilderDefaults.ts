import { defaultCatalogProducts } from './productDefaults'

export const BUNDLE_BUILDER_DEFAULTS = {
  bundleBuilderLayout: 'grid' as const,
  bundleBuilderMinItems: 2,
  bundleBuilderMaxItems: 4,
  bundleBuilderDiscountPercent: 10,
  showBundleBuilderSavings: true,
}

export function defaultBundleBuilderProps() {
  const products = defaultCatalogProducts()
  return {
    text: 'Build your bundle',
    subtitle: 'Pick items to create a custom set and unlock savings',
    products,
    buttonText: 'Add bundle to cart',
    bundleBuilderPreviewSelectedIds: products.slice(0, 2).map((p) => p.id),
    ...BUNDLE_BUILDER_DEFAULTS,
  }
}
