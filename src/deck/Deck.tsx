import { AnimatePresence, motion } from 'motion/react'
import { SlideView, Stage } from './Slide'
import { useDeck } from './useDeck'
import { slides } from './slides'
import { Overview } from './Overview'

export function Deck() {
  const deck = useDeck(slides.length)
  const slide = slides[Math.min(deck.slide, slides.length - 1)]
  const progress = slides.length > 1 ? deck.slide / (slides.length - 1) : 1

  return (
    <div
      className="deck"
      onClick={(e) => {
        // Tap right half to advance, left half to go back. Ignore real UI clicks.
        if ((e.target as HTMLElement).closest('a, button, input, .no-nav')) return
        if (e.clientX > window.innerWidth * 0.5) deck.next()
        else deck.prev()
      }}
    >
      <Stage>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide.id}
            className="deck__slide"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <SlideView slide={slide} step={deck.step} onSteps={deck.reportSteps} />
          </motion.div>
        </AnimatePresence>
      </Stage>

      <div className="deck__chrome">
        <div className="deck__progress" style={{ transform: `scaleX(${progress})` }} />
        <div className="deck__counter">
          {deck.slide + 1} / {slides.length}
        </div>
      </div>

      {deck.blackout && <div className="deck__blackout" />}

      {deck.overview && (
        <Overview
          current={deck.slide}
          onPick={(i) => {
            deck.goTo(i)
            deck.setOverview(false)
          }}
          onClose={() => deck.setOverview(false)}
        />
      )}
    </div>
  )
}
