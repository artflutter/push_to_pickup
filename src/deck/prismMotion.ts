/** The rainbow and prism share world coordinates and one reversible clock. */
export const METRICS_LEFT = 2560
export const PRISM_HIT = .9
export const PRISM_SPLIT = PRISM_HIT + .12
export const PRISM_END = PRISM_SPLIT + 2.08
export const PRISM_POINT = { x: 462, y: 407 }

export const prismPhase = (t: number, start: number, end: number) => {
  const p = Math.max(0, Math.min(1, (t - start) / (end - start)))
  return p * p * (3 - 2 * p)
}
const mix = (a: number, b: number, p: number) => a + (b - a) * p

const approach = (t: number) => Math.max(0, Math.min(1, t / PRISM_HIT))
// Both derivatives stay positive: gather speed, then hit without easing down.
// The camera stops at contact, making the impact the end of the acceleration.
export const prismTravel = (t: number) => {
  const p = approach(t)
  return .18 * p + .82 * p ** 3
}
export const prismCamera = (t: number) => 1280 * prismTravel(t)
export const prismCollapse = (t: number) => prismPhase(t, .025, .34)
export const prismBoost = (t: number) => prismPhase(t, .03, .3) *
  (.12 + .88 * approach(t) ** 2) * (1 - prismPhase(t, PRISM_HIT, PRISM_HIT + .09))
export const prismImpact = (t: number) => ({
  opacity: prismPhase(t, PRISM_HIT, PRISM_HIT + .025) * (1 - prismPhase(t, PRISM_HIT + .06, PRISM_HIT + .34)),
  spread: prismPhase(t, PRISM_HIT, PRISM_HIT + .34),
})

export function prismHead(t: number) {
  return {
    x: mix(2460, METRICS_LEFT + PRISM_POINT.x, prismTravel(t)),
    y: mix(405, PRISM_POINT.y, prismCollapse(t)),
  }
}

/** A brief contact sparkle precedes the three flights and their captions. */
export function prismBranch(t: number, index: number) {
  const arrival = PRISM_SPLIT + 1.2 + index * .22
  const p = Math.max(0, Math.min(1, (t - PRISM_SPLIT) / (arrival - PRISM_SPLIT)))
  const travel = 1 - (1 - p) ** 3
  const targetY = 255 + index * 152
  const unfold = prismPhase(t, PRISM_SPLIT, PRISM_SPLIT + .26)
  const tilt = Math.atan2(targetY - PRISM_POINT.y, 738 - PRISM_POINT.x) * 180 / Math.PI
  return {
    x: mix(PRISM_POINT.x, 738, travel),
    y: mix(PRISM_POINT.y, targetY, travel),
    travel,
    unfold,
    angle: tilt * (1 - prismPhase(travel, .7, 1)),
    label: prismPhase(t, arrival - .05, arrival + .4),
  }
}
