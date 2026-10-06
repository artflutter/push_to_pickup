const SQUASH_DURATION = 1
const HOLD_DURATION = 0.288
const REVEAL_DURATION = 2.052
const REVEAL_START = SQUASH_DURATION + HOLD_DURATION
export const BETWEEN_DURATION = REVEAL_START + REVEAL_DURATION
export const PILL_WIDTH = 136
export const GARLAND_ROWS = ['GET VENDOR TOKEN', 'CONNECT TO VENDOR'] as const
export const GARLAND_LEFT = 204
export const GARLAND_WIDTH = 872
export const GARLAND_RUNNER_SCALE = 2.5

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** Press the paper into folds, pause in contact, then pull the wires taut. */
export function betweenAt(progress: number) {
  const seconds = progress * BETWEEN_DURATION
  const squash = seconds / SQUASH_DURATION
  const press = smooth(squash)
  const open = smooth((seconds - REVEAL_START) / REVEAL_DURATION)
  const left = seconds < REVEAL_START ? mix(-68, 568, press) : mix(568, 136, open)
  return {
    left,
    right: 1280 - left,
    contentOpacity: 1 - smooth((squash - 6 / 7) * 7),
    pillOpacity: smooth(squash / (0.045 / 0.35)),
    open,
  }
}

// Paired widths close every pleat back onto the same plane. Slightly uneven
// creases make this one sheet of paper, rather than a stack of equal blinds.
export const PAPER = { x: 56, y: 56, width: 1168, height: 608 }
export const PAPER_PANELS = [86, 86, 108, 108, 94, 94, 112, 112, 88, 88, 96, 96]

export function paperAt(progress: number) {
  const state = betweenAt(progress)
  // The pills cross the empty margins before they touch the sheet.
  const gap = Math.min(PAPER.width, state.right - state.left - PILL_WIDTH)
  // Once pressed, the paper stays folded while the garlands open.
  const width = progress * BETWEEN_DURATION >= SQUASH_DURATION ? 8 : gap
  const cosine = width / PAPER.width
  const angle = Math.acos(cosine)
  return { left: (1280 - width) / 2, cosine, angle, fold: Math.sin(angle), opacity: state.contentOpacity }
}

/** Spaces reserve positions on the cord, but never create a light. */
export function garlandLetters(text: string) {
  const slots = Math.max(...GARLAND_ROWS.map(row => row.length))
  const offset = (slots - text.length) / 2
  return [...text].flatMap((letter, i) => letter === ' ' ? [] : [{ letter, t: (i + offset + 1) / (slots + 1) }])
}

const LETTER_INTERVAL = 0.09
const LETTER_WARMUP = 0.14
const SLOT_PITCH = GARLAND_WIDTH / (Math.max(...GARLAND_ROWS.map(text => text.length)) + 1)
const RUN_SPEED = SLOT_PITCH / LETTER_INTERVAL
// Leave room for the enlarged mascot to clear the pill while tilted on the cord.
const RUN_MARGIN = 14 * GARLAND_RUNNER_SCALE
const RUN_WIDTH = GARLAND_WIDTH + RUN_MARGIN * 2
const RUN_DURATION = RUN_WIDTH / RUN_SPEED
const RUNS = GARLAND_ROWS.map((text, row) => {
  const lamps = garlandLetters(text).map(({ t }) => GARLAND_LEFT + GARLAND_WIDTH * t)
  const reverse = row === 1
  return {
    lamps,
    entry: reverse ? GARLAND_LEFT + GARLAND_WIDTH + RUN_MARGIN : GARLAND_LEFT - RUN_MARGIN,
    direction: reverse ? -1 : 1,
    first: reverse ? lamps[lamps.length - 1] : lamps[0],
  }
})

/** Twilio rings without a vendor token, so a tag hangs under TOKEN once its row is lit. */
export const GARLAND_TAG = (() => {
  const row = 0
  const word = 'TOKEN'
  const text = GARLAND_ROWS[row]
  const first = text.slice(0, text.lastIndexOf(word)).replaceAll(' ', '').length
  return { row, index: first + Math.floor(word.length / 2), lines: ['Twilio brings', 'its own'] }
})()
const TAG_SETTLE = 1.6
const TAG_START = (() => {
  const run = RUNS[GARLAND_TAG.row]
  const last = run.direction > 0 ? run.lamps[run.lamps.length - 1] : run.lamps[0]
  return Math.abs(last - run.entry) / RUN_SPEED + LETTER_WARMUP
})()

// A row lasts until its lamps are lit and the tag has settled.
const ROW_DURATIONS = GARLAND_ROWS.map((_, row) => row === GARLAND_TAG.row ? Math.max(RUN_DURATION, TAG_START + TAG_SETTLE) : RUN_DURATION)

// A single clock lets a quick second click queue the lower row after the upper.
export const GARLAND_CUES = ROW_DURATIONS.reduce((cues, duration) => [...cues, cues[cues.length - 1] + duration], [0])

/** Drops in on its thread, swung aside, and rocks to rest. */
export function garlandTagAt(clock: number) {
  const time = Math.max(0, clock - GARLAND_CUES[GARLAND_TAG.row] - TAG_START)
  const enter = smooth(time / 0.25)
  return {
    opacity: enter,
    y: (enter - 1) * 14,
    // The envelope reaches zero as the row's clock stops, so the tag rests plumb.
    angle: 30 * Math.exp(-2.6 * time) * Math.cos(time * Math.PI * 2 / 0.95) * clamp(1 - time / TAG_SETTLE),
  }
}

export function garlandLightAt(clock: number, row: number, index: number) {
  const run = RUNS[row]
  const arrival = Math.abs(run.lamps[index] - run.entry) / RUN_SPEED
  return smooth((clock - GARLAND_CUES[row] - arrival + LETTER_WARMUP / 2) / LETTER_WARMUP)
}

/** Travel at a fixed speed, taking a normal stride through every empty slot. */
export function garlandRunnerAt(clock: number, row: number) {
  const time = clock - GARLAND_CUES[row]
  const run = RUNS[row]
  const distance = clamp(time / RUN_DURATION) * RUN_WIDTH
  const x = run.entry + run.direction * distance
  const step = (distance - Math.abs(run.first - run.entry)) / SLOT_PITCH
  const stride = Math.sin(step * Math.PI)
  return { x, hop: Math.abs(stride) * 4, legA: -Math.max(0, stride) * 1.5, legB: Math.min(0, stride) * 1.5, visible: time > 0 && clock < GARLAND_CUES[row + 1] }
}

export const garlandSag = (t: number, depth: number) => 4 * depth * t * (1 - t)

export type GarlandCurve = { left: number; right: number; depth: number }

/** Both pills pay out the same cord. Each newly exposed lamp adds to its sag. */
export function garlandCurveAt(progress: number, maxDepth: number, positions: readonly number[]): GarlandCurve {
  const state = betweenAt(progress)
  const left = state.left + PILL_WIDTH / 2
  const right = state.right - PILL_WIDTH / 2
  const exposed = positions.reduce((weight, t) => {
    const x = GARLAND_LEFT + GARLAND_WIDTH * t
    // Count the lamp gradually as it clears either pill, without a weight jump.
    return weight + smooth((Math.min(x - left, right - x) + 22) / 44)
  }, 0)
  return { left, right, depth: state.open > 0 ? maxDepth * exposed / positions.length : 0 }
}

export function garlandDropAt(x: number, curve: GarlandCurve) {
  return garlandSag(clamp((x - curve.left) / (curve.right - curve.left)), curve.depth)
}
