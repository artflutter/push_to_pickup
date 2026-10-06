import { createContext, useContext } from 'react'
import type { MotionValue } from 'motion/react'

export const RainbowContext = createContext<{
  clock: MotionValue<number>
  winner: MotionValue<number>
  ready: MotionValue<boolean>
  prism: MotionValue<number>
  finale: MotionValue<number>
} | null>(null)
export const useRainbow = () => useContext(RainbowContext)
