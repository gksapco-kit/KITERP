import {
  ArrowRight,
  Award,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  Gift,
  Globe,
  Heart,
  Home,
  Key,
  Link2,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  Percent,
  Phone,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  ThumbsUp,
  Truck,
  Upload,
  User,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export type BuilderOverlayIconId = string

export type BuilderOverlayIconEntry = {
  id: BuilderOverlayIconId
  label: string
  Icon: LucideIcon
  category: string
}

export const DEFAULT_BUILDER_OVERLAY_ICON_ID = 'star'

/** Curated Lucide icons for overlay layers — shared by builder and storefront preview. */
export const BUILDER_OVERLAY_ICONS: BuilderOverlayIconEntry[] = [
  { id: 'star', label: 'Star', Icon: Star, category: 'Popular' },
  { id: 'heart', label: 'Heart', Icon: Heart, category: 'Popular' },
  { id: 'sparkles', label: 'Sparkles', Icon: Sparkles, category: 'Popular' },
  { id: 'zap', label: 'Zap', Icon: Zap, category: 'Popular' },
  { id: 'award', label: 'Award', Icon: Award, category: 'Popular' },
  { id: 'gift', label: 'Gift', Icon: Gift, category: 'Popular' },
  { id: 'crown', label: 'Crown', Icon: Crown, category: 'Popular' },
  { id: 'thumbs-up', label: 'Thumbs up', Icon: ThumbsUp, category: 'Popular' },
  { id: 'check', label: 'Check', Icon: Check, category: 'Popular' },
  { id: 'check-circle', label: 'Check circle', Icon: CheckCircle2, category: 'Popular' },
  { id: 'shopping-bag', label: 'Shopping bag', Icon: ShoppingBag, category: 'Commerce' },
  { id: 'shopping-cart', label: 'Cart', Icon: ShoppingCart, category: 'Commerce' },
  { id: 'credit-card', label: 'Card', Icon: CreditCard, category: 'Commerce' },
  { id: 'tag', label: 'Tag', Icon: Tag, category: 'Commerce' },
  { id: 'percent', label: 'Percent', Icon: Percent, category: 'Commerce' },
  { id: 'truck', label: 'Truck', Icon: Truck, category: 'Commerce' },
  { id: 'package', label: 'Package', Icon: Package, category: 'Commerce' },
  { id: 'store', label: 'Store', Icon: Store, category: 'Commerce' },
  { id: 'mail', label: 'Mail', Icon: Mail, category: 'Contact' },
  { id: 'phone', label: 'Phone', Icon: Phone, category: 'Contact' },
  { id: 'message-circle', label: 'Message', Icon: MessageCircle, category: 'Contact' },
  { id: 'map-pin', label: 'Map pin', Icon: MapPin, category: 'Contact' },
  { id: 'clock', label: 'Clock', Icon: Clock, category: 'Contact' },
  { id: 'calendar', label: 'Calendar', Icon: Calendar, category: 'Contact' },
  { id: 'bell', label: 'Bell', Icon: Bell, category: 'Contact' },
  { id: 'share-2', label: 'Share', Icon: Share2, category: 'Social' },
  { id: 'link', label: 'Link', Icon: Link2, category: 'Social' },
  { id: 'globe', label: 'Globe', Icon: Globe, category: 'Social' },
  { id: 'users', label: 'Users', Icon: Users, category: 'Social' },
  { id: 'user', label: 'User', Icon: User, category: 'Social' },
  { id: 'arrow-right', label: 'Arrow', Icon: ArrowRight, category: 'UI' },
  { id: 'chevron-right', label: 'Chevron', Icon: ChevronRight, category: 'UI' },
  { id: 'external-link', label: 'External', Icon: ExternalLink, category: 'UI' },
  { id: 'download', label: 'Download', Icon: Download, category: 'UI' },
  { id: 'upload', label: 'Upload', Icon: Upload, category: 'UI' },
  { id: 'search', label: 'Search', Icon: Search, category: 'UI' },
  { id: 'menu', label: 'Menu', Icon: Menu, category: 'UI' },
  { id: 'home', label: 'Home', Icon: Home, category: 'UI' },
  { id: 'briefcase', label: 'Briefcase', Icon: Briefcase, category: 'Business' },
  { id: 'building-2', label: 'Building', Icon: Building2, category: 'Business' },
  { id: 'shield-check', label: 'Shield', Icon: ShieldCheck, category: 'Business' },
  { id: 'lock', label: 'Lock', Icon: Lock, category: 'Business' },
  { id: 'key', label: 'Key', Icon: Key, category: 'Business' },
  { id: 'settings', label: 'Settings', Icon: Settings, category: 'Business' },
  { id: 'wrench', label: 'Wrench', Icon: Wrench, category: 'Business' },
]

const iconById = new Map(BUILDER_OVERLAY_ICONS.map(entry => [entry.id, entry]))

export function resolveBuilderOverlayIcon(id?: string | null): LucideIcon {
  return iconById.get(id || '')?.Icon ?? Star
}

export function builderOverlayIconLabel(id?: string | null): string {
  return iconById.get(id || '')?.label ?? 'Star'
}

export function builderOverlayIconCategories(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of BUILDER_OVERLAY_ICONS) {
    if (!seen.has(entry.category)) {
      seen.add(entry.category)
      out.push(entry.category)
    }
  }
  return out
}

export function overlayIconRenderSize(item: { w: number; h: number; fontSize?: number }): number {
  if (item.fontSize && item.fontSize > 0) return item.fontSize
  return Math.max(16, Math.round(Math.min(item.w, item.h) * 0.55))
}
