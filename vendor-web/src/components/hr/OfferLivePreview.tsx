import { memo, useCallback } from 'react'
import { DocumentLivePreview } from '@/components/common/DocumentLivePreview'
import { createDefaultContinuationPage } from '@/lib/documentPreview'
import { layoutLabel } from '@/lib/offerLayouts'
import type { OfferLayoutId } from '@/lib/offerLayouts'

export const OfferLivePreview = memo(function OfferLivePreview({
  html,
  loading,
  layout,
  editable = false,
  onBodyChange,
  pageCount = 1,
  vendorName,
  accentColor,
}: {
  html: string
  loading?: boolean
  layout?: OfferLayoutId | string
  editable?: boolean
  onBodyChange?: (bodyHtml: string) => void
  pageCount?: number
  vendorName?: string
  accentColor?: string
}) {
  const createBlankPage = useCallback((nextPage: number) => {
    return createDefaultContinuationPage(nextPage, {
      heading: vendorName || 'Offer Letter',
      subtitle: `Page ${nextPage}`,
      accentColor: accentColor || '#1a56db',
      footerText: 'Computer-generated offer letter continuation page.',
    })
  }, [vendorName, accentColor])

  return (
    <DocumentLivePreview
      html={html}
      loading={loading}
      editable={editable}
      onBodyChange={onBodyChange}
      pageCount={pageCount}
      badge={layout ? layoutLabel(layout) : undefined}
      hint="Click anywhere in the preview to edit header, body, footer, and tables. Use Add page for multi-page letters. Changes sync with the Content tab."
      emptyMessage={loading ? 'Loading…' : 'Select or create a template'}
      iframeTitle="Offer letter preview"
      createBlankPage={createBlankPage}
    />
  )
})
