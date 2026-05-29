import { v4 as uuid } from 'uuid'
import type { TimelineEventItem } from '../types/builder'

export const TIMELINE_DEFAULTS = {
  timelineLayout: 'alternating' as const,
  timelineTheme: 'premium' as const,
  showTimelineDates: true,
  showTimelineConnector: true,
  showTimelineTags: true,
}

export function createTimelineEvent(overrides: Partial<TimelineEventItem> = {}): TimelineEventItem {
  return {
    id: uuid(),
    date: '2026',
    title: 'Event title',
    description: 'Describe this milestone',
    enabled: true,
    ...overrides,
  }
}

export function defaultTimelineEvents(): TimelineEventItem[] {
  return [
    createTimelineEvent({
      date: 'Mar 2024',
      title: 'Company founded',
      description: 'Started with a small team and a bold vision to simplify how teams ship products.',
      tag: 'Origin',
    }),
    createTimelineEvent({
      date: 'Sep 2024',
      title: 'Public beta launch',
      description: 'Opened the platform to early adopters and gathered feedback from 2,000+ teams.',
      tag: 'Launch',
    }),
    createTimelineEvent({
      date: 'Jan 2025',
      title: 'Series A funding',
      description: 'Raised capital to expand engineering, design, and customer success.',
      tag: 'Growth',
    }),
    createTimelineEvent({
      date: 'May 2025',
      title: 'Enterprise tier',
      description: 'Launched SSO, audit logs, and dedicated support for large organizations.',
      tag: 'Product',
    }),
    createTimelineEvent({
      date: '2026',
      title: 'Global expansion',
      description: 'New data centers and localized experiences across 12 regions.',
      tag: 'Scale',
    }),
  ]
}

export function defaultTimelineProps() {
  return {
    text: 'Our journey',
    subtitle: 'Key milestones that shaped where we are today',
    timelineEvents: defaultTimelineEvents(),
    ...TIMELINE_DEFAULTS,
  }
}
