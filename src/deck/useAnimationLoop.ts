import { useLayoutEffect, useRef } from 'react'
import { cancelFrame, frame, type MotionValue } from 'motion/react'

/** Continuous artwork only needs a frame subscription while it is visible and moving. */
export function useAnimationLoop(enabled: boolean | MotionValue<boolean>, update: (delta: number) => void) {
  const latest = useRef(update)
  useLayoutEffect(() => { latest.current = update })

  useLayoutEffect(() => {
    const tick = ({ delta }: { delta: number }) => latest.current(delta)
    let running = false
    const sync = () => {
      const next = !document.hidden && (typeof enabled === 'boolean' ? enabled : enabled.get())
      if (next === running) return
      running = next
      if (running) frame.update(tick, true)
      else cancelFrame(tick)
    }
    const stop = typeof enabled === 'boolean' ? undefined : enabled.on('change', sync)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      stop?.()
      cancelFrame(tick)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [enabled])
}
