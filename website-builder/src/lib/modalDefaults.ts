export const MODAL_DEFAULTS = {
  modalLayout: 'classic' as const,
  modalIcon: 'gift' as const,
  modalAutoShow: true,
  showModalClose: true,
  showModalBackdrop: true,
  modalBackdropBlur: true,
  showModalSecondary: true,
  modalOverlayOpacity: 0.55,
  modalTriggerText: 'Open modal preview',
}

const MODAL_IMG =
  'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800&q=80'

export function defaultModalProps() {
  return {
    text: "You're on the list!",
    subtitle:
      'Thanks for subscribing. Check your inbox for a welcome offer and early access to new drops.',
    buttonText: 'Continue shopping',
    buttonText2: 'Maybe later',
    buttonLink: '#products',
    imageUrl: MODAL_IMG,
    imageAlt: 'Promotional offer',
    ...MODAL_DEFAULTS,
  }
}
