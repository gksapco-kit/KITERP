import { memo, useCallback } from 'react'
import { DocumentLivePreview } from '@/components/common/DocumentLivePreview'
import { layoutLabel, createBlankOfferContinuationPage } from '@/lib/offerLayouts'
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
    return createBlankOfferContinuationPage({
      pageNumber: nextPage,
      vendorName,
      accentColor,
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
