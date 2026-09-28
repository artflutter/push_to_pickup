import { ENDPOINTS } from './endpointMotion'

// Reference: nyan.cat — saturated, stepped stripes and a 12 × 70 ms sprite loop.
export const NYAN_FRAME_MS = 70
export const RAINBOW_ENTRY = 1.15
export const RAINBOW_Y = 405
export const RAINBOW_COLORS = ['#ff0000', '#ff9900', '#ffff00', '#33ff00', '#0099ff', '#6633ff']
export const CHECKPOINTS = [
  { x: 300, amplitude: 0.94, lines: ['Server', 'processing'] },
  { x: 650, amplitude: 1.84, lines: ['Push delivery'] },
  { x: 1000, amplitude: 1.33, lines: ['On-device', 'call processing'] },
] as const
const clamp = (v: number) => Math.max(0, Math.min(1, v))
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t
// Keep the approved narrow heartbeat shape; soften its timing, not its geometry.
const HEARTBEAT = [[-72, 0], [-44, 0], [-34, -10], [-22, 14], [-6, -54], [12, 46], [28, -12], [40, 0], [72, 0]] as const

function heartbeatAt(x: number) {
  for (let index = 0; index < CHECKPOINTS.length; index++) {
    const local = x - 1280 - CHECKPOINTS[index].x
    if (local < -72 || local > 72) continue
    for (let i = 1; i < HEARTBEAT.length; i++) {
      const [ax, ay] = HEARTBEAT[i - 1]
      const [bx, by] = HEARTBEAT[i]
      if (local <= bx) return {
        index,
        offset: mix(ay, by, (local - ax) / (bx - ax)) * CHECKPOINTS[index].amplitude,
        linear: local > -72,
        quiet: clamp((72 - Math.abs(local)) / 28),
      }
    }
  }
  return { index: -1, offset: 0, linear: false, quiet: 0 }
}

// Ease down to 1/3.5 speed through each spike, then return to the usual cruise.
// Precompute time by distance so forward/backward playback uses the same path.
const RUN_TIMELINE = (() => {
  const points = [{ x: 1420, time: 0 }]
  const pace = (x: number) => 1 + 2.5 * smooth(heartbeatAt(x - 5.2 * 7).quiet)
  for (let x = 1422; x <= 2460; x += 2) {
    const previous = points[points.length - 1]
    points.push({ x, time: previous.time + 2 / 440 * (pace(previous.x) + pace(x)) / 2 })
  }
  return points
})()
function runX(elapsed: number) {
  const index = RUN_TIMELINE.findIndex(point => point.time >= elapsed)
  if (index < 0) return 2460
  if (index === 0) return 1420
  const a = RUN_TIMELINE[index - 1]
  const b = RUN_TIMELINE[index]
  return mix(a.x, b.x, (elapsed - a.time) / (b.time - a.time))
}
export const RAINBOW_RUN_END = RAINBOW_ENTRY + RUN_TIMELINE[RUN_TIMELINE.length - 1].time
// Arrival runs the whole flight. Each next click reveals one checkpoint label.
export const RAINBOW_CUES = Array.from({ length: CHECKPOINTS.length + 1 }, (_, i) => RAINBOW_RUN_END + i * 0.42)
export const rainbowCamera = (clock: number) => 1280 * smooth((clock - 0.18) / 0.87)

/** Start at the connected mascot, including its phone's tilt. */
export function rainbowOrigin(winner: number) {
  const d = ENDPOINTS[winner]
  const localY = d.kind === 'web' ? -5 : -17
  const a = d.angle * Math.PI / 180
  return { x: d.x - localY * Math.sin(a), y: d.y + localY * Math.cos(a), angle: d.angle }
}
/** Freeze the wake in world coordinates; only its pixel ripple and revealed length move. */
export function makeRainbowFlight(winner: number) {
  const origin = rainbowOrigin(winner)
  const samples = new Set<number>([origin.x])
  for (let x = Math.ceil((origin.x + 16) / 16) * 16; x <= 2560; x += 16) {
    samples.add(x)
  }
  for (const checkpoint of CHECKPOINTS) {
    for (const [x] of HEARTBEAT) samples.add(1280 + checkpoint.x + x)
  }
  const points = [...samples].sort((a, b) => a - b).map(x => {
    const progress = clamp((x - origin.x) / (1420 - origin.x))
    // Invert the launch's smoothstep to recover the height where Clawd passed.
    const time = 0.08 + (RAINBOW_ENTRY - 0.08) * (0.5 - Math.sin(Math.asin(1 - 2 * progress) / 3))
    const y = mix(origin.y, RAINBOW_Y, smooth(time / 0.65))
    return { x, y: x === origin.x ? origin.y : time >= 0.65 ? RAINBOW_Y : Math.round(y / 4) * 4, beat: heartbeatAt(x) }
  })
  return { origin, points, trailCache: new Map<number, string[]>() }
}
export type RainbowFlight = ReturnType<typeof makeRainbowFlight>

/** Each stripe records the jump; its leading edge reveals the spike as Clawd flies. */
export function rainbowTrails(flight: RainbowFlight, phase: number) {
  const cached = flight.trailCache.get(phase)
  if (cached) return cached
  const centre = flight.points.map(p => {
    const ripple = Math.floor((p.x + phase * 16) / 48) % 2 * 4 *
      clamp((p.x - flight.origin.x) / 48) * (1 - p.beat.quiet)
    return { x: p.x, y: p.y + p.beat.offset - ripple, linear: p.beat.linear }
  })
  const trails = RAINBOW_COLORS.map((_, band) => {
    const top = centre.map(p => ({ ...p, y: p.y - 28 + band * 8 }))
    const forward = top.slice(1).map(p => p.linear ? `L ${p.x} ${p.y}` : `H ${p.x} V ${p.y}`).join(' ')
    const backward = top.slice(0, -1).map((p, i) => top[i + 1].linear
      ? `L ${p.x} ${p.y + 8}` : `V ${p.y + 8} H ${p.x}`).reverse().join(' ')
    return `M ${top[0].x} ${top[0].y} ${forward} V ${top[top.length - 1].y + 8} ${backward} Z`
  })
  // The six pixel ripple frames are reused; finished spikes never morph afterward.
  flight.trailCache.set(phase, trails)
  return trails
}

/** Jump through each heartbeat, keeping the exhaust attached to Clawd's trailing edge. */
export function rainbowFrame(clock: number, flight: RainbowFlight) {
  const launch = smooth((clock - 0.08) / (RAINBOW_ENTRY - 0.08))
  const x = clock <= RAINBOW_ENTRY
    ? mix(flight.origin.x, 1420, launch)
    : runX(clock - RAINBOW_ENTRY)
  const scale = mix(3.2, 5.2, smooth(clock / 0.45))
  const jump = heartbeatAt(x - scale * 7)
  return {
    x,
    y: mix(flight.origin.y, RAINBOW_Y, smooth(clock / 0.65)) + jump.offset,
    angle: mix(flight.origin.angle, 0, smooth(clock / 0.2)),
    scale,
    bob: 1 - jump.quiet,
    tailStart: flight.origin.x,
    camera: rainbowCamera(clock),
  }
}

/** Discrete poses, deliberately independent of the slide's click/flight clock. */
export function nyanPose(frame: number) {
  const i = frame % 12
  return {
    x: [0, 0, 0, 2, 2, 2, 0, 0, 0, -2, -2, -2][i],
    y: [0, 0, -4, -4, -4, 0, 0, 0, 4, 4, 4, 0][i],
    aX: [0, -1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1][i],
    aY: [0, 0, -1, -1, -1, 0, 0, 0, -1, -1, -1, 0][i],
    bX: [0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, -1][i],
    bY: [-1, -1, 0, 0, 0, -1, -1, -1, 0, 0, 0, -1][i],
  }
}

export const rainbowLabels = (clock: number, index: number) =>
  smooth((clock - RAINBOW_CUES[index]) / (RAINBOW_CUES[index + 1] - RAINBOW_CUES[index]))
