export const CART_DRAWER_DEFAULTS = {
  cartDrawerSide: 'right' as const,
  cartDrawerTheme: 'light' as const,
  cartDrawerPreviewOpen: true,
  showCartDrawerCheckout: true,
  showCartDrawerSubtotal: true,
  buttonText: 'Cart',
}

export function defaultCartDrawerProps() {
  return {
    text: 'Your cart',
    subtitle: 'Review items before checkout',
    buttonText2: 'Checkout',
    ...CART_DRAWER_DEFAULTS,
  }
}

export const CART_DRAWER_SIDE_CLASS = {
  left: 'left-0',
  right: 'right-0',
} as const
