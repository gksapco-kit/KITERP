/**
 * Pricing / party groups shared between Customer records and product
 * "Party" price rules. A customer's `customer_group` here must match a
 * ProductPriceRule's `customer_group` for that rule to apply at checkout/POS.
 */
export const CUSTOMER_PRICING_GROUPS: { value: string; label: string }[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'vip', label: 'VIP' },
  { value: 'employee', label: 'Employee' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'agent', label: 'Agent' },
  { value: 'institutional', label: 'Institutional' },
  { value: 'government', label: 'Government' },
  { value: 'custom', label: 'Custom' },
]
