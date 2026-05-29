import { v4 as uuid } from 'uuid'
import { createDefaultFormField } from './contactFormDefaults'
import type { FormStepItem } from '../types/builder'

export const MULTI_STEP_FORM_DEFAULTS = {
  multiStepFormLayout: 'numbered' as const,
  multiStepFormTheme: 'premium' as const,
  showMultiStepProgress: true,
  showMultiStepLabels: true,
  multiStepBackText: 'Back',
  multiStepNextText: 'Continue',
  multiStepSubmitText: 'Submit',
  multiStepSuccessTitle: 'Thank you!',
  multiStepSuccessMessage: 'Your submission has been received. We will be in touch shortly.',
}

export function createFormStep(overrides: Partial<FormStepItem> = {}): FormStepItem {
  return {
    id: uuid(),
    title: 'Step',
    description: '',
    fields: [createDefaultFormField()],
    enabled: true,
    ...overrides,
  }
}

export function defaultMultiStepFormSteps(): FormStepItem[] {
  return [
    createFormStep({
      title: 'Your details',
      description: 'Tell us how to reach you',
      fields: [
        createDefaultFormField({ label: 'Full name', type: 'text', placeholder: 'Jane Doe', required: true }),
        createDefaultFormField({ label: 'Work email', type: 'email', placeholder: 'jane@company.com', required: true }),
      ],
    }),
    createFormStep({
      title: 'Project info',
      description: 'Help us understand your needs',
      fields: [
        createDefaultFormField({ label: 'Company', type: 'text', placeholder: 'Acme Inc.' }),
        createDefaultFormField({
          label: 'Team size',
          type: 'select',
          options: ['1–10', '11–50', '51–200', '200+'],
          required: true,
        }),
        createDefaultFormField({
          label: 'Timeline',
          type: 'select',
          options: ['ASAP', '1–3 months', '3–6 months', 'Flexible'],
        }),
      ],
    }),
    createFormStep({
      title: 'Goals',
      description: 'Anything else we should know?',
      fields: [
        createDefaultFormField({
          label: 'Project goals',
          type: 'textarea',
          placeholder: 'Describe what you want to achieve…',
          required: true,
        }),
        createDefaultFormField({ label: 'Phone (optional)', type: 'tel', placeholder: '+1 (555) 000-0000' }),
      ],
    }),
  ]
}

export function defaultMultiStepFormProps() {
  return {
    text: 'Get started',
    subtitle: 'Complete the short wizard below — it only takes a minute',
    multiStepFormSteps: defaultMultiStepFormSteps(),
    submitNote: 'Your information is kept private and secure.',
    ...MULTI_STEP_FORM_DEFAULTS,
  }
}
