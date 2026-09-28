import { createContext, useContext } from 'react'
import { useMotionValue, type MotionValue } from 'motion/react'

export const EndpointEntryContext = createContext<MotionValue<number> | null>(null)

export function useEndpointEntry(fallback = 0) {
  const still = useMotionValue(fallback)
  return useContext(EndpointEntryContext) ?? still
}
