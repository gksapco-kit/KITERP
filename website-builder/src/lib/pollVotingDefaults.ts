import { v4 as uuid } from 'uuid'
import type { PollOptionItem } from '../types/builder'

export const POLL_VOTING_DEFAULTS = {
  pollLayout: 'bars' as const,
  pollTheme: 'premium' as const,
  showPollResults: true,
  showPollVoteCount: true,
  pollTotalVotes: 248,
}

export function createPollOption(overrides: Partial<PollOptionItem> = {}): PollOptionItem {
  return {
    id: uuid(),
    label: 'Option',
    votes: 0,
    enabled: true,
    ...overrides,
  }
}

export function defaultPollOptions(): PollOptionItem[] {
  return [
    createPollOption({ label: 'Ship dark mode first', votes: 112 }),
    createPollOption({ label: 'Focus on mobile app', votes: 78 }),
    createPollOption({ label: 'Improve onboarding', votes: 58 }),
  ]
}

export function defaultPollVotingProps() {
  return {
    text: 'What should we build next?',
    subtitle: 'Cast your vote — results update in real time',
    pollOptions: defaultPollOptions(),
    buttonText: 'Submit vote',
    ...POLL_VOTING_DEFAULTS,
  }
}
