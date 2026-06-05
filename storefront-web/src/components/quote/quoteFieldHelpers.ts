import type { QuoteFormField } from '@/types'
import { quoteFileIsEmpty } from './QuoteFileField'
import { quoteLocationIsEmpty } from './QuoteLocationField'

export function isQuoteFieldEmpty(field: QuoteFormField, value: string): boolean {
  if (field.type === 'document' || field.type === 'photo_video' || field.type === 'photo_document') {
    return quoteFileIsEmpty(value)
  }
  if (field.type === 'location') {
    return quoteLocationIsEmpty(value)
  }
  return !value?.trim()
}
