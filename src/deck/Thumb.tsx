import type { ReactNode } from 'react'
import { useFitScale } from './useFitScale'

/** A 1280x720 slide scaled down to fit whatever box it is dropped into. */
export function Thumb({ children, className }: { children: ReactNode; className?: string }) {
  const [ref, scale] = useFitScale()
  return (
    <div ref={ref} className={`thumb ${className ?? ''}`}>
      <div className="thumb__inner" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}
