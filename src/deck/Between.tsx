import { createContext, useContext, useId, useLayoutEffect, useState, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useTransform, type MotionStyle, type MotionValue } from 'motion/react'
import { betweenAt, GARLAND_CUES, GARLAND_LEFT, GARLAND_ROWS, GARLAND_RUNNER_SCALE, GARLAND_TAG, GARLAND_WIDTH, garlandCurveAt, garlandDropAt, garlandLetters, garlandLightAt, garlandRunnerAt, garlandTagAt, PILL_WIDTH, type GarlandCurve } from './betweenMotion'
import { CLAWD } from './ClaudeMark'
import { useSlide } from './slideContext'
import { useEndpointEntry } from './endpointContext'
import { pillarFallAt, ropeDebrisOpacity, ropePowerAt, tornRopePathAt, tornRopePointAt } from './endpointMotion'

export const BetweenContext = createContext<MotionValue<number> | null>(null)
const LightingContext = createContext<MotionValue<number> | null>(null)
const strandY = (row: number) => 230 + row * 210

function useProgress() {
  const still = useMotionValue(1)
  return useContext(BetweenContext) ?? still
}

/** The same capsules press the UI and become the garland's two anchors. */
export function Between({ children }: { children: ReactNode }) {
  const slide = useSlide()
  useState(() => slide.register(GARLAND_ROWS.length))
  const progress = useProgress()
  const collapse = useEndpointEntry()
  const target = GARLAND_CUES[slide.static ? GARLAND_ROWS.length : Math.min(slide.step, GARLAND_ROWS.length)]
  const lighting = useMotionValue(target)
  useLayoutEffect(() => {
    if (slide.static) {
      lighting.jump(target)
      return
    }
    let animation: ReturnType<typeof animate> | undefined
    let stopWaiting = () => {}
    const start = () => {
      stopWaiting()
      animation = animate(lighting, target, { duration: Math.abs(target - lighting.get()), ease: 'linear' })
    }
    // A click during the paper transition waits until all lamps are pulled out.
    if (target > lighting.get() && progress.get() < 1) {
      stopWaiting = progress.on('change', p => { if (p >= 1) start() })
    } else start()
    return () => { stopWaiting(); animation?.stop() }
  }, [lighting, progress, slide.static, target])
  const leftFall = useTransform(collapse, t => pillarFallAt(t, -1))
  const rightFall = useTransform(collapse, t => pillarFallAt(t, 1))
  const left = useTransform(() => betweenAt(progress.get()).left - PILL_WIDTH / 2 + leftFall.get().x)
  const right = useTransform(() => betweenAt(progress.get()).right - PILL_WIDTH / 2 + rightFall.get().x)
  const leftY = useTransform(leftFall, p => p.y)
  const rightY = useTransform(rightFall, p => p.y)
  const leftAngle = useTransform(leftFall, p => p.angle)
  const rightAngle = useTransform(rightFall, p => p.angle)
  const leftOpacity = useTransform(() => betweenAt(progress.get()).pillOpacity * leftFall.get().opacity)
  const rightOpacity = useTransform(() => betweenAt(progress.get()).pillOpacity * rightFall.get().opacity)
  return <div className="between">
    <LightingContext.Provider value={lighting}>{children}</LightingContext.Provider>
    <motion.div className="between__pill between__pill--push" style={{ x: left, y: leftY, rotate: leftAngle, opacity: leftOpacity, originX: 0.5, originY: 1 }}>Push</motion.div>
    <motion.div className="between__pill between__pill--ui" style={{ x: right, y: rightY, rotate: rightAngle, opacity: rightOpacity, originX: 0.5, originY: 1 }}>UI</motion.div>
  </div>
}

/** A paper tag tied under its lamp; it rides the lamp through the sag and the fall. */
function Tag({ lighting }: { lighting: MotionValue<number> }) {
  const state = useTransform(lighting, garlandTagAt)
  const opacity = useTransform(state, s => s.opacity)
  const y = useTransform(state, s => s.y)
  const rotate = useTransform(state, s => s.angle)
  return <g transform="translate(0 65)">
    <motion.g className="garland__tag" style={{ opacity, y, rotate, originX: 0, originY: 0, transformBox: 'view-box' }}>
      <path className="garland__tag-thread" d="M 0 0 V 22" />
      <path className="garland__tag-card" d="M -56 22 H 56 L 72 38 V 92 Q 72 98 66 98 H -66 Q -72 98 -72 92 V 38 Z" />
      <circle className="garland__tag-hole" cx="0" cy="33" r="4" />
      {GARLAND_TAG.lines.map((line, i) => <text key={line} className="garland__tag-text" y={62 + i * 24} textAnchor="middle">{line}</text>)}
    </motion.g>
  </g>
}

function Light({ letter, t, row, index, glow, curve, lighting }: {
  letter: string; t: number; row: number; index: number; glow: string
  curve: MotionValue<GarlandCurve>; lighting: MotionValue<number>
}) {
  const collapse = useEndpointEntry()
  const position = useTransform(() => tornRopePointAt(GARLAND_LEFT + GARLAND_WIDTH * t, row, collapse.get(), curve.get()))
  const x = useTransform(position, p => p.x)
  const y = useTransform(position, p => p.y)
  const rotate = useTransform(position, p => p.angle)
  const light = useTransform(() => garlandLightAt(lighting.get(), row, index) * ropePowerAt(collapse.get(), row))
  return <motion.g className="garland__light" style={{ x, y, rotate, originX: 0, originY: 0, transformBox: 'view-box', '--light': light } as MotionStyle}>
    <path className="garland__drop" d="M 0 0 V 20" />
    <ellipse className="garland__glow" cx="0" cy="43" rx="34" ry="36" fill={`url(#${glow})`} />
    <path className="garland__socket" d="M -5 20 H 5 V 26 H -5 Z" />
    <circle className="garland__glass" cx="0" cy="45" r="20" />
    {/* Centre the visible capitals, using the loaded font's cap height. */}
    <text className="garland__letter" y="45" dy="0.5cap" textAnchor="middle" dominantBaseline="alphabetic">{letter}</text>
    {row === GARLAND_TAG.row && index === GARLAND_TAG.index && <Tag lighting={lighting} />}
  </motion.g>
}

function RopeRunner({ row, curve, lighting }: { row: number; curve: MotionValue<GarlandCurve>; lighting: MotionValue<number> }) {
  const id = useId()
  const collapse = useEndpointEntry()
  const run = useTransform(lighting, clock => garlandRunnerAt(clock, row))
  const transform = useTransform(() => {
    const runner = run.get()
    const cord = curve.get()
    const t = Math.max(0, Math.min(1, (runner.x - cord.left) / (cord.right - cord.left)))
    const angle = Math.atan(4 * cord.depth * (1 - 2 * t) / (cord.right - cord.left)) * 180 / Math.PI
    const y = strandY(row) + garlandDropAt(runner.x, cord) - runner.hop
    return `translate(${runner.x}px, ${y}px) rotate(${angle}deg)`
  })
  const opacity = useTransform(() => collapse.get() === 0 && run.get().visible ? 1 : 0)
  const legA = useTransform(run, runner => runner.legA)
  const legB = useTransform(run, runner => runner.legB)
  return <motion.g className="garland__runner" style={{ transform, opacity, originX: 0, originY: 0, transformBox: 'view-box' }}>
    {/* Keep the shipped silhouette; alternate its two pairs of pixel feet. */}
    <g transform={`scale(${GARLAND_RUNNER_SCALE}) translate(-12 -18)`}>
      <defs>
        <clipPath id={`${id}-body`}><rect width="24" height="16" /></clipPath>
        <clipPath id={`${id}-a`}><path d="M5.5 16h1.5v2H5.5Z M14.5 16H16v2h-1.5Z" /></clipPath>
        <clipPath id={`${id}-b`}><path d="M8 16h1.5v2H8Z M17 16h1.5v2H17Z" /></clipPath>
      </defs>
      <path d={CLAWD} clipPath={`url(#${id}-body)`} />
      <motion.g style={{ y: legA }}><path d={CLAWD} clipPath={`url(#${id}-a)`} /></motion.g>
      <motion.g style={{ y: legB }}><path d={CLAWD} clipPath={`url(#${id}-b)`} /></motion.g>
    </g>
  </motion.g>
}

function Strand({ text, row, glow, progress, lighting }: {
  text: string; row: number; glow: string; progress: MotionValue<number>; lighting: MotionValue<number>
}) {
  const y = strandY(row)
  const lights = garlandLetters(text)
  const positions = lights.map(light => light.t)
  const curve = useTransform(progress, p => garlandCurveAt(p, 42, positions))
  const collapse = useEndpointEntry()
  const d = useTransform(() => {
    const c = curve.get()
    return collapse.get() > 0 ? tornRopePathAt(row, collapse.get(), c) : `M ${c.left} ${y} Q 640 ${y + c.depth * 2} ${c.right} ${y}`
  })
  const opacity = useTransform(collapse, clock => ropeDebrisOpacity(clock, row))
  return <motion.g className={`garland__row garland__row--${row}`} style={{ opacity }}>
    <motion.path className="garland__wire" d={d} />
    {lights.map(({ letter, t }, i) => <Light key={i} letter={letter} t={t} row={row} index={i} glow={glow} curve={curve} lighting={lighting} />)}
    <RopeRunner row={row} curve={curve} lighting={lighting} />
  </motion.g>
}

/** Two rows of globes, with one lighting cue per row. */
export function Garland() {
  const progress = useProgress()
  const collapse = useEndpointEntry()
  const fullyLit = useMotionValue(GARLAND_CUES[GARLAND_ROWS.length])
  const lighting = useContext(LightingContext) ?? fullyLit
  const id = useId()
  const left = useTransform(() => collapse.get() > 0 ? -1280 : betweenAt(progress.get()).left + PILL_WIDTH / 2)
  const width = useTransform(() => {
    if (collapse.get() > 0) return 3840
    const state = betweenAt(progress.get())
    return state.right - state.left - PILL_WIDTH
  })
  const visibility = useTransform(progress, p => betweenAt(p).open > 0 ? 'visible' : 'hidden')
  return <div className="garland">
    <motion.svg className="garland__svg" viewBox="0 0 1280 720" style={{ visibility }}>
      <defs>
        <clipPath id={`${id}-gap`} clipPathUnits="userSpaceOnUse">
          <motion.rect x={left} y="0" width={width} height="720" />
        </clipPath>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="currentColor" stopOpacity="0.23" />
          <stop offset="0.48" stopColor="currentColor" stopOpacity="0.08" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${id}-gap)`}>
        {/* The widening gap releases lamps from behind both pills. Horizontal
            spacing and lamp size stay fixed while their weight lowers the cord. */}
        {GARLAND_ROWS.map((text, row) => <Strand key={text} text={text} row={row} glow={`${id}-glow`} progress={progress} lighting={lighting} />)}
      </g>
    </motion.svg>
  </div>
}
