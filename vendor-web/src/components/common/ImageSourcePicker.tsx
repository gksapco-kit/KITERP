import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  remoteImageToFile,
  MediaUploadPickerModal,
} from '@/components/common/MediaUploadPickerModal'
import { resolveBusinessGalleryDisplayUrl } from '@/data/businessImagePack'

/** Hidden but still activatable via programmatic .click() (display:none breaks some browsers). */
const PICKER_FILE_INPUT_CLASS = 'fixed left-[-9999px] top-0 h-px w-px opacity-0 overflow-hidden'

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
  /** Include website media library when listing stored uploads. */
  siteId?: string | null
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
      files.push(await remoteImageToFile(url))
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
  siteId,
  children,
}: ImageSourcePickerProps) {
  const [open, setOpen] = useState(false)
  const fileInputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)

  const openPicker = useCallback(() => {
    if (disabled || uploading) return
    setOpen(true)
  }, [disabled, uploading])

  const handleLocal = () => {
    fileRef.current?.click()
  }

  const closePicker = useCallback(() => setOpen(false), [])

  const handleRemote = useCallback(
    async (url: string) => {
      if (preferDirectUrl && onUrl) {
        await onUrl(url)
        closePicker()
        return
      }
      try {
        const file = await remoteImageToFile(url)
        closePicker()
        await onFile(file)
      } catch (err) {
        if (onUrl) {
          try {
            await onUrl(resolveBusinessGalleryDisplayUrl(url))
            closePicker()
            return
          } catch {
            // fall through to rethrow original fetch error
          }
        }
        throw err
      }
    },
    [closePicker, onFile, onUrl, preferDirectUrl],
  )

  const handleRemoteMany = useCallback(
    async (urls: string[]) => {
      try {
        if (preferDirectUrl && onUrl) {
          for (const url of urls) {
            await onUrl(url)
          }
          closePicker()
          return
        }
        const files: File[] = []
        for (const url of urls) {
          try {
            files.push(await remoteImageToFile(url))
          } catch {
            if (onUrl) {
              await onUrl(url)
              continue
            }
            throw new Error('Could not load image')
          }
        }
        closePicker()
        if (files.length === 0) return
        if (onFiles) {
          await onFiles(files)
        } else {
          for (const file of files) {
            await onFile(file)
          }
        }
      } catch {
        closePicker()
        throw new Error('Could not load image')
      }
    },
    [closePicker, onFile, onFiles, onUrl, preferDirectUrl],
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list?.length) return
    const files = Array.from(list)
    e.target.value = ''
    closePicker()
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
        id={fileInputId}
        ref={fileRef}
        type="file"
        accept={accept}
        multiple={galleryMultiSelect}
        className={PICKER_FILE_INPUT_CLASS}
        onChange={handleFileChange}
      />

      <MediaUploadPickerModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        showGallery={showGallery}
        deviceHint={deviceHint}
        siteId={siteId}
        galleryMultiSelect={galleryMultiSelect}
        deviceInputId={fileInputId}
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
  siteId,
  onFile,
  onFiles,
  onUrl,
}: Pick<ImageSourcePickerProps, 'title' | 'accept' | 'showGallery' | 'galleryMultiSelect' | 'deviceHint' | 'siteId' | 'onFile' | 'onFiles' | 'onUrl'>) {
  const [open, setOpen] = useState(false)
  const fileInputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)

  const openPicker = useCallback(() => setOpen(true), [])

  const handleLocal = () => {
    fileRef.current?.click()
  }

  const closePicker = useCallback(() => setOpen(false), [])

  const handleRemote = useCallback(
    async (url: string) => {
      try {
        const file = await remoteImageToFile(url)
        closePicker()
        await onFile(file)
      } catch (err) {
        if (onUrl) {
          try {
            await onUrl(resolveBusinessGalleryDisplayUrl(url))
            closePicker()
            return
          } catch {
            // fall through to rethrow original fetch error
          }
        }
        throw err
      }
    },
    [closePicker, onFile, onUrl],
  )

  const handleRemoteMany = useCallback(
    async (urls: string[]) => {
      try {
        await remoteUrlsToFiles(urls, onFile, onFiles, onUrl)
        closePicker()
      } catch {
        closePicker()
        throw new Error('Could not load image')
      }
    },
    [closePicker, onFile, onFiles, onUrl],
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list?.length) return
    const files = Array.from(list)
    e.target.value = ''
    closePicker()
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
      id={fileInputId}
      ref={fileRef}
      type="file"
      accept={accept}
      multiple={galleryMultiSelect}
      className={PICKER_FILE_INPUT_CLASS}
      onChange={handleFileChange}
    />
  )

  const modal = (
    <>
      {fileInput}
      <MediaUploadPickerModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        showGallery={showGallery}
        deviceHint={deviceHint}
        siteId={siteId}
        galleryMultiSelect={galleryMultiSelect}
        deviceInputId={fileInputId}
        onChooseLocal={handleLocal}
        onChooseGalleryUrl={handleRemote}
        onChooseGalleryUrls={galleryMultiSelect ? handleRemoteMany : undefined}
        onChooseExternalUrl={handleRemote}
      />
    </>
  )

  return { openPicker, fileInput, modal }
}
