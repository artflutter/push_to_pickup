import { prismPhase } from './prismMotion'

export const FINALE_END = 4.6
export const FINALE_CIRCLE = { x: 640, y: 288, r: 224 }
export const finaleExit = (t: number) => 1 - prismPhase(t, 0, .5)

/** The three sprites spin while fading out. The shared clock reverses both
 * the path and the fade, returning each sprite to its exact metric ray. */
export function finaleClawd(t: number, index: number, start: { x: number; y: number; angle: number }) {
  if (t <= 0) return start
  const p = prismPhase(t, 0, 1.6)
  const dx = start.x - FINALE_CIRCLE.x
  const dy = start.y - FINALE_CIRCLE.y
  const initialAngle = Math.atan2(dy, dx)
  const targetAngle = (270 + index * 120) * Math.PI / 180
  const spin = Math.PI * 2 * prismPhase(t, 0, 3.6) + .65 * t
  const angle = initialAngle + p * (targetAngle - initialAngle + spin)
  const radius = Math.hypot(dx, dy) * (1 - p) + FINALE_CIRCLE.r * p
  return {
    x: FINALE_CIRCLE.x + Math.cos(angle) * radius,
    y: FINALE_CIRCLE.y + Math.sin(angle) * radius,
    angle: start.angle * (1 - p) + Math.sin(angle) * 10 * p,
  }
}
