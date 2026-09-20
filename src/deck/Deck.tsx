import { AnimatePresence, motion } from 'motion/react'
import { SlideView, Stage } from './Slide'
import { useDeck } from './useDeck'
import { slides } from './slides'
import { Overview } from './Overview'
import { Traveller, useIrisClip, useReveal } from './Traveller'

const EASE = [0.22, 0.61, 0.36, 1] as const
type Reveal = { target: number } | null

/* A slide change is a crossfade with a little lift. When the orb reveals the
   new slide through its iris, the new one is clipped to the iris instead
   (style below) and the old one just holds underneath until it is covered. */
const slideMotion = {
  enter: (r: Reveal) => (r ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }),
  show: (r: Reveal) =>
    r ? { opacity: 1, y: 0, transition: { duration: 0 } } : { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE } },
  exit: (r: Reveal) =>
    r ? { opacity: 0, transition: { duration: 0.25, delay: 0.9 } } : { opacity: 0, y: -12, transition: { duration: 0.26, ease: EASE } },
}

export function Deck() {
  const deck = useDeck(slides.length)
  const slide = slides[Math.min(deck.slide, slides.length - 1)]
  const progress = slides.length > 1 ? deck.slide / (slides.length - 1) : 1
  const reveal = useReveal()
  const irisClip = useIrisClip()
  const revealing = reveal != null && reveal.target === deck.slide

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
        <AnimatePresence mode="sync" initial={false} custom={reveal}>
          <motion.div
            key={slide.id}
            className="deck__slide"
            custom={reveal}
            variants={slideMotion}
            initial="enter"
            animate="show"
            exit="exit"
            style={revealing ? { clipPath: irisClip, zIndex: 2 } : undefined}
          >
            <SlideView slide={slide} step={deck.step} index={deck.slide} onSteps={deck.reportSteps} onAdvance={deck.next} />
          </motion.div>
        </AnimatePresence>
        <Traveller slide={deck.slide} />
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
