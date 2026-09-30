import { createContext, useContext } from 'react'
import type { MotionValue } from 'motion/react'
import type { SlideModule } from './types'

export const RainbowContext = createContext<{
  clock: MotionValue<number>
  winner: MotionValue<number>
  ready: MotionValue<boolean>
  metrics: SlideModule
  transitionHost: HTMLDivElement | null
} | null>(null)
export const useRainbow = () => useContext(RainbowContext)
