import { createContext, useContext, useId, type ReactNode } from 'react'
import { motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { betweenAt, GARLAND_LEFT, GARLAND_ROWS, GARLAND_WIDTH, garlandCurveAt, garlandDropAt, garlandLetters, PILL_WIDTH, type GarlandCurve } from './betweenMotion'

export const BetweenContext = createContext<MotionValue<number> | null>(null)

function useProgress() {
  const still = useMotionValue(1)
  return useContext(BetweenContext) ?? still
}

/** The same capsules press the UI and become the garland's two anchors. */
export function Between({ children }: { children: ReactNode }) {
  const progress = useProgress()
  const left = useTransform(progress, p => betweenAt(p).left - PILL_WIDTH / 2)
  const right = useTransform(progress, p => betweenAt(p).right - PILL_WIDTH / 2)
  const opacity = useTransform(progress, p => betweenAt(p).pillOpacity)
  return <div className="between">
    {children}
    <motion.div className="between__pill between__pill--push" style={{ x: left, opacity }}>Push</motion.div>
    <motion.div className="between__pill between__pill--ui" style={{ x: right, opacity }}>UI</motion.div>
  </div>
}

type GarlandStyle = 'globes' | 'drops' | 'lanterns' | 'letters'
const DEPTH: Record<GarlandStyle, number> = { globes: 42, drops: 56, lanterns: 36, letters: 24 }
const LETTER_CENTER: Record<GarlandStyle, number> = { globes: 45, drops: 52, lanterns: 44, letters: 43 }

function Light({ letter, t, row, look, glow, curve }: {
  letter: string; t: number; row: number; look: GarlandStyle; glow: string; curve: MotionValue<GarlandCurve>
}) {
  const x = GARLAND_LEFT + GARLAND_WIDTH * t
  const y = useTransform(curve, c => 250 + row * 170 + garlandDropAt(x, c))
  return <motion.g className={`garland__light garland__light--${look}`} data-letter={letter}
    data-side={t < 0.5 ? 'left' : 'right'} style={{ x, y }}>
    <path className="garland__drop" d="M 0 0 V 20" />
    <ellipse cx="0" cy="43" rx="34" ry="36" fill={`url(#${glow})`} />
    {look === 'globes' && <>
      <path className="garland__socket" d="M -5 20 H 5 V 26 H -5 Z" />
      <circle className="garland__glass" cx="0" cy="45" r="20" />
    </>}
    {look === 'drops' && <>
      <path className="garland__socket" d="M -5 18 H 5 V 25 H -5 Z" />
      <path className="garland__glass" d="M 0 25 C 5 29 19 42 19 52 A 19 19 0 0 1 -19 52 C -19 42 -5 29 0 25 Z" />
    </>}
    {look === 'lanterns' && <>
      <path className="garland__socket" d="M -10 20 H 10 V 25 H -10 Z M -9 65 H 9" />
      <rect className="garland__glass" x="-22" y="25" width="44" height="38" rx="12" />
      <path className="garland__rib" d="M -12 27 Q -20 44 -12 61 M 12 27 Q 20 44 12 61 M -21 37 H 21 M -21 51 H 21" />
    </>}
    {look === 'letters' && <circle className="garland__socket" cy="20" r="3" />}
    {/* Centre the visible capitals, using the loaded font's cap height. */}
    <text className="garland__letter" y={LETTER_CENTER[look]} dy="0.5cap" textAnchor="middle" dominantBaseline="alphabetic">{letter}</text>
  </motion.g>
}

function Strand({ text, row, look, glow, progress }: {
  text: string; row: number; look: GarlandStyle; glow: string; progress: MotionValue<number>
}) {
  const y = 250 + row * 170
  const lights = garlandLetters(text)
  const positions = lights.map(light => light.t)
  const curve = useTransform(progress, p => garlandCurveAt(p, DEPTH[look], positions))
  const d = useTransform(curve, c => `M ${c.left} ${y} Q 640 ${y + c.depth * 2} ${c.right} ${y}`)
  return <g className={`garland__row garland__row--${row}`} role="img" aria-label={text} data-lights={lights.length}>
    <motion.path className="garland__wire" d={d} />
    {lights.map(({ letter, t }, i) => <Light key={i} letter={letter} t={t} row={row} look={look} glow={glow} curve={curve} />)}
  </g>
}

/** Each option stays on slide #7; Pick owns the click sequence. */
export function Garland({ look, tag, label }: { look: GarlandStyle; tag: string; label: string }) {
  const progress = useProgress()
  const id = useId()
  const opacity = useTransform(progress, p => betweenAt(p).wireOpacity)
  const left = useTransform(progress, p => betweenAt(p).left + PILL_WIDTH / 2)
  const width = useTransform(progress, p => {
    const state = betweenAt(p)
    return state.right - state.left - PILL_WIDTH
  })
  const visibility = useTransform(progress, p => betweenAt(p).open > 0 ? 'visible' : 'hidden')
  return <div className={`garland garland--${look}`}>
    <motion.span className="garland__tag" style={{ opacity }}>{tag} · {label}</motion.span>
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
        {GARLAND_ROWS.map((text, row) => <Strand key={text} text={text} row={row} look={look} glow={`${id}-glow`} progress={progress} />)}
      </g>
    </motion.svg>
  </div>
}
