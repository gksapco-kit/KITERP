import {
  AlignLeft, ArrowUp, Award, Bell, Building, CheckSquare, ChevronDown, ChevronRight, Cookie, AppWindow, SplitSquareHorizontal,
  Circle, CircleDot, Columns2, Columns3, CreditCard, FileText, Grid3x3, ShieldCheck,
  Tag, Ticket, Timer,
  HelpCircle, Image, Images, Inbox, LayoutGrid, Layers, Link, Mail, Megaphone,
  Menu, Minus, MousePointerClick, MoveVertical, MessageCircle, MessagesSquare, Loader2, RefreshCw, Newspaper, Package, Palette,
  PanelBottom, PanelLeft, PanelTop, Play, Plus, Quote, Rainbow, Rows, Search,
  ShoppingBag, ShoppingCart, SlidersHorizontal, Smartphone, Sparkles, Star,
  Table, Tags, TextCursor, Type, Upload, User, Users, Video, Wrench, Zap,
  GalleryHorizontal, Grid3x3 as GridIcon, Text, AlignLeft as AlignIcon, Maximize2, History,
  AlertTriangle, CheckCircle2, FileQuestion, LogOut, BarChart2, AtSign, ListOrdered,
  Heart, PlusCircle, PanelRight, UserCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BlockType } from '../types/builder'

export const blockIcons: Record<string, LucideIcon> = {
  Type, AlignLeft, AlignIcon, ArrowUp, MousePointerClick, Image, Minus, MoveVertical, Sparkles,
  LayoutGrid, Megaphone, Menu, PanelBottom, Quote, Mail, ShoppingBag, ShoppingCart,
  CreditCard, Plus, Tags, Wrench, FileText, Link, Circle, Award, Layers, Video,
  Palette, Zap, Columns2, Columns3, Bell, Rainbow, PanelTop, Newspaper, User,
  Star, GridIcon, Grid3x3, Rows, Inbox, TextCursor, ChevronDown, CheckSquare,
  CircleDot, Upload, Images, GalleryHorizontal, SlidersHorizontal, Play,
  Smartphone, PanelLeft, ChevronRight, HelpCircle, Users, Building, Package,
  MessageCircle,
  MessagesSquare,
  Loader2,
  RefreshCw,
  Table, Text, Search, Ticket, Timer, Tag, ShieldCheck, Cookie, AppWindow, SplitSquareHorizontal, Maximize2, History,
  AlertTriangle, CheckCircle2, FileQuestion, LogOut, BarChart2, AtSign, ListOrdered,
  Heart, PlusCircle, PanelRight, UserCircle,
}

export function getBlockIcon(name: string): LucideIcon {
  return blockIcons[name] ?? Type
}

export function isPaletteId(id: string | number): id is string {
  return typeof id === 'string' && id.startsWith('palette-')
}

export function getTypeFromPaletteId(id: string): BlockType {
  return id.replace('palette-', '') as BlockType
}
