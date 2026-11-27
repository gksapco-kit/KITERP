import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type LandingScrollRevealVariant = 'section' | 'card' | 'pop' | 'tilt'

/** GPU-friendly: opacity + translate only (no blur / 3D — those jank on scroll). */
const REVEAL_VARIANTS: Record<LandingScrollRevealVariant, Variants> = {
  section: {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0 },
  },
  card: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },
  pop: {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1 },
  },
  tilt: {
    hidden: { opacity: 0, x: -12 },
    visible: { opacity: 1, x: 0 },
  },
}

type Props = {
  children: ReactNode
  className?: string
  variant?: LandingScrollRevealVariant
  delay?: number
}

export function LandingScrollReveal({
  children,
  className,
  variant = 'section',
  delay = 0,
}: Props) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={cn('kiterp-scroll-reveal', className)}
      variants={REVEAL_VARIANTS[variant]}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.12, margin: '0px 0px -8% 0px' }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      {children}
    </motion.div>
  )
}