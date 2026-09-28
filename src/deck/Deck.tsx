import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useLayoutEffect, useRef } from 'react'
import { SlideView, Stage } from './Slide'
import { useDeck } from './useDeck'
import { slides } from './slides'
import { Overview } from './Overview'
import { Traveller, flightCamera, flightSkin, useIrisClip, useReveal } from './Traveller'
import { FLIGHT_HEIGHT } from './balloonMotion'
import { UIEntryContext } from './UICrawl'
import { BetweenContext } from './Between'
import { BETWEEN_DURATION, paperAt } from './betweenMotion'
import { PaperFold } from './PaperFold'

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

const appIndex = slides.findIndex((s) => s.id === '060-app-king')
const vendorIndex = slides.findIndex((s) => s.id === '070-vendor')
const uiIndex = slides.findIndex((s) => s.id === '090-ui')
const betweenIndex = slides.findIndex((s) => s.id === '100-between')

/** Fold just the printed UI; the stage and its bottom rule never deform. */
function BetweenScene({ deck }: { deck: ReturnType<typeof useDeck> }) {
  const atBetween = deck.slide === betweenIndex
  const progress = useMotionValue(atBetween ? 1 : 0)
  const source = useRef<HTMLDivElement>(null)
  const visibility = useTransform(progress, p => paperAt(p).fold > 0 ? 'hidden' : 'visible')
  useLayoutEffect(() => {
    const target = atBetween ? 1 : 0
    const animation = animate(progress, target, {
      duration: Math.abs(target - progress.get()) * BETWEEN_DURATION,
      ease: 'linear',
    })
    return () => animation.stop()
  }, [atBetween, progress])
  return <div className="between-scene">
    <motion.div ref={source} className="between-scene__ui" aria-hidden={atBetween} style={{ visibility }}>
      <SlideView slide={slides[uiIndex]} step={atBetween ? 3 : deck.step} index={uiIndex} active={!atBetween}
        onSteps={atBetween ? undefined : deck.reportSteps} onAdvance={atBetween ? undefined : deck.next} />
    </motion.div>
    <PaperFold progress={progress} source={source} />
    <BetweenContext.Provider value={progress}>
      <div className="between-scene__next" aria-hidden={!atBetween}>
        <SlideView slide={slides[betweenIndex]} step={atBetween ? deck.step : 0} index={betweenIndex} active={atBetween}
          onSteps={atBetween ? deck.reportSteps : undefined} onAdvance={atBetween ? deck.next : undefined} />
      </div>
    </BetweenContext.Provider>
    <div className="between-scene__rule" aria-hidden="true" />
  </div>
}

/** Both scenes keep their DOM and state. There is no page transition between them. */
function FlightScene({ deck }: { deck: ReturnType<typeof useDeck> }) {
  const atApp = deck.slide === appIndex
  useLayoutEffect(() => {
    flightCamera.jump(atApp ? 0 : FLIGHT_HEIGHT)
    // Set the camera only when entering this world from elsewhere in the deck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <motion.div className="flight-scene" style={{ background: flightSkin }}>
      <motion.div className="flight-scene__world" style={{ y: flightCamera }}>
        <div className="flight-scene__phone" aria-hidden={!atApp}>
          <SlideView slide={slides[appIndex]} step={atApp ? deck.step : 5} index={appIndex} active={atApp}
            onSteps={atApp ? deck.reportSteps : undefined} onAdvance={atApp ? deck.next : undefined} />
        </div>
        <div className="flight-scene__vendor" aria-hidden={atApp} data-waiting={atApp || deck.step === 0}>
          <SlideView slide={slides[vendorIndex]} step={atApp ? 0 : deck.step} index={vendorIndex} active={!atApp}
            onSteps={atApp ? undefined : deck.reportSteps} onAdvance={atApp ? undefined : deck.next} />
        </div>
      </motion.div>
    </motion.div>
  )
}

export function Deck() {
  const deck = useDeck(slides.length)
  const previousSlide = useRef(deck.slide)
  const enteringUI = previousSlide.current === vendorIndex && deck.slide === uiIndex && deck.step === 0
  useLayoutEffect(() => { previousSlide.current = deck.slide }, [deck.slide])
  const slide = slides[Math.min(deck.slide, slides.length - 1)]
  const progress = slides.length > 1 ? deck.slide / (slides.length - 1) : 1
  const reveal = useReveal()
  const irisClip = useIrisClip()
  const revealing = reveal != null && reveal.target === deck.slide
  const inFlightScene = deck.slide === appIndex || deck.slide === vendorIndex
  const inBetweenScene = deck.slide === uiIndex || deck.slide === betweenIndex

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
            key={inFlightScene ? 'app-vendor-world' : inBetweenScene ? 'ui-between-world' : slide.id}
            className="deck__slide"
            custom={reveal}
            variants={slideMotion}
            initial={enteringUI ? false : 'enter'}
            animate="show"
            exit="exit"
            style={revealing ? { clipPath: irisClip, zIndex: 2 } : undefined}
          >
            <UIEntryContext.Provider value={enteringUI}>
              {inFlightScene ? <FlightScene deck={deck} /> : inBetweenScene ? <BetweenScene deck={deck} /> :
                <SlideView slide={slide} step={deck.step} index={deck.slide} onSteps={deck.reportSteps} onAdvance={deck.next} />}
            </UIEntryContext.Provider>
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
