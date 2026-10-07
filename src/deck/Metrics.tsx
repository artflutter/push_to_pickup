import { useId, useState } from 'react'
import { motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { CLAWD } from './ClaudeMark'
import { MustachedPortrait } from './OpeningPortrait'
import { useSlide } from './slideContext'
import { useRainbow } from './rainbowContext'
import { RAINBOW_COLORS } from './rainbowMotion'
import { PRISM_END, PRISM_SPLIT, PRISM_POINT, prismBranch, prismImpact, prismPhase } from './prismMotion'
import { FINALE_CIRCLE, FINALE_END, finaleClawd, finaleExit } from './finaleMotion'

const METRICS = [
  { title: 'Call-processing graph', body: 'Every step of the pipeline, timestamped, from the webhook to the ring.', color: RAINBOW_COLORS[0] },
  { title: 'Push delivery delay', body: 'Emitted at the vendor, received on the device — the gap in between.', color: RAINBOW_COLORS[3] },
  { title: 'On-device processing', body: 'From the app receiving the push to the ringing screen.', color: RAINBOW_COLORS[4] },
] as const
type Clock = { clock: MotionValue<number> }
type FinaleClock = { finale: MotionValue<number> }

const LINKS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/vasyl-dytsiak', qr: 'linkedin' },
  { label: 'Slides', href: 'https://artflutter.github.io/push_to_pickup/', qr: 'presentation' },
] as const

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

function PrismRay({ index, clock, finale }: Clock & FinaleClock & { index: number }) {
  const branch = useTransform(clock, t => prismBranch(t, index))
  const ray = useTransform(branch, b => b.travel)
  const exit = useTransform(finale, finaleExit)
  const opacity = useTransform(() => branch.get().label * exit.get())
  const y = useTransform(opacity, p => 12 * (1 - p))
  const mascot = useTransform(() => {
    const b = branch.get()
    const p = finaleClawd(finale.get(), index, b)
    return `translate(${p.x}px, ${p.y}px) rotate(${p.angle}deg) scale(${4.8 - b.unfold * 1.6}, ${.12 + b.unfold * 3.08}) translate(-12px, -12px)`
  })
  const mascotOpacity = useTransform(() => prismPhase(clock.get(), PRISM_SPLIT, PRISM_SPLIT + .05) *
    (1 - prismPhase(finale.get(), .9, 1.8)))
  const target = 255 + index * 152
  return <>
    <svg className="metrics-lab__svg" viewBox="0 0 1280 720">
      <motion.g style={{ opacity: exit }}>
        <motion.path d={`M462 407L738 ${target}`} stroke={METRICS[index].color} strokeWidth="14" opacity=".07" style={{ pathLength: ray }} />
        <motion.path d={`M462 407L738 ${target}`} stroke={METRICS[index].color} strokeWidth="2.5" style={{ pathLength: ray }} />
      </motion.g>
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

function FinaleRings({ finale }: FinaleClock) {
  const id = useId()
  const opacity = useTransform(finale, t => prismPhase(t, .15, .8))
  const grow = useTransform(finale, t => .15 + .85 * prismPhase(t, .2, 1.65))
  const transform = useTransform(grow, p => `translate(640px, 288px) scale(${p})`)
  return <motion.svg className="metrics-lab__svg metrics-finale__rings" viewBox="0 0 1280 720" style={{ opacity }} aria-hidden="true">
    <defs>
      <radialGradient id={`${id}-red`}>
        <stop offset=".55" stopColor="#ef6940" />
        <stop offset=".78" stopColor="#da442b" />
        <stop offset=".96" stopColor="#aa241c" />
        <stop offset="1" stopColor="#78151b" />
      </radialGradient>
      <radialGradient id={`${id}-dark`}>
        <stop stopColor="#161318" />
        <stop offset="1" stopColor="#08080b" />
      </radialGradient>
    </defs>
    <motion.g style={{ transform, originX: 0, originY: 0, transformBox: 'view-box' }}>
      {[900, 720, 565, 438, 337, 260].map(r => <circle key={r} r={r} fill={`url(#${id}-red)`} />)}
      <circle r="199" fill={`url(#${id}-dark)`} />
    </motion.g>
  </motion.svg>
}

function Finale({ finale, shown }: FinaleClock & { shown: boolean }) {
  const centre = useTransform(finale, t => prismPhase(t, 2.35, 3.05))
  const portraitY = useTransform(centre, p => 74 * (1 - p))
  const portraitScale = useTransform(centre, p => .64 + p * .36)
  const portraitRotate = useTransform(centre, p => -8 * (1 - p))
  const caption = useTransform(finale, t => prismPhase(t, 2.95, 3.9))
  const captionY = useTransform(caption, p => 16 * (1 - p))
  const links = useTransform(finale, t => prismPhase(t, 3.65, FINALE_END))
  const linksY = useTransform(links, p => -370 * (1 - p))
  return <div className="metrics-finale" aria-hidden={!shown}>
    <motion.div className="metrics-finale__portrait" style={{ left: FINALE_CIRCLE.x - 180, top: FINALE_CIRCLE.y - 180,
      y: portraitY, scale: portraitScale, rotate: portraitRotate, opacity: centre }}>
      <MustachedPortrait src={`${import.meta.env.BASE_URL}brand/speaker-vasyl.png`} />
    </motion.div>
    <motion.h1 className="metrics-finale__caption" style={{ opacity: caption, y: captionY }}>
      <img src={`${import.meta.env.BASE_URL}brand/thats-all-folks.svg`} alt="That’s all Folks!" />
    </motion.h1>
    <motion.div className="metrics-finale__links" style={{ y: linksY, pointerEvents: shown ? 'auto' : 'none' }}>
      {LINKS.map(link => <a className="metrics-finale__link" key={link.qr} href={link.href}
        target="_blank" rel="noreferrer" tabIndex={shown ? 0 : -1}>
        <img src={`${import.meta.env.BASE_URL}qr/${link.qr}.svg`} alt={`QR code: ${link.href}`} width="256" height="256" />
        <span className="metrics-finale__link-title">{link.label}</span>
      </a>)}
    </motion.div>
  </div>
}

function Prism({ clock, finale, standalone, closing }: Clock & FinaleClock & { standalone: boolean; closing: boolean }) {
  const id = useId()
  const exit = useTransform(finale, finaleExit)
  return <div className="metrics-lab metrics-lab--prism">
    <FinaleRings finale={finale} />
    <motion.div style={{ opacity: exit }} aria-hidden={closing}><Header /></motion.div>
    <motion.svg className="metrics-lab__svg" viewBox="0 0 1280 720" style={{ opacity: exit }}>
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d5e2fa" stopOpacity=".2" /><stop offset=".5" stopColor="#99b1dd" stopOpacity=".035" /><stop offset="1" stopColor="#ff69c5" stopOpacity=".13" /></linearGradient>
      </defs>
      <path d="M84 556H661 M383 294V573" stroke="#abc5f4" strokeOpacity=".09" />
      <ellipse cx="426" cy="557" rx="158" ry="15" fill="#fff" opacity=".025" />
      {standalone && <path d={`M0 ${PRISM_POINT.y}H${PRISM_POINT.x}`} stroke="#fff" strokeWidth="2.5" />}
      <path d="M426 262L578 526H274Z" fill={`url(#${id}-glass)`} stroke="#c5d8fb" strokeWidth="1.5" />
      <path d="M426 262L468 286 620 548 578 526 M274 526l42 22H620 M468 286L316 548" fill="none" stroke="#c5d8fb" strokeOpacity=".25" />
      <path d="M426 277L287 518" stroke="#fff" strokeOpacity=".75" />
    </motion.svg>
    <Finale finale={finale} shown={closing} />
    {METRICS.map((_, index) => <PrismRay key={index} index={index} clock={clock} finale={finale} />)}
    <PrismSparkle clock={clock} />
  </div>
}

/** The shared traveller becomes the input beam; the prism emits three Clawds. */
export function Metrics() {
  const slide = useSlide()
  useState(() => slide.register(1))
  const flight = useRainbow()
  const still = useMotionValue(PRISM_END)
  const finalStill = useMotionValue(FINALE_END)
  const standalone = !flight || slide.static
  const finale = standalone ? finalStill : flight.finale
  return <Prism clock={standalone ? still : flight.prism} finale={finale}
    standalone={standalone} closing={standalone || slide.step > 0} />
}
