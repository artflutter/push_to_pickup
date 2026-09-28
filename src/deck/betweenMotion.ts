const SQUASH_DURATION = 1
const HOLD_DURATION = 0.288
const REVEAL_DURATION = 2.052
const REVEAL_START = SQUASH_DURATION + HOLD_DURATION
export const BETWEEN_DURATION = REVEAL_START + REVEAL_DURATION
export const PILL_WIDTH = 136
export const GARLAND_ROWS = ['GET VENDOR TOKEN', 'CONNECT VENDOR'] as const
export const GARLAND_LEFT = 204
export const GARLAND_WIDTH = 872

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
// A single clock lets a quick second click queue the lower row after the upper.
export const GARLAND_CUES = GARLAND_ROWS.reduce<number[]>((cues, text) => {
  cues.push(cues[cues.length - 1] + (garlandLetters(text).length - 1) * LETTER_INTERVAL + LETTER_WARMUP)
  return cues
}, [0])

export function garlandLightAt(clock: number, row: number, index: number) {
  return smooth((clock - GARLAND_CUES[row] - index * LETTER_INTERVAL) / LETTER_WARMUP)
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
