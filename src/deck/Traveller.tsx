import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { animate, motion, motionValue, useTransform, type MotionValue, type ValueAnimationTransition } from 'motion/react'
import { useSlide } from './slideContext'
import { BALLOON_DESTINATION, BALLOON_DURATION, BALLOON_TIMING, FLIGHT_HEIGHT, balloonFrame, balloonString, toStage } from './balloonMotion'

/** The phone and vendor occupy one world; only its camera moves. */
export const flightCamera = motionValue(0)
export const flightSkin = motionValue('linear-gradient(214.375deg, var(--blue) 40%, #4a5cff 100%)')

export function FlightBackdrop({ skin }: { skin: MotionValue<string> }) {
  const slide = useSlide()
  useEffect(() => {
    if (slide.static || slide.active === false) return
    const update = (value: string) => {
      if (!vstate.inFlight && flightCamera.get() === 0) flightSkin.set(value)
    }
    update(skin.get())
    return skin.on('change', update)
  }, [skin, slide.static, slide.active])
  return null
}

/* Module-level motion values and tickets cannot survive a hot swap: the orb
   on screen would keep its old state until the next cue. Reload instead. */
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', (p) => {
    if (p.updates.some((u) => u.path.endsWith('/deck/Traveller.tsx'))) window.location.reload()
  })
}

/* ------------------------------------------------------------- traveller --- */
/* The orb — the pink glow, nothing else — as a traveller between slides.
   There is exactly one: the deck draws it above the slide layer
   (<Traveller>), slides only cue it. Everything is a motion value in stage
   px, so a slide change never resets it: the orb can be mid-air while one
   slide gives way to the next. */

/** glow element size, same as `.orb__glow` on the section slides */
export const GLOW = 820
/** where the glow reads as "the edge of the orb" at scale 1 (alpha ≈ .45) */
const EDGE = 261

export interface Point {
  x: number
  y: number
}

const ball = {
  /** centre */
  x: motionValue(0),
  y: motionValue(0),
  /** whole-orb scale, from the centre */
  scale: motionValue(1),
  /** squash and stretch, from the orb's lower edge */
  sx: motionValue(1),
  sy: motionValue(1),
  opacity: motionValue(0),
}

/** lights-out layer a slide can draw (`<OrbLaunch>` on 010) */
const lights = motionValue(0)
const DIM = 0.88

/* the iris: the next slide is clipped to a circle growing from the orb */
const IRIS_OFF = -1
const IRIS_MAX = 1400
const iris = {
  r: motionValue(IRIS_OFF),
  x: motionValue(0),
  y: motionValue(0),
  ring: motionValue(0),
}

/* which slide index is being revealed through the iris right now — a tiny
   external store so the deck can re-render on it */
let reveal: { target: number } | null = null
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
function setReveal(r: { target: number } | null) {
  reveal = r
  listeners.forEach((l) => l())
}
export const useReveal = () => useSyncExternalStore(subscribe, () => reveal, () => null)
/** clip-path for the slide being revealed; 'none' when no iris is open */
export const useIrisClip = () =>
  useTransform([iris.r, iris.x, iris.y], ([r, x, y]: number[]) => (r < 0 ? 'none' : `circle(${r}px at ${x}px ${y}px)`))

type LeaveHandler = (from: number, to: number) => void | Promise<void>
/** set by the slide that owns the orb; called by <Traveller> when the deck changes slide */
const hooks: { onLeaveForward: LeaveHandler | null; onLeaveBack: LeaveHandler | null; skipNext: boolean; claimedBy: number | null } = {
  onLeaveForward: null,
  onLeaveBack: null,
  /** true while a reveal drives the slide change itself — the hooks must stay out of it */
  skipNext: false,
  /** slide index whose cue has just placed the orb (rest) — the fallback fade must not undo it */
  claimedBy: null as number | null,
}

const EASE = [0.22, 0.61, 0.36, 1] as const
const EXPO_OUT = [0.16, 1, 0.3, 1] as const
const GRAVITY = [0.55, 0, 1, 1] as const
const SMOOTH = [0.65, 0, 0.35, 1] as const

/* every choreography takes a ticket; a newer one (a click mid-drop) makes
   the older continuation stop after its current await */
let ticket = 0
const take = () => ++ticket
const live = (t: number) => t === ticket

type MV = ReturnType<typeof motionValue<number>>
/* resolves when the animation completes OR is interrupted by a newer one on
   the same value — an interrupted `finished` promise never settles, and a
   choreography awaiting it would hang. Listeners go on after `animate()`
   so the cancel of the previous animation (fired inside it) is not ours. */
const run = (v: MV, to: number | number[], opts: ValueAnimationTransition<number>) =>
  new Promise<void>((resolve) => {
    animate(v, to, opts)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      offComplete()
      offCancel()
      resolve()
    }
    const offComplete = v.on('animationComplete', finish)
    const offCancel = v.on('animationCancel', finish)
  })
const wait = (s: number) => new Promise<void>((r) => setTimeout(r, s * 1000))
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const still = () => {
  for (const v of [ball.x, ball.y, ball.sx, ball.sy, ball.scale, ball.opacity]) v.stop()
}

/* ----------------------------------------------------------------- moves --- */

/** the pink of the card gathers into one orb over `at`: a wide haze contracts into a bright glow while the lights go down */
async function condense(at: Point, scale: number) {
  still()
  ball.x.jump(at.x)
  ball.y.jump(at.y)
  ball.sx.jump(1)
  ball.sy.jump(1)
  ball.scale.jump(scale * 3.4)
  ball.opacity.jump(0)
  await Promise.all([
    run(ball.opacity, 1, { duration: 0.55, ease: 'easeOut' }),
    run(ball.scale, scale, { duration: 1.05, ease: EXPO_OUT }),
    run(lights, DIM, { duration: 1.0, ease: SMOOTH }),
  ])
}

/** a breath up, then a gravity fall onto `floor`; the glow splashes flat and springs back, one soft hop, settle */
async function drop(floor: number) {
  const y0 = ball.y.get()
  await run(ball.y, y0 - 26, { duration: 0.28, ease: 'easeOut' })
  const t = 0.58 * Math.sqrt(Math.max(0, floor - (y0 - 26)) / 300)
  await run(ball.y, floor, { duration: t, ease: GRAVITY })
  /* splash */
  await Promise.all([
    run(ball.sy, 0.68, { duration: 0.09, ease: 'easeOut' }),
    run(ball.sx, 1.32, { duration: 0.09, ease: 'easeOut' }),
  ])
  const spring = { type: 'spring', stiffness: 240, damping: 12, mass: 0.9 } as const
  await Promise.all([
    run(ball.sy, 1, spring),
    run(ball.sx, 1, spring),
    (async () => {
      await run(ball.y, floor - 64, { duration: 0.3, ease: 'easeOut' })
      await run(ball.y, floor, { duration: 0.3, ease: GRAVITY })
      const soft = { type: 'spring', stiffness: 300, damping: 14 } as const
      void run(ball.sy, [0.9, 1], soft)
      void run(ball.sx, [1.1, 1], soft)
    })(),
  ])
}

/** crouch, then a low arc to `to`, growing to `scale` on the way; a light landing */
async function hop(to: Point, scale: number) {
  await Promise.all([
    run(ball.sy, 0.86, { duration: 0.16, ease: 'easeIn' }),
    run(ball.sx, 1.1, { duration: 0.16, ease: 'easeIn' }),
  ])
  const y0 = ball.y.get()
  const apex = Math.min(y0, to.y) - 130
  const times = [0, 0.45, 1]
  await Promise.all([
    run(ball.x, to.x, { duration: 0.55, ease: SMOOTH }),
    run(ball.y, [y0, apex, to.y], { duration: 0.55, times, ease: ['easeOut', 'easeIn'] }),
    run(ball.scale, scale, { duration: 0.55, ease: 'easeInOut' }),
    run(ball.sy, [0.86, 1.1, 1], { duration: 0.55, times, ease: EASE }),
    run(ball.sx, [1.1, 0.92, 1], { duration: 0.55, times, ease: EASE }),
  ])
  const soft = { type: 'spring', stiffness: 260, damping: 13 } as const
  void run(ball.sy, [0.88, 1], soft)
  void run(ball.sx, [1.1, 1], soft)
}

/**
 * The orb's light spreads: the next slide is revealed through a circle
 * growing from the orb, a pink rim leading it, while the orb itself fades
 * into whatever the new slide has at that spot.
 */
async function spread(at: Point, target: number, advance: () => void) {
  iris.x.jump(at.x)
  iris.y.jump(at.y)
  iris.r.jump(0)
  iris.ring.jump(1)
  hooks.skipNext = true
  setReveal({ target })
  advance()
  const s = ball.scale.get()
  void run(ball.scale, [s, s * 1.1, s], { duration: 0.5, times: [0, 0.4, 1], ease: EASE })
  await Promise.all([
    run(iris.r, IRIS_MAX, { duration: 1.0, ease: SMOOTH }),
    run(iris.ring, [1, 1, 0], { duration: 1.0, times: [0, 0.55, 1], ease: 'easeIn' }),
    run(ball.opacity, 0, { duration: 0.85, ease: 'easeIn' }),
  ])
  iris.r.jump(IRIS_OFF)
  await frame()
  setReveal(null)
}

/** melt into whatever is underneath */
async function absorb() {
  await Promise.all([
    run(ball.opacity, 0, { duration: 0.32, ease: 'easeIn' }),
    run(ball.scale, ball.scale.get() * 0.8, { duration: 0.32, ease: 'easeIn' }),
  ])
}

async function hide() {
  take()
  for (const v of [ball.x, ball.y, ball.sx, ball.sy, ball.scale]) v.stop()
  await run(ball.opacity, 0, { duration: 0.22, ease: 'easeOut' })
}

/** sit still at `at`, fully visible — the state a slide shows when it is re-entered; `owner` is that slide's index */
function rest(at: Point, scale: number, owner?: number) {
  take()
  hooks.claimedBy = owner ?? null
  still()
  ball.x.jump(at.x)
  ball.y.jump(at.y)
  ball.sx.jump(1)
  ball.sy.jump(1)
  ball.scale.jump(scale)
  ball.opacity.jump(1)
}

/* ----------------------------------------------------------------- layer --- */
/**
 * The orb itself plus the iris rim. Rendered once by the deck, inside the
 * stage, above the slides. Watches the slide index: a slide change hands the
 * orb to the leaving slide's hook (forward / back); with no hook it fades
 * out so a jump through the overview never strands it. A reveal moves the
 * deck itself and tells the hooks to stay out of that one change.
 */
export function Traveller({ slide }: { slide: number }) {
  const prev = useRef(slide)
  useEffect(() => {
    const from = prev.current
    prev.current = slide
    const claimed = hooks.claimedBy
    hooks.claimedBy = null
    const vclaimed = vstate.claimedBy
    vstate.claimedBy = null
    if (from === slide) return
    /* the vessel is handed over the same way: the arriving slide has either
       claimed it (a rest cue) or it is still in the air between the two */
    if (vclaimed !== slide) void vesselHide()
    if (hooks.skipNext) {
      hooks.skipNext = false
      return
    }
    /* the slide we arrived at has already placed the orb (re-entered at a step) */
    if (claimed === slide) return
    const hook = slide > from ? hooks.onLeaveForward : hooks.onLeaveBack
    if (hook) void hook(from, slide)
    else void hide()
  }, [slide])
  const ringScale = useTransform(iris.r, (r) => Math.max(0, r) / 700)
  return (
    <div className="ball-layer" aria-hidden="true">
      <motion.div className="iris-ring" style={{ x: iris.x, y: iris.y, scale: ringScale, opacity: iris.ring }} />
      <motion.div className="ball" style={{ x: ball.x, y: ball.y, scale: ball.scale, opacity: ball.opacity }}>
        <motion.div className="ball__glow" style={{ scaleX: ball.sx, scaleY: ball.sy }}>
          <div className="ball__core" />
        </motion.div>
      </motion.div>
      <Vessel />
    </div>
  )
}

/* ------------------------------------------------------------ slide cues --- */
const slideOf = (el: HTMLElement | null) => el?.closest<HTMLElement>('.slide') ?? null

/** orb scale while it is on the title card (the avatar-sized 0.47 was tried and rolled back) and once it is home on 020 */
const SMALL = 0.7
const HOME = 1
/** bottom-left corner of the 020 gradient box, where that box's own blob rests */
const CORNER: Point = { x: 72, y: 648 }

/**
 * Slide 010, two steps that chain by themselves on one click:
 *   1. lights out — the pink of the card condenses into the orb over the
 *      avatar, the orb drops to the floor, splashes, settles;
 *   2. the orb hops into the corner and its light spreads: slide 020 is
 *      revealed through a circle growing from it, and the orb fades into
 *      the box blob that lives in that corner.
 * Re-entering the slide at a step (stepping back from 020) shows that
 * step's resting state — lights down, orb on the floor or in the corner —
 * with no replay and no auto-advance. Step 0 turns the lights back on.
 */
export function OrbLaunch() {
  const slide = useSlide()
  useState(() => slide.register(2))
  const anchor = useRef<HTMLSpanElement>(null)
  const seen = useRef<number | null>(null)
  const latest = useRef({ advance: slide.advance, index: slide.index })
  latest.current = { advance: slide.advance, index: slide.index }

  useEffect(() => {
    if (slide.static) return
    const was = seen.current
    seen.current = slide.step
    const host = slideOf(anchor.current)
    const av = host?.querySelector<HTMLElement>('.avatar')
    const from = av ? { x: av.offsetLeft + av.offsetWidth / 2, y: av.offsetTop + av.offsetHeight / 2 } : { x: 190, y: 434 }
    const floor = { x: from.x, y: (host?.offsetHeight ?? 720) - EDGE * SMALL }

    if (slide.step === 0) {
      void hide()
      void run(lights, 0, { duration: 0.45, ease: 'easeOut' })
      return
    }
    if (slide.step === 1) {
      if (was === 0) {
        const t = take()
        void (async () => {
          await condense(from, SMALL)
          if (!live(t)) return
          await drop(floor.y)
          if (!live(t)) return
          await wait(0.22)
          if (!live(t)) return
          latest.current.advance?.()
        })()
      } else {
        rest(floor, SMALL, latest.current.index)
        lights.jump(DIM)
      }
      return
    }
    if (was === 1) {
      const t = take()
      void (async () => {
        await hop(CORNER, HOME)
        if (!live(t)) return
        const { advance, index } = latest.current
        if (!advance || index == null) return
        await spread(CORNER, index + 1, advance)
      })()
    } else {
      rest(CORNER, HOME, latest.current.index)
      lights.jump(DIM)
    }
  }, [slide.step, slide.static])

  useEffect(() => {
    hooks.onLeaveForward = (from, next) => (next === from + 1 ? absorb() : hide())
    return () => {
      hooks.onLeaveForward = null
    }
  }, [])

  return (
    <>
      <span ref={anchor} hidden />
      <motion.div className="lights" style={{ opacity: lights }} aria-hidden="true" />
    </>
  )
}

/* ---------------------------------------------------------------- vessel --- */
/**
 * The vessel: the wireframe that carries the light from one slide to the next.
 * It is one closed outline built from sampled icon anchors, so all three of its
 * shapes are the same points in different places — the ring the last stop of
 * 060 leaves behind, the balloon that lifts off it, and the vendor's cloud on
 * 070. `shape` runs 0 → 1 → 2 and the path is rebuilt from the lerped
 * anchors. The connector lives here too, so its attachment and release stay
 * continuous through the slide change.
 *
 * The orb rule stands: the light inside is the same pink glow, and the outline
 * around it is a wireframe like the app's phone — the orb itself never gets a
 * skin, a ring or any blue.
 */
type Anchor = { x: number; y: number; t?: number }

/** local box of `.vessel`; every shape is written around its centre */
const V_BOX = 520
const VC = V_BOX / 2
/** points per shape — every shape has the same ones at the same angles, which is what lets any two of them lerp */
const N = 96
const TAU = Math.PI * 2

/**
 * A shape is written as the area it covers — circles, a triangle, a floor —
 * and sampled into `N` points by walking a ray out from `from` at each angle
 * until it leaves. Walking out (rather than taking each circle's far side)
 * is what keeps the notches between a cloud's puffs: the ray stops at the
 * first gap, it does not jump to the far side of the next puff.
 */
type Inside = (x: number, y: number) => boolean
function sampleShape(from: Point, inside: Inside): Anchor[] {
  return Array.from({ length: N }, (_, k) => {
    const a = (k * TAU) / N
    const dx = Math.sin(a)
    const dy = -Math.cos(a)
    const at = (d: number) => inside(from.x + d * dx, from.y + d * dy)
    let lo = 0
    while (lo < 400 && at(lo + 1)) lo += 1
    let hi = lo + 1
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2
      if (at(mid)) lo = mid
      else hi = mid
    }
    return { x: +(from.x + lo * dx).toFixed(1), y: +(from.y + lo * dy).toFixed(1) }
  })
}

const inCircle = (cx: number, cy: number, r: number): Inside => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r
const inEllipse = (cx: number, cy: number, rx: number, ry: number): Inside => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
const inTriangle = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): Inside => (x, y) => {
  const s = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
  const t = (cx - bx) * (y - by) - (cy - by) * (x - bx)
  const u = (ax - cx) * (y - cy) - (ay - cy) * (x - cx)
  return (s >= 0 && t >= 0 && u >= 0) || (s <= 0 && t <= 0 && u <= 0)
}
const inRect = (x0: number, y0: number, x1: number, y1: number): Inside => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1
const anyOf = (...parts: Inside[]): Inside => (x, y) => parts.some((p) => p(x, y))
/** everything above `y`, so a shape can be cut off flat */
const above = (part: Inside, floor: number): Inside => (x, y) => y <= floor && part(x, y)

/** shape 0 — the 120 px stop ring on 060, so the balloon grows out of it */
const RING = sampleShape({ x: 0, y: 0 }, inCircle(0, 0, 60))

/** shape 1 — Tabler's `balloon` body; the connector supplies its straight string. */
const BALLOON_ICON = 'M6 8a6 6 0 1 1 12 0c0 4.97 -2.686 9 -6 9s-6 -4.03 -6 -9'
const BALLOON_FIT = fitPath(BALLOON_ICON, 190)
const BALLOON = BALLOON_FIT.anchors

/**
 * shape 2 — the vendor's cloud: Feather's `cloud` icon (the same path 070's
 * hand-off machine draws), walked along its own outline. The points come off
 * the real path at even steps, so what is drawn at the end of the morph is
 * the icon itself and not an impression of it. Like the marched shapes it
 * starts at the top and runs clockwise, which is what keeps the morph from
 * twisting.
 */
function fitPath(d: string, width: number): { anchors: Anchor[]; k: number; cx: number; cy: number } {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  el.setAttribute('d', d)
  const len = el.getTotalLength()
  const steps = 24 * N
  const raw = Array.from({ length: steps }, (_, i) => el.getPointAtLength((i * len) / steps))
  const xs = raw.map((p) => p.x)
  const ys = raw.map((p) => p.y)
  const k = width / (Math.max(...xs) - Math.min(...xs))
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  let pts = raw.map((p) => ({ x: (p.x - cx) * k, y: (p.y - cy) * k }))
  /* clockwise on screen (y down) */
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    area += a.x * b.y - b.x * a.y
  }
  if (area < 0) pts.reverse()
  /* start at the top, like the marched shapes */
  let top = 0
  pts.forEach((p, i) => {
    if (p.y < pts[top].y - 0.01 || (Math.abs(p.y - pts[top].y) <= 0.01 && Math.abs(p.x) < Math.abs(pts[top].x))) top = i
  })
  pts = [...pts.slice(top), ...pts.slice(0, top)]
  const anchors = Array.from({ length: N }, (_, i) => {
    const p = pts[Math.round((i * pts.length) / N) % pts.length]
    return { x: +p.x.toFixed(1), y: +p.y.toFixed(1) }
  })
  return { anchors, k, cx, cy }
}

/** Material Symbols `cloud` (filled) — the icon everyone draws for a cloud, taken as it ships */
const CLOUD_ICON =
  'M251-160q-88 0-149.5-61.5T40-371q0-78 50-137t127-71q20-97 94-158.5T482-799q112 0 189 81.5T748-522v24q72-2 122 46.5T920-329q0 69-50 119t-119 50H251Z'
const CLOUD = fitPath(CLOUD_ICON, 440).anchors

/** where the light sits and how wide it burns in each shape: ring · balloon · cloud */
const GLOW_Y = [0, -34, 10]
const GLOW_R = [78, 104, 200]

const mix = (a: number, b: number, k: number) => a + (b - a) * k
const between = (a: Anchor[], b: Anchor[], k: number): Anchor[] =>
  a.map((p, i) => ({ x: mix(p.x, b[i].x, k), y: mix(p.y, b[i].y, k), t: mix(p.t ?? 1, b[i].t ?? 1, k) }))
const shapeAt = (s: number) => (s <= 1 ? between(RING, BALLOON, Math.max(0, s)) : between(BALLOON, CLOUD, Math.min(1, s - 1)))

/* a closed smooth outline through the anchors (Catmull-Rom as cubics); an
   anchor's `t` is how round it is — 0 is a corner, 1 the natural curve */
function outline(a: Anchor[]): string {
  const n = a.length
  const at = (i: number) => a[(i + n) % n]
  const p = (v: number) => v.toFixed(1)
  let d = `M ${p(a[0].x + VC)} ${p(a[0].y + VC)}`
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const t1 = (p1.t ?? 1) / 6
    const t2 = (p2.t ?? 1) / 6
    d += ` C ${p(p1.x + (p2.x - p0.x) * t1 + VC)} ${p(p1.y + (p2.y - p0.y) * t1 + VC)}`
    d += ` ${p(p2.x - (p3.x - p1.x) * t2 + VC)} ${p(p2.y - (p3.y - p1.y) * t2 + VC)}`
    d += ` ${p(p2.x + VC)} ${p(p2.y + VC)}`
  }
  return `${d} Z`
}

const ves = {
  /** centre, in stage px */
  x: motionValue(0),
  y: motionValue(0),
  scale: motionValue(1),
  /** a balloon never hangs straight */
  rot: motionValue(0),
  opacity: motionValue(0),
  /** 0 ring · 1 balloon · 2 cloud */
  shape: motionValue(0),
  /** the light inside */
  glow: motionValue(0),
  /** "Vendor" inside the cloud */
  label: motionValue(0),
  /** 1 while tied to the previous stop; 0 once the connector has become the free tail */
  tether: motionValue(0),
}
const launchClock = motionValue(0)
const callOpacity = motionValue(0)
const callRotation = motionValue(0)
let detachLaunch: (() => void) | null = null

const vstate = {
  /** the balloon is between two slides: the arriving slide picks it up */
  inFlight: false,
  /** The shared ascent; the vendor waits for the camera to settle before the morph. */
  exit: null as Promise<void> | null,
  /** slide index whose cue has just placed the vessel; the fallback hide must not undo it */
  claimedBy: null as number | null,
  tetherFrom: { x: 0, y: 0 },
  launchFrom: { x: 0, y: 0 },
}

let vticket = 0
const vtake = () => ++vticket
const vlive = (t: number) => t === vticket
const vstill = () => {
  detachLaunch?.()
  detachLaunch = null
  launchClock.stop()
  flightCamera.stop()
  for (const v of Object.values(ves)) v.stop()
}

function vput(at: Point, shape: number, { scale = 1, glow = 1, label = 0, rot = 0, tether = 0 } = {}) {
  vstill()
  ves.x.jump(at.x)
  ves.y.jump(at.y)
  ves.scale.jump(scale)
  ves.rot.jump(rot)
  ves.shape.jump(shape)
  ves.glow.jump(glow)
  ves.label.jump(label)
  ves.tether.jump(tether)
  ves.opacity.jump(1)
}

/**
 * The ring inflates, releases its string and climbs into the vendor's part
 * of the same world. Advance only transfers the click controls after the
 * camera settles; both pieces of content remain mounted throughout.
 */
export async function balloonLaunch(at: Point, from: Point, advance?: () => void, alive?: () => boolean) {
  const t = vtake()
  vstate.inFlight = true
  vstate.claimedBy = null
  vstate.tetherFrom = from
  vstate.launchFrom = at
  vput(at, 0, { glow: 0, tether: 1 })
  flightCamera.jump(0)
  launchClock.jump(0)
  let advanced = false
  const off = launchClock.on('change', (seconds) => {
    const pose = balloonFrame(seconds, at, RING, BALLOON)
    ves.x.set(pose.x)
    ves.y.set(pose.y)
    ves.shape.set(pose.shape)
    ves.scale.set(pose.scale)
    ves.rot.set(pose.rot)
    ves.glow.set(pose.glow)
    ves.tether.set(pose.tether)
    flightCamera.set(pose.cameraY)
    if (pose.advance && !advanced && vlive(t) && (!alive || alive())) {
      advanced = true
      advance?.()
    }
  })
  detachLaunch = off
  // A rapid manual advance joins this flight instead of restarting the balloon.
  const flight = run(launchClock, BALLOON_DURATION, { duration: BALLOON_DURATION, ease: 'linear' })
  vstate.exit = flight
  try {
    await flight
  } finally {
    off()
    if (detachLaunch === off) detachLaunch = null
  }
}

/** the balloon sitting on the stop it grew out of — the launch step's rest state, re-entered from the next slide */
export function balloonRest(at: Point, from: Point, owner?: number) {
  vtake()
  vstate.inFlight = false
  vstate.exit = null
  vstate.claimedBy = owner ?? null
  vstate.tetherFrom = from
  const pose = balloonFrame(BALLOON_TIMING.gather + BALLOON_TIMING.inflate, at, RING, BALLOON)
  vput(pose, 1, { tether: 1 })
  void run(flightCamera, 0, { duration: 0.9, ease: EASE })
}

/**
 * The outline opens into a cloud during the last part of the ascent.
 * On arrival, settle it gently and reveal its centred name.
 */
export async function cloudArrive(at: Point, owner?: number) {
  const t = vtake()
  vstate.claimedBy = owner ?? null
  if (vstate.exit) {
    await vstate.exit
  }
  if (!vlive(t)) return
  vstate.exit = null
  vstate.inFlight = false
  await Promise.all([
    run(ves.x, at.x, { duration: 0.35, ease: EASE }),
    run(ves.y, at.y + 10 - FLIGHT_HEIGHT, { duration: 0.35, ease: EASE }),
    run(ves.label, 1, { duration: 0.45, ease: 'easeOut' }),
  ])
}

/** the cloud at rest in the middle of the slide, name inside */
export function cloudRest(at: Point, owner?: number) {
  vtake()
  vstate.inFlight = false
  vstate.exit = null
  vstate.claimedBy = owner ?? null
  vput({ x: at.x, y: at.y + 10 - FLIGHT_HEIGHT }, 2, { label: 1 })
  flightCamera.jump(FLIGHT_HEIGHT)
}

/** The cloud moves into the diagram with its name still inside. */
export async function cloudPark(to: Point, scale: number, owner?: number) {
  const t = vtake()
  vstill()
  vstate.inFlight = false
  vstate.exit = null
  vstate.claimedBy = owner ?? null
  void run(ves.label, 1, { duration: 0.3, ease: 'easeOut' })
  await Promise.all([
    run(ves.x, to.x, { duration: 0.9, ease: EASE }),
    run(ves.y, to.y - FLIGHT_HEIGHT, { duration: 0.9, ease: EASE }),
    run(flightCamera, FLIGHT_HEIGHT, { duration: 0.9, ease: EASE }),
    run(ves.scale, scale, { duration: 0.9, ease: EASE }),
    run(ves.rot, 0, { duration: 0.9, ease: EASE }),
    run(ves.shape, 2, { duration: 0.9, ease: EASE }),
    run(ves.tether, 0, { duration: 0.3, ease: 'easeOut' }),
    run(ves.glow, 1, { duration: 0.3, ease: 'easeOut' }),
  ])
  if (!vlive(t)) return
}

/** parked, no motion — the state the slide shows when it is re-entered at a later step */
export function cloudParkRest(to: Point, scale: number, owner?: number) {
  vtake()
  vstate.inFlight = false
  vstate.exit = null
  vstate.claimedBy = owner ?? null
  vput({ x: to.x, y: to.y - FLIGHT_HEIGHT }, 2, { scale, label: 1 })
  flightCamera.jump(FLIGHT_HEIGHT)
}

/** the cloud comes back to the middle and takes its name again (stepping back) */
export async function cloudHome(at: Point, owner?: number) {
  const t = vtake()
  vstate.claimedBy = owner ?? null
  await Promise.all([
    run(ves.x, at.x, { duration: 0.9, ease: EASE }),
    run(ves.y, at.y + 10 - FLIGHT_HEIGHT, { duration: 0.9, ease: EASE }),
    run(ves.scale, 1, { duration: 0.9, ease: EASE }),
  ])
  if (!vlive(t)) return
  await run(ves.label, 1, { duration: 0.35, ease: 'easeOut' })
}

export async function vesselHide(returnToPhone = false) {
  vtake()
  vstate.inFlight = false
  vstate.exit = null
  vstill()
  if (returnToPhone) void run(flightCamera, 0, { duration: 0.8, ease: EASE })
  await run(ves.opacity, 0, { duration: 0.28, ease: 'easeOut' })
}

/** the outline, its rigging, the light inside and the name — drawn once by the deck, inside the ball layer */
function Vessel() {
  const cloudScale = useTransform([ves.scale, ves.shape], ([scale, shape]: number[]) =>
    scale * (1 - 0.3 * Math.max(0, Math.min(1, shape - 1))),
  )
  const d = useTransform(ves.shape, (s: number) => outline(shapeAt(s)))
  const string = useTransform([ves.x, ves.y, cloudScale, ves.rot, ves.shape, ves.tether, launchClock], ([x, y, scale, rot, shape, tether, seconds]: number[]) => {
    const pose = { x, y, scale, rot, shape }
    const points = balloonString(pose, tether, vstate.tetherFrom, RING, BALLOON, seconds, vstate.launchFrom)
    if (shape > 1) {
      // Reel the thread into the same outline point as it becomes the cloud.
      const contour = shapeAt(shape)
      const anchor = toStage(contour[contour.length / 2], pose)
      const head = points[0]
      const remaining = Math.max(0, 2 - shape)
      return points.map((p, i) => `${i ? 'L' : 'M'} ${(anchor.x + (p.x - head.x) * remaining).toFixed(1)} ${(anchor.y + (p.y - head.y) * remaining).toFixed(1)}`).join(' ')
    }
    return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  },
  )
  const rig = useTransform([ves.shape, ves.opacity], ([s, o]: number[]) => o * Math.max(0, Math.min(1, (2 - s) / 0.02)))
  const stringStroke = useTransform(ves.tether, (t) => `rgba(255,255,255,${0.72 - 0.17 * t})`)
  const wireStroke = useTransform(ves.shape, [0, 1], ['rgba(255,255,255,1)', 'rgba(255,255,255,0.72)'])
  /* the hairline keeps its 2.5 px however the vessel is scaled */
  const stroke = useTransform(ves.scale, (s: number) => 2.5 / s)
  /* The light and the outline share the same path throughout the morph. */
  const glowY = useTransform(ves.shape, [0, 1, 2], GLOW_Y.map((v) => VC + v))
  const glowR = useTransform(ves.shape, [0, 1, 2], GLOW_R)
  const callVisibility = useTransform([ves.label, callOpacity], ([label, call]: number[]) => label * call)
  return (
    <motion.div className="vessel__camera" style={{ y: flightCamera }}>
      <motion.svg className="vessel__tether" viewBox="0 0 1280 720" style={{ opacity: rig, stroke: stringStroke }} aria-hidden="true">
        <motion.path d={string} />
      </motion.svg>
      <motion.div className="vessel" style={{ x: ves.x, y: ves.y, scale: cloudScale, rotate: ves.rot, opacity: ves.opacity }} aria-hidden="true">
        <motion.svg className="vessel__wire" viewBox={`0 0 ${V_BOX} ${V_BOX}`} style={{ strokeWidth: stroke, stroke: wireStroke }}>
          <defs>
            <radialGradient id="vessel-light">
              <stop offset="0%" stopColor="rgb(255, 85, 231)" stopOpacity="1" />
              <stop offset="34%" stopColor="rgb(255, 85, 231)" stopOpacity="0.82" />
              <stop offset="100%" stopColor="rgb(255, 85, 231)" stopOpacity="0" />
            </radialGradient>
            <clipPath id="vessel-skin">
              <motion.path d={d} />
            </clipPath>
          </defs>
          <motion.g clipPath="url(#vessel-skin)" style={{ opacity: ves.glow }}>
            <motion.circle cx={VC} cy={glowY} r={glowR} fill="url(#vessel-light)" stroke="none" />
          </motion.g>
          <motion.path d={d} />
          <motion.g style={{ opacity: callVisibility }}>
            <g transform="translate(228.4 161.8) scale(2.4)" fill="none" stroke="var(--paper)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <motion.g style={{ rotate: callRotation, transformBox: 'fill-box', originX: 0.5, originY: 0.5 }}>
              <path d="M 5 3 H 9 L 11 8 L 8 10 Q 10 15 15 17 L 17 14 L 22 16 V 20 Q 22 22 19 22 Q 4 19 3 6 Q 3 3 5 3 Z" />
              </motion.g>
              <path d="M 15 3 Q 21 3 21 9 M 15 -1 Q 25 -1 25 9" />
            </g>
          </motion.g>
        </motion.svg>
        <motion.div className="vessel__label" style={{ opacity: ves.label }}>
          Vendor
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Slide 070's opening beat: the camera follows 060's balloon up to the cloud,
 * the slide's own content waiting under it
 * (`.slide--cloud`). A separate click reveals the ringing phone before the
 * cloud moves into the diagram; `until` is the last step on screen.
 */
export function CloudIn({
  at = BALLOON_DESTINATION,
  park = { x: 1104, y: 104 },
  parkScale = 0.38,
  until = 5,
}: {
  at?: Point
  park?: Point
  parkScale?: number
  until?: number
}) {
  const slide = useSlide()
  const anchor = useRef<HTMLSpanElement>(null)
  const seen = useRef<number | null>(null)

  useEffect(() => {
    const el = slideOf(anchor.current)
    return () => el?.classList.remove('slide--cloud')
  }, [])

  useEffect(() => {
    if (slide.static || slide.active === false) return
    const was = seen.current
    seen.current = slide.step
    slideOf(anchor.current)?.classList.toggle('slide--cloud', slide.step <= 1)
    callRotation.jump(0)
    if (slide.step === 0) {
      callOpacity.jump(0)
      if (vstate.inFlight) void cloudArrive(at, slide.index)
      else if (was != null && was > 0) void cloudHome(at, slide.index)
      else cloudRest(at, slide.index)
    } else if (slide.step === 1) {
      if (was != null && was > 1) void cloudHome(at, slide.index)
      else if (was == null) cloudRest(at, slide.index)
      const reveal = animate(callOpacity, 1, { duration: 0.2 })
      const shake = animate(callRotation, [0, -6, 6, -4, 4, 0], { duration: 0.55, delay: 0.2, ease: 'easeInOut' })
      let cancelled = false
      void shake.then(() => {
        if (!cancelled && was === 0) slide.advance?.()
      })
      return () => { cancelled = true; reveal.stop(); shake.stop() }
    } else if (slide.step <= until) {
      callOpacity.jump(1)
      if (was != null && was <= 1) void cloudPark(park, parkScale, slide.index)
      else cloudParkRest(park, parkScale, slide.index)
    } else void vesselHide()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.step, slide.static, slide.active])

  return <span ref={anchor} hidden />
}
