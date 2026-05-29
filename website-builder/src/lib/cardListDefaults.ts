import { createDefaultCard } from './cardDefaults'
import type { CardItem } from '../types/builder'

const IMG = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80'
const IMG2 = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80'
const IMG3 = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80'

export function defaultCardListItems(): CardItem[] {
  return [
    createDefaultCard({
      title: 'Wireless Headphones',
      description: 'Premium sound with active noise cancellation and 30-hour battery life.',
      imageUrl: IMG,
      badge: 'Best Seller',
      price: '$199',
      buttonText: 'View product',
      link: '#products',
    }),
    createDefaultCard({
      title: 'Smart Watch Pro',
      description: 'Track fitness, notifications, and health metrics in a sleek design.',
      imageUrl: IMG2,
      badge: 'New',
      price: '$249',
      buttonText: 'View product',
      link: '#products',
    }),
    createDefaultCard({
      title: 'Running Shoes',
      description: 'Lightweight cushioning built for comfort on every mile.',
      imageUrl: IMG3,
      badge: '',
      price: '$129',
      buttonText: 'Shop now',
      link: '#products',
    }),
  ]
}

export function defaultCardListViewProps() {
  return {
    text: 'Featured Items',
    subtitle: 'Browse our top picks',
    cards: defaultCardListItems(),
    showListImage: true,
    showListBadge: true,
    showListPrice: true,
    showListButton: true,
    showViewAllButton: false,
    viewAllButtonText: 'View all',
    viewAllButtonLink: '#services',
    cardImageHeight: '176px',
  }
}
