import { garlandDropAt, type GarlandCurve } from './betweenMotion'

export const ENDPOINT_ENTRY_DURATION = 2.9
export const ROPE_IMPACTS = [0.48, 0.94] as const
export const ROPE_TEARS = [0.78, 1.22] as const
const CUT_X = 568
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** The capsules tip around their feet, in opposite directions, then drop out. */
export function pillarFallAt(clock: number, side: -1 | 1) {
  const t = Math.max(0, clock - (side === -1 ? 1.25 : 1.32))
  const turn = clamp(t / 0.94)
  return {
    x: side * 210 * turn * turn,
    y: 660 * Math.max(0, t - 0.34) ** 2,
    angle: side * 104 * turn * turn,
    opacity: 1 - smooth((t - 0.96) / 0.3),
  }
}

function anchorAt(x: number, y: number, clock: number, side: -1 | 1) {
  const fall = pillarFallAt(clock, side)
  const pivotX = side === -1 ? 136 : 1144
  const angle = fall.angle * Math.PI / 180
  const dx = x - pivotX
  const dy = y - 670
  return {
    x: pivotX + fall.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: 670 + fall.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  }
}

/** Every bulb and every sampled rope point uses this same physical position. */
export function tornRopePointAt(x: number, row: number, clock: number, curve: GarlandCurve) {
  const baseline = 230 + row * 210
  const baseY = baseline + garlandDropAt(x, curve)
  const stretch = 62 * smooth((clock - ROPE_IMPACTS[row]) / (ROPE_TEARS[row] - ROPE_IMPACTS[row]))
  const weight = Math.max(0, 1 - Math.abs(x - CUT_X) / 330)
  const y = baseY + stretch * weight
  const released = Math.max(0, clock - ROPE_TEARS[row])
  if (!released) return { x, y, angle: 0 }

  const side = x <= CUT_X ? -1 : 1
  const anchorX = side === -1 ? curve.left : curve.right
  const anchor = anchorAt(anchorX, baseline, clock, side)
  const along = Math.abs(x - anchorX) / Math.abs(CUT_X - anchorX)
  const angle = -side * Math.min(1.3, released * 2.1)
  const dx = x - anchorX
  const dy = y - baseline
  return {
    x: anchor.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: anchor.y + dx * Math.sin(angle) + dy * Math.cos(angle) + 360 * released ** 2 * along,
    angle: -side * Math.min(36, released * 80) * along,
  }
}

export function tornRopePathAt(row: number, clock: number, curve: GarlandCurve) {
  const points = (from: number, to: number) => Array.from({ length: 23 }, (_, i) => {
    const p = tornRopePointAt(mix(from, to, i / 22), row, clock, curve)
    return `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  }).join(' ')
  if (clock < ROPE_TEARS[row]) return points(curve.left, curve.right)
  // Separate subpaths leave a real break. Neither half stretches across the cut.
  return `${points(curve.left, CUT_X - 7)} ${points(CUT_X + 7, curve.right)}`
}

export const ropeDebrisOpacity = (clock: number, row: number) => 1 - smooth((clock - ROPE_TEARS[row] - 0.7) / 0.4)
export const ropePowerAt = (clock: number, row: number) => 1 - smooth((clock - ROPE_TEARS[row]) / 0.12)

export type EndpointKind = 'ios' | 'android' | 'duo' | 'web'
export type EndpointSpec = { id: string; kind: EndpointKind; label: string; x: number; y: number; w: number; h: number; angle: number; delay: number; navigation?: 'three-button'; notch?: 'wide' | 'narrow' }

export const ENDPOINTS: readonly EndpointSpec[] = [
  // Apple's closed-body proportions: 84.1 mm wide × 117.8 mm tall.
  { id: 'duo', kind: 'duo', label: 'iPhone Duo', x: 568, y: 544, w: 192 * 84.1 / 117.8, h: 192, angle: -4, delay: 0 },
  { id: 'iphone', kind: 'ios', label: 'iPhone · iOS', x: 169, y: 298, w: 108, h: 210, angle: -7, delay: 0.48, notch: 'wide' },
  { id: 'android', kind: 'android', label: 'Android', x: 394, y: 297, w: 112, h: 214, angle: 5, delay: 0.62, navigation: 'three-button' },
  { id: 'browser', kind: 'web', label: 'Web browser', x: 691, y: 290, w: 274, h: 174, angle: -3, delay: 0.72 },
  { id: 'iphone-2', kind: 'ios', label: 'iPhone · iOS', x: 1046, y: 298, w: 110, h: 212, angle: 8, delay: 0.9, notch: 'narrow' },
  { id: 'browser-2', kind: 'web', label: 'Web browser', x: 228, y: 546, w: 266, h: 166, angle: 3, delay: 0.58 },
  { id: 'android-2', kind: 'android', label: 'Android', x: 901, y: 543, w: 108, h: 206, angle: -7, delay: 0.84, navigation: 'three-button' },
  { id: 'iphone-3', kind: 'ios', label: 'iPhone · iOS', x: 1120, y: 549, w: 102, h: 198, angle: 7, delay: 1.03 },
]

/** The leading foldable loads both ropes before breaking through them. */
function leadDeviceY(clock: number) {
  const beats = [0, ROPE_IMPACTS[0], ROPE_TEARS[0], ROPE_IMPACTS[1], ROPE_TEARS[1], 1.59]
  const positions = [-210, 173, 235, 383, 445, 544]
  for (let i = 1; i < beats.length; i++) {
    if (clock <= beats[i]) {
      const t = clamp((clock - beats[i - 1]) / (beats[i] - beats[i - 1]))
      return mix(positions[i - 1], positions[i], i === 1 || i === 3 || i === 5 ? t * t : smooth(t))
    }
  }
  const bounce = clamp((clock - 1.59) / 0.62)
  return 544 - Math.abs(Math.sin(bounce * Math.PI * 2)) * 30 * (1 - bounce)
}

export function endpointPoseAt(clock: number, index: number) {
  const device = ENDPOINTS[index]
  if (index === 0) return { x: device.x, y: leadDeviceY(clock), angle: mix(-16, device.angle, smooth(clock / 1.6)) }
  const time = Math.max(0, clock - device.delay)
  const duration = 0.93
  const fall = clamp(time / duration)
  const bounce = clamp((time - duration) / 0.52)
  const drift = (index % 2 ? -1 : 1) * (48 + index * 6)
  return {
    x: device.x + drift * (1 - smooth(fall)),
    y: mix(-device.h - 100, device.y, fall * fall) - Math.abs(Math.sin(bounce * Math.PI * 2)) * 28 * (1 - bounce),
    angle: device.angle + (index % 2 ? 25 : -28) * (1 - smooth(fall)) + Math.sin(bounce * Math.PI * 2) * 5 * (1 - bounce),
  }
}

/** Shuffle once per incoming call; every endpoint gets exactly one turn. */
export function shuffleEndpointOrder() {
  const order = ENDPOINTS.map((_, index) => index)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}
export const RING_INTERVAL = 0.28
export const RING_DURATION = (ENDPOINTS.length - 1) * RING_INTERVAL + 0.38
export const ANSWER_DURATION = 0.65

export function endpointCallAt(clock: number, index: number, winner: number, ringOrder: readonly number[]) {
  const ring = smooth((clock - ringOrder.indexOf(index) * RING_INTERVAL) / 0.3)
  const answered = smooth((clock - RING_DURATION) / ANSWER_DURATION)
  const picked = index === winner
  return { ring, answered, picked, light: ring * (picked ? 1 : 1 - answered * 0.86) }
}
