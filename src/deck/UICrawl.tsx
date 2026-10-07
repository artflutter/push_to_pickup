import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, useIsPresent, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import { SlideContext, useSlide } from './slideContext'
import { APPLE, ANDROID, VendorPush } from './VendorPush'
import { PUSH_END } from './vendorPushMotion'
import { flightSkin, leavePushOrbBehind } from './Traveller'
import { type Point, type Rect } from './uiCrawlMotion'
import { CrawlJourney, type CrawlArtwork, type JourneyFrame } from './uiCrawlJourney'
import { useAnimationLoop } from './useAnimationLoop'

/** The deck cues this only for the adjacent vendor → UI hand-off. */
export const UIEntryContext = createContext(false)
const CrawlContext = createContext<MotionValue<JourneyFrame> | null>(null)
const DEFAULT_SLOTS: Rect[] = [
  { x: 72, y: 153.36, width: 560, height: 494.64 },
  { x: 648, y: 153.36, width: 560, height: 239.32 },
  { x: 648, y: 408.68, width: 560, height: 239.32 },
]

function sample(d: string): Point[] {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  const length = path.getTotalLength()
  return Array.from({ length: 96 }, (_, i) => {
    const p = path.getPointAtLength(length * i / 96)
    return { x: p.x, y: p.y }
  })
}

function makeArtwork(rect: Rect, part: number): CrawlArtwork {
  // Exactly the same logo transforms and final camera as 070.
  const path = part === 0 ? APPLE[1] : ANDROID[part === 1 ? 2 : 1]
  const points = sample(path).map(p => ({ x: (part === 0 ? 104 : 744) + p.x * 0.84375, y: 140 + p.y * 0.84375 }))
  const { x, y, width: w, height: h } = rect, r = 28
  const target = sample(`M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`)
  return { points, target }
}

function Crawler({ frame, part }: { frame: MotionValue<JourneyFrame>; part: number }) {
  const d = useTransform(frame, f => f.paths[part])
  const opacity = useTransform(frame, f => 1 - f.cards[part])
  const fillOpacity = useTransform(frame, f => f.fills[part] * .9)
  return <motion.path data-crawler={part} d={d} stroke="white" strokeWidth="2.5"
    fill="#1c1c1f" style={{ opacity, fillOpacity }} />
}

function SnakeHeadlight({ frame }: { frame: MotionValue<JourneyFrame> }) {
  const id = useId()
  const transform = useTransform(frame, ({ headlight: h }) => `translate(${h.x}px, ${h.y}px) rotate(${h.angle}deg)`)
  const level = useTransform(frame, f => f.headlight.opacity)
  const opacity = useSpring(level, { stiffness: 100, damping: 22 })
  return <motion.g className="ui-crawl__headlight" style={{ transform, opacity, originX: 0, originY: 0, transformBox: 'view-box' }}>
    <defs>
      <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="195" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="white" stopOpacity=".55" />
        <stop offset=".22" stopColor="white" stopOpacity=".28" />
        <stop offset=".65" stopColor="white" stopOpacity=".09" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-halo`}>
        <stop offset="0" stopColor="white" stopOpacity=".48" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-soft`} x="-20%" y="-30%" width="140%" height="160%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>
    <path d="M 0 -7 L 195 -78 Q 218 0 195 78 L 0 7 Z" fill={`url(#${id}-beam)`} filter={`url(#${id}-soft)`} />
    <ellipse cx="3" rx="28" ry="28" fill={`url(#${id}-halo)`} />
  </motion.g>
}

function CrawlOverlay({ frame, camera }: { frame: MotionValue<JourneyFrame>; camera: MotionValue<number> }) {
  const delivery = useMotionValue(PUSH_END)
  const id = useId()
  const donor = useTransform(frame, f => f.donor)
  const blue = useTransform(frame, f => f.blue)
  const black = useTransform(frame, f => f.black)
  const visibility = useTransform(frame, f => f.phase === 'arrived' ? 'hidden' : 'visible')
  return <motion.div className="ui-crawl__overlay" style={{ visibility }}>
    <motion.div className="ui-crawl__black" style={{ opacity: black }} />
    <motion.div className="ui-crawl__blue" style={{ opacity: blue, background: flightSkin }} />
    <svg viewBox="0 0 1280 720" className="ui-crawl__wire">
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 2 1 L 7 5 L 2 9" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </marker>
      </defs>
      <motion.g style={{ y: camera }}>
        <motion.g style={{ opacity: donor }}>
          <g transform="translate(-960 700)"><VendorPush progress={delivery} marker={`url(#${id})`} shown detached /></g>
        </motion.g>
        <SnakeHeadlight frame={frame} />
        {[0, 1, 2].map(part => <Crawler key={part} part={part} frame={frame} />)}
      </motion.g>
    </svg>
  </motion.div>
}

/** Step 0 is an open-ended wander; step 1 routes the live bodies into the UI. */
export function UICrawl({ children }: { children: ReactNode }) {
  const entry = useContext(UIEntryContext)
  const slide = useSlide()
  const present = useIsPresent()
  useState(() => slide.register(4))
  const [start] = useState({ fromVendor: entry && !slide.static && slide.step === 0,
    complete: slide.static || slide.active === false || slide.step > 0 })
  const ref = useRef<HTMLDivElement>(null)
  const [slots, setSlots] = useState(DEFAULT_SLOTS)
  const artwork = useMemo(() => slots.map(makeArtwork), [slots])
  const journey = useMemo(() => new CrawlJourney(artwork, start.fromVendor, start.complete), [artwork, start])
  const frame = useMotionValue(journey.frame)
  const camera = useTransform(frame, f => f.camera)
  const [phase, setPhase] = useState(journey.phase)
  const phaseRef = useRef(phase)
  const publish = useCallback((next: JourneyFrame) => {
    frame.set(next)
    if (phaseRef.current !== next.phase) {
      phaseRef.current = next.phase
      setPhase(next.phase)
    }
  }, [frame])

  useLayoutEffect(() => {
    if (!start.fromVendor || slide.static || slide.active === false || !present) return
    return leavePushOrbBehind(camera, slide.index)
  }, [slide.static, slide.active, slide.index, present, start, camera])

  useLayoutEffect(() => {
    const section = ref.current?.closest<HTMLElement>('.slide')
    if (!section) return
    const root = section.getBoundingClientRect(), scale = root.width / 1280
    if (scale && !start.complete) {
      const cards = [...section.querySelectorAll<HTMLElement>('.ui-crawl__slot .card')]
      if (cards.length === 3) setSlots(cards.map(card => {
        const r = card.getBoundingClientRect()
        return { x: (r.x - root.x) / scale, y: (r.y - root.y) / scale - (frame.get().camera - 1440), width: r.width / scale, height: r.height / scale }
      }))
    }
    const title = section.querySelector<HTMLElement>('.slide__title')
    const update = (f: JourneyFrame) => {
      if (!title) return
      title.style.opacity = String(f.title)
      title.style.transform = `translateY(${f.camera - 1440}px)`
    }
    update(frame.get())
    const off = frame.on('change', update)
    return () => { off(); if (title) { title.style.removeProperty('opacity'); title.style.removeProperty('transform') } }
  }, [frame, start])

  useLayoutEffect(() => {
    journey.setOpen(slide.static || slide.active === false || slide.step > 0)
    // The retained UI must be complete when the next scene takes its paper copy.
    if (slide.active === false) { journey.advance(60); journey.advance(60) }
    publish(journey.frame)
  }, [journey, slide.step, slide.static, slide.active, publish])

  useAnimationLoop(!slide.static && slide.active !== false && present && phase !== 'arrived', delta => {
    // Background tabs pause the simulation instead of teleporting on return.
    publish(journey.advance(Math.min(delta / 1000, .05)))
  })

  return <CrawlContext.Provider value={frame}>
    <SlideContext.Provider value={{ ...slide, step: phase === 'arrived' ? slide.step : 0 }}>
      <div ref={ref} className="ui-crawl" data-crawl-stage={phase}>
        {children}
        {!slide.static && <CrawlOverlay frame={frame} camera={camera} />}
      </div>
    </SlideContext.Provider>
  </CrawlContext.Provider>
}

export function UIArrival({ part, children }: { part: number; children: ReactNode }) {
  const frame = useContext(CrawlContext)!
  const opacity = useTransform(frame, f => f.cards[part])
  const y = useTransform(frame, f => f.camera - 1440)
  return <motion.div className="ui-crawl__slot" style={{ opacity, y }}>{children}</motion.div>
}
