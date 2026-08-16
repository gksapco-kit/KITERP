import { Copy, Mail, MessageCircle, MessageSquare, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  url?: string
  priceLabel?: string
  overlay?: boolean
  className?: string
}

function resolveShareUrl(url?: string): string {
  if (url?.trim()) return url.trim()
  if (typeof window !== 'undefined') return window.location.href
  return ''
}

function buildShareText(title: string, url: string, priceLabel?: string): string {
  return [title, priceLabel, url].filter(Boolean).join('\n')
}

function smsHref(text: string): string {
  const body = encodeURIComponent(text)
  if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return `sms:&body=${body}`
  }
  return `sms:?body=${body}`
}

export function CatalogShareButton({ title, url, priceLabel, overlay = false, className }: Props) {
  const shareUrl = resolveShareUrl(url)
  const text = buildShareText(title, shareUrl, priceLabel)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  const shareNative = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl })
        return
      }
    } catch {
      return
    }
    await copyLink()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'inline-flex shrink-0 items-center justify-center p-0',
            overlay && 'border-gray-200/80 bg-white/95 shadow-md backdrop-blur-sm hover:bg-white',
            className ?? 'h-10 w-10',
          )}
          aria-label="Share"
          onClick={e => e.stopPropagation()}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem
          onSelect={() => {
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
          }}
        >
          <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            window.open(
              `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`,
              '_self',
            )
          }}
        >
          <Mail className="mr-2 h-4 w-4 text-blue-600" />
          Email
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            window.location.href = smsHref(text)
          }}
        >
          <MessageSquare className="mr-2 h-4 w-4 text-violet-600" />
          Message
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { void copyLink() }}>
          <Copy className="mr-2 h-4 w-4" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { void shareNative() }}>
          <Share2 className="mr-2 h-4 w-4" />
          More
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
