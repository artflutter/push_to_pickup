import { createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useIsPresent, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { useSlide } from './slideContext'
import { APPLE, ANDROID, VendorPush } from './VendorPush'
import { PUSH_END } from './vendorPushMotion'
import { flightSkin, leavePushOrbBehind } from './Traveller'
import { CRAWL_END, alignContour, bounds, cardArrival, crawlAt, crawlCamera, crawlOutline, makeSnakeFrames, outlinePath, smooth, type CrawlShape, type Point, type Rect } from './uiCrawlMotion'

/** The deck cues this only for the adjacent vendor → UI hand-off. */
export const UIEntryContext = createContext(false)
const CrawlContext = createContext<MotionValue<number> | null>(null)
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

function makeShape(part: number, rect: Rect): CrawlShape {
  // Exactly the same 0.5625 × 1.5 logo transforms and final camera as 070.
  const path = part === 0 ? APPLE[1] : ANDROID[part === 1 ? 2 : 1]
  const points = sample(path).map(p => ({ x: (part === 0 ? 104 : 744) + p.x * 0.84375, y: 140 + p.y * 0.84375 }))
  const box = bounds(points)
  const { x, y, width: w, height: h } = rect
  const r = 28
  const target = sample(`M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`)
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const destination = { x: x + w / 2, y: y + h / 2 }
  const snake = makeSnakeFrames(points, center, destination, part)
  // Carry the original outline along the same grid steps while it becomes a snake.
  // Align the logo to each existing frame, preserving the snake's route and timing.
  const departure = snake.slice(0, 4).map(frame => {
    const at = bounds(frame)
    const dx = at.x + at.width / 2 - center.x, dy = at.y + at.height / 2 - center.y
    return alignContour(frame, points).map(p => ({ x: p.x + dx, y: p.y + dy }))
  })
  return { part, points, snake, departure, target: alignContour(snake[snake.length - 1], target) }
}

function Crawler({ clock, part, rect }: { clock: MotionValue<number>; part: number; rect: Rect }) {
  const shape = useMemo(() => makeShape(part, rect), [part, rect])
  const d = useTransform(clock, s => outlinePath(crawlOutline(s, shape)))
  const opacity = useTransform(clock, s => 1 - cardArrival(s, part))
  const fill = useTransform(clock, s => smooth((crawlAt(s, part) - 0.84) / 0.12) * 0.9)
  return <motion.path d={d} stroke="white" strokeWidth="2.5"
    fill="#1c1c1f" style={{ opacity, fillOpacity: fill }} />
}

function CrawlOverlay({ clock, camera, slots }: { clock: MotionValue<number>; camera: MotionValue<number>; slots: Rect[] }) {
  const delivery = useMotionValue(PUSH_END)
  const id = useId()
  const donorOpacity = useTransform(clock, s => 1 - smooth((s - 0.4) / 1.2))
  const background = useTransform(clock, s => 1 - smooth((s - 1.45) / 1.3))
  const visibility = useTransform(clock, s => s >= CRAWL_END ? 'hidden' : 'visible')
  return <motion.div className="ui-crawl__overlay" style={{ visibility }}>
    <motion.div className="ui-crawl__blue" style={{ opacity: background, background: flightSkin }} />
    <svg viewBox="0 0 1280 720" className="ui-crawl__wire">
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 2 1 L 7 5 L 2 9" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </marker>
      </defs>
      <motion.g style={{ y: camera, opacity: donorOpacity }}>
        <g transform="translate(-960 700)"><VendorPush progress={delivery} marker={`url(#${id})`} shown detached /></g>
      </motion.g>
      {slots.map((rect, part) => <Crawler key={part} part={part} rect={rect} clock={clock} />)}
    </svg>
  </motion.div>
}

/** Preserve the UI's three cards and click sequence; their outlines arrive first. */
export function UICrawl({ children }: { children: ReactNode }) {
  const entry = useContext(UIEntryContext)
  const slide = useSlide()
  const present = useIsPresent()
  const [play] = useState(entry && !slide.static && slide.step === 0)
  const clock = useMotionValue(play ? 0 : CRAWL_END)
  const camera = useTransform(clock, crawlCamera)
  const ref = useRef<HTMLDivElement>(null)
  const [slots, setSlots] = useState(DEFAULT_SLOTS)

  useLayoutEffect(() => {
    if (!play || slide.static || slide.active === false || !present) return
    return leavePushOrbBehind(camera, slide.index)
  }, [slide.static, slide.active, slide.index, present, play, camera])

  useLayoutEffect(() => {
    if (!play) return
    const section = ref.current?.closest<HTMLElement>('.slide')
    if (!section) return
    const root = section.getBoundingClientRect()
    const scale = root.width / 1280
    if (scale) {
      const cards = [...section.querySelectorAll<HTMLElement>('.ui-crawl__slot .card')]
      if (cards.length === 3) setSlots(cards.map(card => {
        const r = card.getBoundingClientRect()
        return { x: (r.x - root.x) / scale, y: (r.y - root.y) / scale, width: r.width / scale, height: r.height / scale }
      }))
    }
    const title = section.querySelector<HTMLElement>('.slide__title')
    const update = (s: number) => { if (title) title.style.opacity = String(smooth((s - 2.2) / 0.55)) }
    update(clock.get())
    const off = clock.on('change', update)
    return () => { off(); if (title) title.style.removeProperty('opacity') }
  }, [play, clock])

  useLayoutEffect(() => {
    if (!play || !present) return
    // A click during the crawl finishes the hand-off and reveals that card.
    if (slide.step > 0) { clock.jump(CRAWL_END); return }
    const animation = animate(clock, CRAWL_END, { duration: Math.max(0, CRAWL_END - clock.get()), ease: 'linear' })
    return () => animation.stop()
  }, [play, present, slide.step, clock])

  return <CrawlContext.Provider value={clock}>
    <div ref={ref} className="ui-crawl">
      {children}
      {play && <CrawlOverlay clock={clock} camera={camera} slots={slots} />}
    </div>
  </CrawlContext.Provider>
}

export function UIArrival({ part, children }: { part: number; children: ReactNode }) {
  const fallback = useMotionValue(CRAWL_END)
  const clock = useContext(CrawlContext) ?? fallback
  const opacity = useTransform(clock, s => cardArrival(s, part))
  return <motion.div className="ui-crawl__slot" style={{ opacity }}>{children}</motion.div>
}
