import { useId, useRef, useState } from 'react'
import { motion, useAnimationFrame, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { CLAWD } from './ClaudeMark'
import { useSlide } from './slideContext'
import { useRainbow } from './rainbowContext'
import { CHECKPOINTS, NYAN_FRAME_MS, RAINBOW_COLORS, RAINBOW_CUES, RAINBOW_Y, makeRainbowFlight, nyanPose, rainbowFrame, rainbowLabels, rainbowTrails } from './rainbowMotion'

const STILL_TRAILS = rainbowTrails(makeRainbowFlight(2), 0)

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

function AnchoredBand({ trails, index }: { trails: MotionValue<string[]>; index: number }) {
  const d = useTransform(trails, paths => paths[index])
  return <motion.path d={d} fill={RAINBOW_COLORS[index]} />
}

/** The sprite, rippling exhaust and star field keep looping between clicks. */
export function RainbowTraveller() {
  const id = useId()
  const flight = useRainbow()!
  const path = useTransform(flight.winner, makeRainbowFlight)
  const frame = useTransform(() => rainbowFrame(flight.clock.get(), path.get()))
  const cycle = useMotionValue(0)
  const elapsed = useRef(0)
  useAnimationFrame((_, delta) => {
    if (flight.clock.get() <= 0) {
      elapsed.current = 0
      if (cycle.get()) cycle.set(0)
      return
    }
    elapsed.current += Math.min(delta, 100)
    const next = Math.floor(elapsed.current / NYAN_FRAME_MS)
    if (next !== cycle.get()) cycle.set(next)
  })
  const pose = useTransform(cycle, nyanPose)
  const bob = useTransform(flight.clock, t => Math.min(1, t / 0.25))
  const opacity = useTransform(flight.clock, t => t > 0 ? 1 : 0)
  const mascotX = useTransform(() => frame.get().x + pose.get().x * bob.get() * frame.get().bob)
  const mascotY = useTransform(() => frame.get().y + pose.get().y * bob.get() * frame.get().bob)
  const transform = useTransform(() => `translate(${mascotX.get()}px, ${mascotY.get()}px) rotate(${frame.get().angle}deg) scale(${frame.get().scale})`)
  const trailStart = useTransform(frame, f => f.tailStart)
  const trailWidth = useTransform(() => Math.max(0, mascotX.get() - frame.get().scale * 7 - trailStart.get()))
  const trails = useTransform(() => rainbowTrails(path.get(), cycle.get() % 6))
  const trailOpacity = useTransform(flight.clock, t => Math.min(1, t / 0.16))
  const starsOpacity = useTransform(flight.clock, t => Math.min(1, t / 0.5))
  const legA = useTransform(pose, p => `translate(${p.aX}px, ${p.aY}px)`)
  const legB = useTransform(pose, p => `translate(${p.bX}px, ${p.bY}px)`)
  return <motion.svg className="rainbow-traveller" viewBox="0 0 2560 720" style={{ opacity }} aria-hidden="true">
    <motion.g className="rainbow__stars" style={{ opacity: starsOpacity }}>
      {Array.from({ length: 20 }, (_, i) => <PixelStar key={i} index={i} frame={cycle} />)}
    </motion.g>
    <defs><clipPath id={`${id}-wake`} clipPathUnits="userSpaceOnUse">
      <motion.rect x={trailStart} y="0" width={trailWidth} height="720" />
    </clipPath></defs>
    <motion.g className="rainbow__exhaust" clipPath={`url(#${id}-wake)`} style={{ opacity: trailOpacity }}>
      {RAINBOW_COLORS.map((color, index) => <AnchoredBand key={color} trails={trails} index={index} />)}
    </motion.g>
    <motion.g className="rainbow-traveller__mascot" style={{ transform, originX: 0, originY: 0, transformBox: 'view-box' }}>
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
  return <g className="rainbow__checkpoint" data-checkpoint={index + 1} transform={`translate(${checkpoint.x} ${RAINBOW_Y})`}>
    <motion.g className="rainbow__caption" data-side={above ? 'above' : 'below'} style={{ opacity: labels, y: labelY }}>
      <text className="rainbow__label" y={textY}>
        {checkpoint.lines.map((line, i) => <tspan key={line} x="0" dy={i ? 35 : 0}>{line}</tspan>)}
      </text>
    </motion.g>
  </g>
}

export function Rainbow() {
  const slide = useSlide()
  useState(() => slide.register(RAINBOW_CUES.length - 1))
  const id = useId()
  const flight = useRainbow()
  const still = useMotionValue(RAINBOW_CUES[RAINBOW_CUES.length - 1])
  const clock = flight?.clock ?? still
  const title = useTransform(clock, t => Math.max(0, Math.min(1, (t - 0.45) / 0.55)))
  return <div className="rainbow">
    <motion.h1 className="rainbow__title" style={{ opacity: title }}>All of this has to happen fast.</motion.h1>
    <svg className="rainbow__map" viewBox="0 0 1280 720" role="img" aria-label="Server processing, push delivery, and on-device call processing are checkpoints on a rainbow">
      {/* Static overview / print has no shared traveller above the slide. */}
      {!flight && <g>
        <defs><clipPath id={`${id}-still`}><rect width="1144" height="720" /></clipPath></defs>
        <g clipPath={`url(#${id}-still)`}>
          <g className="rainbow__exhaust" transform="translate(-1280 0)">
            {STILL_TRAILS.map((d, i) => <path key={i} d={d} fill={RAINBOW_COLORS[i]} />)}
          </g>
        </g>
        <path d={CLAWD} fill="white" transform={`translate(1180 ${RAINBOW_Y}) scale(5.2) translate(-12 -12)`} />
      </g>}
      {CHECKPOINTS.map((_, i) => <Checkpoint key={i} index={i} clock={clock} />)}
    </svg>
  </div>
}
