import { useEffect, useMemo, useRef } from 'react'
import { useFitScale } from './useFitScale'
import { MDXProvider } from '@mdx-js/react'
import { SlideContext, type SlideRuntime } from './slideContext'
import { mdxComponents } from './mdxComponents'
import type { SlideModule } from './types'

interface SlideViewProps {
  slide: SlideModule
  step: number
  /** Fired once on mount with the number of fragments this slide contains. */
  onSteps?: (count: number) => void
  /** Render every fragment revealed and skip step tracking (overview, print, previews). */
  frozen?: boolean
}

export function SlideView({ slide, step, onSteps, frozen = false }: SlideViewProps) {
  const counter = useRef(0)

  const runtime = useMemo<SlideRuntime>(
    () => ({
      step,
      static: frozen,
      register: (at?: number) => {
        if (at != null) {
          counter.current = Math.max(counter.current, at)
          return at
        }
        counter.current += 1
        return counter.current
      },
    }),
    [step, frozen],
  )

  // Fragments register during the first render pass, so the count is final by
  // the time effects run. Report it so the deck knows when to advance.
  useEffect(() => {
    onSteps?.(counter.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id])

  const layout = slide.layout ?? 'default'

  return (
    <SlideContext.Provider value={runtime}>
      <MDXProvider components={mdxComponents}>
        <section
          className={`slide slide--${layout}${slide.theme === 'light' ? ' slide--light' : ''}`}
          data-slide={slide.id}
          style={slide.background ? { background: slide.background } : undefined}
        >
          {slide.title && <h1 className="slide__title">{slide.title}</h1>}
          {slide.subtitle && <p className="slide__subtitle">{slide.subtitle}</p>}
          <div className="slide__body">
            <slide.Content />
          </div>
        </section>
      </MDXProvider>
    </SlideContext.Provider>
  )
}

/**
 * Fixed 1280x720 canvas scaled to fit the viewport. Everything inside can use
 * absolute px sizes, which keeps typography identical on a laptop, a projector
 * and in the PDF export.
 */
export function Stage({ children }: { children: React.ReactNode }) {
  const [ref, scale] = useFitScale()
  return (
    <div ref={ref} className="stage">
      <div className="stage__canvas" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}
