/** Geometry shared by the balloon and its string. Coordinates are stage px. */
export type Point = { x: number; y: number }
export type BalloonPose = Point & { scale: number; rot: number; shape: number }

export const FLIGHT_HEIGHT = 720
export const BALLOON_DESTINATION = { x: 640, y: 280 }
export const BALLOON_TIMING = { gather: 0.18, inflate: 0.9, rise: 2.5, release: 0.12 } as const
export const BALLOON_DURATION = BALLOON_TIMING.gather + BALLOON_TIMING.inflate + BALLOON_TIMING.rise

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }

/** The same Catmull–Rom curve used by the vessel's visible outline. */
function pointOnOutline(points: Point[], fraction: number): Point {
  const f = fraction * points.length
  const i = Math.floor(f)
  const t = f - i
  const at = (n: number) => points[(n + points.length) % points.length]
  const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2)
  const coord = (key: 'x' | 'y') => 0.5 * (
    2 * b[key] + (-a[key] + c[key]) * t +
    (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t * t +
    (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t * t * t
  )
  return { x: coord('x'), y: coord('y') }
}

/** The attachment travels around the lower-left edge, from the old line to the knot. */
export function balloonAttachment(shape: number, ring: Point[], balloon: Point[]): Point {
  const s = clamp(shape)
  const points = ring.map((p, i) => ({ x: mix(p.x, balloon[i].x, s), y: mix(p.y, balloon[i].y, s) }))
  return pointOnOutline(points, mix(0.75, 0.5, smooth(s)))
}

export function toStage(point: Point, pose: Pick<BalloonPose, 'x' | 'y' | 'scale' | 'rot'>): Point {
  const angle = pose.rot * Math.PI / 180
  const cos = Math.cos(angle), sin = Math.sin(angle)
  return {
    x: pose.x + (point.x * cos - point.y * sin) * pose.scale,
    y: pose.y + (point.x * sin + point.y * cos) * pose.scale,
  }
}

/** One clock drives inflation, buoyancy, sway and release; none can drift apart. */
export function balloonFrame(seconds: number, origin: Point, ring: Point[], balloon: Point[]) {
  const { gather, inflate, rise, release } = BALLOON_TIMING
  const shape = smooth((seconds - gather) / inflate)
  const u = clamp((seconds - gather - inflate) / rise)
  const attachment = balloonAttachment(shape, ring, balloon)
  const scale = 1 + 0.035 * Math.sin(Math.PI * shape)
  const rot = -4 * Math.sin(2 * Math.PI * u) * Math.sin(Math.PI * u)
  // A small pressure overshoot is anchored at the knot, never at the centre.
  const offset = toStage(attachment, { x: 0, y: 0, scale, rot })
  const sway = 28 * Math.sin(2 * Math.PI * u) * Math.sin(Math.PI * u) ** 2
  const travel = smooth(u)
  // The vendor lives one viewport above the phone in the same world.
  const lift = (origin.y - (BALLOON_DESTINATION.y - FLIGHT_HEIGHT + attachment.y)) * travel
  return {
    x: mix(origin.x, BALLOON_DESTINATION.x, travel) + attachment.x * scale + sway - offset.x,
    y: origin.y - lift - offset.y,
    scale, rot, shape: shape + smooth((u - 0.72) / 0.28),
    glow: smooth(seconds / gather),
    tether: 1 - smooth((u - release) / 0.24),
    // The camera catches up after lift-off; the balloon never leaves the view.
    cameraY: FLIGHT_HEIGHT * smooth((u - 0.12) / 0.88),
    advance: u >= 1,
  }
}

/** Release travels down the flexible string; its tail follows the balloon late. */
export function balloonString(
  pose: BalloonPose,
  tether: number,
  from: Point,
  ring: Point[],
  balloon: Point[],
  seconds = 0,
  origin: Point = pose,
): Point[] {
  const knot = toStage(balloonAttachment(pose.shape, ring, balloon), pose)
  // Close the connector's original 14px clearance as the knot forms.
  const start = { x: knot.x - 14 * (1 - clamp(pose.shape)), y: knot.y }
  const u = clamp((seconds - BALLOON_TIMING.gather - BALLOON_TIMING.inflate) / BALLOON_TIMING.rise)
  const previous = balloonFrame(Math.max(0, seconds - 0.24), origin, ring, balloon)
  const settling = 1 - smooth((u - 0.8) / 0.2)
  const lag = Math.max(-65, Math.min(85, previous.x - pose.x)) * settling
  const lift = Math.max(0, from.y - knot.y)
  const sag = Math.min(42, lift * 0.35)
  return Array.from({ length: 33 }, (_, i) => {
    const s = i / 32
    // The knot responds first. The loose end briefly keeps its old direction.
    const released = smooth((1 - tether) * 1.6 - s * 0.6)
    const tied = {
      x: mix(start.x, from.x, s),
      y: mix(start.y, from.y, s) + sag * Math.sin(Math.PI * s),
    }
    const flutter = 8 * Math.sin(u * Math.PI * 3 - s * 2.5) * Math.sin(Math.PI * u) * settling
    const free = {
      x: start.x + lag * s * s + flutter * s * s,
      y: start.y + 160 * pose.scale * s,
    }
    return { x: mix(tied.x, free.x, released), y: mix(tied.y, free.y, released) }
  })
}

/** Clawd catches the loose end as it pulls away from the previous ring. */
export function balloonPassenger(points: Point[], from: Point, shape: number) {
  const grip = points[points.length - 1]
  const previous = points[points.length - 3]
  const pulled = Math.hypot(grip.x - from.x, grip.y - from.y)
  const angle = Math.atan2(previous.y - grip.y, previous.x - grip.x) * 180 / Math.PI
  return {
    ...grip,
    rot: Math.max(-75, Math.min(25, angle)),
    opacity: smooth(pulled / 28) * (1 - smooth((shape - 1.8) / 0.2)),
  }
}
