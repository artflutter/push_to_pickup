import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useLayoutEffect, useMemo, useRef } from 'react'
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
import { EndpointEntryContext } from './endpointContext'
import { ENDPOINT_ENTRY_DURATION } from './endpointMotion'
import { RainbowContext } from './rainbowContext'
import { RAINBOW_CUES, rainbowCamera } from './rainbowMotion'
import { RainbowTraveller } from './Rainbow'
import { PRISM_END, PRISM_HIT, prismCamera, prismPhase } from './prismMotion'

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
const endpointsIndex = slides.findIndex((s) => s.id === '110-active-call')
const rainbowIndex = slides.findIndex((s) => s.id === '120-fast')
const metricsIndex = slides.findIndex((s) => s.id === '130-metrics')

/** One world: folded UI, endpoints, rainbow, and the prism that splits its beam. */
function BetweenScene({ deck }: { deck: ReturnType<typeof useDeck> }) {
  const atUI = deck.slide === uiIndex
  const atBetween = deck.slide === betweenIndex
  const atEndpoints = deck.slide === endpointsIndex
  const atRainbow = deck.slide === rainbowIndex
  const atMetrics = deck.slide === metricsIndex
  const rainbowEnd = RAINBOW_CUES[RAINBOW_CUES.length - 1]
  const progress = useMotionValue(atUI ? 0 : 1)
  const collapse = useMotionValue(atEndpoints || atRainbow || atMetrics ? ENDPOINT_ENTRY_DURATION : 0)
  const clock = useMotionValue(atMetrics ? rainbowEnd : atRainbow ? RAINBOW_CUES[Math.min(deck.step, RAINBOW_CUES.length - 1)] : 0)
  const prism = useMotionValue(atMetrics ? PRISM_END : 0)
  const winner = useMotionValue(2)
  const ready = useMotionValue(false)
  const rainbow = useMemo(() => ({ clock, winner, ready, prism }), [clock, winner, ready, prism])
  const camera = useTransform(() => -rainbowCamera(clock.get()) - prismCamera(prism.get()))
  const prismSkin = useTransform(prism, t => prismPhase(t, .025, PRISM_HIT))
  const source = useRef<HTMLDivElement>(null)
  const visibility = useTransform(progress, p => paperAt(p).fold > 0 ? 'hidden' : 'visible')
  useLayoutEffect(() => {
    const target = atUI ? 0 : 1
    const animation = animate(progress, target, {
      duration: Math.abs(target - progress.get()) * BETWEEN_DURATION,
      ease: 'linear',
    })
    return () => animation.stop()
  }, [atUI, progress])
  useLayoutEffect(() => {
    const target = atEndpoints || atRainbow || atMetrics ? ENDPOINT_ENTRY_DURATION : 0
    let animation: ReturnType<typeof animate> | undefined
    let stopWaiting = () => {}
    const start = () => {
      stopWaiting()
      animation = animate(collapse, target, { duration: Math.abs(target - collapse.get()), ease: 'linear' })
    }
    if ((atEndpoints || atRainbow || atMetrics) && progress.get() < 1) {
      stopWaiting = progress.on('change', p => { if (p >= 1) start() })
    } else start()
    return () => { stopWaiting(); animation?.stop() }
  }, [atEndpoints, atRainbow, atMetrics, collapse, progress])
  useLayoutEffect(() => {
    const target = atMetrics ? rainbowEnd : atRainbow ? RAINBOW_CUES[Math.min(deck.step, RAINBOW_CUES.length - 1)] : 0
    let animation: ReturnType<typeof animate> | undefined
    let stopWaiting = () => {}
    const start = () => {
      stopWaiting()
      animation = animate(clock, target, { duration: Math.abs(target - clock.get()), ease: 'linear' })
    }
    // A fast next click still lets the chosen endpoint connect before taking off.
    if (target > clock.get() && !ready.get()) {
      stopWaiting = ready.on('change', value => { if (value) start() })
    } else start()
    return () => { stopWaiting(); animation?.stop() }
  }, [atRainbow, atMetrics, clock, ready, deck.step, rainbowEnd])
  useLayoutEffect(() => {
    const target = atMetrics ? PRISM_END : 0
    let animation: ReturnType<typeof animate> | undefined
    let stopWaiting = () => {}
    const start = () => {
      stopWaiting()
      animation = animate(prism, target, { duration: Math.abs(target - prism.get()), ease: 'linear' })
    }
    // A fast next still completes the rainbow run and its three captions first.
    if (atMetrics && clock.get() < rainbowEnd - .001) {
      stopWaiting = clock.on('change', t => { if (t >= rainbowEnd - .001) start() })
    } else start()
    return () => { stopWaiting(); animation?.stop() }
  }, [atMetrics, prism, clock, rainbowEnd])
  return <div className="between-scene">
    <motion.div className="between-scene__prism-skin" style={{ opacity: prismSkin }} />
    <RainbowContext.Provider value={rainbow}>
      <motion.div className="between-scene__world" style={{ x: camera }}>
        <motion.div ref={source} className="between-scene__ui" style={{ visibility }}>
          <SlideView slide={slides[uiIndex]} step={atUI ? deck.step : 4} index={uiIndex} active={atUI}
            onSteps={atUI ? deck.reportSteps : undefined} onAdvance={atUI ? deck.next : undefined} />
        </motion.div>
        <PaperFold progress={progress} source={source} />
        <EndpointEntryContext.Provider value={collapse}>
          <BetweenContext.Provider value={progress}>
            <div className="between-scene__next">
              <SlideView slide={slides[betweenIndex]} step={atBetween ? deck.step : atEndpoints || atRainbow || atMetrics ? 2 : 0} index={betweenIndex} active={atBetween}
                onSteps={atBetween ? deck.reportSteps : undefined} onAdvance={atBetween ? deck.next : undefined} />
            </div>
          </BetweenContext.Provider>
          <div className="between-scene__endpoints">
            <SlideView slide={slides[endpointsIndex]} step={atEndpoints ? deck.step : atRainbow || atMetrics ? 2 : 0} index={endpointsIndex} active={atEndpoints}
              onSteps={atEndpoints ? deck.reportSteps : undefined} onAdvance={atEndpoints ? deck.next : undefined} />
          </div>
        </EndpointEntryContext.Provider>
        <div className="between-scene__rainbow">
          <SlideView slide={slides[rainbowIndex]} step={atRainbow ? deck.step : atMetrics ? 3 : 0} index={rainbowIndex} active={atRainbow}
            onSteps={atRainbow ? deck.reportSteps : undefined} onAdvance={atRainbow ? deck.next : undefined} />
        </div>
        <div className="between-scene__metrics">
          <SlideView slide={slides[metricsIndex]} step={0} index={metricsIndex} active={atMetrics}
            onSteps={atMetrics ? deck.reportSteps : undefined} onAdvance={atMetrics ? deck.next : undefined} />
        </div>
        <RainbowTraveller />
      </motion.div>
    </RainbowContext.Provider>
    <div className="between-scene__rule" />
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
        <div className="flight-scene__phone">
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
  const inBetweenScene = deck.slide === uiIndex || deck.slide === betweenIndex || deck.slide === endpointsIndex || deck.slide === rainbowIndex || deck.slide === metricsIndex

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
