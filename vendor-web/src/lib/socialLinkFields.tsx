import type { ComponentType } from 'react'
import {
  Globe, MessageCircle, Instagram, Facebook, Twitter, Youtube,
  Linkedin, Github, Send,
} from 'lucide-react'

export type SocialLinkFieldKind = 'url' | 'phone'

export type SocialLinkFieldDef = {
  key: string
  label: string
  placeholder: string
  kind: SocialLinkFieldKind
  Icon: ComponentType<{ className?: string }>
}

function BrandSvg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className ?? 'h-4 w-4'} fill="currentColor">
      {children}
    </svg>
  )
}

const TikTokIcon = ({ className }: { className?: string }) => (
  <BrandSvg className={className}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </BrandSvg>
)

const PinterestIcon = ({ className }: { className?: string }) => (
  <BrandSvg className={className}>
    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.097.118.112.224.083.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.748-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.987C24.007 5.367 18.641.001 12.017.001z" />
  </BrandSvg>
)

const SnapchatIcon = ({ className }: { className?: string }) => (
  <BrandSvg className={className}>
    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.539-.074.832 0 .449-.225.844-.727 1.093-.659.39-1.693.645-2.774.645-.24 0-.45-.015-.659-.045-.659-.075-1.349-.225-2.059-.435-.405-.12-.809-.24-1.199-.24-.36 0-.754.12-1.199.27-.794.24-1.644.509-2.574.509-.809 0-1.559-.24-2.129-.645-.465-.375-.705-.779-.705-1.199 0-.225.03-.479.074-.704.045-.225.105-.479.15-.644.405-.105 1.23-.36 1.649-.779.405-.405.645-.959.645-1.593 0-.375-.075-.705-.18-1.005-.12-.345-.285-.659-.465-.929-.45-.659-1.139-1.019-1.799-1.019-.24 0-.465.045-.659.12-.405.135-.705.345-.915.555-.21.21-.36.435-.435.555-.075.12-.135.21-.18.255-.045.045-.09.075-.135.09-.045.015-.09.015-.135.015-.24 0-.435-.12-.585-.345-.15-.225-.225-.525-.225-.885 0-.66.24-1.365.705-1.995.465-.63 1.125-1.155 1.875-1.455.75-.3 1.575-.435 2.385-.435z" />
  </BrandSvg>
)

export const SOCIAL_LINK_FIELDS: SocialLinkFieldDef[] = [
  { key: 'website', label: 'Website', placeholder: 'https://yourstore.com', kind: 'url', Icon: Globe },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+91 98765 43210', kind: 'phone', Icon: MessageCircle },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourstore', kind: 'url', Icon: Instagram },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourstore', kind: 'url', Icon: Facebook },
  { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/yourstore', kind: 'url', Icon: Twitter },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourstore', kind: 'url', Icon: Youtube },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourstore', kind: 'url', Icon: Linkedin },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourstore', kind: 'url', Icon: TikTokIcon },
  { key: 'pinterest', label: 'Pinterest', placeholder: 'https://pinterest.com/yourstore', kind: 'url', Icon: PinterestIcon },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/yourstore', kind: 'url', Icon: Github },
  { key: 'telegram', label: 'Telegram', placeholder: 'https://t.me/yourstore', kind: 'url', Icon: Send },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'https://snapchat.com/add/yourstore', kind: 'url', Icon: SnapchatIcon },
]

export function SocialLinkFieldIcon({
  field,
  className,
  filled,
}: {
  field: SocialLinkFieldDef
  className?: string
  filled?: boolean
}) {
  const { Icon } = field
  const boxClass = filled
    ? 'bg-primary/10 text-primary ring-primary/20'
    : 'bg-muted text-muted-foreground ring-border'

  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${boxClass} ${className ?? ''}`}
    >
      <Icon className="h-4 w-4" />
    </span>
  )
}
