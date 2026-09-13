import { useEffect, useRef } from 'react'
import { SlideView } from './Slide'
import { Thumb } from './Thumb'
import { slides } from './slides'

interface OverviewProps {
  current: number
  onPick: (index: number) => void
  onClose: () => void
}

/** Grid of every slide. `o` toggles it, click jumps. */
export function Overview({ current, onPick, onClose }: OverviewProps) {
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  }, [])

  return (
    <div className="overview no-nav" onClick={onClose}>
      <div className="overview__grid" onClick={(e) => e.stopPropagation()}>
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            ref={i === current ? activeRef : undefined}
            className={`overview__cell ${i === current ? 'is-current' : ''}`}
            onClick={() => onPick(i)}
          >
            <Thumb className="overview__thumb">
              <SlideView slide={slide} step={0} frozen />
            </Thumb>
            <div className="overview__caption">
              <span>{i + 1}</span>
              {slide.title ?? slide.id}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
