import * as React from "react"

interface AccordionContextValue {
  value: string | null
  onValueChange: (v: string) => void
}

const AccordionContext = React.createContext<AccordionContextValue>({
  value: null,
  onValueChange: () => {},
})

interface AccordionProps {
  type?: "single"
  collapsible?: boolean
  value?: string
  onValueChange?: (v: string) => void
  defaultValue?: string
  className?: string
  children: React.ReactNode
}

export function Accordion({
  value: controlledValue,
  onValueChange: onControlledChange,
  defaultValue,
  className,
  children,
}: AccordionProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | null>(defaultValue ?? null)

  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue

  const handleChange = (v: string) => {
    const next = v === value ? null : v
    setUncontrolledValue(next)
    onControlledChange?.(next ?? "")
  }

  return (
    <AccordionContext.Provider value={{ value: value ?? null, onValueChange: handleChange }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemContextValue {
  itemValue: string
  isOpen: boolean
  toggle: () => void
}

const AccordionItemContext = React.createContext<AccordionItemContextValue>({
  itemValue: "",
  isOpen: false,
  toggle: () => {},
})

interface AccordionItemProps {
  value: string
  className?: string
  children: React.ReactNode
}

export function AccordionItem({ value: itemValue, className, children }: AccordionItemProps) {
  const { value, onValueChange } = React.useContext(AccordionContext)
  const isOpen = value === itemValue
  const toggle = () => onValueChange(itemValue)

  return (
    <AccordionItemContext.Provider value={{ itemValue, isOpen, toggle }}>
      <div className={className}>{children}</div>
    </AccordionItemContext.Provider>
  )
}

interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function AccordionTrigger({ children, className, ...props }: AccordionTriggerProps) {
  const { isOpen, toggle } = React.useContext(AccordionItemContext)

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      className={className}
      onClick={toggle}
      {...props}
    >
      {children}
    </button>
  )
}

interface AccordionContentProps {
  children: React.ReactNode
  className?: string
}

export function AccordionContent({ children, className }: AccordionContentProps) {
  const { isOpen } = React.useContext(AccordionItemContext)
  if (!isOpen) return null
  return <div className={className}>{children}</div>
}
