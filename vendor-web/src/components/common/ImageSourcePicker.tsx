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
  /** Allow multiple gallery picks and multi file device upload. */
  galleryMultiSelect?: boolean
  /** Handle image as a File (device, gallery, or fetched URL). */
  onFile: (file: File) => void | Promise<void>
  /** Optional batch handler for multiple files (gallery multi or device multi). */
  onFiles?: (files: File[]) => void | Promise<void>
  /** Optional: set a URL directly instead of uploading a File. */
  onUrl?: (url: string) => void | Promise<void>
  /** When true, gallery/URL picks call onUrl directly (no fetch + re-upload). */
  preferDirectUrl?: boolean
  buttonLabel?: string
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon'
  buttonClassName?: string
  className?: string
  deviceHint?: string
  children?: ReactNode | ((props: ImageSourcePickerTriggerProps) => ReactNode)
}

async function remoteUrlsToFiles(
  urls: string[],
  onFile: (file: File) => void | Promise<void>,
  onFiles?: (files: File[]) => void | Promise<void>,
  onUrl?: (url: string) => void | Promise<void>,
) {
  const files: File[] = []
  for (const url of urls) {
    try {
      files.push(await galleryImageToFile(url))
    } catch {
      if (onUrl) {
        await onUrl(url)
        continue
      }
      throw new Error('Could not load image')
    }
  }
  if (files.length === 0) return
  if (onFiles) {
    await onFiles(files)
  } else {
    for (const file of files) {
      await onFile(file)
    }
  }
}

async function remoteUrlToFileOrUrl(
  url: string,
  onFile: (file: File) => void | Promise<void>,
  onUrl?: (url: string) => void | Promise<void>,
  preferDirectUrl?: boolean,
) {
  if (preferDirectUrl && onUrl) {
    await onUrl(url)
    return
  }
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
  galleryMultiSelect = false,
  onFile,
  onFiles,
  onUrl,
  preferDirectUrl = false,
  buttonLabel = 'Upload image',
  buttonVariant = 'outline',
  buttonSize = 'sm',
  buttonClassName,
  className,
  deviceHint,
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
    window.requestAnimationFrame(() => {
      fileRef.current?.click()
    })
  }

  const handleRemote = useCallback(
    async (url: string) => {
      await remoteUrlToFileOrUrl(url, onFile, onUrl, preferDirectUrl)
    },
    [onFile, onUrl, preferDirectUrl],
  )

  const handleRemoteMany = useCallback(
    async (urls: string[]) => {
      await remoteUrlsToFiles(urls, onFile, onFiles, onUrl)
    },
    [onFile, onFiles, onUrl],
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    e.target.value = ''
    if (!list?.length) return
    const files = Array.from(list)
    try {
      if (files.length > 1 && onFiles) {
        await onFiles(files)
      } else if (files.length > 1) {
        for (const file of files) await onFile(file)
      } else if (files[0]) {
        await onFile(files[0])
      }
    } catch {
      // Caller should toast; avoid unhandled rejection if they do not.
    }
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
        multiple={galleryMultiSelect}
        className="hidden"
        onChange={handleFileChange}
      />

      <MediaUploadPickerModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        showGallery={showGallery}
        deviceHint={deviceHint}
        galleryMultiSelect={galleryMultiSelect}
        onChooseLocal={handleLocal}
        onChooseGalleryUrl={handleRemote}
        onChooseGalleryUrls={galleryMultiSelect ? handleRemoteMany : undefined}
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
  galleryMultiSelect = false,
  deviceHint,
  onFile,
  onFiles,
  onUrl,
}: Pick<ImageSourcePickerProps, 'title' | 'accept' | 'showGallery' | 'galleryMultiSelect' | 'deviceHint' | 'onFile' | 'onFiles' | 'onUrl'>) {
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const openPicker = useCallback(() => setOpen(true), [])

  const handleLocal = () => {
    setOpen(false)
    window.requestAnimationFrame(() => {
      fileRef.current?.click()
    })
  }

  const handleRemote = useCallback(
    async (url: string) => {
      await remoteUrlToFileOrUrl(url, onFile, onUrl)
    },
    [onFile, onUrl],
  )

  const handleRemoteMany = useCallback(
    async (urls: string[]) => {
      await remoteUrlsToFiles(urls, onFile, onFiles, onUrl)
    },
    [onFile, onFiles, onUrl],
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    e.target.value = ''
    if (!list?.length) return
    const files = Array.from(list)
    try {
      if (files.length > 1 && onFiles) {
        await onFiles(files)
      } else if (files.length > 1) {
        for (const file of files) await onFile(file)
      } else if (files[0]) {
        await onFile(files[0])
      }
    } catch {
      // Caller should toast; avoid unhandled rejection if they do not.
    }
  }

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept={accept}
      multiple={galleryMultiSelect}
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
      deviceHint={deviceHint}
      galleryMultiSelect={galleryMultiSelect}
      onChooseLocal={handleLocal}
      onChooseGalleryUrl={handleRemote}
      onChooseGalleryUrls={galleryMultiSelect ? handleRemoteMany : undefined}
      onChooseExternalUrl={handleRemote}
    />
  )

  return { openPicker, fileInput, modal }
}
