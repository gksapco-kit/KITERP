export const CHAT_FLOAT_DEFAULTS = {
  chatFloatProvider: 'whatsapp' as const,
  chatPhoneNumber: '15551234567',
  chatPrefillMessage: 'Hi! I have a question about your products.',
  chatFloatPosition: 'bottom-right' as const,
  chatFloatVariant: 'bubble' as const,
  buttonText: 'Chat on WhatsApp',
  chatGreeting: 'Need help? Message us on WhatsApp.',
  showChatPulse: true,
  showChatIcon: true,
}

export function defaultChatFloatProps() {
  return { ...CHAT_FLOAT_DEFAULTS }
}
