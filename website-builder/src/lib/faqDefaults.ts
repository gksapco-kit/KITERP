import { v4 as uuid } from 'uuid'
import type { BlockProps, FaqItem } from '../types/builder'

export function createDefaultFaqItem(overrides: Partial<FaqItem> = {}): FaqItem {
  return {
    id: uuid(),
    question: 'Your question here?',
    answer: 'Add a clear, helpful answer for your visitors.',
    ...overrides,
  }
}

export function defaultFaqItems(): FaqItem[] {
  return [
    createDefaultFaqItem({
      question: 'How does the website builder work?',
      answer: 'Drag components onto the canvas, customize text and styles in the panel, then preview or publish your live site instantly.',
    }),
    createDefaultFaqItem({
      question: 'Can I sell products and services?',
      answer: 'Yes. Choose your business type during setup to get product listings, services, cart, and checkout pages automatically.',
    }),
    createDefaultFaqItem({
      question: 'Is there a free trial?',
      answer: 'You can build and preview your site for free. Upgrade anytime when you are ready to connect a custom domain.',
    }),
    createDefaultFaqItem({
      question: 'How do I contact support?',
      answer: 'Use the contact page on your site or email our team — we typically respond within one business day.',
    }),
  ]
}

export function defaultFaqProps(): BlockProps {
  return {
    visible: true,
    text: 'Frequently Asked Questions',
    subtitle: "Quick answers to common questions. Can't find what you need? Reach out through our contact page.",
    faqItems: defaultFaqItems(),
  }
}
