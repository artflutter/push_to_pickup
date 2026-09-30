import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { animate, motion, useIsPresent, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { CLAWD } from './ClaudeMark'
import { SlideView } from './Slide'
import { useSlide } from './slideContext'
import { useRainbow } from './rainbowContext'
import { RAINBOW_COLORS, RAINBOW_CUES, RAINBOW_Y, makeRainbowFlight } from './rainbowMotion'

const END = RAINBOW_CUES[RAINBOW_CUES.length - 1]
const phase = (t: number, a: number, b: number) => {
  const p = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return p * p * (3 - 2 * p)
}
const mix = (a: number, b: number, p: number) => a + (b - a) * p

// The same heartbeat vertices as the flight, frozen at its final position.
// Retain the little pixel steps between spikes while the ribbon spreads.
const POINTS = [
  { x: 0, offset: 0, linear: false },
  ...makeRainbowFlight(2).points.filter(p => p.x > 1280 && p.x < 2424).map(p => ({
    x: p.x - 1280,
    offset: p.beat.offset - Math.floor(p.x / 48) % 2 * 4 * (1 - p.beat.quiet),
    linear: p.beat.linear,
  })),
  { x: 1144, offset: 0, linear: false },
]

function bandPath(index: number, t: number) {
  const spread = phase(t, 0.04, 0.34)
  const lift = phase(t, 0.42, 0.96) * 850
  const width = mix(1144, 1280, spread)
  const thickness = mix(8, 121, spread)
  const y = mix(RAINBOW_Y - 28 + index * 8, index * 120, spread) - lift
  const points = POINTS.map(p => ({
    ...p, x: p.x / 1144 * width, y: y + p.offset * (1 - spread),
  }))
  const forward = points.slice(1).map(p => p.linear ? `L${p.x} ${p.y}` : `H${p.x}V${p.y}`).join(' ')
  const back = points.slice(0, -1).map((p, i) => points[i + 1].linear
    ? `L${p.x} ${p.y + thickness}` : `V${p.y + thickness}H${p.x}`).reverse().join(' ')
  return `M0 ${points[0].y} ${forward}v${thickness} ${back}Z`
}

function Band({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const d = useTransform(progress, t => bandPath(index, t))
  return <motion.path d={d} fill={RAINBOW_COLORS[index]} />
}

function Curtain({ progress }: { progress: MotionValue<number> }) {
  const mascot = useTransform(progress, t => {
    const spread = phase(t, 0.04, 0.34)
    const lift = phase(t, 0.42, 0.96)
    const x = mix(1180, 1212, spread)
    const y = mix(RAINBOW_Y, 689, spread) - lift * 850
    const angle = Math.sin(lift * Math.PI) * -24
    return `translate(${x}px, ${y}px) rotate(${angle}deg) scale(5.2) translate(-12px, -12px)`
  })
  return <>
    {RAINBOW_COLORS.map((_, index) => <Band key={index} index={index} progress={progress} />)}
    <motion.path d={CLAWD} fill="white" style={{ transform: mascot, originX: 0, originY: 0, transformBox: 'view-box' }} />
  </>
}

/** The fourth click lifts the rainbow curtain into the original Metrics slide. */
export function RainbowCurtain({ source }: { source: ReactNode }) {
  const slide = useSlide()
  useState(() => slide.register(4))
  const flight = useRainbow()
  const present = useIsPresent()
  const active = present && !slide.static && slide.active !== false && slide.step >= 4 && !!flight
  const progress = useMotionValue(0)
  const previousStep = useRef(slide.step)
  const advance = useRef(slide.advance)
  useLayoutEffect(() => { advance.current = slide.advance }, [slide.advance])
  useLayoutEffect(() => {
    const play = previousStep.current < 4
    previousStep.current = slide.step
    if (!active || !flight) return
    // Returning from Metrics or opening this step directly shows its rest state.
    // Only a forward click from the rainbow starts an automatic page turn.
    if (!play) { progress.jump(1); return }
    progress.jump(0)
    let animation: ReturnType<typeof animate> | undefined
    let stopWaiting = () => {}
    let cancelled = false
    const start = () => {
      stopWaiting()
      animation = animate(progress, 1, {
        duration: 2.5, ease: 'linear',
        onComplete: () => { if (!cancelled) advance.current?.() },
      })
    }
    // Rapid clicks still complete the flight and all three captions first.
    if (flight.clock.get() < END - 0.001) {
      stopWaiting = flight.clock.on('change', t => { if (t >= END - 0.001) start() })
    } else start()
    return () => { cancelled = true; stopWaiting(); animation?.stop() }
  }, [active, flight, progress, slide.step])
  const visible = useTransform(() => flight && flight.clock.get() >= END - 0.001 ? 'visible' : 'hidden')
  const sourceOpacity = useTransform(progress, t => 1 - phase(t, 0.02, 0.34))
  const targetOpacity = useTransform(progress, t => phase(t, 0.35, 0.41))
  if (!active || !flight?.transitionHost) return null
  return createPortal(<motion.div className="rainbow-curtain" style={{ visibility: visible }}>
    <motion.div className="rainbow-curtain__source" style={{ opacity: sourceOpacity }}>{source}</motion.div>
    <motion.div className="rainbow-curtain__target" style={{ opacity: targetOpacity }}>
      <SlideView slide={flight.metrics} step={0} active={false} />
    </motion.div>
    <svg className="rainbow-curtain__drawing" viewBox="0 0 1280 720" aria-hidden="true">
      <Curtain progress={progress} />
    </svg>
  </motion.div>, flight.transitionHost)
}
