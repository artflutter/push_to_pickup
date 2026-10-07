import { useId, useLayoutEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { CLAWD } from './ClaudeMark'
import { useSlide } from './slideContext'
import { useRainbow } from './rainbowContext'
import { useAnimationLoop } from './useAnimationLoop'
import { finaleExit } from './finaleMotion'
import { PRISM_HIT, prismBoost, prismCollapse, prismHead, prismPhase, prismTravel } from './prismMotion'
import { CHECKPOINTS, NYAN_FRAME_MS, RAINBOW_COLORS, RAINBOW_CUES, RAINBOW_RUN_END, RAINBOW_Y, makeRainbowFlight, nyanPose, rainbowFrame, rainbowLabels, rainbowTrails } from './rainbowMotion'

const STILL_TRAILS = rainbowTrails(makeRainbowFlight(2), 0)
const TIMER_SECONDS = 30

/** Held by the forward hand, in the same local space as the moving mascot. */
function HandTimer({ seconds }: { seconds: MotionValue<number> }) {
  const digits = useTransform(seconds, s => String(s).padStart(2, '0'))
  const spent = useTransform(seconds, s => 1 - s / TIMER_SECONDS)
  return <g className="rainbow__timer" transform="translate(11.5 0)">
    <path className="rainbow__timer-outline" d="M0-5.5V-7M-1.5-7h3M4-4l1-1" />
    <circle className="rainbow__timer-face" r="5.5" />
    <motion.circle className="rainbow__timer-progress" r="4.6" pathLength="1"
      strokeDasharray="1" strokeDashoffset={spent} transform="rotate(-90)" />
    <motion.text className="rainbow__timer-digits">{digits}</motion.text>
  </g>
}

const STAR_FRAMES = [
  'M-2-2h4v4h-4Z',
  'M-2-6h4v4h-4Z M-6-2h4v4h-4Z M2-2h4v4H2Z M-2 2h4v4h-4Z',
  'M-2-10h4v6h-4Z M-10-2h6v4h-6Z M4-2h6v4H4Z M-2 4h4v6h-4Z',
  'M-2-14h4v4h-4Z M-10-10h4v4h-4Z M6-10h4v4H6Z M-14-2h4v4h-4Z M10-2h4v4h-4Z M-10 6h4v4h-4Z M6 6h4v4H6Z M-2 10h4v4h-4Z',
  'M-2-16h4v4h-4Z M-16-2h4v4h-4Z M12-2h4v4h-4Z M-2 12h4v4h-4Z',
  '',
]

function PixelStar({ index, frame }: { index: number; frame: MotionValue<number> }) {
  const x = useTransform(frame, f => ((index * 193 + 91 - f * (index % 3 + 2) * 5) % 2800 + 2800) % 2800 - 120)
  const d = useTransform(frame, f => STAR_FRAMES[(Math.floor(f / 2) + index) % STAR_FRAMES.length])
  const y = [212, 258, 292, 418, 616, 660][index % 6]
  return <motion.path className="rainbow__star" d={d} fill="white" style={{ x, y, opacity: index % 3 === 0 ? 0.75 : 0.38, scale: index % 2 ? 0.75 : 1, originX: 0, originY: 0, transformBox: 'view-box' }} />
}

function AnchoredBand({ trails, index, collapse }: { trails: MotionValue<string[]>; index: number; collapse: MotionValue<number> }) {
  const d = useTransform(trails, paths => paths[index])
  const fill = useTransform(collapse, [0, 1], [RAINBOW_COLORS[index], '#ffffff'])
  return <motion.path d={d} fill={fill} />
}

/** Streaks get longer, brighter and faster right up to the impact. */
function SpeedStreak({ index, clock }: { index: number; clock: MotionValue<number> }) {
  const frame = useTransform(clock, t => {
    const boost = prismBoost(t)
    const cycle = ((Math.min(t, PRISM_HIT) * .18 + prismTravel(t) * 2.4 + index * .177) % 1 + 1) % 1
    const x = prismHead(t).x - 24 - cycle * 1350
    return {
      x,
      tail: x - (120 + index * 37 % 220) * boost,
      opacity: boost * Math.sin(cycle * Math.PI) * (.32 + index % 3 * .09),
    }
  })
  const x1 = useTransform(frame, f => f.tail)
  const x2 = useTransform(frame, f => f.x)
  const opacity = useTransform(frame, f => f.opacity)
  const y = 407 + [-36, 52, -78, 104, -134, 164, -198, 214, -55, 74, -114, 142][index]
  return <motion.line className="rainbow__speed-streak" x1={x1} x2={x2} y1={y} y2={y}
    stroke="white" strokeWidth={index % 4 === 0 ? 2 : 1} style={{ opacity }} />
}

/** The sprite, rippling exhaust and star field keep looping between clicks. */
export function RainbowTraveller() {
  const id = useId()
  const flight = useRainbow()!
  const path = useTransform(flight.winner, makeRainbowFlight)
  const collapse = useTransform(flight.prism, prismCollapse)
  const frame = useTransform(() => {
    const base = rainbowFrame(flight.clock.get(), path.get())
    if (flight.prism.get() <= 0) return base
    return { ...base, ...prismHead(flight.prism.get()), angle: 0, bob: 1 - collapse.get() }
  })
  const cycle = useMotionValue(0)
  const elapsed = useRef(0)
  // The displayed 30 seconds elapse over the flight, reaching zero on arrival.
  // Sharing its clock also makes rewinds and direct entry show the right value.
  const seconds = useTransform(flight.clock, t =>
    Math.ceil(TIMER_SECONDS * (1 - Math.max(0, Math.min(1, t / RAINBOW_RUN_END)))))
  // Once compressed, neither the sprite nor its stars/ripple is visible.
  // Keep the pose for a continuous rewind, but release the frame subscription.
  const looping = useTransform(() => flight.clock.get() > 0 && collapse.get() < 1)
  useLayoutEffect(() => flight.clock.on('change', t => {
    if (t <= 0) {
      elapsed.current = 0
      cycle.set(0)
    }
  }), [flight.clock, cycle])
  useAnimationLoop(looping, delta => {
    elapsed.current += Math.min(delta, 100)
    const next = Math.floor(elapsed.current / NYAN_FRAME_MS)
    if (next !== cycle.get()) cycle.set(next)
  })
  const pose = useTransform(cycle, nyanPose)
  const bob = useTransform(flight.clock, t => Math.min(1, t / 0.25))
  const opacity = useTransform(() => flight.clock.get() > 0 ? finaleExit(flight.finale.get()) : 0)
  const mascotX = useTransform(() => frame.get().x + pose.get().x * bob.get() * frame.get().bob)
  const mascotY = useTransform(() => frame.get().y + pose.get().y * bob.get() * frame.get().bob)
  const transform = useTransform(() => {
    const p = collapse.get()
    const scale = frame.get().scale
    return `translate(${mascotX.get()}px, ${mascotY.get()}px) rotate(${frame.get().angle}deg) scale(${scale * (1 + p)}, ${scale * (1 - p * .96)})`
  })
  const mascotOpacity = useTransform(collapse, p => 1 - prismPhase(p, .86, 1))
  const trailStart = useTransform(frame, f => f.tailStart)
  const trailWidth = useTransform(() => Math.max(0, mascotX.get() - frame.get().scale * 7 * (1 - collapse.get()) - trailStart.get()))
  const trails = useTransform(() => rainbowTrails(path.get(), cycle.get() % 6))
  const trailOpacity = useTransform(() => Math.min(1, flight.clock.get() / .16) * (1 - prismPhase(collapse.get(), .9, 1)))
  const beamOpacity = useTransform(collapse, p => prismPhase(p, .75, 1))
  const beamGlow = useTransform(() => beamOpacity.get() * prismBoost(flight.prism.get()) * .22)
  const beam = useTransform(() => `M${trailStart.get()} 407H${mascotX.get()}`)
  const starsOpacity = useTransform(() => Math.min(1, flight.clock.get() / .5) * (1 - collapse.get()))
  const trailTransform = useTransform(collapse, p => {
    const scale = 1 - p
    return `translate(0px, ${RAINBOW_Y * (1 - scale) + p * 2}px) scale(1, ${scale})`
  })
  const legA = useTransform(pose, p => `translate(${p.aX}px, ${p.aY}px)`)
  const legB = useTransform(pose, p => `translate(${p.bX}px, ${p.bY}px)`)
  return <motion.svg className="rainbow-traveller" viewBox="0 0 3840 720" style={{ opacity }}>
    <motion.g className="rainbow__stars" style={{ opacity: starsOpacity }}>
      {Array.from({ length: 20 }, (_, i) => <PixelStar key={i} index={i} frame={cycle} />)}
    </motion.g>
    <g className="rainbow__speed">
      {Array.from({ length: 12 }, (_, index) => <SpeedStreak key={index} index={index} clock={flight.prism} />)}
    </g>
    <defs><clipPath id={`${id}-wake`} clipPathUnits="userSpaceOnUse">
      <motion.rect x={trailStart} y="0" width={trailWidth} height="720" />
    </clipPath></defs>
    <g clipPath={`url(#${id}-wake)`}>
      <motion.g className="rainbow__exhaust" style={{ opacity: trailOpacity, transform: trailTransform, originX: 0, originY: 0, transformBox: 'view-box' }}>
        {RAINBOW_COLORS.map((color, index) => <AnchoredBand key={color} trails={trails} index={index} collapse={collapse} />)}
      </motion.g>
    </g>
    <motion.path d={beam} stroke="white" strokeWidth="10" style={{ opacity: beamGlow }} />
    <motion.path className="rainbow__white-beam" d={beam} stroke="white" strokeWidth="2.5" style={{ opacity: beamOpacity }} />
    <motion.g className="rainbow-traveller__mascot" style={{ transform, opacity: mascotOpacity, originX: 0, originY: 0, transformBox: 'view-box' }}>
      <g transform="translate(-12 -12)" fill="white">
        <defs>
          <clipPath id={`${id}-body`}><rect width="24" height="16" /></clipPath>
          <clipPath id={`${id}-a`}><path d="M5.5 16h1.5v2H5.5Z M14.5 16H16v2h-1.5Z" /></clipPath>
          <clipPath id={`${id}-b`}><path d="M8 16h1.5v2H8Z M17 16h1.5v2H17Z" /></clipPath>
        </defs>
        <path d={CLAWD} clipPath={`url(#${id}-body)`} />
        <motion.g className="rainbow__feet" style={{ transform: legA }}><path d={CLAWD} clipPath={`url(#${id}-a)`} /></motion.g>
        <motion.g className="rainbow__feet" style={{ transform: legB }}><path d={CLAWD} clipPath={`url(#${id}-b)`} /></motion.g>
      </g>
      <HandTimer seconds={seconds} />
    </motion.g>
  </motion.svg>
}

function Checkpoint({ index, clock }: { index: number; clock: MotionValue<number> }) {
  const checkpoint = CHECKPOINTS[index]
  const above = index !== 1
  // Keep the caption's clearance as the heartbeat's amplitude changes.
  const textY = above
    ? -132 - Math.max(0, checkpoint.amplitude - 0.94) * 54
    : 128 + Math.max(0, checkpoint.amplitude - 1.45) * 46
  const labels = useTransform(clock, t => rainbowLabels(t, index))
  const labelY = useTransform(labels, t => (1 - t) * (above ? 12 : -12))
  return <g className="rainbow__checkpoint" transform={`translate(${checkpoint.x} ${RAINBOW_Y})`}>
    <motion.g className="rainbow__caption" style={{ opacity: labels, y: labelY }}>
      <text className="rainbow__label" y={textY}>
        {checkpoint.lines.map((line, i) => <tspan key={line} x="0" dy={i ? 35 : 0}>{line}</tspan>)}
      </text>
    </motion.g>
  </g>
}

function RainbowArtwork({ clock, standalone = false }: { clock: MotionValue<number>; standalone?: boolean }) {
  const id = useId()
  const stillSeconds = useMotionValue(0)
  const title = useTransform(clock, t => Math.max(0, Math.min(1, (t - 0.45) / 0.55)))
  return <div className="rainbow">
    <motion.h1 className="rainbow__title" style={{ opacity: title }}>All of this has to happen fast.</motion.h1>
    <svg className="rainbow__map" viewBox="0 0 1280 720">
      {/* Static overview / print has no shared traveller above the slide. */}
      {standalone && <g>
        <defs><clipPath id={`${id}-still`}><rect width="1144" height="720" /></clipPath></defs>
        <g clipPath={`url(#${id}-still)`}>
          <g className="rainbow__exhaust" transform="translate(-1280 0)">
            {STILL_TRAILS.map((d, i) => <path key={i} d={d} fill={RAINBOW_COLORS[i]} />)}
          </g>
        </g>
        <g transform={`translate(1180 ${RAINBOW_Y}) scale(5.2)`}>
          <path className="rainbow__still-mascot" d={CLAWD} fill="white" transform="translate(-12 -12)" />
          <HandTimer seconds={stillSeconds} />
        </g>
      </g>}
      {CHECKPOINTS.map((_, i) => <Checkpoint key={i} index={i} clock={clock} />)}
    </svg>
  </div>
}

export function Rainbow() {
  const slide = useSlide()
  useState(() => slide.register(RAINBOW_CUES.length - 1))
  const flight = useRainbow()
  const still = useMotionValue(RAINBOW_CUES[RAINBOW_CUES.length - 1])
  return <RainbowArtwork clock={flight?.clock ?? still} standalone={!flight} />
}
