import { useEscapeToClose } from '@/hooks/useEscapeToClose'

/** Place inside an open modal overlay to close it with Escape. */
export function ModalEscapeHandler({ onClose }: { onClose: () => void }) {
  useEscapeToClose(onClose)
  return null
}
