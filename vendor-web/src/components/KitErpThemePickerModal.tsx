import { Check } from 'lucide-react'
import { ModalBody, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { KIT_ERP_THEME_OPTIONS, type KitErpThemeId } from '@/lib/kitErpThemes'
import { useThemeStore } from '@/stores/themeStore'

type KitErpThemePickerModalProps = {
  open: boolean
  onClose: () => void
}

export function KitErpThemePickerModal({ open, onClose }: KitErpThemePickerModalProps) {
  const colorTheme = useThemeStore((s) => s.colorTheme)
  const setColorTheme = useThemeStore((s) => s.setColorTheme)
  const layoutTemplate = useThemeStore((s) => s.layoutTemplate)
  const setLayoutTemplate = useThemeStore((s) => s.setLayoutTemplate)

  if (!open) return null

  const handleSelect = (id: KitErpThemeId) => {
    setColorTheme(id)
    onClose()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-lg bg-card text-card-foreground">
        <div className="border-b border-border px-5 py-4">
          <ModalHeader
            title="Change KIT ERP theme"
            subtitle={
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a color palette for buttons, sidebar highlights, and accents across the dashboard.
              </p>
            }
            onClose={onClose}
          />
        </div>
        <ModalBody className="px-5 py-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {KIT_ERP_THEME_OPTIONS.map((theme) => {
              const selected = colorTheme === theme.id
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleSelect(theme.id)}
                  className={cn(
                    'group relative flex flex-col overflow-hidden rounded-lg border text-left transition-all',
                    'hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-primary ring-2 ring-primary/25 shadow-sm'
                      : 'border-border bg-card',
                  )}
                  aria-pressed={selected}
                  aria-label={`Apply ${theme.name} theme`}
                >
                  <div
                    className="flex h-14 items-stretch border-b border-border/80"
                    aria-hidden
                  >
                    {theme.swatches.map((color, i) => (
                      <span
                        key={`${theme.id}-${i}`}
                        className="flex-1"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="truncate text-xs font-semibold text-foreground">{theme.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                      {theme.description}
                    </p>
                  </div>
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Layout template
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLayoutTemplate('default')}
                aria-pressed={layoutTemplate === 'default'}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  layoutTemplate === 'default'
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/25'
                    : 'border-border bg-card text-foreground hover:border-primary/50',
                )}
              >
                Template 1
              </button>
              <button
                type="button"
                onClick={() => setLayoutTemplate('template2')}
                aria-pressed={layoutTemplate === 'template2'}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  layoutTemplate === 'template2'
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/25'
                    : 'border-border bg-card text-foreground hover:border-primary/50',
                )}
              >
                Template 2
              </button>
            </div>
          </div>
        </ModalBody>
      </ModalPanel>
    </ModalOverlay>
  )
}
