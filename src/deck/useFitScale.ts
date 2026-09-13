import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Scale factor that fits a fixed `w x h` canvas inside the observed element.
 *
 * This has to be measured in JS: CSS cannot turn a length into the unitless
 * number `scale()` wants, so `scale(100vw / 1280)` is simply invalid and gets
 * dropped.
 */
export function useFitScale(w = 1280, h = 720): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      if (box.width && box.height) setScale(Math.min(box.width / w, box.height / h))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [w, h])

  return [ref, scale]
}
