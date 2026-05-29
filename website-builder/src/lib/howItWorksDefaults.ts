import { v4 as uuid } from 'uuid'
import type { HowItWorksStep } from '../types/builder'

export const HOW_IT_WORKS_DEFAULTS = {
  howItWorksLayout: 'horizontal' as const,
  showStepNumbers: true,
}

export function createHowItWorksStep(overrides: Partial<HowItWorksStep> = {}): HowItWorksStep {
  return {
    id: uuid(),
    title: 'Step title',
    description: 'Short description of this step',
    icon: 'check',
    enabled: true,
    ...overrides,
  }
}

export function defaultHowItWorksSteps(): HowItWorksStep[] {
  return [
    {
      id: 'browse',
      title: 'Browse products',
      description: 'Explore our catalog and find what you need',
      icon: 'search',
      enabled: true,
    },
    {
      id: 'cart',
      title: 'Add to cart',
      description: 'Pick your favorites and add them in one click',
      icon: 'cart',
      enabled: true,
    },
    {
      id: 'checkout',
      title: 'Secure checkout',
      description: 'Pay safely with encrypted payment options',
      icon: 'credit-card',
      enabled: true,
    },
    {
      id: 'delivery',
      title: 'Fast delivery',
      description: 'Track your order until it arrives at your door',
      icon: 'truck',
      enabled: true,
    },
  ]
}

export function defaultHowItWorksProps() {
  return {
    text: 'How it works',
    subtitle: 'Four simple steps from browse to doorstep',
    howItWorksSteps: defaultHowItWorksSteps(),
    ...HOW_IT_WORKS_DEFAULTS,
  }
}
