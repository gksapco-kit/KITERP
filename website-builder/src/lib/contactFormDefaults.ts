import { v4 as uuid } from 'uuid'
import type { BlockProps, FormFieldItem } from '../types/builder'

export function createDefaultFormField(overrides: Partial<FormFieldItem> = {}): FormFieldItem {
  return {
    id: uuid(),
    label: 'Field label',
    type: 'text',
    placeholder: 'Enter value...',
    required: false,
    ...overrides,
  }
}

export function defaultContactFormFields(): FormFieldItem[] {
  return [
    createDefaultFormField({ label: 'Full name', type: 'text', placeholder: 'John Smith', required: true }),
    createDefaultFormField({ label: 'Email', type: 'email', placeholder: 'you@company.com', required: true }),
    createDefaultFormField({ label: 'Phone', type: 'tel', placeholder: '+1 (555) 000-0000' }),
    createDefaultFormField({ label: 'Subject', type: 'select', placeholder: '', options: ['General inquiry', 'Support', 'Sales'] }),
    createDefaultFormField({ label: 'Message', type: 'textarea', placeholder: 'How can we help you?', required: true }),
  ]
}

export function defaultContactFormProps(): BlockProps {
  return {
    visible: true,
    text: 'Get in Touch',
    subtitle: "Have a question or feedback? Fill out the form and we'll get back to you soon.",
    buttonText: 'Send Message',
    submitNote: 'We usually respond within one business day.',
    formFields: defaultContactFormFields(),
  }
}
