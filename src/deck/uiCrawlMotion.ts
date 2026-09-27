export type Point = { x: number; y: number }
export type Rect = Point & { width: number; height: number }
export const CRAWL_DURATION = 3.6
export const CRAWL_DELAYS = [0, 0.12, 0.24]
export const CRAWL_END = CRAWL_DURATION + CRAWL_DELAYS[2] + 0.2
const CRAWL_HEIGHT = 720
export const clamp = (n: number) => Math.max(0, Math.min(1, n))
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t

export const crawlAt = (seconds: number, part: number) => clamp((seconds - CRAWL_DELAYS[part]) / CRAWL_DURATION)
// Let the pieces climb toward the top first, then follow them one slide up.
export const crawlCamera = (seconds: number) => CRAWL_HEIGHT * smooth((seconds - 1) / 2.05)
export const cardArrival = (seconds: number, part: number) => smooth((crawlAt(seconds, part) - 0.94) / 0.06)

export type CrawlShape = { points: Point[]; center: Point; target: Point[]; destination: Point; part: number }

/** Four upward inchworm strides: the body arches as its front and tail gather. */
export function crawlOutline(seconds: number, shape: CrawlShape): Point[] {
  const u = crawlAt(seconds, shape.part)
  const t = clamp((u - 0.08) / 0.7)
  const phase = t * Math.PI * 8
  const travel = t - Math.sin(phase) / (Math.PI * 8)
  const detach = smooth(u / 0.12)
  const morph = smooth((u - 0.8) / 0.2)
  const arch = Math.sin(phase / 2) ** 2 * (1 - morph)
  const rotation = (shape.part === 0 ? -41 : 0) * Math.PI / 180 * detach
  const cos = Math.cos(rotation), sin = Math.sin(rotation)
  const direction = shape.part === 2 ? 1 : -1
  const center = {
    x: mix(shape.center.x, shape.destination.x, smooth(t)) + direction * 28 * Math.sin(Math.PI * travel),
    y: mix(shape.center.y, shape.destination.y - CRAWL_HEIGHT, travel),
  }
  const halfLength = shape.part === 0 ? 48 : 61
  return shape.points.map((point, i) => {
    const dx = point.x - shape.center.x, dy = point.y - shape.center.y
    const along = -(dx * sin + dy * cos)
    const across = dx * cos - dy * sin
    const body = {
      x: center.x + across * (1 + 0.12 * arch) + direction * 27 * arch * Math.max(0, 1 - (along / halfLength) ** 2),
      y: center.y - along * (1 - 0.38 * arch),
    }
    return {
      x: mix(body.x, shape.target[i].x, morph),
      y: mix(body.y, shape.target[i].y - CRAWL_HEIGHT, morph) + crawlCamera(seconds),
    }
  })
}

/** A closed Catmull–Rom contour keeps both the logo and card corners smooth. */
export function outlinePath(points: Point[]) {
  const n = points.length
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const a = points[(i + n - 1) % n], b = points[i], c = points[(i + 1) % n], e = points[(i + 2) % n]
    d += ` C ${(b.x + (c.x - a.x) / 6).toFixed(2)} ${(b.y + (c.y - a.y) / 6).toFixed(2)} ${(c.x - (e.x - b.x) / 6).toFixed(2)} ${(c.y - (e.y - b.y) / 6).toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`
  }
  return `${d} Z`
}

export function bounds(points: Point[]): Rect {
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y))
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y }
}

/** Keep winding and contour correspondence, so the outline opens without twisting. */
export function alignContour(source: Point[], target: Point[]) {
  const normalized = (points: Point[]) => {
    const box = bounds(points)
    return points.map(p => ({ x: (p.x - box.x) / box.width - 0.5, y: (p.y - box.y) / box.height - 0.5 }))
  }
  const area = (points: Point[]) => points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]
    return sum + p.x * q.y - q.x * p.y
  }, 0)
  const ordered = area(source) * area(target) < 0 ? [...target].reverse() : target
  const a = normalized(source), b = normalized(ordered)
  let shift = 0, best = Infinity
  for (let k = 0; k < a.length; k++) {
    const score = a.reduce((sum, p, i) => {
      const q = b[(i + k) % b.length]
      return sum + (p.x - q.x) ** 2 + (p.y - q.y) ** 2
    }, 0)
    if (score < best) { best = score; shift = k }
  }
  return ordered.map((_, i) => ordered[(i + shift) % ordered.length])
}
