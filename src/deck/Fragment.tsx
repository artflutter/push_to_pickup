import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useSlide } from './slideContext'

interface FragmentProps {
  children: ReactNode
  /** Pin this fragment to an explicit step instead of auto-numbering. */
  at?: number
  /** `fade` keeps layout stable, `enter` slides up, `hide` removes it entirely. */
  mode?: 'fade' | 'enter' | 'hide'
  className?: string
}

/**
 * Step-reveal wrapper. Auto-numbers in document order:
 *
 *   <F>first click</F>
 *   <F>second click</F>
 *   <F at={1}>also on the first click</F>
 */
export function F({ children, at, mode = 'enter', className }: FragmentProps) {
  const slide = useSlide()
  const [ordinal] = useState(() => slide.register(at))
  const visible = slide.static || slide.step >= ordinal

  if (mode === 'hide') {
    return visible ? <div className={className}>{children}</div> : null
  }

  return (
    <motion.div
      className={className}
      initial={false}
      animate={{
        opacity: visible ? 1 : mode === 'fade' ? 0.18 : 0,
        y: visible || mode === 'fade' ? 0 : 14,
        filter: visible ? 'blur(0px)' : 'blur(3px)',
      }}
      transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      {children}
    </motion.div>
  )
}
