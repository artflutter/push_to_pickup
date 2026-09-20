import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react'
import { F } from './Fragment'
import { Code, CodeMorph, Pre } from './Code'
import { useSlide } from './slideContext'
import { Brick, BrickGallery } from './Brick'

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

/**
 * `w` × `h` is the host's size in stage px (0 until measured). Pointer
 * events are read from `listen` (defaults to the host) — pass the slide
 * when the host is a background layer that content sits on top of.
 */
function useOrb(
  host: React.RefObject<HTMLElement | null>,
  w: number,
  h: number,
  active: boolean,
  listen?: (el: HTMLElement) => HTMLElement | null,
): OrbValues {
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

  useEffect(() => {
    const el = host.current
    if (!w || !h || !el) return
    const home = () => {
      px.set(0)
      py.set(h)
      ax.set(225)
    }
    /* first placement is instant — no sliding in from the top-left corner */
    home()
    for (const v of [glowX, sheenX]) v.jump(0)
    for (const v of [glowY, sheenY]) v.jump(h)
    angle.jump(225)
    if (!active) return
    const target = listen ? listen(el) : el
    if (!target) return
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0) return
      const k = w / r.width
      const x = (e.clientX - r.left) * k
      const y = (e.clientY - r.top) * k
      px.set(x)
      py.set(y)
      ax.set(225 - (x / w - 0.5) * 34)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerleave', home)
    return () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerleave', home)
    }
  }, [host, w, h, active, listen, px, py, ax, glowX, glowY, sheenX, sheenY, angle])

  return { skin, glowX, glowY, sheenX, sheenY }
}

function OrbLayers({ orb, left = 0 }: { orb: OrbValues; left?: number }) {
  return (
    <>
      <motion.div className="orb__glow" style={{ x: orb.glowX, y: orb.glowY, left }} />
      <motion.div className="orb__sheen" style={{ x: orb.sheenX, y: orb.sheenY, left }} />
    </>
  )
}

const slideOf = (el: HTMLElement) => el.closest<HTMLElement>('.slide')

/** Full-slide background with the pointer-chasing blob. Put it first in a section slide. */
export function Orb() {
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
  const orb = useOrb(ref, size?.w ?? 0, size?.h ?? 0, !slide.static, slideOf)
  return (
    <motion.div ref={ref} className="orb" style={{ background: orb.skin }} aria-hidden="true">
      <OrbLayers orb={orb} />
    </motion.div>
  )
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

  const orb = useOrb(boxRef, size ? boxW : 0, size ? boxH : 0, !slide.static)

  /* The tail is a notch in the skin's clip-path, so gradient and glow run
     straight into it. It springs between bars and grows out when lit. */
  const TAIL = 16
  const RAD = 28
  const tailYMv = useMotionValue(0)
  const tailOnMv = useMotionValue(0)
  const tailYS = useSpring(tailYMv, { stiffness: 260, damping: 28 })
  const tailOnS = useSpring(tailOnMv, { stiffness: 200, damping: 26 })
  const clip = useTransform([tailYS, tailOnS], ([yRaw, on]: number[]) => {
    const W = boxW
    const H = boxH
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
  useEffect(() => {
    if (slide.static) {
      tailYS.jump(tailY)
      tailOnS.jump(lit ? 1 : 0)
      return
    }
    tailYMv.set(tailY)
    tailOnMv.set(lit ? 1 : 0)
  }, [tailY, lit, slide.static, tailYMv, tailOnMv, tailYS, tailOnS])

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
        <div ref={boxRef} className="spotlight__box" style={{ top: titleRow, left: boxX, width: boxW, height: boxH }}>
          <motion.div
            className="spotlight__skin"
            style={{ background: orb.skin, clipPath: clip, left: box === 'right' ? -TAIL : 0, right: box === 'right' ? 0 : -TAIL }}
          >
            <OrbLayers orb={orb} left={box === 'right' ? TAIL : 0} />
          </motion.div>
          <AnimatePresence mode="wait" initial={false}>
            {active == null ? (
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
        </div>
      )}

      <BentoContext.Provider value={{ rects, heroAt: null, detailInCards: false, bar: true, activeAt }}>{children}</BentoContext.Provider>
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
              {(style === 'list' || style === 'steps' || style === 'rail') && <span className="sb__dot" aria-hidden="true" />}
              {style === 'ticks' && (
                <span className="sb__tick" aria-hidden="true">
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
  brick,
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
  /** Isometric LEGO brick outline at the right end of the card, e.g. `2x4` — see <Brick kind />. */
  brick?: string
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
  const rect = bento && at != null ? bento.rects.get(at) : undefined
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
      }${rect && (rect.height < 140 || bento?.bar) ? ' card--bar' : ''}${brick ? ' card--has-end' : ''}`}
      style={{ '--pop': pop } as React.CSSProperties}
      initial={false}
      animate={rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : undefined}
      transition={{ type: 'spring', stiffness: 170, damping: 26, mass: 1 }}
    >
      <div className="card__bg" aria-hidden="true" />
      <div className="card__inner">
        {n != null && <div className="card__n">{n}</div>}
        {title && <div className="card__title">{title}</div>}
        {art && <div className="card__art">{art}</div>}
        {body && <div className="card__body">{body}</div>}
        {showDetail && <div className={`card__body card__detail${settled ? ' is-in' : ''}`}>{detail}</div>}
      </div>
      {brick && (
        <div className="card__end">
          <Brick kind={brick} fit={56} />
        </div>
      )}
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
        <div key={`a${i}`} className="hops__arrow" aria-hidden="true">
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
      <span className="check__box" aria-hidden="true">
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
      aria-hidden="true"
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
      <img className="confbar__logo" src="/brand/nextapp-wordmark.png" alt="next.app" />
      <span>
        {city} | {dates}
      </span>
      {pill && <span className="confbar__pill">{pill}</span>}
    </div>
  )
}

/** flutterCon wordmark, sits between the bar and the eyebrow. */
export function Logo() {
  return <img className="hero-logo" src="/brand/fluttercon-logo.png" alt="flutterCon" />
}

/** The 3D flutterCon mark bleeding off the bottom-right, as on the site. */
export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <img src="/brand/fluttercon-icon.png" alt="" />
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
      <img className="brand__nextapp" src="/brand/nextapp-wordmark.png" alt="next.app" />
      <img className="brand__fluttercon" src="/brand/fluttercon-logo.png" alt="flutterCon" />
    </div>
  )
}

/** Round halftone portrait with the blue ring. The PNG is already masked round. */
export function Avatar({ src, alt = '' }: { src: string; alt?: string }) {
  return <img className="avatar" src={src} alt={alt} />
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
  return <img className="gate" src="/brand/brandenburg-gate.png" alt="" aria-hidden="true" />
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
  Brick,
  BrickGallery,
  Bento,
  Spotlight,
  Orb,
  Tiles,
  Tile,
  Hops,
  Checklist,
  Check,
  Phones,
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
