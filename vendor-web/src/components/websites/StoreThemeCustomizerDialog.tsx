import { ModalBody, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { StoreThemeCustomizer } from './StoreThemeCustomizer'

type Props = {
  open: boolean
  onClose: () => void
}

export function StoreThemeCustomizerDialog({ open, onClose }: Props) {
  if (!open) return null

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-6xl">
        <div className="shrink-0 border-b border-gray-100 px-4 sm:px-6 py-4">
          <ModalHeader
            title="Customize store theme"
            subtitle={
              <p className="text-sm text-gray-500 mt-1">
                Colors, fonts, layout, and homepage sections for your business front.
              </p>
            }
            onClose={onClose}
          />
        </div>
        <ModalBody className="px-4 sm:px-6 py-4 sm:py-5">
          <StoreThemeCustomizer embedded />
        </ModalBody>
      </ModalPanel>
    </ModalOverlay>
  )
}
