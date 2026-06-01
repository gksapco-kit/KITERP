import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  galleryImageToFile,
  MediaUploadPickerModal,
} from '@/components/common/MediaUploadPickerModal'

export type ImageSourcePickerTriggerProps = {
  open: () => void
  uploading: boolean
  disabled?: boolean
}

export type ImageSourcePickerProps = {
  /** Shown in modal as "Add {title}" */
  title: string
  accept?: string
  disabled?: boolean
  uploading?: boolean
  showGallery?: boolean
  /** Handle image as a File (device, gallery, or fetched URL). */
  onFile: (file: File) => void | Promise<void>
  /** Optional: set a URL directly instead of uploading a File. */
  onUrl?: (url: string) => void | Promise<void>
  buttonLabel?: string
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon'
  buttonClassName?: string
  className?: string
  children?: ReactNode | ((props: ImageSourcePickerTriggerProps) => ReactNode)
}

async function remoteUrlToFileOrUrl(
  url: string,
  onFile: (file: File) => void | Promise<void>,
  onUrl?: (url: string) => void | Promise<void>,
) {
  try {
    await onFile(await galleryImageToFile(url))
  } catch {
    if (onUrl) {
      await onUrl(url)
      return
    }
    throw new Error('Could not load image')
  }
}

export function ImageSourcePicker({
  title,
  accept = 'image/*',
  disabled,
  uploading = false,
  showGallery = true,
  onFile,
  onUrl,
  buttonLabel = 'Upload image',
  buttonVariant = 'outline',
  buttonSize = 'sm',
  buttonClassName,
  className,
  children,
}: ImageSourcePickerProps) {
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const openPicker = useCallback(() => {
    if (disabled || uploading) return
    setOpen(true)
  }, [disabled, uploading])

  const handleLocal = () => {
    setOpen(false)
    fileRef.current?.click()
  }

  const handleRemote = useCallback(
    async (url: string) => {
      await remoteUrlToFileOrUrl(url, onFile, onUrl)
    },
    [onFile, onUrl],
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await onFile(file)
  }

  const triggerProps: ImageSourcePickerTriggerProps = { open: openPicker, uploading, disabled }

  return (
    <div className={className}>
      {typeof children === 'function' ? (
        children(triggerProps)
      ) : children ?? (
        <Button
          type="button"
          variant={buttonVariant}
          size={buttonSize}
          disabled={disabled || uploading}
          className={cn('gap-1.5', buttonClassName)}
          onClick={openPicker}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploading ? 'Uploading…' : buttonLabel}
        </Button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />

      <MediaUploadPickerModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        showGallery={showGallery}
        onChooseLocal={handleLocal}
        onChooseGalleryUrl={handleRemote}
        onChooseExternalUrl={handleRemote}
      />
    </div>
  )
}

/** Hook for custom triggers while sharing modal + file-input wiring. */
export function useImageSourcePicker({
  title,
  accept = 'image/*',
  showGallery = true,
  onFile,
  onUrl,
}: Pick<ImageSourcePickerProps, 'title' | 'accept' | 'showGallery' | 'onFile' | 'onUrl'>) {
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const openPicker = useCallback(() => setOpen(true), [])

  const handleLocal = () => {
    setOpen(false)
    fileRef.current?.click()
  }

  const handleRemote = useCallback(
    async (url: string) => {
      await remoteUrlToFileOrUrl(url, onFile, onUrl)
    },
    [onFile, onUrl],
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await onFile(file)
  }

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept={accept}
      className="hidden"
      onChange={handleFileChange}
    />
  )

  const modal = (
    <MediaUploadPickerModal
      open={open}
      onClose={() => setOpen(false)}
      title={title}
      showGallery={showGallery}
      onChooseLocal={handleLocal}
      onChooseGalleryUrl={handleRemote}
      onChooseExternalUrl={handleRemote}
    />
  )

  return { openPicker, fileInput, modal }
}
