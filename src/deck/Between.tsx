import { createContext, useContext, useId, useLayoutEffect, useState, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useTransform, type MotionStyle, type MotionValue } from 'motion/react'
import { betweenAt, GARLAND_CUES, GARLAND_LEFT, GARLAND_ROWS, GARLAND_RUNNER_SCALE, GARLAND_WIDTH, garlandCurveAt, garlandDropAt, garlandLetters, garlandLightAt, garlandRunnerAt, PILL_WIDTH, type GarlandCurve } from './betweenMotion'
import { CLAWD } from './ClaudeMark'
import { useSlide } from './slideContext'

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
  const left = useTransform(progress, p => betweenAt(p).left - PILL_WIDTH / 2)
  const right = useTransform(progress, p => betweenAt(p).right - PILL_WIDTH / 2)
  const opacity = useTransform(progress, p => betweenAt(p).pillOpacity)
  return <div className="between">
    <LightingContext.Provider value={lighting}>{children}</LightingContext.Provider>
    <motion.div className="between__pill between__pill--push" style={{ x: left, opacity }}>Push</motion.div>
    <motion.div className="between__pill between__pill--ui" style={{ x: right, opacity }}>UI</motion.div>
  </div>
}

function Light({ letter, t, row, index, glow, curve, lighting }: {
  letter: string; t: number; row: number; index: number; glow: string
  curve: MotionValue<GarlandCurve>; lighting: MotionValue<number>
}) {
  const x = GARLAND_LEFT + GARLAND_WIDTH * t
  const y = useTransform(curve, c => strandY(row) + garlandDropAt(x, c))
  const light = useTransform(lighting, clock => garlandLightAt(clock, row, index))
  return <motion.g className="garland__light" data-letter={letter}
    data-side={t < 0.5 ? 'left' : 'right'} style={{ x, y, '--light': light } as MotionStyle}>
    <path className="garland__drop" d="M 0 0 V 20" />
    <ellipse className="garland__glow" cx="0" cy="43" rx="34" ry="36" fill={`url(#${glow})`} />
    <path className="garland__socket" d="M -5 20 H 5 V 26 H -5 Z" />
    <circle className="garland__glass" cx="0" cy="45" r="20" />
    {/* Centre the visible capitals, using the loaded font's cap height. */}
    <text className="garland__letter" y="45" dy="0.5cap" textAnchor="middle" dominantBaseline="alphabetic">{letter}</text>
  </motion.g>
}

function RopeRunner({ row, curve, lighting }: { row: number; curve: MotionValue<GarlandCurve>; lighting: MotionValue<number> }) {
  const id = useId()
  const run = useTransform(lighting, clock => garlandRunnerAt(clock, row))
  const transform = useTransform(() => {
    const runner = run.get()
    const cord = curve.get()
    const t = Math.max(0, Math.min(1, (runner.x - cord.left) / (cord.right - cord.left)))
    const angle = Math.atan(4 * cord.depth * (1 - 2 * t) / (cord.right - cord.left)) * 180 / Math.PI
    const y = strandY(row) + garlandDropAt(runner.x, cord) - runner.hop
    return `translate(${runner.x}px, ${y}px) rotate(${angle}deg)`
  })
  const opacity = useTransform(run, runner => runner.visible ? 1 : 0)
  const legA = useTransform(run, runner => runner.legA)
  const legB = useTransform(run, runner => runner.legB)
  return <motion.g className="garland__runner" style={{ transform, opacity, originX: 0, originY: 0, transformBox: 'view-box' }} aria-hidden="true">
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
  const d = useTransform(curve, c => `M ${c.left} ${y} Q 640 ${y + c.depth * 2} ${c.right} ${y}`)
  return <g className={`garland__row garland__row--${row}`} role="img" aria-label={text} data-lights={lights.length}>
    <motion.path className="garland__wire" d={d} />
    {lights.map(({ letter, t }, i) => <Light key={i} letter={letter} t={t} row={row} index={i} glow={glow} curve={curve} lighting={lighting} />)}
    <RopeRunner row={row} curve={curve} lighting={lighting} />
  </g>
}

/** Two rows of globes, with one lighting cue per row. */
export function Garland() {
  const progress = useProgress()
  const fullyLit = useMotionValue(GARLAND_CUES[GARLAND_ROWS.length])
  const lighting = useContext(LightingContext) ?? fullyLit
  const id = useId()
  const left = useTransform(progress, p => betweenAt(p).left + PILL_WIDTH / 2)
  const width = useTransform(progress, p => {
    const state = betweenAt(p)
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
