import { useId } from 'react'
import { motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { CLAWD } from './ClaudeMark'
import { useSlide } from './slideContext'
import { useRainbow } from './rainbowContext'
import { RAINBOW_COLORS } from './rainbowMotion'
import { PRISM_END, PRISM_SPLIT, PRISM_POINT, prismBranch, prismImpact, prismPhase } from './prismMotion'

const METRICS = [
  { title: 'Call-processing graph', body: 'Every step of the pipeline, timestamped, from the webhook to the ring.', color: RAINBOW_COLORS[0] },
  { title: 'Push delivery delay', body: 'Emitted at the vendor, received on the device — the gap in between.', color: RAINBOW_COLORS[3] },
  { title: 'On-device processing', body: 'From the push landing to the ringing screen.', color: RAINBOW_COLORS[4] },
] as const
type Clock = { clock: MotionValue<number> }

function Header() {
  return <header className="metrics-lab__header">
    <h1>Metrics.</h1>
  </header>
}

function MetricCopy({ index }: { index: number }) {
  const metric = METRICS[index]
  return <div className="metrics-lab__copy">
    <h2>{metric.title}</h2>
    <p>{metric.body}</p>
  </div>
}

function PrismRay({ index, clock }: Clock & { index: number }) {
  const branch = useTransform(clock, t => prismBranch(t, index))
  const ray = useTransform(branch, b => b.travel)
  const opacity = useTransform(branch, b => b.label)
  const y = useTransform(opacity, p => 12 * (1 - p))
  const mascot = useTransform(branch, b => `translate(${b.x}px, ${b.y}px) rotate(${b.angle}deg) scale(${4.8 - b.unfold * 1.6}, ${.12 + b.unfold * 3.08}) translate(-12px, -12px)`)
  const mascotOpacity = useTransform(clock, t => prismPhase(t, PRISM_SPLIT, PRISM_SPLIT + .05))
  const target = 255 + index * 152
  return <>
    <svg className="metrics-lab__svg" viewBox="0 0 1280 720">
      <motion.path d={`M462 407L738 ${target}`} stroke={METRICS[index].color} strokeWidth="14" opacity=".07" style={{ pathLength: ray }} />
      <motion.path d={`M462 407L738 ${target}`} stroke={METRICS[index].color} strokeWidth="2.5" style={{ pathLength: ray }} />
      <motion.path className="prism__clawd" d={CLAWD} fill={METRICS[index].color}
        style={{ transform: mascot, opacity: mascotOpacity, originX: 0, originY: 0, transformBox: 'view-box' }} />
    </svg>
    <motion.div className="prism__metric" style={{ top: target - 16, opacity, y }}>
      <MetricCopy index={index} />
    </motion.div>
  </>
}

function PrismSparkle({ clock }: Clock) {
  const impact = useTransform(clock, prismImpact)
  const opacity = useTransform(impact, p => p.opacity)
  const transform = useTransform(impact, p => `translate(${PRISM_POINT.x}px, ${PRISM_POINT.y}px) scale(${.45 + p.spread * .85})`)
  return <svg className="metrics-lab__svg prism__sparkle" viewBox="0 0 1280 720">
    <motion.g style={{ opacity, transform, originX: 0, originY: 0, transformBox: 'view-box' }}>
      <path d="M0-23L3-3L23 0L3 3L0 23L-3 3L-23 0L-3-3Z" fill="white" />
      {RAINBOW_COLORS.map((color, i) => <path key={color} d="M22 0h7" stroke={color} strokeWidth="2"
        transform={`rotate(${i * 60 + 30})`} />)}
    </motion.g>
  </svg>
}

function Prism({ clock, standalone }: Clock & { standalone: boolean }) {
  const id = useId()
  return <div className="metrics-lab metrics-lab--prism">
    <Header />
    <svg className="metrics-lab__svg" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d5e2fa" stopOpacity=".2" /><stop offset=".5" stopColor="#99b1dd" stopOpacity=".035" /><stop offset="1" stopColor="#ff69c5" stopOpacity=".13" /></linearGradient>
      </defs>
      <path d="M84 556H661 M383 294V573" stroke="#abc5f4" strokeOpacity=".09" />
      <ellipse cx="426" cy="557" rx="158" ry="15" fill="#fff" opacity=".025" />
      {standalone && <path d={`M0 ${PRISM_POINT.y}H${PRISM_POINT.x}`} stroke="#fff" strokeWidth="2.5" />}
      <path d="M426 262L578 526H274Z" fill={`url(#${id}-glass)`} stroke="#c5d8fb" strokeWidth="1.5" />
      <path d="M426 262L468 286 620 548 578 526 M274 526l42 22H620 M468 286L316 548" fill="none" stroke="#c5d8fb" strokeOpacity=".25" />
      <path d="M426 277L287 518" stroke="#fff" strokeOpacity=".75" />
    </svg>
    {METRICS.map((_, index) => <PrismRay key={index} index={index} clock={clock} />)}
    <PrismSparkle clock={clock} />
  </div>
}

/** The shared traveller becomes the input beam; the prism emits three Clawds. */
export function Metrics() {
  const slide = useSlide()
  const flight = useRainbow()
  const still = useMotionValue(PRISM_END)
  const standalone = !flight || slide.static
  return <Prism clock={standalone ? still : flight.prism} standalone={standalone} />
}
