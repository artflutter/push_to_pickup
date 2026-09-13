import { SlideView } from './Slide'
import { slides } from './slides'

/**
 * Every slide, fully revealed, one per page. Open `?print` and use the
 * browser's Save as PDF — or run `npm run pdf`.
 */
export function Print() {
  return (
    <div className="print">
      {slides.map((slide) => (
        <div className="print__page" key={slide.id}>
          <SlideView slide={slide} step={0} frozen />
        </div>
      ))}
    </div>
  )
}
