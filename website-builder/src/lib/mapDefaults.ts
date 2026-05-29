import type { BlockProps } from '../types/builder'

export function defaultMapEmbedProps(): BlockProps {
  return {
    visible: true,
    text: 'Find Us',
    subtitle: 'We look forward to seeing you.',
    location: '123 Business Ave, San Francisco, CA 94102',
    mapHeight: '400px',
    showDirectionsLink: false,
  }
}
