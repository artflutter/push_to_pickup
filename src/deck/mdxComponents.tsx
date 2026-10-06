import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { animate, AnimatePresence, motion, useMotionTemplate, useMotionValue, useMotionValueEvent, useSpring, useTransform, type MotionValue } from 'motion/react'
import { F } from './Fragment'
import { Code, CodeMorph, Pre } from './Code'
import { ClaudeMark } from './ClaudeMark'
import { useSlide } from './slideContext'
import { balloonLaunch, balloonRest, CloudIn, FlightBackdrop, OrbLaunch, vesselHide } from './Traveller'

export function Cols({ children, n = 2, gap = 40 }: { children: ReactNode; n?: number; gap?: number }) {
  return (
    <div className="cols" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap }}>
      {children}
    </div>
  )
}

export function Box({
  children,
  tone = 'ink',
  title,
}: {
  children: ReactNode
  tone?: 'ink' | 'blue' | 'pink' | 'warn'
  title?: string
}) {
  return (
    <div className={`box box--${tone}`}>
      {title && <div className="box__title">{title}</div>}
      <div className="box__body">{children}</div>
    </div>
  )
}

export function Big({ children }: { children: ReactNode }) {
  return <div className="big">{children}</div>
}

export function Stat({ value, label, size = 'md' }: { value: ReactNode; label: ReactNode; size?: 'md' | 'xl' }) {
  return (
    <div className={`stat stat--${size}`}>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  )
}

export function Tag({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'pink' | 'ink' }) {
  return <span className={`tag tag--${tone}`}>{children}</span>
}

/**
 * The push -> pickup pipeline. Each <Step> reveals on its own click and the
 * connector between steps animates in with it.
 */
export function Flow({ children }: { children: ReactNode }) {
  return <div className="flow">{children}</div>
}

export function Step({
  children,
  ms,
  at,
  tone = 'ink',
}: {
  children: ReactNode
  /** Budget for this hop, rendered under the box. */
  ms?: string
  at?: number
  tone?: 'ink' | 'blue' | 'pink' | 'warn'
}) {
  const slide = useSlide()
  const ordinal = at ?? undefined
  return (
    <F at={ordinal} mode="fade" className="flow__cell">
      <motion.div className={`flow__step flow__step--${tone}`} layout>
        {children}
      </motion.div>
      {ms && <div className="flow__ms">{ms}</div>}
    </F>
  )
}

/* ----------------------------------------------------------------- cards --- */
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const lcm = (a: number, b: number) => (a * b) / gcd(a, b)

/* Gradient "spot": one slab per grid that springs to whichever card is active.
   It sits above the card backgrounds and below their content, so the text of
   the card it lands on stays crisp on top of it. */
interface Rect {
  x: number
  y: number
  width: number
  height: number
}
type SetActive = (el: HTMLElement | null, pop?: number) => void
const SpotContext = createContext<SetActive | null>(null)

/** Same curve as the CSS transitions on the card content, so slab and text grow together. */
const POP_EASE = [0.22, 0.61, 0.36, 1] as const

function useSpotLayer() {
  const [rect, setRect] = useState<Rect | null>(null)
  const [visible, setVisible] = useState(false)
  const [pop, setPop] = useState(1)
  const setActive = useCallback<SetActive>((el, nextPop = 1) => {
    if (!el) {
      setVisible(false)
      return
    }
    setRect({ x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight })
    setPop(nextPop)
    setVisible(true)
  }, [])
  const spot = rect ? (
    <motion.div
      className="spot"
      initial={{ ...rect, opacity: 0, scale: 1 }}
      animate={{ ...rect, opacity: visible ? 1 : 0, scale: visible ? pop : 1 }}
      transition={{
        type: 'spring',
        stiffness: 190,
        damping: 27,
        mass: 1,
        opacity: { duration: 0.35 },
        scale: { duration: 0.45, ease: POP_EASE },
      }}
    />
  ) : null
  return { setActive, spot }
}

/**
 * Site-style card grid. `rows` is how many cards sit in each row, so
 * rows={[3, 2]} lays five cards out as three on top and two below, each row
 * filling the full width. Wrap cards in <F> to reveal them one click at a
 * time, or give each <Card at={n}> to step the gradient spot across them.
 */
export function Cards({
  children,
  rows = [3, 2],
  gap = 16,
  height,
}: {
  children: ReactNode
  rows?: number[]
  gap?: number
  /** Fixed height in px; by default the grid takes all the height the slide has left. */
  height?: number
}) {
  const cols = rows.reduce((acc, n) => lcm(acc, n), 1)
  const spans = rows.flatMap((n) => Array<number>(n).fill(cols / n))
  const items = Children.toArray(children).filter((c) => !(typeof c === 'string' && c.trim() === ''))
  const { setActive, spot } = useSpotLayer()
  return (
    <SpotContext.Provider value={setActive}>
      <div
        className="cards has-spot"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap, height, flex: height != null ? 'none' : undefined }}
      >
        {items.map((child, i) => (
          <div key={i} className="cards__cell" style={{ gridColumn: `span ${spans[i] ?? 1}` }}>
            {child}
          </div>
        ))}
        {spot}
      </div>
    </SpotContext.Provider>
  )
}

/* Bento accordion: cards never change order. With a single row (rows={[5]})
   the lit card is a full-height square and the rest are narrow columns, so a
   step only touches two neighbours. With several rows the lit card grows out
   of its own spot into a full-height square and the other rows compress on
   their side of it. With `stack` the square has a fixed side and the rest are
   horizontal bars on the other; a step swaps two cards. Cards are
   absolutely positioned and spring between rects, so the resize is the
   animation. Before step 1 the rows share the height equally; static previews
   show the last card grown and lit. */
interface BentoLayout {
  rects: Map<number, Rect>
  heroAt: number | null
  /** false when the grid shows details elsewhere (Spotlight box), so cards stay title-only */
  detailInCards?: boolean
  /** every card is a horizontal bar (number + title, centred), whatever its height */
  bar?: boolean
  /** the lit card, when the grid decides it (Spotlight); undefined = lit on its own step */
  activeAt?: number | null
  /**
   * Where a card starts from before it takes its slot: a circle it springs
   * out of (Spotlight's opening view). While set, the card is drawn as that
   * circle — outline only, no content.
   */
  seed?: Map<number, Rect & { radius: number }>
  /** the grid can seed cards, so their corner radius is animated too */
  seedable?: boolean
}
const BentoContext = createContext<BentoLayout | null>(null)

export function Bento({
  children,
  rows = [5],
  gap = 16,
  stack,
}: {
  children: ReactNode
  /** Cards per row, in `at` order. Ignored when `stack` is set. */
  rows?: number[]
  gap?: number
  /**
   * Fixed layout: the lit card is a full-height square on one side and the
   * others stack as horizontal bars on the `stack` side, in order. A step
   * swaps the card entering the square with the one leaving it.
   */
  stack?: 'left' | 'right'
}) {
  const slide = useSlide()
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ats = Children.toArray(children)
    .flatMap((c) => (isValidElement(c) && typeof (c.props as { at?: unknown }).at === 'number' ? [(c.props as { at: number }).at] : []))
    .sort((a, b) => a - b)

  const step = slide.step
  const heroAt =
    ats.length === 0
      ? null
      : slide.static
        ? ats[ats.length - 1]
        : ats.includes(step)
          ? step
          : ([...ats].reverse().find((a) => a < step) ?? null)

  const rects = new Map<number, Rect>()
  if (size && stack) {
    const { w: W, h: H } = size
    /* before the first step the first card holds the square, dimmed */
    const hero = heroAt ?? ats[0]
    const side = Math.min(H, W)
    const squareX = stack === 'right' ? 0 : W - side
    const barX = stack === 'right' ? side + gap : 0
    const barW = W - side - gap
    const others = ats.filter((a) => a !== hero)
    const barH = others.length > 0 ? (H - gap * (others.length - 1)) / others.length : H
    if (hero != null) rects.set(hero, { x: squareX, y: 0, width: side, height: side })
    others.forEach((a, i) => rects.set(a, { x: barX, y: i * (barH + gap), width: barW, height: barH }))
  } else if (size) {
    const { w: W, h: H } = size
    let taken = 0
    const rowCards = rows.map((n) => ats.slice(taken, (taken += n))).filter((r) => r.length > 0)
    const rowH = (H - gap * (rowCards.length - 1)) / rowCards.length

    /* resting grid: every row shares the full width */
    const rest = new Map<number, Rect>()
    rowCards.forEach((cards, ri) => {
      const w = (W - gap * (cards.length - 1)) / cards.length
      cards.forEach((a, ci) => rest.set(a, { x: ci * (w + gap), y: ri * (rowH + gap), width: w, height: rowH }))
    })

    const heroRow = heroAt == null ? -1 : rowCards.findIndex((r) => r.includes(heroAt))
    if (heroAt == null || heroRow < 0) {
      rest.forEach((r, a) => rects.set(a, r))
    } else if (rowCards.length === 1) {
      /* Single row = accordion. The lit card is a full-height square, every
         other card is one fixed narrow column, all in order. A step only ever
         changes the two adjacent cards; nothing else moves at all. */
      const cards = rowCards[0]
      const side = Math.min(H, W)
      const narrow = (W - side - gap * (cards.length - 1)) / (cards.length - 1)
      let x = 0
      cards.forEach((a) => {
        const w = a === heroAt ? side : narrow
        rects.set(a, { x, y: 0, width: w, height: H })
        x += w + gap
      })
    } else {
      const side = Math.min(H, W)
      /* The square grows out of the lit card's own resting spot: anchored to
         the left edge, the right edge, or centred on it. */
      const heroRest = rest.get(heroAt)!
      const atLeft = heroRest.x <= 0.5
      const atRight = heroRest.x + heroRest.width >= W - 0.5
      const slot = atLeft && !atRight ? 'left' : atRight && !atLeft ? 'right' : 'center'
      const sx =
        slot === 'left'
          ? 0
          : slot === 'right'
            ? W - side
            : Math.max(0, Math.min(W - side, heroRest.x + heroRest.width / 2 - side / 2))
      rects.set(heroAt, { x: sx, y: 0, width: side, height: side })

      /* Everyone else keeps its row and order and simply compresses into the
         space left on its own side of the square — a push, never a reshuffle. */
      const place = (list: number[], ri: number, x0: number, x1: number) => {
        if (list.length === 0) return
        const w = (x1 - x0 - gap * (list.length - 1)) / list.length
        list.forEach((a, i) => rects.set(a, { x: x0 + i * (w + gap), y: ri * (rowH + gap), width: w, height: rowH }))
      }
      const squareMid = sx + side / 2
      rowCards.forEach((cards, ri) => {
        const others = cards.filter((a) => a !== heroAt)
        const left =
          slot === 'right'
            ? others
            : slot === 'left'
              ? []
              : others.filter((a) => {
                  const r = rest.get(a)!
                  return r.x + r.width / 2 < squareMid
                })
        const right = others.filter((a) => !left.includes(a))
        place(left, ri, 0, sx - gap)
        place(right, ri, sx + side + gap, W)
      })
    }
  }

  return (
    <BentoContext.Provider value={{ rects, heroAt: stack ? (heroAt ?? ats[0] ?? null) : heroAt }}>
      <div ref={ref} className="bento">
        {children}
      </div>
    </BentoContext.Provider>
  )
}

/* Spotlight: a fixed gradient box on the left and the cards as fixed bars on
   the right. Nothing ever moves. Before the first step the box carries the
   slide title; on step 1 the title hands off to the top of the slide and the
   box starts showing the lit card's number, title and detail, crossfading as
   the highlight walks down the bars. */
/* ------------------------------------------------------------------- orb --- */
/* All the pink is one blob: it rests in the bottom-left corner (where the
   brand gradient has its pink) and chases the pointer on a lazy spring while
   the pointer is inside the host; a small white sheen follows faster, like a
   reflection, and the blue base leans a few degrees toward the pointer.
   Pointer out: everything drifts home and the corner is pink again. */
interface OrbValues {
  skin: ReturnType<typeof useMotionTemplate>
  glowX: ReturnType<typeof useSpring>
  glowY: ReturnType<typeof useSpring>
  sheenX: ReturnType<typeof useSpring>
  sheenY: ReturnType<typeof useSpring>
}

interface OrbOptions {
  /** false in static views: blob parked, no listeners */
  active: boolean
  /** element to read the pointer from; defaults to the host */
  listen?: (el: HTMLElement) => HTMLElement | null
  /** where the blob goes instead of the pointer (host px); the pointer only drifts it a little */
  target?: { x: number; y: number } | null
}

/**
 * `w` × `h` is the host's size in stage px (0 until measured). Without a
 * target the blob rests in the bottom-left corner and follows the pointer
 * while it is over `listen`; with one it flies there on each change.
 */
function useOrb(host: React.RefObject<HTMLElement | null>, w: number, h: number, { active, listen, target }: OrbOptions): OrbValues {
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const ax = useMotionValue(225)
  const glowX = useSpring(px, { stiffness: 46, damping: 15, mass: 1.3 })
  const glowY = useSpring(py, { stiffness: 46, damping: 15, mass: 1.3 })
  const sheenX = useSpring(px, { stiffness: 150, damping: 22 })
  const sheenY = useSpring(py, { stiffness: 150, damping: 22 })
  const angle = useSpring(ax, { stiffness: 60, damping: 18 })
  /* the base is blue only — every bit of pink comes from the blob */
  const skin = useMotionTemplate`linear-gradient(${angle}deg, var(--blue) 40%, #4a5cff 100%)`

  const tx = target?.x
  const ty = target?.y
  const goalRef = useRef({ x: 0, y: h })
  goalRef.current = tx != null && ty != null ? { x: tx, y: ty } : { x: 0, y: h }
  const aim = useCallback(
    (x: number, y: number) => {
      px.set(x)
      py.set(y)
      ax.set(225 - (x / Math.max(w, 1) - 0.5) * 34)
    },
    [px, py, ax, w],
  )

  /* first placement is instant — no sliding in from the top-left corner */
  useEffect(() => {
    if (!w || !h) return
    const g = goalRef.current
    aim(g.x, g.y)
    for (const v of [glowX, sheenX]) v.jump(g.x)
    for (const v of [glowY, sheenY]) v.jump(g.y)
    angle.jump(225 - (g.x / w - 0.5) * 34)
  }, [w, h, aim, glowX, glowY, sheenX, sheenY, angle])

  /* a new target: fly there */
  useEffect(() => {
    if (!w || !h) return
    const g = goalRef.current
    aim(g.x, g.y)
  }, [tx, ty, w, h, aim])

  useEffect(() => {
    const el = host.current
    if (!w || !h || !el || !active) return
    const el2 = listen ? listen(el) : el
    if (!el2) return
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0) return
      const k = w / r.width
      const x = (e.clientX - r.left) * k
      const y = (e.clientY - r.top) * k
      const g = goalRef.current
      if (tx != null) aim(g.x + (x - g.x) * 0.1, g.y + (y - g.y) * 0.1)
      else aim(x, y)
    }
    const back = () => aim(goalRef.current.x, goalRef.current.y)
    el2.addEventListener('pointermove', move)
    el2.addEventListener('pointerleave', back)
    return () => {
      el2.removeEventListener('pointermove', move)
      el2.removeEventListener('pointerleave', back)
    }
  }, [host, w, h, active, listen, tx, aim])

  return { skin, glowX, glowY, sheenX, sheenY }
}

/* `together`: the sheen rides the glow's own spring instead of its faster one —
   on a small glow the two springs read as two orbs */
function OrbLayers({ orb, left = 0, together = false }: { orb: OrbValues; left?: number; together?: boolean }) {
  return (
    <>
      <motion.div className="orb__glow" style={{ x: orb.glowX, y: orb.glowY, left }} />
      <motion.div className="orb__sheen" style={{ x: together ? orb.glowX : orb.sheenX, y: together ? orb.glowY : orb.sheenY, left }} />
    </>
  )
}

const slideOf = (el: HTMLElement) => el.closest<HTMLElement>('.slide')

/**
 * Full-bleed background with the pointer-chasing blob: fills the nearest
 * positioned ancestor. `listen="slide"` (default) reads the pointer over the
 * whole slide, so content stacked on top doesn't block it; `self` only
 * inside the layer's own box.
 */
export function Orb({
  listen = 'slide',
  target,
  glow = true,
  children,
}: {
  listen?: 'slide' | 'self'
  target?: { x: number; y: number } | null
  /** false: the base only — render the blob yourself with <Lamp>, e.g. above a fog */
  glow?: boolean
  /** rendered after the layer with the orb's motion values — for things that follow the blob */
  children?: (orb: OrbValues) => ReactNode
}) {
  const slide = useSlide()
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const orb = useOrb(ref, size?.w ?? 0, size?.h ?? 0, { active: !slide.static, listen: listen === 'slide' ? slideOf : undefined, target })
  return (
    <>
      <motion.div ref={ref} className="orb" style={{ background: orb.skin }}>
        {glow && <OrbLayers orb={orb} />}
      </motion.div>
      {children?.(orb)}
    </>
  )
}

/** The blob and its sheen on their own layer — a transform-only mover, cheap to stack above a fog. */
export function Lamp({ orb, together = false }: { orb: OrbValues; together?: boolean }) {
  return (
    <div className="lamp">
      <OrbLayers orb={orb} together={together} />
    </div>
  )
}

/**
 * Fog of war: a dark layer with soft holes. The mask is static — each hole's
 * colour is a registered custom property (`--fog-hN`, see deck.css) that goes
 * from black (fog) to transparent (clear), so opening one is a CSS fade in
 * place, not a growing disc and not a per-frame mask rebuild. Up to 8.
 */
export function Fog({
  on = true,
  holes,
  open,
  clear = 210,
}: {
  on?: boolean
  /** every place that can be revealed */
  holes: { x: number; y: number }[]
  /** which of them are open right now */
  open: boolean[]
  clear?: number
}) {
  const layers = holes
    .map((h, k) => `radial-gradient(circle at ${h.x}px ${h.y}px, var(--fog-h${k}) ${clear}px, #000 ${Math.round(clear * 1.9)}px)`)
    .join(', ')
  const vars: Record<string, string> = {}
  holes.forEach((_, k) => {
    vars[`--fog-h${k}`] = open[k] ? 'transparent' : '#000'
  })
  return (
    <motion.div
      className="fog"
      style={{ WebkitMaskImage: layers, maskImage: layers, WebkitMaskComposite: 'source-in', maskComposite: 'intersect', ...vars }}
      initial={false}
      animate={{ opacity: on ? 1 : 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    />
  )
}

/* ----------------------------------------------------------------- route --- */
/**
 * Poster opening, then the orb flies from stop to stop, one per click. Each
 * <Stop title> is a ring on a line. Rings light by how close the orb is and
 * stay lit once it has passed; the line draws in under the orb as it
 * travels. No fog: the base stays bright throughout; the blob rides on its
 * own layer (<Lamp>) above the line and below the rings.
 *
 * `poster` is an opening title shown before `title` on the same poster, one
 * extra click: the words of one swap for the words of the other in place —
 * old words lift out, new words rise in, staggered. Stepping back runs the
 * swap downward. The same word motion carries the title off when the first
 * stop lights and brings it back when the deck steps back onto the poster.
 *
 * An <Act title> after the stops is a further act on the same route. On the
 * click after the last stop the whole frame — title, line and rings — lifts
 * out and the act's own title rises in its place as a poster, the same look
 * the route opened with; the next click carries that title into the corner
 * and the same rings come back empty for the orb to visit again. Stepping
 * back brings the old act down with its rings still lit.
 */
const ROUTE_EASE = [0.22, 0.61, 0.36, 1] as const
const coverMotion = {
  in: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
  out: { transition: { staggerChildren: 0.045 } },
}
const wordMotion = {
  in: (dir: number) => ({ opacity: 0, y: 56 * dir }),
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: ROUTE_EASE } },
  out: (dir: number) => ({ opacity: 0, y: -56 * dir, transition: { duration: 0.38, ease: ROUTE_EASE } }),
}

/* each word on its own motion span, so a title can swap word by word.
   `custom` is set on every span: the mount-time `in` variant is resolved from
   the span's own props (the presence custom only reaches exit), so without it
   the words would fade in without rising. */
function Words({ text, dir }: { text: ReactNode; dir: number }) {
  const parts = typeof text === 'string' ? text.split(' ') : [text]
  return (
    <>
      {parts.flatMap((w, i) => [
        i > 0 ? ' ' : null,
        <motion.span key={i} className="route__word" variants={wordMotion} custom={dir}>
          {w}
        </motion.span>,
      ])}
    </>
  )
}

type StopProps = { n?: ReactNode; title: ReactNode; children?: ReactNode }
/** one act of the route: the titles it opens with, then its rings */
type ActData = { covers: ReactNode[]; title: ReactNode; stops: StopProps[]; xs: number[] }

const ROUTE_W = 1280
const ROUTE_Y = 400
/* how far an act travels when the deck steps past it */
const ACT_LIFT = 180

const spread = (n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? ROUTE_W / 2 : 240 + (i * (ROUTE_W - 480)) / (n - 1)))

/* the stops written straight into <Route> are the first act; every <Act> adds
   another, and each act opens on its own title poster */
function readActs(title: ReactNode, poster: ReactNode, children: ReactNode): ActData[] {
  const kids = Children.toArray(children).filter(isValidElement)
  const stopsOf = (nodes: ReactNode) =>
    Children.toArray(nodes)
      .filter(isValidElement)
      .map((c) => c.props as StopProps)
  const acts: Omit<ActData, 'xs'>[] = [
    { covers: poster != null ? [poster, title] : [title], title, stops: kids.filter((k) => k.type !== Act).map((k) => k.props as StopProps) },
  ]
  for (const k of kids) {
    if (k.type !== Act) continue
    const a = k.props as { title: ReactNode; children?: ReactNode }
    acts.push({ covers: [a.title], title: a.title, stops: stopsOf(a.children) })
  }
  return acts.map((a) => ({ ...a, xs: spread(a.stops.length) }))
}

export function Route({ poster, title, children }: { poster?: ReactNode; title: ReactNode; children: ReactNode }) {
  const slide = useSlide()
  const acts = readActs(title, poster, children)
  /* every beat of the route: each opening title is one, each stop is one. The
     deck sits on the first beat at step 0, so there is one click fewer. */
  const beats = acts.flatMap((a, i) => [
    ...a.covers.map((_, j) => ({ act: i, cover: j, active: 0 })),
    ...a.stops.map((_, m) => ({ act: i, cover: -1, active: m + 1 })),
  ])
  useState(() => {
    for (let i = 1; i < beats.length; i++) slide.register(i)
    return null
  })
  const step = slide.static ? beats.length - 1 : Math.min(beats.length - 1, Math.max(0, slide.step))
  const beat = beats[step]
  /* which way the last click went — the title swap runs with it */
  const prevStep = useRef(step)
  const dir = step >= prevStep.current ? 1 : -1
  useEffect(() => {
    prevStep.current = step
  }, [step])
  const target = beat.active === 0 ? null : { x: acts[beat.act].xs[beat.active - 1], y: ROUTE_Y }
  return (
    <div className="route">
      <Orb target={target} glow={false}>
        {(orb) => (
          <>
            {acts.map((a, i) => {
              const at = i === beat.act ? beat.active : i < beat.act ? a.stops.length : 0
              return (
                <ActLayer
                  key={i}
                  orb={orb}
                  title={a.title}
                  stops={a.stops}
                  xs={a.xs}
                  active={at}
                  /* the corner title only exists once the act's own poster is gone */
                  titleShown={i < beat.act || at > 0}
                  state={i === beat.act ? 0 : i < beat.act ? -1 : 1}
                  isStatic={slide.static}
                />
              )
            })}
            <Lamp orb={orb} />
          </>
        )}
      </Orb>
      <AnimatePresence initial={false} custom={dir}>
        {beat.cover >= 0 && (
          <motion.div key={`cover-${step}`} className="route__cover" variants={coverMotion} custom={dir} initial="in" animate="show" exit="out">
            <Words text={acts[beat.act].covers[beat.cover]} dir={dir} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * One act: its title, the line and the rings. Two layers with the blob's own
 * layer between them, so the light keeps running above the line and below the
 * rings. `state` is -1 for an act the deck has stepped past (it lifts out of
 * frame), 0 for the one on screen, 1 for one still waiting below it.
 */
function ActLayer({
  orb,
  title,
  stops,
  xs,
  active,
  isStatic,
  state,
  titleShown,
}: {
  orb: OrbValues
  title: ReactNode
  stops: StopProps[]
  xs: number[]
  active: number
  isStatic: boolean
  state: -1 | 0 | 1
  titleShown: boolean
}) {
  /* a ring is held fully lit once the orb has reached it, for as long as it
     is at or before the current stop. Without this a step back would flip
     the ring the orb returns to from "passed" to distance-lit while the orb
     is still far away — a blink. Rings beyond the current stop go back to
     distance lighting, which fades as the orb leaves them. */
  const [reached, setReached] = useState<boolean[]>(() => xs.map((_, i) => i < active - 1 || (isStatic && i < active)))
  const reachedRef = useRef(reached)
  reachedRef.current = reached
  useMotionValueEvent(orb.glowX, 'change', (gx) => {
    if (state !== 0) return
    const i = active - 1
    if (i < 0 || reachedRef.current[i]) return
    if (Math.hypot(gx - xs[i], orb.glowY.get() - ROUTE_Y) < 60) setReached((a) => a.map((v, k) => (k === i ? true : v)))
  })
  useEffect(() => {
    setReached((a) => {
      const next = a.map((v, i) => i < active - 1 || (i < active && v))
      return next.some((v, i) => v !== a[i]) ? next : a
    })
  }, [active])

  const move = {
    initial: false as const,
    animate: { y: state === 0 ? 0 : state < 0 ? -ACT_LIFT : ACT_LIFT, opacity: state === 0 ? 1 : 0 },
    transition: { duration: 0.6, ease: ROUTE_EASE },
  }
  return (
    <>
      <motion.div className="route__act route__act--lines" {...move}>
        {/* held back until the orb is at the first ring: on the poster it roams with
            the pointer, and an act that opens from the right would otherwise show
            its lines already drawn while the orb flies back to the start */}
        <motion.svg
          className="route__path"
          viewBox="0 0 1280 720"
          initial={false}
          animate={{ opacity: active > 0 && reached[0] ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {xs.slice(1).map((x, i) => (
            <Segment key={i} orb={orb} a={xs[i]} b={x} y={ROUTE_Y} inset={114} />
          ))}
        </motion.svg>
      </motion.div>
      <motion.div className="route__act route__act--stops" {...move}>
        <AnimatePresence initial={false}>
          {titleShown && (
            <motion.h1
              key="title"
              className="slide__title route__title"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: ROUTE_EASE, delay: 0.1 }}
            >
              {title}
            </motion.h1>
          )}
        </AnimatePresence>
        {stops.map((s, i) => (
          <StopView
            key={i}
            orb={orb}
            x={xs[i]}
            y={ROUTE_Y}
            n={s.n ?? (i + 1).toString(2).padStart(2, '0')}
            title={s.title}
            body={s.children}
            shown={active > 0}
            held={i < active - 1 || (i === active - 1 && reached[i])}
            delay={0.08 * i}
          />
        ))}
      </motion.div>
    </>
  )
}

/* the line between two stops, drawn as far as the orb has travelled between their centres */
function Segment({ orb, a, b, y, inset }: { orb: OrbValues; a: number; b: number; y: number; inset: number }) {
  const progress = useTransform(orb.glowX, (gx: number) => Math.max(0, Math.min(1, (gx - a) / (b - a))))
  const opacity = useTransform(progress, (p) => (p > 0.02 ? 1 : 0))
  return <motion.line x1={a + inset} y1={y} x2={b - inset} y2={y} style={{ pathLength: progress, opacity }} />
}

/* how lit the ring a component sits in is — <Munch> waits for it to arrive */
const StopLit = createContext<MotionValue<number> | null>(null)

/* a ring lit by the orb's distance; `held` pins it fully lit (reached, and at or before the current stop) */
function StopView({
  orb,
  x,
  y,
  n,
  title,
  body,
  shown,
  held,
  delay,
}: {
  orb: OrbValues
  x: number
  y: number
  n: ReactNode
  title: ReactNode
  body?: ReactNode
  shown: boolean
  held: boolean
  delay: number
}) {
  const lit = useTransform([orb.glowX, orb.glowY], ([gx, gy]: number[]) => {
    if (held) return 1
    const d = Math.hypot(gx - x, gy - y)
    return Math.max(0, Math.min(1, 1 - (d - 60) / 260))
  })
  const border = useTransform(lit, (v) => `rgba(255, 255, 255, ${v})`)
  const halo = useTransform(lit, (v) => `0 0 0 12px rgba(255, 255, 255, ${0.14 * v})`)
  const scale = useTransform(lit, (v) => 1 + 0.06 * v)
  const text = useTransform(lit, (v) => v)
  return (
    <motion.div
      className="stop"
      style={{ left: x, top: y }}
      initial={false}
      animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 24 }}
      transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1], delay: shown ? delay : 0 }}
    >
      <StopLit.Provider value={lit}>
        <motion.div className="stop__ring" style={{ borderColor: border, boxShadow: halo, scale }}>
          <motion.span className="stop__n" style={{ opacity: text }}>
            {n}
          </motion.span>
        </motion.div>
        <motion.div className="stop__title" style={{ opacity: text }}>
          {title}
        </motion.div>
      </StopLit.Provider>
      {body && (
        <motion.div className="stop__body" style={{ opacity: text }}>
          {body}
        </motion.div>
      )}
    </motion.div>
  )
}

/* ---------------------------------------------------------------- unfold --- */
/**
 * One page, no layout change: a full-slide gradient with a hero drawing on
 * it and the blob resting on the hero. On the first click the hero shrinks
 * up out of the way and its circles (`seeds`, in slide px, one per <Stop>)
 * spring down into a row of rings, number inside, title and body under —
 * the blob stays on the hero, riding its shrink. Only the next click moves
 * it: it lights the rings one per click, the line drawing in behind it,
 * exactly like <Route>. Stepping back folds it up again.
 */
const UNFOLD_SPRING = { type: 'spring' as const, stiffness: 150, damping: 24, mass: 0.9 }

export function Unfold({
  hero,
  seeds,
  orbAt,
  heroAt = { x: 640, y: 360 },
  heroTo = { x: 640, y: 200 },
  shrink = 0.5,
  y = 470,
  ring = 120,
  launch = false,
  children,
}: {
  hero: ReactNode
  /** the hero's circles the stops start out as, in slide px, in stop order */
  seeds: { x: number; y: number; r: number }[]
  /** where the blob rests on the hero */
  orbAt: { x: number; y: number }
  /** the hero's centre — what it shrinks around */
  heroAt?: { x: number; y: number }
  /** where that centre goes once it has shrunk */
  heroTo?: { x: number; y: number }
  shrink?: number
  /** the rings' centre line */
  y?: number
  /** ring diameter */
  ring?: number
  /** one more step after the last ring: it becomes a balloon and carries the light off the top, turning the page on its way */
  launch?: boolean
  children: ReactNode
}) {
  const slide = useSlide()
  const stops = Children.toArray(children)
    .filter(isValidElement)
    .map((c) => c.props as StopProps)
  const n = stops.length
  const last = n + 1 + (launch ? 1 : 0)
  /* one click to unfold, then one per ring, then the launch */
  useState(() => {
    for (let i = 1; i <= last; i++) slide.register(i)
    return null
  })
  const step = slide.static ? n + 1 : Math.min(last, Math.max(0, slide.step))
  const open = step > 0
  /* how many rings the orb has been sent to */
  const active = Math.min(n, Math.max(0, step - 1))
  /* the last step: the ring the orb sits on lifts off as a balloon and takes the light with it */
  const away = launch && step === last
  const xs = spread(n)
  /* where the blob's resting spot on the hero ends up once the hero has shrunk */
  const orbAtShrunk = { x: heroTo.x + (orbAt.x - heroAt.x) * shrink, y: heroTo.y + (orbAt.y - heroAt.y) * shrink }
  const target = !open ? orbAt : active === 0 ? orbAtShrunk : { x: xs[active - 1], y }

  /* same rule as the route: a ring is held lit once the orb has reached it,
     for as long as it is at or before the current stop — no blink on the
     way back */
  const [reached, setReached] = useState<boolean[]>(() => xs.map((_, i) => i < active - 1 || (slide.static && i < active)))
  const reachedRef = useRef(reached)
  reachedRef.current = reached
  useEffect(() => {
    setReached((a) => {
      const next = a.map((v, i) => i < active - 1 || (i < active && v))
      return next.some((v, i) => v !== a[i]) ? next : a
    })
  }, [active])

  /* The launch step: the ring becomes a balloon and the camera follows it
     into the vendor's area. Both scenes remain mounted in <FlightScene>.
     Re-entered from the next slide it only shows its rest state — balloon on
     the ring, no replay and above all no auto-advance. */
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  const seen = useRef<number | null>(null)
  const latest = useRef({ advance: slide.advance, index: slide.index })
  latest.current = { advance: slide.advance, index: slide.index }
  useEffect(() => {
    if (slide.static || slide.active === false || !launch) return
    const was = seen.current
    seen.current = step
    const at = { x: xs[n - 1], y }
    const from = { x: (xs[n - 2] ?? xs[n - 1] - 400) + ring / 2 + 14, y }
    if (step === last) {
      if (was === last - 1) void balloonLaunch(at, from, latest.current.advance, () => alive.current)
      else balloonRest(at, from, latest.current.index)
    } else if (was === last) void vesselHide(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, slide.static, slide.active, launch])

  return (
    <div className={`unfold${open ? ' unfold--open' : ''}${away ? ' unfold--away' : ''}`}>
      <Orb target={target} glow={false}>
        {(orb) => (
          <>
            {launch && <FlightBackdrop skin={orb.skin} />}
            <Reach orb={orb} x={active > 0 ? xs[active - 1] : null} y={y} onReach={() => setReached((a) => a.map((v, k) => (k === active - 1 ? true : v)))} skip={!!reachedRef.current[active - 1]} />
            <motion.div
              className="unfold__hero"
              style={{ transformOrigin: `${heroAt.x}px ${heroAt.y}px` }}
              initial={false}
              animate={open ? { scale: shrink, x: heroTo.x - heroAt.x, y: heroTo.y - heroAt.y } : { scale: 1, x: 0, y: 0 }}
              transition={UNFOLD_SPRING}
            >
              {hero}
            </motion.div>
            {/* held back until the orb is at the first ring: it arrives from the hero, from above and off-line */}
            <motion.svg
              className="unfold__path"
              viewBox="0 0 1280 720"
              initial={false}
              animate={{ opacity: open && reached[0] ? 1 : 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {xs.slice(1).map((x, i) =>
                away && i === n - 2 ? null : <Segment key={i} orb={orb} a={xs[i]} b={x} y={y} inset={ring / 2 + 14} />,
              )}
              {/* Traveller takes this connector with the ring, keeping one string across the page turn. */}
            </motion.svg>
            {/* one orb: the sheen moves with the glow here, not ahead of it */}
            <Lamp orb={orb} together />
            {stops.map((s, i) => (
              <UnfoldStop
                key={i}
                orb={orb}
                seed={seeds[i]}
                x={xs[i]}
                y={y}
                size={ring}
                open={open}
                aim={i === active - 1}
                held={i < active - 1 || (i === active - 1 && reached[i])}
                /* the balloon has taken this ring: the circle and its number go, the title stays lit */
                gone={away && i === n - 1}
                /* binary, like the 020 bullets: 01 · 10 · 11 */
                n={s.n ?? (i + 1).toString(2).padStart(2, '0')}
                title={s.title}
                body={s.children}
              />
            ))}
          </>
        )}
      </Orb>
    </div>
  )
}

/* fires once when the orb comes within 60px of (x, y); nothing while x is null */
function Reach({ orb, x, y, onReach, skip }: { orb: OrbValues; x: number | null; y: number; onReach: () => void; skip: boolean }) {
  useMotionValueEvent(orb.glowX, 'change', (gx) => {
    if (x == null || skip) return
    if (Math.hypot(gx - x, orb.glowY.get() - y) < 60) onReach()
  })
  return null
}

/* a ring that starts out as one of the hero's circles. Once open, only the
   ring the orb is heading for (`aim`) lights by its distance — the orb comes
   down from the hero past the others, which must not flicker on the way —
   and a reached ring is held. */
function UnfoldStop({
  orb,
  seed,
  x,
  y,
  size,
  open,
  aim,
  held,
  gone = false,
  n,
  title,
  body,
}: {
  orb: OrbValues
  seed?: { x: number; y: number; r: number }
  x: number
  y: number
  size: number
  open: boolean
  aim: boolean
  held: boolean
  /** the balloon has taken this ring's circle: outline and number fade, the label stays */
  gone?: boolean
  n: ReactNode
  title: ReactNode
  body?: ReactNode
}) {
  /* the flags as motion values, so the transform below re-runs on their changes too */
  const mode = useMotionValue(0)
  useEffect(() => {
    mode.set(!open ? 0 : held ? 2 : aim ? 1 : 0)
  }, [open, aim, held, mode])
  const lit = useTransform([orb.glowX, orb.glowY, mode], ([gx, gy, m]: number[]) => {
    if (m === 0) return 0
    if (m === 2) return 1
    const d = Math.hypot(gx - x, gy - y)
    return Math.max(0, Math.min(1, 1 - (d - 60) / 260))
  })
  /* the circle itself: it fades out when the balloon takes it */
  const solid = useMotionValue(1)
  useEffect(() => {
    animate(solid, gone ? 0 : 1, { duration: gone ? 0.18 : 0.3, ease: 'easeOut' })
  }, [gone, solid])
  /* the same outline as the wireframe while folded; brightens with the light once open */
  const border = useTransform([lit, solid], ([v, f]: number[]) => `rgba(255, 255, 255, ${(0.62 + 0.38 * v) * f})`)
  const halo = useTransform([lit, solid], ([v, f]: number[]) => `0 0 0 10px rgba(255, 255, 255, ${0.14 * v * f})`)
  /* number and title come with the light: nothing on a ring the orb has not reached */
  const text = useTransform([lit, solid], ([v, f]: number[]) => v * f)
  const label = useTransform(lit, (v) => v)
  const rise = useTransform(lit, (v) => 12 * (1 - v))
  const box =
    open || !seed
      ? { x: x - size / 2, y: y - size / 2, width: size, height: size }
      : { x: seed.x - seed.r, y: seed.y - seed.r, width: 2 * seed.r, height: 2 * seed.r }
  return (
    <motion.div className="unfold__ring" style={{ borderColor: border, boxShadow: halo }} initial={false} animate={box} transition={UNFOLD_SPRING}>
      <motion.span className="unfold__n" style={{ opacity: text }}>
        {n}
      </motion.span>
      <motion.div className="unfold__label" style={{ opacity: label, y: rise }}>
        <div className="unfold__title">{title}</div>
        {body && <div className="unfold__body">{body}</div>}
      </motion.div>
    </motion.div>
  )
}

/** Data only — read by <Route>. */
export function Stop(_: { n?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return null
}

/** Data only — a further act of a <Route>: its own title and its own stops. */
export function Act(_: { title: ReactNode; children?: ReactNode }) {
  return null
}

/* Five bites, left to right across the number: at every bite the mark snaps
   shut over the next fifth and that fifth is clipped away for good. Built
   once — keyframes and their times have to line up exactly. */
const BITES = 5
const CHEW = (() => {
  const span = BITES + 0.5 /* a tail, so the mark can settle after the last bite */
  const times = [0]
  /* it waits centred under the ring and only steps aside for the first bite */
  const x = [0]
  const scaleX = [1]
  const scaleY = [1]
  const clip = ['inset(0px 0px 0px 0%)']
  for (let i = 0; i < BITES; i++) {
    const at = -32 + (64 * (i + 0.5)) / BITES
    times.push((i + 0.55) / span, (i + 1) / span)
    x.push(at, at)
    scaleX.push(1.22, 0.96)
    scaleY.push(0.7, 1.06)
    const eaten = (100 * (i + 1)) / BITES
    clip.push(`inset(0px 0px 0px ${eaten}%)`, `inset(0px 0px 0px ${eaten}%)`)
  }
  times.push(1)
  x.push(0)
  scaleX.push(1)
  scaleY.push(1)
  clip.push('inset(0px 0px 0px 100%)')
  return { times, x, scaleX, scaleY, clip, duration: 1.6 }
})()

/**
 * The Claude mark eating a stop's number: it waits below the ring, rises into
 * it after `delay` and chews the number away in five bites, then settles in
 * its place. Cued by the ring's own light, so it starts when the orb really
 * arrives; stepping back to an earlier stop puts the number back.
 */
export function Munch({ children, delay = 0.8 }: { children: ReactNode; delay?: number }) {
  const slide = useSlide()
  const lit = useStopLitValue()
  const [on, setOn] = useState(slide.static)
  useMotionValueEvent(lit, 'change', (v) => setOn(v > 0.98))
  const chew = { delay: delay + 0.5, duration: CHEW.duration, times: CHEW.times, ease: 'easeInOut' as const }
  return (
    <span className="munch">
      <motion.span
        className="munch__n"
        initial={false}
        animate={on ? { clipPath: CHEW.clip } : { clipPath: 'inset(0px 0px 0px 0%)' }}
        transition={on ? { ...chew, ease: 'linear' as const } : { duration: 0.3 }}
      >
        {children}
      </motion.span>
      <motion.span
        className="munch__icon"
        initial={false}
        animate={on ? { y: [140, -8, 0], x: CHEW.x, scaleX: CHEW.scaleX, scaleY: CHEW.scaleY } : { y: 140, x: 0, scaleX: 1, scaleY: 1 }}
        transition={on ? { y: { delay, duration: 0.5, ease: ROUTE_EASE }, x: chew, scaleX: chew, scaleY: chew } : { duration: 0.35, ease: 'easeOut' }}
      >
        <ClaudeMark />
      </motion.span>
    </span>
  )
}

/* the light of the ring this sits in; a still 0 when used outside a stop */
function useStopLitValue() {
  const idle = useMotionValue(0)
  return useContext(StopLit) ?? idle
}

/**
 * Design picker: shows child N on step N (clicks walk through the options).
 * Static views show the first. `after` holds the first option until that step,
 * so options can be walked after a choreography that owns the earlier steps
 * has finished.
 */
export function Pick({ children, after = 0 }: { children: ReactNode; after?: number }) {
  const slide = useSlide()
  const items = Children.toArray(children).filter(nonBlank)
  useState(() => {
    for (let i = 1; i < items.length; i++) slide.register(after + i)
    return null
  })
  const idx = slide.static ? 0 : Math.min(items.length - 1, Math.max(0, slide.step - after))
  return <>{items[idx]}</>
}

export type BulletStyle = 'list' | 'numbered' | 'ticks' | 'chips' | 'steps' | 'rail' | 'big' | 'hero'

export function Spotlight({
  title,
  eyebrow,
  children,
  gap = 16,
  titleRow = 82,
  box = 'left',
  split = 0.5,
  bullets,
  hero,
  heroOrb,
  heroSeeds,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  children: ReactNode
  gap?: number
  /** Height reserved for the slide title above the block (title line + gap). */
  titleRow?: number
  /** Which side the gradient box sits on; the bars take the other. */
  box?: 'left' | 'right'
  /** Share of the width the box takes (0.5 = an even split). */
  split?: number
  /**
   * How a card's `bullets` show in the box under (or instead of) its detail.
   * `steps` reveals them one click at a time: give the cards `at` values with
   * room for them (at={1}, at={5} … for three bullets each).
   */
  bullets?: BulletStyle
  /**
   * An opening view: before the first card lights, the box fills the whole
   * slide with this inside it (drawn under the blob). The first click shrinks
   * it into its corner and brings the bars in.
   */
  hero?: ReactNode
  /** Where the blob rests in the opening view, in slide px. Default: the middle. */
  heroOrb?: { x: number; y: number }
  /**
   * Circles in the opening view (slide px), one per card in `at` order: the
   * bars start out as these circles and spring into their slots on the
   * first click. The bars are then shown from step 0, not faded in.
   */
  heroSeeds?: { x: number; y: number; r: number }[]
}) {
  const slide = useSlide()
  const ref = useRef<HTMLDivElement>(null)
  /* own size, plus where this sits on the slide and how big the slide is
     (stage px), for the opening view that covers the whole slide */
  const [size, setSize] = useState<{ w: number; h: number; ox: number; oy: number; sw: number; sh: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      const host = slideOf(el)
      const a = el.getBoundingClientRect()
      const b = host?.getBoundingClientRect()
      const k = b && b.width > 0 && host ? host.offsetWidth / b.width : 1
      setSize(b && host ? { w, h, ox: (a.left - b.left) * k, oy: (a.top - b.top) * k, sw: host.offsetWidth, sh: host.offsetHeight } : { w, h, ox: 0, oy: 0, sw: w, sh: h })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  type Item = { at: number; n?: ReactNode; title?: ReactNode; detail?: ReactNode; bullets?: ReactNode[]; bulletStyle?: BulletStyle }
  const items: Item[] = Children.toArray(children)
    .flatMap((c) => (isValidElement(c) && typeof (c.props as { at?: unknown }).at === 'number' ? [c.props as Item] : []))
    .sort((a, b) => a.at - b.at)
  const ats = items.map((i) => i.at)

  const boxRef = useRef<HTMLDivElement>(null)

  /* stepped bullets take the clicks after their card's own */
  useState(() => {
    items.forEach((i) => (i.bulletStyle ?? bullets) === 'steps' && i.bullets?.forEach((_, k) => slide.register(i.at + k + 1)))
    return null
  })

  const step = slide.step
  const activeAt =
    ats.length === 0
      ? null
      : slide.static
        ? ats[ats.length - 1]
        : ats.includes(step)
          ? step
          : ([...ats].reverse().find((a) => a < step) ?? null)
  const active = items.find((i) => i.at === activeAt)
  const bulletStyle = active ? (active.bulletStyle ?? bullets) : undefined

  const rects = new Map<number, Rect>()
  let boxW = 0
  let boxH = 0
  let boxX = 0
  if (size) {
    const { w: W, h: H } = size
    boxW = W * split - gap / 2
    boxH = H - titleRow
    boxX = box === 'right' ? W - boxW : 0
    const barX = box === 'right' ? 0 : boxW + gap
    const barW = W - boxW - gap
    const barH = ats.length > 0 ? (boxH - gap * (ats.length - 1)) / ats.length : boxH
    ats.forEach((a, i) => rects.set(a, { x: barX, y: titleRow + i * (barH + gap), width: barW, height: barH }))
  }

  /* where the tail points: the middle of the lit bar */
  const activeIndex = activeAt == null ? -1 : ats.indexOf(activeAt)
  const barPitch = ats.length > 0 ? (boxH - gap * (ats.length - 1)) / ats.length + gap : 0
  const tailY = activeIndex < 0 ? boxH / 2 : activeIndex * barPitch + (barPitch - gap) / 2

  /* With a `hero` the box opens full-slide and shrinks into its corner on the
     first click, so its geometry is animated and the clip-path has to follow
     it frame by frame — hence motion values rather than plain numbers. */
  const RAD = 28
  const full = hero != null && activeAt == null
  const goal = size ? (full ? { x: -size.ox, y: -size.oy, w: size.sw, h: size.sh, r: 0 } : { x: boxX, y: titleRow, w: boxW, h: boxH, r: RAD }) : null
  const bxMv = useMotionValue(0)
  const byMv = useMotionValue(0)
  const bwMv = useMotionValue(0)
  const bhMv = useMotionValue(0)
  const brMv = useMotionValue(RAD)
  const BOX_SPRING = { stiffness: 150, damping: 24, mass: 0.9 }
  const bx = useSpring(bxMv, BOX_SPRING)
  const by = useSpring(byMv, BOX_SPRING)
  const bw = useSpring(bwMv, BOX_SPRING)
  const bh = useSpring(bhMv, BOX_SPRING)
  const br = useSpring(brMv, BOX_SPRING)
  const placed = useRef(false)
  useEffect(() => {
    if (!goal) return
    const pairs: [typeof bxMv, typeof bx, number][] = [
      [bxMv, bx, goal.x],
      [byMv, by, goal.y],
      [bwMv, bw, goal.w],
      [bhMv, bh, goal.h],
      [brMv, br, goal.r],
    ]
    /* a box without a hero never moves, so it is always put straight there */
    const jump = !placed.current || slide.static || hero == null
    for (const [mv, sp, v] of pairs) {
      mv.set(v)
      if (jump) sp.jump(v)
    }
    placed.current = true
  }, [goal?.x, goal?.y, goal?.w, goal?.h, goal?.r, hero, slide.static, bxMv, byMv, bwMv, bhMv, brMv, bx, by, bw, bh, br])

  /* in the opening view the blob rests on the hero (`heroOrb`); the pointer only drifts it */
  const orb = useOrb(boxRef, goal?.w ?? 0, goal?.h ?? 0, {
    active: !slide.static,
    target: full && goal ? (heroOrb ?? { x: goal.w / 2, y: goal.h / 2 }) : null,
  })

  /* the opening view's circles, in this block's own coordinates, one per bar */
  const seed = useMemo(() => {
    if (!full || !heroSeeds || !size) return undefined
    const m = new Map<number, Rect & { radius: number }>()
    heroSeeds.forEach((c, i) => {
      const a = ats[i]
      if (a != null) m.set(a, { x: c.x - c.r - size.ox, y: c.y - c.r - size.oy, width: 2 * c.r, height: 2 * c.r, radius: c.r })
    })
    return m
  }, [full, heroSeeds, size, ats.join(',')])

  /* The tail is a notch in the skin's clip-path, so gradient and glow run
     straight into it. It springs between bars and grows out when lit. */
  const TAIL = 16
  const tailYMv = useMotionValue(0)
  const tailOnMv = useMotionValue(0)
  const tailYS = useSpring(tailYMv, { stiffness: 260, damping: 28 })
  const tailOnS = useSpring(tailOnMv, { stiffness: 200, damping: 26 })
  const clip = useTransform([tailYS, tailOnS, bw, bh, br], ([yRaw, on, W, H, RAD]: number[]) => {
    const t = TAIL * on
    const y = Math.max(RAD + TAIL, Math.min(H - RAD - TAIL, yRaw))
    const n = (v: number) => v.toFixed(2)
    const arc = `A${RAD},${RAD} 0 0 1`
    if (box === 'right') {
      const x0 = TAIL
      const x1 = TAIL + W
      return `path("M${n(x0 + RAD)},0 H${n(x1 - RAD)} ${arc} ${n(x1)},${RAD} V${n(H - RAD)} ${arc} ${n(x1 - RAD)},${n(H)} H${n(x0 + RAD)} ${arc} ${n(x0)},${n(H - RAD)} V${n(y + t)} L${n(x0 - t)},${n(y)} L${n(x0)},${n(y - t)} V${RAD} ${arc} ${n(x0 + RAD)},0 Z")`
    }
    return `path("M${RAD},0 H${n(W - RAD)} ${arc} ${n(W)},${RAD} V${n(y - t)} L${n(W + t)},${n(y)} L${n(W)},${n(y + t)} V${n(H - RAD)} ${arc} ${n(W - RAD)},${n(H)} H${RAD} ${arc} 0,${n(H - RAD)} V${RAD} ${arc} ${RAD},0 Z")`
  })

  const lit = activeAt != null
  /* The tail travels only while it is out, from bar to bar. While hidden —
     before the box is measured, on step 0, or arriving on a later step from
     the next slide — it is put straight where it will show, so growing out
     never comes with a vertical slide; retracting leaves it where it is. */
  const shown = useRef(false)
  useEffect(() => {
    if (!size) return
    if (slide.static || (lit && !shown.current)) {
      tailYMv.jump(tailY)
      tailYS.jump(tailY)
    } else if (lit) tailYMv.set(tailY)
    if (slide.static) tailOnS.jump(lit ? 1 : 0)
    else tailOnMv.set(lit ? 1 : 0)
    shown.current = lit
  }, [size, tailY, lit, slide.static, tailYMv, tailOnMv, tailYS, tailOnS])

  return (
    <div ref={ref} className="spotlight">
      <motion.h1
        className="slide__title spotlight__title"
        initial={false}
        animate={{ opacity: lit ? 1 : 0, y: lit ? 0 : 28 }}
        transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1], delay: lit && !slide.static ? 0.12 : 0 }}
      >
        {title}
      </motion.h1>

      {size && (
        <motion.div ref={boxRef} className={`spotlight__box${full ? ' spotlight__box--full' : ''}`} style={{ x: bx, y: by, width: bw, height: bh }}>
          <motion.div
            className="spotlight__skin"
            style={{ background: orb.skin, clipPath: clip, left: box === 'right' ? -TAIL : 0, right: box === 'right' ? 0 : -TAIL }}
          >
            {hero && (
              <motion.div
                className="spotlight__hero"
                initial={false}
                animate={{ opacity: full ? 1 : 0 }}
                transition={{ duration: full ? 0.45 : 0.25, ease: 'easeOut' }}
              >
                {hero}
              </motion.div>
            )}
            {/* the blob rides above the hero: it is the light on it, not behind it */}
            <OrbLayers orb={orb} left={box === 'right' ? TAIL : 0} />
          </motion.div>
          <AnimatePresence mode="wait" initial={false}>
            {active == null ? (
              hero ? null : (
              <motion.div
                key="cover"
                className="spotlight__cover"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -48 }}
                transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
              >
                {eyebrow && <div className="spotlight__eyebrow">{eyebrow}</div>}
                <div className="spotlight__cover-title">{title}</div>
              </motion.div>
              )
            ) : (
              <motion.div
                key={active.at}
                className={`spotlight__detail${bulletStyle && active.bullets ? ` spotlight__detail--${bulletStyle}` : ''}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease: 'easeOut' }}
              >
                {/* number and title already sit on the highlighted bar; the box carries the detail only */}
                {bulletStyle && active.bullets ? (
                  <BoxBullets
                    style={bulletStyle}
                    items={active.bullets}
                    lead={active.detail}
                    heading={active.title}
                    shown={slide.static || bulletStyle !== 'steps' ? active.bullets.length : Math.max(0, step - active.at)}
                  />
                ) : (
                  (active.detail ?? active.title)
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <motion.div
        className="spotlight__bars"
        initial={false}
        animate={{ opacity: full && !heroSeeds ? 0 : 1 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: full || slide.static ? 0 : 0.2 }}
      >
        <BentoContext.Provider value={{ rects, heroAt: null, detailInCards: false, bar: true, activeAt, seed, seedable: hero != null }}>
          {children}
        </BentoContext.Provider>
      </motion.div>
    </div>
  )
}

/* Bullets inside the Spotlight box, one markup, eight looks (deck.css .sb--*). */
function BoxBullets({
  style,
  items,
  lead,
  heading,
  shown,
}: {
  style: BulletStyle
  items: ReactNode[]
  lead?: ReactNode
  heading?: ReactNode
  shown: number
}) {
  const withLead = style === 'list' || style === 'ticks' || style === 'chips' || style === 'steps' || style === 'rail'
  return (
    <>
      {style === 'big' && heading && <div className="spotlight__eyebrow">{heading}</div>}
      {withLead && lead && <div className="spotlight__lead">{lead}</div>}
      <div className={`sb sb--${style}`}>
        {items.map((item, k) => {
          const on = k < shown
          return (
            <motion.div
              key={k}
              className={`sb__item${k === 0 ? ' sb__item--first' : ''}`}
              initial={false}
              animate={{ opacity: on ? 1 : 0, y: on ? 0 : 10 }}
              transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
            >
              {style === 'numbered' && <span className="sb__n">{(k + 1).toString(2).padStart(2, '0')}</span>}
              {(style === 'list' || style === 'steps' || style === 'rail') && <span className="sb__dot" />}
              {style === 'ticks' && (
                <span className="sb__tick">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
              )}
              <span className="sb__text">{item}</span>
            </motion.div>
          )
        })}
      </div>
    </>
  )
}

export function Card({
  n,
  title,
  children,
  detail,
  tone = 'ink',
  size = 'md',
  at,
  art,
}: {
  /** Small index label, e.g. "01". */
  n?: ReactNode
  title?: ReactNode
  /** One-liner body. In a Bento, small cards show nothing but number + title. */
  children?: ReactNode
  /** Longer copy shown only while the card is the lit one; fades in once it has finished growing. */
  detail?: ReactNode
  tone?: 'ink' | 'blue' | 'pink' | 'brand'
  /** `lg` is the hero look: big headline, body pinned to the bottom. Inside <Bento> the lit card gets it. */
  size?: 'md' | 'lg'
  /**
   * Step this card lights up on. Before it: dimmed. On it: the gradient
   * (and, in a Bento, it grows in place). After it: plain. Cards without `at` are static.
   */
  at?: number
  /** Illustration between the title and the body; takes the spare height. */
  art?: ReactNode
  /** Short lines shown in the Spotlight box under the detail — see <Spotlight bullets />. */
  bullets?: ReactNode[]
  /** Per-card override of the Spotlight's bullet style. */
  bulletStyle?: BulletStyle
}) {
  const slide = useSlide()
  const setActive = useContext(SpotContext)
  const bento = useContext(BentoContext)
  const ref = useRef<HTMLDivElement>(null)
  const [ordinal] = useState(() => (at != null ? slide.register(at) : null))
  const seed = bento && at != null ? bento.seed?.get(at) : undefined
  const rect = seed ?? (bento && at != null ? bento.rects.get(at) : undefined)
  const isHero = bento ? bento.heroAt === at : size === 'lg'
  /* In a spot grid the lit card pops a little; in a Bento it grows for real. */
  const pop = bento ? 1 : size === 'lg' ? 1.03 : 1.06

  const state =
    ordinal == null
      ? 'plain'
      : slide.static
        ? bento
          ? isHero
            ? 'active'
            : 'revealed'
          : 'plain'
        : bento && bento.activeAt !== undefined
          ? bento.activeAt === at
            ? 'active'
            : slide.step < ordinal
              ? 'frosted'
              : 'revealed'
          : slide.step < ordinal
            ? 'frosted'
            : slide.step === ordinal
              ? 'active'
              : 'revealed'

  useLayoutEffect(() => {
    if (bento || state !== 'active' || !setActive) return
    setActive(ref.current, pop)
    return () => setActive(null)
  }, [bento, state, setActive, pop])

  const showDetail = detail != null && (bento ? bento.detailInCards !== false && state === 'active' : isHero)
  const body = bento ? null : isHero && detail ? detail : children

  /* The detail waits for the size spring to settle before fading in, so the
     paragraph never reflows while the card is still growing. */
  const [settled, setSettled] = useState(slide.static)
  useEffect(() => {
    if (slide.static) return
    if (state !== 'active') {
      setSettled(false)
      return
    }
    const t = window.setTimeout(() => setSettled(true), 800)
    return () => window.clearTimeout(t)
  }, [state, slide.static])

  /* Cards render (and register their step) before the bento is measured; once
     the slot rect is known, remount so it appears in place instead of
     animating from an unplaced box. */
  return (
    <motion.div
      key={rect ? 'placed' : 'unplaced'}
      ref={ref}
      className={`card card--${tone} card--${isHero ? 'lg' : 'md'} card--${state}${rect ? ' card--placed' : ''}${
        rect && rect.width < 200 ? ' card--narrow' : ''
      }${rect && (rect.height < 140 || bento?.bar) ? ' card--bar' : ''}${seed ? ' card--seed' : ''}`}
      style={{ '--pop': pop } as React.CSSProperties}
      initial={false}
      animate={
        rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, ...(bento?.seedable ? { borderRadius: seed ? seed.radius : 28 } : {}) }
          : undefined
      }
      transition={{ type: 'spring', stiffness: 170, damping: 26, mass: 1 }}
    >
      <div className="card__bg" />
      <div className="card__inner">
        {n != null && <div className="card__n">{n}</div>}
        {title && <div className="card__title">{title}</div>}
        {art && <div className="card__art">{art}</div>}
        {body && <div className="card__body">{body}</div>}
        {showDetail && <div className={`card__body card__detail${settled ? ' is-in' : ''}`}>{detail}</div>}
      </div>
    </motion.div>
  )
}

/* ----------------------------------------------------------------- tiles --- */
const nonBlank = (c: ReactNode) => !(typeof c === 'string' && c.trim() === '')

/**
 * Free-form card mosaic: a CSS grid you shape with `cols` / `rows`, each
 * <Tile area="row / col / row / col"> placing one card. Cards with `at` share
 * one travelling gradient spot, like <Cards>.
 */
export function Tiles({
  children,
  cols = '1fr 1fr',
  rows = '1fr',
  gap = 16,
}: {
  children: ReactNode
  cols?: string
  rows?: string
  gap?: number
}) {
  const { setActive, spot } = useSpotLayer()
  return (
    <SpotContext.Provider value={setActive}>
      <div className="tiles has-spot" style={{ gridTemplateColumns: cols, gridTemplateRows: rows, gap }}>
        {Children.toArray(children).filter(nonBlank)}
        {spot}
      </div>
    </SpotContext.Provider>
  )
}

export function Tile({ children, area }: { children: ReactNode; area?: string }) {
  return (
    <div className="tiles__cell" style={{ gridArea: area }}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ hops --- */
/** Cards in a row with a chevron between each pair — a pipeline of big steps. */
export function Hops({ children, gap = 14 }: { children: ReactNode; gap?: number }) {
  const items = Children.toArray(children).filter(nonBlank)
  const { setActive, spot } = useSpotLayer()
  const cells: ReactNode[] = []
  items.forEach((child, i) => {
    if (i > 0)
      cells.push(
        <div key={`a${i}`} className="hops__arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </div>,
      )
    cells.push(
      <div key={i} className="hops__cell">
        {child}
      </div>,
    )
  })
  return (
    <SpotContext.Provider value={setActive}>
      <div className="hops has-spot" style={{ gridTemplateColumns: items.map(() => 'minmax(0, 1fr)').join(' auto '), gap }}>
        {cells}
        {spot}
      </div>
    </SpotContext.Provider>
  )
}

/* ------------------------------------------------------------- checklist --- */
/** Big lines with a box in front; each box ticks on its own click. */
export function Checklist({ children }: { children: ReactNode }) {
  return <div className="checklist">{children}</div>
}

export function Check({ children, at }: { children: ReactNode; at?: number }) {
  const slide = useSlide()
  const [ordinal] = useState(() => slide.register(at))
  const done = slide.static || slide.step >= ordinal
  return (
    <div className={`check${done ? ' is-done' : ''}`}>
      <span className="check__box">
        <svg viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="check__text">{children}</span>
    </div>
  )
}

/* ---------------------------------------------------------------- phones --- */
/**
 * Two phone outlines. `both`: both ring. `split`: the first has hung up
 * (crossed screen), the second still rings.
 */
/**
 * Wireframe of the app's ringing screen — the phone, the caller's lines and
 * the home bar — drawn in stage px and centred on the slide. Its three
 * circles (avatar, two call buttons) are not drawn here: they are the
 * Spotlight's bars in their opening state (`heroSeeds={APP_WIRE.circles}`),
 * so they can spring out into the bars. `top` is where the blob rests.
 */
export const APP_WIRE = (() => {
  const w = 270
  const h = 536
  const x = 640 - w / 2
  const y = 360 - h / 2
  return {
    x,
    y,
    w,
    h,
    top: { x: 640, y },
    circles: [
      { x: 640, y: y + 190, r: 44 },
      { x: 640 - 62, y: y + 430, r: 32 },
      { x: 640 + 62, y: y + 430, r: 32 },
    ],
  }
})()

export function AppWire() {
  const { x, y, w, h } = APP_WIRE
  const cx = 640
  return (
    <svg className="appwire" viewBox="0 0 1280 720" fill="none">
      <rect x={x} y={y} width={w} height={h} rx="34" />
      <rect x={x + 10} y={y + 10} width={w - 20} height={h - 20} rx="26" opacity="0.5" />
      <rect x={cx - 45} y={y + 20} width="90" height="11" rx="5.5" />
      {/* the caller's two lines: they go with the avatar once it has left as a ring */}
      <g className="appwire__caller">
        <rect x={cx - 80} y={y + 258} width="160" height="12" rx="6" />
        <rect x={cx - 50} y={y + 286} width="100" height="10" rx="5" opacity="0.6" />
      </g>
      <rect x={cx - 34} y={y + 504} width="68" height="8" rx="4" opacity="0.5" />
    </svg>
  )
}

export function Phones({ state = 'both' }: { state?: 'both' | 'split' }) {
  const phone = (x: number, ringing: boolean, hung: boolean) => (
    <g transform={`translate(${x} 0)`}>
      <rect x="1" y="1" width="84" height="164" rx="16" />
      <rect x="29" y="12" width="28" height="5" rx="2.5" fill="currentColor" stroke="none" opacity="0.6" />
      {ringing && (
        <g className="phones__ring">
          <path d="M100 58a28 28 0 0 1 0 50" />
          <path d="M116 42a50 50 0 0 1 0 82" />
        </g>
      )}
      {hung && <path className="phones__hung" d="M28 66l30 30M58 66l-30 30" />}
    </g>
  )
  return (
    <svg
      className="phones"
      viewBox="0 0 346 166"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {phone(0, state === 'both', state === 'split')}
      {phone(176, true, false)}
    </svg>
  )
}

/* -------------------------------------------------------------- deadline --- */
/**
 * A time track that fills one lap per click (`laps` = the steps before it)
 * and, on its own click `at`, hits the end: the marker and the figure light up.
 */
export function Deadline({
  laps,
  at,
  value,
  label,
}: {
  laps: number
  at?: number
  value: ReactNode
  label?: ReactNode
}) {
  const slide = useSlide()
  const [ordinal] = useState(() => slide.register(at))
  const hit = slide.static || slide.step >= ordinal
  const frac = hit ? 1 : Math.min(Math.max(slide.step, 0), laps) / laps
  return (
    <div className={`deadline${hit ? ' is-hit' : ''}`}>
      <div className="deadline__track">
        <div className="deadline__fill" style={{ width: `${frac * 100}%` }} />
        <div className="deadline__mark" />
      </div>
      <div className="deadline__stat">
        <span className="deadline__value">{value}</span>
        {label && <span className="deadline__label">{label}</span>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ list --- */
/** Editorial index: number | title | one-liner, hairline between rows. */
export function List({ children }: { children: ReactNode }) {
  return <div className="list">{children}</div>
}

export function Item({ n, title, children }: { n?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="item">
      <div className="item__n">{n}</div>
      <div className="item__title">{title}</div>
      <div className="item__body">{children}</div>
    </div>
  )
}

/* ----------------------------------------------------------------- split --- */
/** Two rounded panels side by side, like the site's photo + dark card pairs. */
export function Split({ children, ratio = '0.8fr 1fr', gap = 20 }: { children: ReactNode; ratio?: string; gap?: number }) {
  return (
    <div className="split" style={{ gridTemplateColumns: ratio, gap }}>
      {children}
    </div>
  )
}

export function Panel({
  children,
  tone = 'ink',
  eyebrow,
}: {
  children: ReactNode
  tone?: 'ink' | 'brand' | 'paper'
  eyebrow?: ReactNode
}) {
  return (
    <div className={`panel panel--${tone}`}>
      {eyebrow && <div className="panel__eyebrow">{eyebrow}</div>}
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ rail --- */
/** Vertical timeline: a gradient rail with a dot per milestone. */
export function Rail({ children }: { children: ReactNode }) {
  return <div className="rail">{children}</div>
}

export function Milestone({ n, title, children }: { n?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="milestone">
      <div className="milestone__head">
        {n != null && <span className="milestone__n">{n}</span>}
        <span className="milestone__title">{title}</span>
      </div>
      <div className="milestone__body">{children}</div>
    </div>
  )
}

/** Inline highlight chip for big statements. */
export function Hl({ children, tone = 'ink' }: { children: ReactNode; tone?: 'ink' | 'pink' | 'blue' | 'paper' }) {
  return <span className={`hl hl--${tone}`}>{children}</span>
}

/** Column note for light slides: hairline on top, short head, one-liner. `lg` is the bigger cut with an index. */
export function Note({ head, children, n, size = 'md' }: { head: ReactNode; children?: ReactNode; n?: ReactNode; size?: 'md' | 'lg' }) {
  return (
    <div className={`note note--${size}`}>
      {n != null && <div className="note__n">{n}</div>}
      <div className="note__head">{head}</div>
      <div className="note__body">{children}</div>
    </div>
  )
}

/* ----------------------------------------------------------- hero pieces --- */
/* The title/end layouts mirror the flutterCon site hero. These are absolutely
   positioned by deck.css so the slide body only carries the copy. */

/** Black conference bar across the top: next.app wordmark, city + dates, pill. */
export function ConfBar({
  city = 'Berlin',
  dates = '07-09 Oct. 2026',
  pill = '#nextapp26',
}: {
  city?: string
  dates?: string
  pill?: string
}) {
  return (
    <div className="confbar no-nav">
      <img className="confbar__logo" src={`${import.meta.env.BASE_URL}brand/nextapp-wordmark.png`} />
      <span>
        {city} | {dates}
      </span>
      {pill && <span className="confbar__pill">{pill}</span>}
    </div>
  )
}

/** flutterCon wordmark, sits between the bar and the eyebrow. */
export function Logo() {
  return <img className="hero-logo" src={`${import.meta.env.BASE_URL}brand/fluttercon-logo.png`} />
}

/** The 3D flutterCon mark bleeding off the bottom-right, as on the site. */
export function HeroArt() {
  return (
    <div className="hero-art">
      <img src={`${import.meta.env.BASE_URL}brand/fluttercon-icon.png`} />
    </div>
  )
}

/** Site-style CTA: rounded pill with a dark arrow circle on the right. */
export function Pill({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'pink' | 'ink' }) {
  return (
    <span className={`pill pill--${tone}`}>
      {children}
      <span className="pill__arrow">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </span>
    </span>
  )
}

export function Speaker({ name, role, tone = 'blue' }: { name: string; role?: string; tone?: 'blue' | 'pink' | 'ink' }) {
  return (
    <div className="speaker">
      <Pill tone={tone}>{name}</Pill>
      {role && <span className="speaker__role">{role}</span>}
    </div>
  )
}

/* ---------------------------------------------------------- speaker card --- */
/* The `card` layout is the official flutterCon speaker card (1200x628),
   measured and scaled onto the 1280x720 stage. Every piece is absolutely
   positioned by deck.css; the title comes from frontmatter. */

/** next.app wordmark over the flutterCon wordmark, top-left. */
export function Brand() {
  return (
    <div className="brand">
      <img className="brand__nextapp" src={`${import.meta.env.BASE_URL}brand/nextapp-wordmark.png`} />
      <img className="brand__fluttercon" src={`${import.meta.env.BASE_URL}brand/fluttercon-logo.png`} />
    </div>
  )
}

/** Round halftone portrait with the blue ring. The PNG is already masked round. */
export function Avatar({ src }: { src: string }) {
  return <img className="avatar" src={src} />
}

/** First and last name on two lines, role in ink, optional company in blue. */
export function Byline({
  first,
  last,
  role,
  company,
}: {
  first: string
  last: string
  role?: string
  company?: string
}) {
  return (
    <div className="byline">
      <div className="byline__name">
        {first}
        <br />
        {last}
      </div>
      {role && <div className="byline__role">{role}</div>}
      {company && <div className="byline__company">{company}</div>}
    </div>
  )
}

/** Blue strip bleeding off the bottom-left: hashtag | dates | city. */
export function ConfStrip({ children = '#nextapp26 | OCT 7-9, 2026 | BERLIN' }: { children?: ReactNode }) {
  return (
    <div className="confstrip no-nav">
      <span>{children}</span>
    </div>
  )
}

/** Halftone Brandenburg Gate bleeding off the bottom-right. */
export function Gate() {
  return <img className="gate" src={`${import.meta.env.BASE_URL}brand/brandenburg-gate.png`} />
}

export const mdxComponents = {
  // markdown element overrides
  pre: Pre,
  h1: (props: Record<string, unknown>) => <h2 className="md-h1" {...props} />,
  h2: (props: Record<string, unknown>) => <h3 className="md-h2" {...props} />,
  h3: (props: Record<string, unknown>) => <h4 className="md-h3" {...props} />,
  blockquote: (props: Record<string, unknown>) => <blockquote className="md-quote" {...props} />,
  table: (props: Record<string, unknown>) => (
    <div className="md-table-wrap">
      <table {...props} />
    </div>
  ),
  a: (props: Record<string, unknown>) => <a target="_blank" rel="noreferrer" {...props} />,

  // components usable in any .mdx file without importing them
  F,
  Code,
  CodeMorph,
  Cols,
  Box,
  Big,
  Stat,
  Tag,
  Flow,
  Step,
  Cards,
  Card,
  Bento,
  Spotlight,
  Orb,
  Lamp,
  Fog,
  OrbLaunch,
  CloudIn,
  Route,
  Stop,
  Act,
  Munch,
  Unfold,
  Pick,
  Tiles,
  Tile,
  Hops,
  Checklist,
  Check,
  Phones,
  AppWire,
  Deadline,
  List,
  Item,
  Split,
  Panel,
  Rail,
  Milestone,
  Hl,
  Note,
  ConfBar,
  Logo,
  HeroArt,
  Pill,
  Speaker,
  Brand,
  Avatar,
  Byline,
  ConfStrip,
  Gate,
}
