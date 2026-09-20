import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { animate, motion, motionValue, useTransform, type ValueAnimationTransition } from 'motion/react'
import { useSlide } from './slideContext'

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
    if (from === slide) return
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
