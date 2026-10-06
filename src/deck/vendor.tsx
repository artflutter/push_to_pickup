/* ------------------------------------------------------------ vendor 070 --- */
/**
 * Five looks for "The vendor." — the same four steps, each walked by the orb
 * (the call) in its own way. Every one keeps the deck's rules: the blue base
 * with the one pink glow, binary numbers, text that comes with the light, a
 * stop held lit once the orb has reached it, nothing snapping on the way
 * back.
 *
 *   Stairs   — the call drops in over the top edge and falls tread to tread
 *              down a staircase of hairlines, each tread's text lighting as
 *              it lands.
 *   Dial     — the vendor is the hub; the four steps sit on a dial around it.
 *              The orb leaves the hub and orbits, drawing the arc; the list
 *              on the right lights with the rings.
 *   Ledger   — the steps as a numbered list on the left; on the right one
 *              ring holds the thing in hand — a call, a phone number, a user,
 *              a push token, a push — and swaps it word by word. The orb sits
 *              in the ring and leaves with the push.
 *   Belt     — poster opening, then rings on a belt that moves under the orb:
 *              the orb holds the centre, the world scrolls past.
 *   Hand-off — three machines: the vendor's cloud, your server (a rack with
 *              the two lookup rows inside) and the push gateway. The orb
 *              flies between them and shrinks to walk the rows in the rack.
 *
 * <Variants> shows them one after another on one slide, each owning its own
 * run of clicks; a tag top-right says which is up.
 */
import { Children, isValidElement, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import { SlideContext, useSlide, type SlideRuntime } from './slideContext'
import { Lamp, Orb } from './mdxComponents'

type OrbXY = { glowX: MotionValue<number>; glowY: MotionValue<number> }
/** the blob's motion values as <Orb> hands them out */
type OrbValues = Parameters<typeof Lamp>[0]['orb']
type Pt = { x: number; y: number }
export type StopData = { n?: ReactNode; title: ReactNode; body?: ReactNode }
type VProps = { title?: ReactNode; stops?: StopData[]; children?: ReactNode }

const EASE = [0.22, 0.61, 0.36, 1] as const
const SPRING = { type: 'spring' as const, stiffness: 150, damping: 24, mass: 0.9 }
const bin = (i: number) => (i + 1).toString(2).padStart(2, '0')
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const white = (a: number) => `rgba(255, 255, 255, ${a})`

/* `stops` as data, or <Stop title>body</Stop> children */
function readStops(stops?: StopData[], children?: ReactNode): StopData[] {
  if (stops?.length) return stops
  return Children.toArray(children)
    .filter(isValidElement)
    .map((c) => {
      const p = c.props as { n?: ReactNode; title: ReactNode; children?: ReactNode }
      return { n: p.n, title: p.title, body: p.children }
    })
}

/* which way the last click went */
function useDir(step: number) {
  const prev = useRef(step)
  const dir = step >= prev.current ? 1 : -1
  useEffect(() => {
    prev.current = step
  }, [step])
  return dir
}

/* -------------------------------------------------------------- picker --- */
type VariantProps = { steps: number; label: string; /** the tag's letter; by default A, B, C … in order */ tag?: string; children: ReactNode }

/** Data only — one look inside <Variants>: how many clicks it owns and its tag. */
export function Variant(_: VariantProps) {
  return null
}

/**
 * One slide, several looks: each <Variant steps={n}> owns the next n + 1
 * deck steps (its own step 0 … n), so a click past a look's last step
 * switches to the next look at its start. Static views show the first look
 * finished. A tag in the corner names the one on screen.
 */
export function Variants({ children }: { children: ReactNode }) {
  const slide = useSlide()
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<VariantProps>[]
  const starts: number[] = []
  let total = -1
  for (const it of items) {
    starts.push(total + 1)
    total += it.props.steps + 1
  }
  useState(() => {
    if (total > 0) slide.register(total)
    return null
  })
  const step = slide.static ? 0 : Math.min(Math.max(total, 0), Math.max(0, slide.step))
  let idx = 0
  starts.forEach((s, i) => {
    if (s <= step) idx = i
  })
  const current = items[idx]
  const local = !current ? 0 : slide.static ? current.props.steps : step - starts[idx]
  const counter = useRef(0)
  const runtime = useMemo<SlideRuntime>(
    () => ({ ...slide, step: local, register: (at?: number) => at ?? ++counter.current }),
    [slide, local],
  )
  if (!current) return null
  return (
    <div className="variants">
      <AnimatePresence initial={false}>
        <motion.div
          key={idx}
          className="variants__pane"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <SlideContext.Provider value={runtime}>{current.props.children}</SlideContext.Provider>
        </motion.div>
      </AnimatePresence>
      {!slide.static && (
        <div className="variants__tag no-nav">
          {current.props.tag ?? String.fromCharCode(65 + idx)} · {current.props.label}
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- light --- */
const useMV = (v: number | MotionValue<number>) => {
  const mv = useMotionValue(typeof v === 'number' ? v : 0)
  return typeof v === 'number' ? mv : v
}

/**
 * How lit a point is: 0 off · 1 by the orb's distance (only while the orb is
 * heading for it, so nothing flickers as it passes) · 2 held (reached).
 */
function useLit(orb: OrbXY, x: number | MotionValue<number>, y: number | MotionValue<number>, mode: 0 | 1 | 2, reach = 60, fall = 260) {
  const m = useMotionValue<number>(mode)
  useEffect(() => {
    m.set(mode)
  }, [mode, m])
  const px = useMV(x)
  const py = useMV(y)
  return useTransform([orb.glowX, orb.glowY, px, py, m], ([gx, gy, ax, ay, mm]: number[]) => {
    if (mm === 0) return 0
    if (mm === 2) return 1
    return clamp01(1 - (Math.hypot(gx - ax, gy - ay) - reach) / fall)
  })
}

/**
 * Same rule as the route: a stop is held lit once the orb has reached it, for
 * as long as it is at or before the current one — stepping back never blinks.
 * `watch` are the values whose change can bring the orb onto a stop; `pos`
 * gives a stop's current position on screen.
 */
function useReached(watch: MotionValue<number>[], pos: (i: number) => Pt, orb: OrbXY, n: number, active: number, isStatic: boolean) {
  const [reached, setReached] = useState<boolean[]>(() => Array.from({ length: n }, (_, i) => i < active - 1 || (isStatic && i < active)))
  const ref = useRef(reached)
  ref.current = reached
  const posRef = useRef(pos)
  posRef.current = pos
  useEffect(() => {
    setReached((a) => {
      const next = a.map((v, i) => i < active - 1 || (i < active && v))
      return next.some((v, i) => v !== a[i]) ? next : a
    })
  }, [active])
  useEffect(() => {
    const check = () => {
      const i = active - 1
      if (i < 0 || ref.current[i]) return
      const p = posRef.current(i)
      if (Math.hypot(orb.glowX.get() - p.x, orb.glowY.get() - p.y) < 60) setReached((a) => a.map((v, k) => (k === i ? true : v)))
    }
    check()
    const offs = watch.map((v) => v.on('change', check))
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, orb, ...watch])
  return reached
}

const modeOf = (reached: boolean[], i: number, active: number): 0 | 1 | 2 => (reached[i] ? 2 : i === active - 1 ? 1 : 0)

/* a line drawn as far as `progress` (0–1) */
function Seg({ progress, x1, y1, x2, y2 }: { progress: MotionValue<number>; x1: number; y1: number; x2: number; y2: number }) {
  const opacity = useTransform(progress, (p) => (p > 0.02 ? 1 : 0))
  return <motion.line x1={x1} y1={y1} x2={x2} y2={y2} style={{ pathLength: progress, opacity }} />
}

/* a ring on a spot, lit by `lit`; number inside, title and body under */
function Ring({
  lit,
  x,
  y,
  size,
  n,
  title,
  body,
  bodyShown = true,
  shown = true,
  delay = 0,
}: {
  lit: MotionValue<number>
  x: number
  y: number
  size: number
  n: ReactNode
  title?: ReactNode
  body?: ReactNode
  /** false: the body fades away while the title stays (a ring the orb has moved on from) */
  bodyShown?: boolean
  shown?: boolean
  delay?: number
}) {
  const border = useTransform(lit, (v) => white(0.4 + 0.6 * v))
  const halo = useTransform(lit, (v) => `0 0 0 ${Math.round(size * 0.06)}px rgba(255, 255, 255, ${0.14 * v})`)
  const scale = useTransform(lit, (v) => 1 + 0.06 * v)
  const rise = useTransform(lit, (v) => 12 * (1 - v))
  return (
    <motion.div
      className="vring"
      style={{ left: x, top: y, '--ring': `${size}px` } as CSSProperties}
      initial={false}
      animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 24 }}
      transition={{ duration: 0.45, ease: EASE, delay: shown ? delay : 0 }}
    >
      <motion.div className="vring__ring" style={{ borderColor: border, boxShadow: halo, scale }}>
        <motion.span className="vring__n" style={{ opacity: lit }}>
          {n}
        </motion.span>
      </motion.div>
      {title != null && (
        <motion.div className="vring__label" style={{ opacity: lit, y: rise }}>
          <div className="vring__title">{title}</div>
          {body && (
            <motion.div className="vring__body" initial={false} animate={{ opacity: bodyShown ? 1 : 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
              {body}
            </motion.div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}

/* a title that swaps word by word: old words lift out, new words rise in */
const coverMotion = {
  in: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
  out: { transition: { staggerChildren: 0.045 } },
}
const wordMotion = (travel: number) => ({
  in: (dir: number) => ({ opacity: 0, y: travel * dir }),
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
  out: (dir: number) => ({ opacity: 0, y: -travel * dir, transition: { duration: 0.38, ease: EASE } }),
})
const WORD_56 = wordMotion(56)
const WORD_28 = wordMotion(28)

function Words({ text, dir, travel = 56 }: { text: ReactNode; dir: number; travel?: 56 | 28 }) {
  const parts = typeof text === 'string' ? text.split(' ') : [text]
  const v = travel === 56 ? WORD_56 : WORD_28
  return (
    <>
      {parts.flatMap((w, i) => [
        i > 0 ? ' ' : null,
        <motion.span key={i} className="vendor__word" variants={v} custom={dir}>
          {w}
        </motion.span>,
      ])}
    </>
  )
}

/* ---------------------------------------------------------------- stairs --- */
/* treads: a hairline each, starting further right as they go down; the orb
   lands on each one at its number */
const STAIR_Y = [200, 325, 450, 575]
const STAIR_X = [300, 500, 700, 900]
/** where the call comes in from: over the top edge, above the first tread */
const STAIR_IN: Pt = { x: 300, y: -70 }

export function Stairs({ title = 'The vendor.', stops, children }: VProps) {
  const slide = useSlide()
  const items = readStops(stops, children)
  const n = items.length
  useState(() => {
    for (let i = 1; i <= n; i++) slide.register(i)
    return null
  })
  const step = slide.static ? n : Math.min(n, Math.max(0, slide.step))
  const pts = items.map((_, i) => ({ x: STAIR_X[i] ?? 300 + 200 * i, y: STAIR_Y[i] ?? 200 + 125 * i }))
  const target = step === 0 ? STAIR_IN : pts[step - 1]
  return (
    <div className="vendor vendor--stairs">
      <h1 className="slide__title vendor__title">{title}</h1>
      <Orb target={target} glow={false}>
        {(orb) => <StairsBody orb={orb} pts={pts} items={items} active={step} />}
      </Orb>
    </div>
  )
}

function StairsBody({ orb, pts, items, active }: { orb: OrbValues; pts: Pt[]; items: StopData[]; active: number }) {
  const slide = useSlide()
  const reached = useReached([orb.glowX, orb.glowY], (i) => pts[i], orb, pts.length, active, slide.static)
  return (
    <>
      <Lamp orb={orb} together />
      {items.map((s, i) => (
        <Tread key={i} orb={orb} x={pts[i].x} y={pts[i].y} mode={modeOf(reached, i, active)} n={s.n ?? bin(i)} title={s.title} body={s.body} />
      ))}
    </>
  )
}

function Tread({ orb, x, y, mode, n, title, body }: { orb: OrbXY; x: number; y: number; mode: 0 | 1 | 2; n: ReactNode; title: ReactNode; body?: ReactNode }) {
  const lit = useLit(orb, x, y, mode)
  const line = useTransform(lit, (v) => white(0.28 + 0.62 * v))
  const rise = useTransform(lit, (v) => 10 * (1 - v))
  return (
    <div className="stairs__row" style={{ left: x - 80, top: y }}>
      <motion.div className="stairs__tread" style={{ background: line }} />
      <motion.div className="stairs__text" style={{ opacity: lit, y: rise }}>
        <div className="stairs__head">
          <span className="stairs__n">{n}</span>
          <span className="stairs__title">{title}</span>
        </div>
        {body && <div className="stairs__body">{body}</div>}
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------------------ dial --- */
const HUB: Pt = { x: 380, y: 420 }
const DIAL_R = 200
const DIAL_RING = 100
const DIAL_ANGLES = [-90, 0, 90, 180]
const DIAL_ROW_Y = [186, 303, 420, 537]
const rad = (deg: number) => (deg * Math.PI) / 180
const polar = (deg: number, r: number): Pt => ({ x: HUB.x + r * Math.cos(rad(deg)), y: HUB.y + r * Math.sin(rad(deg)) })
/** how far along the arc a ring's edge (plus a gap) reaches, in degrees */
const DIAL_INSET = ((DIAL_RING / 2 + 14) / DIAL_R) * (180 / Math.PI)

export function Dial({ title = 'The vendor.', stops, children }: VProps) {
  const slide = useSlide()
  const items = readStops(stops, children)
  const n = Math.min(items.length, DIAL_ANGLES.length)
  useState(() => {
    for (let i = 1; i <= n; i++) slide.register(i)
    return null
  })
  const step = slide.static ? n : Math.min(n, Math.max(0, slide.step))
  /* the orb in polar coordinates about the hub: in the hub at step 0, then
     out on the dial and round it, one ring per click */
  const angle = DIAL_ANGLES[Math.max(0, step - 1)]
  const radius = step === 0 ? 0 : DIAL_R
  const a = useMotionValue(angle)
  const r = useMotionValue(radius)
  const aS = useSpring(a, { stiffness: 60, damping: 16, mass: 1 })
  const rS = useSpring(r, { stiffness: 60, damping: 16, mass: 1 })
  const placed = useRef(false)
  useEffect(() => {
    a.set(angle)
    r.set(radius)
    if (!placed.current || slide.static) {
      aS.jump(angle)
      rS.jump(radius)
    }
    placed.current = true
  }, [angle, radius, slide.static, a, r, aS, rS])
  const glowX = useTransform([aS, rS], ([t, rr]: number[]) => HUB.x + rr * Math.cos(rad(t)))
  const glowY = useTransform([aS, rS], ([t, rr]: number[]) => HUB.y + rr * Math.sin(rad(t)))
  const orb = useMemo(() => ({ glowX, glowY }), [glowX, glowY])
  const pts = DIAL_ANGLES.slice(0, n).map((d) => polar(d, DIAL_R))
  const reached = useReached([glowX, glowY], (i) => pts[i], orb, n, step, slide.static)
  return (
    <div className="vendor vendor--dial">
      <div className="orb" style={{ background: 'linear-gradient(225deg, var(--blue) 40%, #4a5cff 100%)' }} />
      {/* the track: the dial's circle, ring to ring, faint — the bright arc draws over it */}
      <svg className="vendor__path dial__track" viewBox="0 0 1280 720">
        {DIAL_ANGLES.map((from, i) => (
          <path key={i} d={arcPath(from, from + 90)} />
        ))}
      </svg>
      <motion.svg
        className="vendor__path"
        viewBox="0 0 1280 720"
        initial={false}
        animate={{ opacity: step > 0 && reached[0] ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {DIAL_ANGLES.slice(1, n).map((to, i) => (
          <Arc key={i} angle={aS} from={DIAL_ANGLES[i]} to={to} />
        ))}
      </motion.svg>
      <div className="lamp">
        <motion.div className="orb__glow" style={{ x: glowX, y: glowY }} />
        <motion.div className="orb__sheen" style={{ x: glowX, y: glowY }} />
      </div>
      <div className="dial__hub">{title}</div>
      {items.slice(0, n).map((s, i) => (
        <DialStop key={i} orb={orb} pt={pts[i]} rowY={DIAL_ROW_Y[i]} last={i === n - 1} mode={modeOf(reached, i, step)} n={s.n ?? bin(i)} title={s.title} body={s.body} />
      ))}
    </div>
  )
}

/* the arc between two rings, clockwise, stopping short of each ring's edge */
function arcPath(from: number, to: number) {
  const p0 = polar(from + DIAL_INSET, DIAL_R)
  const p1 = polar(to - DIAL_INSET, DIAL_R)
  return `M${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${DIAL_R},${DIAL_R} 0 0 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`
}

/* one quarter of the dial, drawn as far as the orb has turned through it */
function Arc({ angle, from, to }: { angle: MotionValue<number>; from: number; to: number }) {
  const progress = useTransform(angle, (t) => clamp01((t - from) / (to - from)))
  const opacity = useTransform(progress, (p) => (p > 0.02 ? 1 : 0))
  return <motion.path d={arcPath(from, to)} style={{ pathLength: progress, opacity }} />
}

/* a ring on the dial and its row in the list, lit together */
function DialStop({ orb, pt, rowY, last, mode, n, title, body }: { orb: OrbXY; pt: Pt; rowY: number; last: boolean; mode: 0 | 1 | 2; n: ReactNode; title: ReactNode; body?: ReactNode }) {
  const lit = useLit(orb, pt.x, pt.y, mode)
  const rowOpacity = useTransform(lit, (v) => 0.32 + 0.68 * v)
  return (
    <>
      <Ring lit={lit} x={pt.x} y={pt.y} size={DIAL_RING} n={n} />
      <motion.div className={`dial__row${last ? ' dial__row--last' : ''}`} style={{ top: rowY, opacity: rowOpacity }}>
        <div className="dial__title">{title}</div>
        {body && <div className="dial__body">{body}</div>}
      </motion.div>
    </>
  )
}

/* ---------------------------------------------------------------- ledger --- */
const LEDGER_RING: Pt = { x: 960, y: 400 }
/** where the push goes: out through the right edge */
const LEDGER_OUT: Pt = { x: 1560, y: 400 }
const THINGS = ['a call', 'a phone number', 'a user', 'a push token', 'a push']

export function Ledger({
  title = 'The vendor.',
  stops,
  children,
  things = THINGS,
}: VProps & {
  /** what the ring holds at each step, step 0 first */
  things?: ReactNode[]
}) {
  const slide = useSlide()
  const items = readStops(stops, children)
  const n = items.length
  useState(() => {
    for (let i = 1; i <= n; i++) slide.register(i)
    return null
  })
  const step = slide.static ? n : Math.min(n, Math.max(0, slide.step))
  const dir = useDir(step)
  const out = step === n
  return (
    <div className="vendor vendor--ledger">
      <h1 className="slide__title vendor__title">{title}</h1>
      <Orb target={out ? LEDGER_OUT : LEDGER_RING} glow={false}>
        {(orb) => <LedgerBody orb={orb} step={step} out={out} dir={dir} thing={things[step] ?? things[things.length - 1]} />}
      </Orb>
      <div className="ledger__rows">
        {items.map((s, i) => (
          <div key={i} className={`ledger__row${step === i + 1 ? ' is-on' : step > i + 1 ? ' is-past' : ''}`}>
            <span className="ledger__n">{s.n ?? bin(i)}</span>
            <span className="ledger__title">{s.title}</span>
            {s.body && <span className="ledger__body">{s.body}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function LedgerBody({ orb, step, out, dir, thing }: { orb: OrbValues; step: number; out: boolean; dir: number; thing: ReactNode }) {
  /* the ring is lit by the orb inside it and goes dark as the orb leaves */
  const lit = useLit(orb, LEDGER_RING.x, LEDGER_RING.y, 1, 80, 240)
  const border = useTransform(lit, (v) => white(0.4 + 0.6 * v))
  const halo = useTransform(lit, (v) => `0 0 0 16px rgba(255, 255, 255, ${0.14 * v})`)
  /* a breath of light on every swap — not on the way out */
  const breathe = step > 0 && !out
  return (
    <>
      <motion.div
        key={breathe ? step : 'still'}
        className="ledger__lamp"
        style={{ transformOrigin: `${LEDGER_RING.x}px ${LEDGER_RING.y}px` }}
        animate={breathe ? { scale: [1, 1.14, 1] } : { scale: 1 }}
        transition={{ duration: 0.75, ease: EASE, times: [0, 0.4, 1] }}
      >
        <Lamp orb={orb} together />
      </motion.div>
      <motion.div className="ledger__ring" style={{ borderColor: border, boxShadow: halo }}>
        <AnimatePresence initial={false} custom={dir}>
          <motion.div key={step} className="ledger__thing" variants={coverMotion} custom={dir} initial="in" animate="show" exit="out">
            <span>
              <Words text={thing} dir={dir} travel={28} />
            </span>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </>
  )
}

/* ------------------------------------------------------------------ belt --- */
const BELT: Pt = { x: 640, y: 400 }
const BELT_PITCH = 460
const BELT_RING = 160

export function Belt({ title = 'The vendor.', stops, children }: VProps) {
  const slide = useSlide()
  const items = readStops(stops, children)
  const n = items.length
  useState(() => {
    for (let i = 1; i <= n; i++) slide.register(i)
    return null
  })
  const step = slide.static ? n : Math.min(n, Math.max(0, slide.step))
  const dir = useDir(step)
  const open = step > 0
  return (
    <div className={`vendor vendor--belt${open ? ' is-open' : ''}`}>
      {/* on the poster the orb roams with the pointer; open, it holds the centre */}
      <Orb target={open ? BELT : null} glow={false}>
        {(orb) => <BeltBody orb={orb} items={items} step={step} />}
      </Orb>
      <AnimatePresence initial={false} custom={dir}>
        {!open && (
          <motion.div key="poster" className="vendor__poster" variants={coverMotion} custom={dir} initial="in" animate="show" exit="out">
            <Words text={title} dir={dir} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {open && (
          <motion.h1
            key="title"
            className="slide__title vendor__title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
          >
            {title}
          </motion.h1>
        )}
      </AnimatePresence>
    </div>
  )
}

function BeltBody({ orb, items, step }: { orb: OrbValues; items: StopData[]; step: number }) {
  const slide = useSlide()
  const n = items.length
  const open = step > 0
  /* the belt: ring `active` sits under the orb at the centre */
  const bx = useMotionValue(0)
  const beltX = useSpring(bx, SPRING)
  const placed = useRef(false)
  useEffect(() => {
    const v = -(Math.max(1, step) - 1) * BELT_PITCH
    bx.set(v)
    if (!placed.current || slide.static) beltX.jump(v)
    placed.current = true
  }, [step, slide.static, bx, beltX])
  const xs = items.map((_, i) => BELT.x + i * BELT_PITCH)
  const reached = useReached([orb.glowX, orb.glowY, beltX], (i) => ({ x: xs[i] + beltX.get(), y: BELT.y }), orb, n, step, slide.static)
  /* the orb in the belt's own coordinates */
  const worldX = useTransform([orb.glowX, beltX], ([gx, b]: number[]) => gx - b)
  return (
    <>
      <motion.svg
        className="vendor__path"
        viewBox="0 0 1280 720"
        style={{ x: beltX }}
        initial={false}
        animate={{ opacity: open && reached[0] ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {xs.slice(1).map((x, i) => (
          <BeltSeg key={i} worldX={worldX} a={xs[i]} b={x} />
        ))}
      </motion.svg>
      <Lamp orb={orb} />
      <motion.div className="belt__world" style={{ x: beltX }} initial={false} animate={{ opacity: open ? 1 : 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        {items.map((s, i) => (
          <BeltStop
            key={i}
            orb={orb}
            beltX={beltX}
            x={xs[i]}
            shown={open}
            current={i === step - 1}
            delay={0.08 * i}
            mode={modeOf(reached, i, step)}
            n={s.n ?? bin(i)}
            title={s.title}
            body={s.body}
          />
        ))}
      </motion.div>
    </>
  )
}

function BeltSeg({ worldX, a, b }: { worldX: MotionValue<number>; a: number; b: number }) {
  const progress = useTransform(worldX, (x) => clamp01((x - a) / (b - a)))
  const inset = BELT_RING / 2 + 14
  return <Seg progress={progress} x1={a + inset} y1={BELT.y} x2={b - inset} y2={BELT.y} />
}

function BeltStop({
  orb,
  beltX,
  x,
  shown,
  current,
  delay,
  mode,
  n,
  title,
  body,
}: {
  orb: OrbXY
  beltX: MotionValue<number>
  x: number
  shown: boolean
  /** the ring under the orb right now */
  current: boolean
  delay: number
  mode: 0 | 1 | 2
  n: ReactNode
  title: ReactNode
  body?: ReactNode
}) {
  /* lit by where the ring really is on screen, belt and all */
  const sx = useTransform(beltX, (b) => x + b)
  const lit = useLit(orb, sx, BELT.y, mode)
  /* only the ring under the orb carries its body; the ones the belt has moved on keep number and title */
  return <Ring lit={lit} x={x} y={BELT.y} size={BELT_RING} n={n} title={title} body={body} bodyShown={current} shown={shown} delay={delay} />
}

/* --------------------------------------------------------------- hand-off --- */
/* three machines on one line: the vendor's cloud, your server, the gateway */
/* Feather's cloud, scaled ×7.2 into a 158×115 box: x 79–238, y 386–501 */
const CLOUD_PATH = 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z'
const CLOUD_K = 7.2
const CLOUD_AT = { x: 72, y: 357 }
const CLOUD: Pt = { x: CLOUD_AT.x + 12 * CLOUD_K, y: CLOUD_AT.y + 12 * CLOUD_K }
const CLOUD_RIGHT = CLOUD_AT.x + 23 * CLOUD_K
const RACK = { x: 470, y: 280, w: 340, h: 320 }
/* header strip, then two rows of 130 */
const RACK_HEAD = 60
const RACK_ROW_H = (RACK.h - RACK_HEAD) / 2
const RACK_TOP: Pt = { x: RACK.x + RACK.w / 2, y: RACK.y }
const RACK_ROWS = [RACK.y + RACK_HEAD + RACK_ROW_H / 2, RACK.y + RACK_HEAD + RACK_ROW_H * 1.5]
const RACK_ORB_X = RACK.x + 54
const GATE = { x: 1038, y: 380, w: 170, h: 120 }
const GATE_C: Pt = { x: GATE.x + GATE.w / 2, y: GATE.y + GATE.h / 2 }
const LINE_Y = 440
/** where the orb is at each step: on the cloud, on the rack, in its two rows, on the gateway */
const HAND_ORB: Pt[] = [CLOUD, RACK_TOP, { x: RACK_ORB_X, y: RACK_ROWS[0] }, { x: RACK_ORB_X, y: RACK_ROWS[1] }, GATE_C]

/**
 * Built for the vendor's four steps: the first is the flight to your server,
 * the two in the middle are rows inside it, the last is the flight on to the
 * gateway.
 */
const HAND_LABELS = { vendor: 'vendor', server: 'your server', gate: 'APNs · FCM' }

export function Handoff({
  title = 'The vendor.',
  stops,
  children,
  labels = HAND_LABELS,
}: VProps & {
  /** the names on the three machines */
  labels?: { vendor: ReactNode; server: ReactNode; gate: ReactNode }
}) {
  const slide = useSlide()
  const items = readStops(stops, children)
  useState(() => {
    for (let i = 1; i <= 4; i++) slide.register(i)
    return null
  })
  const step = slide.static ? 4 : Math.min(4, Math.max(0, slide.step))
  return (
    <div className={`vendor vendor--hand${step === 2 || step === 3 ? ' in-rack' : ''}`}>
      <h1 className="slide__title vendor__title">{title}</h1>
      <Orb target={HAND_ORB[step]} glow={false}>
        {(orb) => <HandBody orb={orb} items={items} step={step} labels={labels} />}
      </Orb>
    </div>
  )
}

function HandBody({ orb, items, step, labels }: { orb: OrbValues; items: StopData[]; step: number; labels: { vendor: ReactNode; server: ReactNode; gate: ReactNode } }) {
  const slide = useSlide()
  /* the stops the orb is sent to after the rack top: row, row, gateway */
  const pts = [HAND_ORB[2], HAND_ORB[3], GATE_C]
  const active = Math.max(0, step - 1)
  const reached = useReached([orb.glowX, orb.glowY], (i) => pts[i], orb, 3, active, slide.static)
  const cloudLit = useLit(orb, CLOUD.x, CLOUD.y, 1)
  const rackLit = useLit(orb, RACK.x + RACK.w / 2, RACK.y + RACK.h / 2, 1, 200, 200)
  const gateLit = useLit(orb, GATE_C.x, GATE_C.y, modeOf(reached, 2, active))
  const cloudStroke = useTransform(cloudLit, (v) => white(0.62 + 0.38 * v))
  const rackStroke = useTransform(rackLit, (v) => white(0.62 + 0.38 * v))
  const gateStroke = useTransform(gateLit, (v) => white(0.62 + 0.38 * v))
  /* the two flights draw their line behind the orb; the text on a line comes with it */
  const p1 = useTransform(orb.glowX, (gx) => clamp01((gx - CLOUD_RIGHT) / (RACK.x - CLOUD_RIGHT)))
  const p2 = useTransform(orb.glowX, (gx) => clamp01((gx - (RACK.x + RACK.w)) / (GATE.x - RACK.x - RACK.w)))
  const t1 = useTransform(p1, (p) => clamp01((p - 0.3) / 0.4))
  const t2 = useTransform(p2, (p) => clamp01((p - 0.3) / 0.4))
  const [s1, s2, s3, s4] = items
  return (
    <>
      <svg className="hand__art" viewBox="0 0 1280 720">
        <motion.path
          d={CLOUD_PATH}
          transform={`translate(${CLOUD_AT.x} ${CLOUD_AT.y}) scale(${CLOUD_K})`}
          vectorEffect="non-scaling-stroke"
          style={{ stroke: cloudStroke }}
        />
        <motion.rect x={RACK.x} y={RACK.y} width={RACK.w} height={RACK.h} rx="24" style={{ stroke: rackStroke }} />
        <line className="hand__hair" x1={RACK.x} y1={RACK.y + RACK_HEAD} x2={RACK.x + RACK.w} y2={RACK.y + RACK_HEAD} />
        <line className="hand__hair" x1={RACK.x} y1={RACK.y + RACK_HEAD + RACK_ROW_H} x2={RACK.x + RACK.w} y2={RACK.y + RACK_HEAD + RACK_ROW_H} />
        <motion.rect x={GATE.x} y={GATE.y} width={GATE.w} height={GATE.h} rx="24" style={{ stroke: gateStroke }} />
        <Seg progress={p1} x1={CLOUD_RIGHT + 14} y1={LINE_Y} x2={RACK.x - 14} y2={LINE_Y} />
        <Seg progress={p2} x1={RACK.x + RACK.w + 14} y1={LINE_Y} x2={GATE.x - 14} y2={LINE_Y} />
      </svg>
      <Lamp orb={orb} together />
      <div className="hand__eyebrow" style={{ left: CLOUD.x, top: 520, transform: 'translateX(-50%)' }}>
        {labels.vendor}
      </div>
      <div className="hand__eyebrow" style={{ left: RACK.x + 36, top: RACK.y + 22 }}>
        {labels.server}
      </div>
      <div className="hand__gate" style={{ left: GATE_C.x, top: GATE_C.y }}>
        {labels.gate}
      </div>
      {s1 && <GapText lit={t1} x={(CLOUD_RIGHT + RACK.x) / 2} n={s1.n ?? bin(0)} title={s1.title} body={s1.body} />}
      {s2 && <RackRow orb={orb} y={RACK_ROWS[0]} mode={modeOf(reached, 0, active)} n={s2.n ?? bin(1)} title={s2.title} body={s2.body} />}
      {s3 && <RackRow orb={orb} y={RACK_ROWS[1]} mode={modeOf(reached, 1, active)} n={s3.n ?? bin(2)} title={s3.title} body={s3.body} />}
      {s4 && <GapText lit={t2} x={(RACK.x + RACK.w + GATE.x) / 2} n={s4.n ?? bin(3)} title={s4.title} body={s4.body} />}
    </>
  )
}

/* a step written on the line between two machines: number and title above it, body under */
function GapText({ lit, x, n, title, body }: { lit: MotionValue<number>; x: number; n: ReactNode; title: ReactNode; body?: ReactNode }) {
  const rise = useTransform(lit, (v) => 8 * (1 - v))
  return (
    <>
      <motion.div className="hand__gap hand__gap--above" style={{ left: x, opacity: lit, y: rise }}>
        <div className="hand__n">{n}</div>
        <div className="hand__title">{title}</div>
      </motion.div>
      {body && (
        <motion.div className="hand__gap hand__gap--below" style={{ left: x, opacity: lit, y: rise }}>
          <div className="hand__body">{body}</div>
        </motion.div>
      )}
    </>
  )
}

/* a lookup row inside the rack, lit when the orb sits at its number */
function RackRow({ orb, y, mode, n, title, body }: { orb: OrbXY; y: number; mode: 0 | 1 | 2; n: ReactNode; title: ReactNode; body?: ReactNode }) {
  const lit = useLit(orb, RACK_ORB_X, y, mode, 40, 160)
  const opacity = useTransform(lit, (v) => 0.3 + 0.7 * v)
  return (
    <motion.div className="hand__row" style={{ left: RACK.x, width: RACK.w, height: RACK_ROW_H, top: y - RACK_ROW_H / 2, opacity }}>
      <div className="hand__row-head">
        <span className="hand__n">{n}</span>
        <span className="hand__title">{title}</span>
      </div>
      {body && <div className="hand__body hand__body--row">{body}</div>}
    </motion.div>
  )
}
