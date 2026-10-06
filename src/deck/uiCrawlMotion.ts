export type Point = { x: number; y: number }
export type Rect = Point & { width: number; height: number }
export const SNAKE_CELL = 40
export const clamp = (n: number) => Math.max(0, Math.min(1, n))
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** Three connected grid cells; the tail follows the head around each corner. */
export function snakeBody(route: Point[], tick: number, origin: Point): Point[] {
  const cells = Array.from({ length: 3 }, (_, i) => tick >= i ? route[tick - i] : { x: 0, y: i - tick })
  const key = (p: Point) => `${p.x},${p.y}`
  const occupied = new Set(cells.map(key))
  const edges = new Map<string, { from: Point; to: Point }>()
  for (const cell of cells) {
    const left = 2 * cell.x - 1, right = left + 2, top = 2 * cell.y - 1, bottom = top + 2
    const sides = [
      [{ x: 0, y: -1 }, { x: left, y: top }, { x: right, y: top }],
      [{ x: 1, y: 0 }, { x: right, y: top }, { x: right, y: bottom }],
      [{ x: 0, y: 1 }, { x: right, y: bottom }, { x: left, y: bottom }],
      [{ x: -1, y: 0 }, { x: left, y: bottom }, { x: left, y: top }],
    ]
    for (const [neighbor, from, to] of sides) {
      if (!occupied.has(key({ x: cell.x + neighbor.x, y: cell.y + neighbor.y }))) edges.set(key(from), { from, to })
    }
  }
  const first = edges.values().next().value!
  const polygon: Point[] = []
  let edge = first
  do {
    polygon.push({ x: origin.x + edge.from.x * SNAKE_CELL / 2, y: origin.y + edge.from.y * SNAKE_CELL / 2 })
    edge = edges.get(key(edge.to))!
  } while (edge !== first)
  const lengths = polygon.map((p, i) => Math.hypot(p.x - polygon[(i + 1) % polygon.length].x, p.y - polygon[(i + 1) % polygon.length].y))
  const perimeter = lengths.reduce((a, b) => a + b, 0)
  return Array.from({ length: 96 }, (_, i) => {
    let distance = perimeter * i / 96, segment = 0
    while (segment < lengths.length - 1 && distance >= lengths[segment]) distance -= lengths[segment++]
    const a = polygon[segment], b = polygon[(segment + 1) % polygon.length], t = distance / lengths[segment]
    return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) }
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
