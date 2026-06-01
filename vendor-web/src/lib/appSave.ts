import { toast } from 'sonner'

/** Header Save button — pages call `preventDefault()` when they handle the save. */
export const APP_SAVE_REQUEST_EVENT = 'app-save-request'

/** @deprecated Use APP_SAVE_REQUEST_EVENT */
export const SAVE_SETTINGS_SECTION_EVENT = 'save-settings-section'

export function dispatchAppSaveRequest(): void {
  const event = new CustomEvent(APP_SAVE_REQUEST_EVENT, { cancelable: true })
  const handled = !window.dispatchEvent(event)
  if (handled) return

  const trigger = document.querySelector<HTMLElement>('[data-app-save-trigger]:not([disabled])')
  if (trigger) {
    trigger.click()
    return
  }

  const form = document.querySelector<HTMLFormElement>('[data-app-save-form]')
  if (form) {
    form.requestSubmit()
    return
  }

  toast.info('Nothing to save on this page')
}
