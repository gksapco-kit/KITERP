import { defaultCatalogProducts } from './productDefaults'

export const FREQUENTLY_BOUGHT_TOGETHER_DEFAULTS = {
  bundleLayout: 'horizontal' as const,
  bundleTheme: 'premium' as const,
  showBundleSavings: true,
  bundleSavingsPercent: 15,
  bundleSavingsLabel: 'Save {percent}% when bought together',
}

export function defaultFrequentlyBoughtTogetherProps() {
  const all = defaultCatalogProducts()
  return {
    text: 'Frequently bought together',
    subtitle: 'Customers often purchase these items as a set',
    products: all,
    bundleMainProductId: all[0]?.id,
    buttonText: 'Add bundle to cart',
    ...FREQUENTLY_BOUGHT_TOGETHER_DEFAULTS,
  }
}
