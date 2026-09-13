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
import { motion } from 'motion/react'
import { F } from './Fragment'
import { Code, CodeMorph, Pre } from './Code'
import { useSlide } from './slideContext'

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
export function Cards({ children, rows = [3, 2], gap = 16 }: { children: ReactNode; rows?: number[]; gap?: number }) {
  const cols = rows.reduce((acc, n) => lcm(acc, n), 1)
  const spans = rows.flatMap((n) => Array<number>(n).fill(cols / n))
  const items = Children.toArray(children).filter((c) => !(typeof c === 'string' && c.trim() === ''))
  const { setActive, spot } = useSpotLayer()
  return (
    <SpotContext.Provider value={setActive}>
      <div className="cards has-spot" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
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

/* Bento accordion: cards sit in fixed rows (3 + 2 by default) and never change
   order. The card on the current step grows in place into a square that spans
   the full height of the block — at the left edge, the right edge or the
   centre, depending on where it sits in its row — and the other cards keep
   their rows, flowing into whatever is left beside the square. Cards are
   absolutely positioned and spring between rects, so the resize is the
   animation. Before step 1 the rows share the height equally; static previews
   show the last card grown and lit. */
interface BentoLayout {
  rects: Map<number, Rect>
  heroAt: number | null
}
const BentoContext = createContext<BentoLayout | null>(null)

export function Bento({
  children,
  rows = [3, 2],
  gap = 16,
}: {
  children: ReactNode
  /** Cards per row, in `at` order. */
  rows?: number[]
  gap?: number
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
  if (size) {
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
    } else {
      const side = Math.min(H, W)
      const row = rowCards[heroRow]
      const ci = row.indexOf(heroAt)
      const slot = row.length === 1 || (ci > 0 && ci < row.length - 1) ? 'center' : ci === 0 ? 'left' : 'right'
      const sx = slot === 'left' ? 0 : slot === 'right' ? W - side : (W - side) / 2
      rects.set(heroAt, { x: sx, y: 0, width: side, height: side })

      /* The other cards, in order, fill the region(s) beside the square as an
         even grid — e.g. four cards become 2 x 2 — rather than keeping their
         resting rows, so an edge square never leaves a row of slivers. */
      const pack = (list: number[], x0: number, x1: number) => {
        if (list.length === 0) return
        const nRows = Math.min(rowCards.length, list.length)
        const rh = (H - gap * (nRows - 1)) / nRows
        let i = 0
        for (let r = 0; r < nRows; r++) {
          const count = Math.ceil((list.length - i) / (nRows - r))
          const w = (x1 - x0 - gap * (count - 1)) / count
          list.slice(i, i + count).forEach((a, k) => rects.set(a, { x: x0 + k * (w + gap), y: r * (rh + gap), width: w, height: rh }))
          i += count
        }
      }
      const others = ats.filter((a) => a !== heroAt)
      const left =
        slot === 'right'
          ? others
          : slot === 'left'
            ? []
            : others.filter((a) => {
                const r = rest.get(a)!
                return r.x + r.width / 2 < W / 2
              })
      const right = others.filter((a) => !left.includes(a))
      pack(left, 0, sx - gap)
      pack(right, sx + side + gap, W)
    }
  }

  return (
    <BentoContext.Provider value={{ rects, heroAt }}>
      <div ref={ref} className="bento">
        {children}
      </div>
    </BentoContext.Provider>
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

  const showDetail = detail != null && (bento ? state === 'active' : isHero)
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
      className={`card card--${tone} card--${isHero ? 'lg' : 'md'} card--${state}${rect ? ' card--placed' : ''}`}
      style={{ '--pop': pop } as React.CSSProperties}
      initial={false}
      animate={rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : undefined}
      transition={{ type: 'spring', stiffness: 170, damping: 26, mass: 1 }}
    >
      <div className="card__bg" aria-hidden="true" />
      <div className="card__inner">
        {n != null && <div className="card__n">{n}</div>}
        {title && <div className="card__title">{title}</div>}
        {body && <div className="card__body">{body}</div>}
        {showDetail && <div className={`card__body card__detail${settled ? ' is-in' : ''}`}>{detail}</div>}
      </div>
    </motion.div>
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

/** Column note for light slides: hairline on top, short head, one-liner. */
export function Note({ head, children }: { head: ReactNode; children?: ReactNode }) {
  return (
    <div className="note">
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
}
