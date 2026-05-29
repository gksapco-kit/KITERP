import { v4 as uuid } from 'uuid'
import type { StepperStepItem } from '../types/builder'

export const STEPPER_DEFAULTS = {
  stepperLayout: 'horizontal' as const,
  stepperTheme: 'premium' as const,
  stepperCurrentStep: 1,
  showStepperLabels: true,
  showStepperDescriptions: true,
}

export function createStepperStep(overrides: Partial<StepperStepItem> = {}): StepperStepItem {
  return {
    id: uuid(),
    title: 'Step',
    description: '',
    enabled: true,
    ...overrides,
  }
}

export function defaultStepperSteps(): StepperStepItem[] {
  return [
    createStepperStep({ title: 'Account', description: 'Sign in or create an account' }),
    createStepperStep({ title: 'Details', description: 'Shipping and billing info' }),
    createStepperStep({ title: 'Payment', description: 'Secure checkout' }),
    createStepperStep({ title: 'Confirm', description: 'Review and place order' }),
  ]
}

export function defaultStepperProps() {
  return {
    text: 'Checkout progress',
    subtitle: 'Track where you are in the flow',
    stepperSteps: defaultStepperSteps(),
    ...STEPPER_DEFAULTS,
  }
}
