import { useId, type CSSProperties } from 'react'

/* Tiny isometric line renderer for LEGO-style bricks.
   Geometry is built in stud units — p along the length, q along the width,
   z up — and projected with p → (0.866, −0.5), q → (−0.866, −0.5), z → (0, −1),
   the same angle as a product shot. A shape is a list of parts in
   back-to-front order: a convex polyhedron (back-face culling is its
   hidden-line removal), a cylinder/cone, a dome, or plain cosmetic lines.
   Every part is masked by the silhouettes of the parts in front of it, so
   nothing shows through. Strokes don't scale, so `fit` can size any shape to
   the same square. */

type V3 = [number, number, number]
type Pt = [number, number]
type Plane = 'pq' | 'pz' | 'qz'

const AX = 0.866
const AY = 0.5
const VIEW: V3 = [1, 1, -1] // the camera looks along +p, +q, −z

const proj = ([p, q, z]: V3): Pt => [(p - q) * AX, -((p + q) * AY + z)]
const f = (n: number) => +n.toFixed(3)
const pt = ([x, y]: Pt) => `${f(x)} ${f(y)}`
const path = (pts: Pt[], close = false) => `M${pts.map(pt).join(' L')}${close ? ' Z' : ''}`
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const rad = (deg: number) => (deg * Math.PI) / 180

interface Part {
  /** stroked paths */
  lines: string[]
  /** closed paths that hide whatever is behind this part */
  solid: string[]
  /** projected points, for the bounding box */
  pts: Pt[]
}

/** Convex polyhedron. Face winding doesn't matter: normals are pointed away from the centroid. */
function poly(v: V3[], faces: number[][]): Part {
  const c: V3 = [0, 0, 0]
  for (const p of v) for (let k = 0; k < 3; k++) c[k] += p[k] / v.length
  const lines: string[] = []
  for (const face of faces) {
    const n: V3 = [0, 0, 0]
    const fc: V3 = [0, 0, 0]
    for (let i = 0; i < face.length; i++) {
      const a = v[face[i]]
      const b = v[face[(i + 1) % face.length]]
      n[0] += (a[1] - b[1]) * (a[2] + b[2])
      n[1] += (a[2] - b[2]) * (a[0] + b[0])
      n[2] += (a[0] - b[0]) * (a[1] + b[1])
      for (let k = 0; k < 3; k++) fc[k] += a[k] / face.length
    }
    const out = dot(n, sub(fc, c)) < 0 ? ([-n[0], -n[1], -n[2]] as V3) : n
    if (dot(out, VIEW) >= -1e-6) continue // back-facing or edge-on
    lines.push(path(face.map((i) => proj(v[i])), true))
  }
  return { lines, solid: lines, pts: v.map(proj) }
}

/** A 2D polygon in one plane, extruded along the third axis. */
function prism(shape: Pt[], plane: Plane, from: number, to: number): Part {
  const lift = ([s, t]: Pt, d: number): V3 => (plane === 'pq' ? [s, t, d] : plane === 'pz' ? [s, d, t] : [d, s, t])
  const n = shape.length
  const v = [...shape.map((p) => lift(p, from)), ...shape.map((p) => lift(p, to))]
  const faces: number[][] = [shape.map((_, i) => i), shape.map((_, i) => n + i)]
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i])
  return poly(v, faces)
}

const box = (p0: number, q0: number, z0: number, p1: number, q1: number, z1: number) =>
  prism(
    [
      [p0, q0],
      [p1, q0],
      [p1, q1],
      [p0, q1],
    ],
    'pq',
    z0,
    z1,
  )

/** Points of a circle spanned by e1/e2 around c, from angle a0 to a1 (degrees, either direction). */
function ringV(c: V3, e1: V3, e2: V3, r: number, a0 = 0, a1 = 360, steps = 32): Pt[] {
  const n = Math.max(2, Math.round((Math.abs(a1 - a0) / 360) * steps))
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n)
    const co = Math.cos(a) * r
    const si = Math.sin(a) * r
    out.push(proj([c[0] + e1[0] * co + e2[0] * si, c[1] + e1[1] * co + e2[1] * si, c[2] + e1[2] * co + e2[2] * si]))
  }
  return out
}
/** Circle in an axis plane. */
const ring = (c: V3, plane: Plane, r: number, a0 = 0, a1 = 360, steps = 24) =>
  ringV(c, plane === 'qz' ? [0, 1, 0] : [1, 0, 0], plane === 'pq' ? [0, 1, 0] : [0, 0, 1], r, a0, a1, steps)

/** Cylinder or truncated cone from c0 to c1 along an axis-aligned direction. */
function tube(c0: V3, c1: V3, r0: number, r1 = r0): Part {
  const d = sub(c1, c0)
  const len = Math.hypot(d[0], d[1], d[2])
  const ax: V3 = [d[0] / len, d[1] / len, d[2] / len]
  const e1: V3 = Math.abs(ax[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0]
  const e2: V3 = Math.abs(ax[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]
  /* the far rim is visible where its surface faces the camera; the two
     silhouette lines sit at the ends of that half */
  const tv = (Math.atan2(-dot(e2, VIEW), -dot(e1, VIEW)) * 180) / Math.PI
  const near0 = dot(ax, VIEW) > 0
  const [cn, cf, rn, rf] = near0 ? [c0, c1, r0, r1] : [c1, c0, r1, r0]
  const R = (c: V3, r: number, a0: number, a1: number) => ringV(c, e1, e2, r, a0, a1)
  const near = R(cn, rn, 0, 360)
  const farArc = R(cf, rf, tv - 90, tv + 90)
  const nearHidden = R(cn, rn, tv + 90, tv + 270)
  return {
    lines: [path(near, true), path(farArc), path([nearHidden[0], farArc[farArc.length - 1]]), path([nearHidden[nearHidden.length - 1], farArc[0]])],
    solid: [path([...nearHidden, ...farArc], true)],
    pts: [...near, ...R(cf, rf, 0, 360)],
  }
}
const cyl = (cp: number, cq: number, z0: number, z1: number, r: number, rTop = r) => tube([cp, cq, z0], [cp, cq, z1], r, rTop)

/** Sphere: an orthographic projection keeps it a circle. */
function ball(c: V3, r: number): Part {
  const [cx, cy] = proj(c)
  const R = r * Math.SQRT1_2 * 2 * AX
  const pts: Pt[] = []
  for (let i = 0; i < 32; i++) pts.push([cx + R * Math.cos((Math.PI * i) / 16), cy + R * Math.sin((Math.PI * i) / 16)])
  const d = path(pts, true)
  return { lines: [d], solid: [d], pts }
}

/** Hemisphere sitting on z0. The projection is orthographic, so its outline is a circle. */
function dome(cp: number, cq: number, z0: number, r: number): Part {
  const [cx, cy] = proj([cp, cq, z0])
  const R = r * Math.SQRT1_2 * 2 * AX // = 1.2247 r, the projected radius
  const upper: Pt[] = []
  for (let i = 0; i <= 24; i++) {
    const a = (Math.PI * i) / 24
    upper.push([cx - R * Math.cos(a), cy - R * Math.sin(a)])
  }
  const base = ring([cp, cq, z0], 'pq', r, 315, 135)
  return {
    lines: [path(upper), path(base)],
    solid: [path([...upper, ...base], true)],
    pts: [...upper, ...ring([cp, cq, z0], 'pq', r)],
  }
}

/** Lines only — grooves, holes, an arch opening. Hide nothing, never hidden. */
const marks = (paths: Pt[][], closed = false): Part => ({
  lines: paths.map((p) => path(p, closed)),
  solid: [],
  pts: paths.flat(),
})

/* -------------------------------------------------------------- catalogue --- */
const BH = 1.2 // brick height
const PH = 0.4 // plate height
const SR = 0.3 // stud radius
const SH = 0.2 // stud height

const stud = (p: number, q: number, z: number) => cyl(p, q, z, z + SH, SR)
/** Studs sorted back to front so each masks only what is behind it. */
const studs = (pos: Pt[], z: number) =>
  [...pos].sort((a, b) => b[0] + b[1] - (a[0] + a[1])).map(([p, q]) => stud(p, q, z))
const grid = (L: number, W: number, p0 = 0, q0 = 0): Pt[] => {
  const out: Pt[] = []
  for (let j = 0; j < W; j++) for (let i = 0; i < L; i++) out.push([p0 + i + 0.5, q0 + j + 0.5])
  return out
}
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

const brick = (L: number, W: number, h = BH) => [box(0, 0, 0, L, W, h), ...studs(grid(L, W), h)]
const plate = (L: number, W: number) => brick(L, W, PH)
const tile = (L: number, W: number) => [box(0, 0, 0, L, W, PH)]
/** Flat back of `flat` studs, then a straight slope down to a `lip`-high front. */
const slope = (L: number, W: number, flat = 1, lip = 0.3, h = BH) => [
  prism(
    [
      [0, 0],
      [W, 0],
      [W, h],
      [W - flat, h],
      [0, lip],
    ],
    'qz',
    0,
    L,
  ),
  ...studs(
    range(L).flatMap((i) => range(Math.floor(flat)).map((j): Pt => [i + 0.5, W - flat + j + 0.5])),
    h,
  ),
]
/** Quarter-ellipse profile from the back top down to a low front, W deep. */
const curve = (W: number): Pt[] => {
  const profile: Pt[] = [
    [0, 0],
    [W, 0],
  ]
  for (let i = 0; i <= 8; i++) {
    const a = rad(90 - (90 * i) / 8)
    profile.push([W - W * Math.cos(a), 0.25 + 0.95 * Math.sin(a)])
  }
  return profile
}
const rect = (a: V3, b: V3, c: V3, d: V3): Pt[] => [proj(a), proj(b), proj(c), proj(d)]
const seg = (a: V3, b: V3): Pt[] => [proj(a), proj(b)]

export const BRICK_KINDS = [
  'brick 1x1',
  'brick 1x2',
  'brick 1x6',
  'brick 2x2',
  'brick 2x4',
  'brick 1x2 tall',
  'plate 1x2',
  'plate 2x2',
  'plate 4x4',
  'tile 2x2',
  'grille 1x2',
  'jumper 1x2',
  'round 1x1',
  'round 2x2',
  'cone 1x1',
  'cone 2x2',
  'dome 2x2',
  'slope 2x2',
  'slope 1x2',
  'slope 1x3',
  'cheese 1x1',
  'inverted 2x2',
  'ridge 2x2',
  'pyramid 2x2',
  'curved 1x2',
  'corner 2x2',
  'wedge 2x3',
  'technic 1x2',
  'arch 1x4',
  'bracket 1x2',
  // 31–60
  'brick 1x4',
  'brick 1x8',
  'brick 2x6',
  'brick 4x4',
  'column 1x1x3',
  'tower 2x2x3',
  'round 2x2x2',
  'cone 4x4',
  'dome 4x4',
  'ball 2x2',
  'plate 1x1',
  'plate 1x4',
  'plate 2x6',
  'plate 4x6',
  'baseplate 6x6',
  'round plate 2x2',
  'tile 1x1',
  'tile 2x4',
  'round tile 1x1',
  'slope 45 2x4',
  'slope 33 2x3',
  'slope 18 2x4',
  'steep 1x2x2',
  'inverted 33 1x3',
  'corner slope 2x2',
  'frustum 2x2',
  'curved 1x4',
  'curved 1x1',
  'windscreen 2x4x2',
  'barrel 2x2',
  // 61–90
  'bucket 2x2',
  'dish 3x3',
  'pulley',
  'gear',
  'axle 4',
  'wheel',
  'tire',
  'roller 2x4',
  'hinge 1x2',
  'side stud 1x1',
  'side studs 1x4',
  'headlight 1x1',
  'pin brick 2x2',
  'handle plate 1x2',
  'clip plate 1x1',
  'antenna 1x1',
  'turntable 2x2',
  'ring plate 4x4',
  'window 1x2x2',
  'door 1x3x4',
  'fence 1x4',
  'lattice 1x4',
  'stairs 2x3',
  'octagon 3x3',
  'hexagon plate',
  'triangle plate 2x2',
  'gem 1x1',
  'tee plate 3x2',
  'pine tree',
  'minifig head',
] as const

const SHAPES: Record<string, () => Part[]> = {
  'brick 1x1': () => brick(1, 1),
  'brick 1x2': () => brick(2, 1),
  'brick 1x6': () => brick(6, 1),
  'brick 2x2': () => brick(2, 2),
  'brick 2x4': () => brick(4, 2),
  'brick 1x2 tall': () => brick(2, 1, BH * 2),
  'plate 1x2': () => plate(2, 1),
  'plate 2x2': () => plate(2, 2),
  'plate 4x4': () => plate(4, 4),
  'tile 2x2': () => tile(2, 2),
  'grille 1x2': () => [
    ...tile(2, 1),
    marks([0.4, 0.8, 1.2, 1.6].map((p) => [proj([p, 0, PH]), proj([p, 1, PH])])),
  ],
  'jumper 1x2': () => [box(0, 0, 0, 2, 1, PH), stud(1, 0.5, PH)],
  'round 1x1': () => [cyl(0.5, 0.5, 0, BH, 0.5), stud(0.5, 0.5, BH)],
  'round 2x2': () => [cyl(1, 1, 0, BH, 1), ...studs(grid(2, 2), BH)],
  'cone 1x1': () => [cyl(0.5, 0.5, 0, BH, 0.5, 0.36), stud(0.5, 0.5, BH)],
  'cone 2x2': () => [cyl(1, 1, 0, BH * 2, 1, 0.36), stud(1, 1, BH * 2)],
  'dome 2x2': () => [cyl(1, 1, 0, PH, 1), dome(1, 1, PH, 1)],
  'slope 2x2': () => slope(2, 2),
  'slope 1x2': () => slope(1, 2),
  'slope 1x3': () => slope(1, 3),
  'cheese 1x1': () => [
    prism(
      [
        [0, 0],
        [1, 0],
        [1, 0.8],
        [0.6, 0.8],
        [0, 0.2],
      ],
      'qz',
      0,
      1,
    ),
  ],
  'inverted 2x2': () => [
    prism(
      [
        [1, 0],
        [2, 0],
        [2, BH],
        [0, BH],
        [0, 0.9],
      ],
      'qz',
      0,
      2,
    ),
    ...studs(grid(2, 2), BH),
  ],
  'ridge 2x2': () => [
    prism(
      [
        [0, 0],
        [2, 0],
        [2, 0.3],
        [1, BH],
        [0, 0.3],
      ],
      'qz',
      0,
      2,
    ),
  ],
  'pyramid 2x2': () => [
    box(0, 0, 0, 2, 2, PH),
    poly(
      [
        [0, 0, PH],
        [2, 0, PH],
        [2, 2, PH],
        [0, 2, PH],
        [1, 1, BH],
      ],
      [
        [0, 1, 2, 3],
        [0, 1, 4],
        [1, 2, 4],
        [2, 3, 4],
        [3, 0, 4],
      ],
    ),
  ],
  'curved 1x2': () => [prism(curve(2), 'qz', 0, 1)],
  'corner 2x2': () => [
    box(0, 1, 0, 2, 2, BH),
    ...studs(
      [
        [0.5, 1.5],
        [1.5, 1.5],
      ],
      BH,
    ),
    box(0, 0, 0, 1, 1, BH),
    stud(0.5, 0.5, BH),
  ],
  'wedge 2x3': () => [
    prism(
      [
        [0, 0],
        [3, 0],
        [3, 2],
        [1, 2],
        [0, 1],
      ],
      'pq',
      0,
      PH,
    ),
    ...studs(
      [
        [0.5, 0.5],
        [1.5, 0.5],
        [2.5, 0.5],
        [1.5, 1.5],
        [2.5, 1.5],
      ],
      PH,
    ),
  ],
  'technic 1x2': () => [
    ...brick(2, 1),
    marks(
      [0.5, 1.5].map((p) => ring([p, 0, 0.6], 'pz', 0.28)),
      true,
    ),
  ],
  'arch 1x4': () => {
    const arc: Pt[] = []
    for (let i = 0; i <= 16; i++) {
      const t = rad(180 - (180 * i) / 16)
      arc.push(proj([2 + 1.5 * Math.cos(t), 0, 0.55 + 0.45 * Math.sin(t)]))
    }
    return [...brick(4, 1), marks([[proj([0.5, 0, 0]), proj([0.5, 0, 0.55]), ...arc, proj([3.5, 0, 0])]])]
  },
  'bracket 1x2': () => [...plate(2, 1), box(0, -0.4, -0.8, 2, 0, PH)],

  /* 31–60 */
  'brick 1x4': () => brick(4, 1),
  'brick 1x8': () => brick(8, 1),
  'brick 2x6': () => brick(6, 2),
  'brick 4x4': () => brick(4, 4),
  'column 1x1x3': () => brick(1, 1, BH * 3),
  'tower 2x2x3': () => brick(2, 2, BH * 3),
  'round 2x2x2': () => [cyl(1, 1, 0, BH * 2, 1), ...studs(grid(2, 2), BH * 2)],
  'cone 4x4': () => [cyl(2, 2, 0, BH * 2, 2, 0.5), stud(2, 2, BH * 2)],
  'dome 4x4': () => [cyl(2, 2, 0, PH, 2), dome(2, 2, PH, 2)],
  'ball 2x2': () => [cyl(1, 1, 0, 0.3, 0.6), ball([1, 1, 1.1], 0.8)],
  'plate 1x1': () => plate(1, 1),
  'plate 1x4': () => plate(4, 1),
  'plate 2x6': () => plate(6, 2),
  'plate 4x6': () => plate(6, 4),
  'baseplate 6x6': () => brick(6, 6, 0.15),
  'round plate 2x2': () => [cyl(1, 1, 0, PH, 1), ...studs(grid(2, 2), PH)],
  'tile 1x1': () => tile(1, 1),
  'tile 2x4': () => tile(4, 2),
  'round tile 1x1': () => [cyl(0.5, 0.5, 0, PH, 0.5)],
  'slope 45 2x4': () => slope(4, 2),
  'slope 33 2x3': () => slope(2, 3),
  'slope 18 2x4': () => slope(4, 4, 1, 0.2, 0.8),
  'steep 1x2x2': () => slope(2, 1, 0.4, 0.3, BH * 2),
  'inverted 33 1x3': () => [
    prism(
      [
        [2, 0],
        [3, 0],
        [3, BH],
        [0, BH],
        [0, 0.9],
      ],
      'qz',
      0,
      1,
    ),
    ...studs(grid(1, 3), BH),
  ],
  'corner slope 2x2': () => [
    poly(
      [
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
        [1, 1, BH],
        [2, 1, BH],
        [2, 2, BH],
        [1, 2, BH],
      ],
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [3, 2, 6, 7],
        [1, 2, 6, 5],
        [0, 1, 5, 4],
        [0, 4, 7, 3],
      ],
    ),
    stud(1.5, 1.5, BH),
  ],
  'frustum 2x2': () => [
    poly(
      [
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
        [0.5, 0.5, BH],
        [1.5, 0.5, BH],
        [1.5, 1.5, BH],
        [0.5, 1.5, BH],
      ],
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
      ],
    ),
    stud(1, 1, BH),
  ],
  'curved 1x4': () => [prism(curve(4), 'qz', 0, 1)],
  'curved 1x1': () => [prism(curve(1), 'qz', 0, 1)],
  'windscreen 2x4x2': () => [
    ...slope(4, 2, 0.5, 0.3, BH * 2),
    marks([rect([0.4, 0.2, 0.58], [3.6, 0.2, 0.58], [3.6, 1.3, 2.12], [0.4, 1.3, 2.12])], true),
  ],
  'barrel 2x2': () => [cyl(1, 1, 0, 0.7, 0.8, 1), cyl(1, 1, 0.7, 1.4, 1, 0.8)],

  /* 61–90 */
  'bucket 2x2': () => [cyl(1, 1, 0, 1.4, 0.6, 0.95)],
  'dish 3x3': () => [cyl(1.5, 1.5, 0, 0.35, 0.5, 1.5)],
  pulley: () => [cyl(0.5, 0.5, 0, 0.3, 0.5, 0.3), cyl(0.5, 0.5, 0.3, 0.6, 0.3, 0.5)],
  gear: () => [
    cyl(1, 1, 0, PH, 0.9),
    marks(
      range(12).map((i) => {
        const a = rad(i * 30)
        return seg([1 + 0.65 * Math.cos(a), 1 + 0.65 * Math.sin(a), PH], [1 + 0.9 * Math.cos(a), 1 + 0.9 * Math.sin(a), PH])
      }),
    ),
    marks([ring([1, 1, PH], 'pq', 0.2)], true),
  ],
  'axle 4': () => [tube([0, 0.5, 0.15], [4, 0.5, 0.15], 0.12)],
  wheel: () => [
    tube([1, 0, 1], [1, 1, 1], 1),
    marks([ring([1, 0, 1], 'pz', 0.35)], true),
    marks(
      range(6).map((i) => {
        const a = rad(i * 60)
        return seg([1 + 0.35 * Math.cos(a), 0, 1 + 0.35 * Math.sin(a)], [1 + 0.85 * Math.cos(a), 0, 1 + 0.85 * Math.sin(a)])
      }),
    ),
  ],
  tire: () => [tube([1.2, 0, 1.2], [1.2, 0.8, 1.2], 1.2), marks([ring([1.2, 0, 1.2], 'pz', 0.75)], true)],
  'roller 2x4': () => [tube([0, 1, 1], [4, 1, 1], 1)],
  'hinge 1x2': () => [box(0, 0, 0, 2, 1, BH), tube([0.2, 0.8, BH + 0.25], [1.8, 0.8, BH + 0.25], 0.25), ...studs(grid(2, 1), BH)],
  'side stud 1x1': () => [box(0, 0, 0, 1, 1, BH), stud(0.5, 0.5, BH), tube([0.5, 0, 0.6], [0.5, -0.2, 0.6], SR)],
  'side studs 1x4': () => [
    box(0, 0, 0, 4, 1, BH),
    ...studs(grid(4, 1), BH),
    ...range(4)
      .reverse()
      .map((i) => tube([i + 0.5, 0, 0.6], [i + 0.5, -0.2, 0.6], SR)),
  ],
  'headlight 1x1': () => [
    box(0, 0, 0, 1, 1, BH),
    stud(0.5, 0.5, BH),
    marks([rect([0.15, 0, 0.15], [0.85, 0, 0.15], [0.85, 0, 1.05], [0.15, 0, 1.05])], true),
    marks([ring([0.5, 0, 0.6], 'pz', 0.25)], true),
  ],
  'pin brick 2x2': () => [...brick(2, 2), tube([1, 0, 0.6], [1, -0.6, 0.6], 0.2)],
  'handle plate 1x2': () => [
    ...plate(2, 1),
    box(1.5, -0.35, 0.1, 1.7, 0, 0.3),
    box(0.3, -0.35, 0.1, 0.5, 0, 0.3),
    tube([0.2, -0.4, 0.2], [1.8, -0.4, 0.2], 0.1),
  ],
  'clip plate 1x1': () => [box(0, 0, 0, 1, 1, PH), box(0.6, 0.3, PH, 0.75, 0.7, 1), box(0.25, 0.3, PH, 0.4, 0.7, 1)],
  'antenna 1x1': () => [box(0, 0, 0, 1, 1, PH), tube([0.5, 0.5, PH], [0.5, 0.5, 2.2], 0.1), ball([0.5, 0.5, 2.35], 0.2)],
  'turntable 2x2': () => [box(0, 0, 0, 2, 2, PH), cyl(1, 1, PH, PH + 0.3, 1), ...studs(grid(2, 2), PH + 0.3)],
  'ring plate 4x4': () => [
    cyl(2, 2, 0, PH, 2),
    marks([ring([2, 2, PH], 'pq', 0.8)], true),
    ...studs(
      grid(4, 4).filter(([p, q]) => !(p > 1 && p < 3 && q > 1 && q < 3)),
      PH,
    ),
  ],
  'window 1x2x2': () => [
    box(0, 0, 0, 2, 1, BH * 2),
    ...studs(grid(2, 1), BH * 2),
    marks([rect([0.2, 0, 0.2], [1.8, 0, 0.2], [1.8, 0, 2.2], [0.2, 0, 2.2])], true),
    marks([seg([1, 0, 0.2], [1, 0, 2.2]), seg([0.2, 0, 1.2], [1.8, 0, 1.2])]),
  ],
  'door 1x3x4': () => [
    box(0, 0, 0, 3, 1, BH * 4),
    ...studs(grid(3, 1), BH * 4),
    marks([[proj([0.3, 0, 0]), proj([0.3, 0, 4.2]), proj([2.7, 0, 4.2]), proj([2.7, 0, 0])]]),
    marks([ring([2.3, 0, 2.2], 'pz', 0.12)], true),
  ],
  'fence 1x4': () => [
    ...[3.7, 1.9, 0.1].map((p) => box(p, 0.4, 0, p + 0.2, 0.6, BH)),
    box(0, 0.42, 0.3, 4, 0.58, 0.45),
    box(0, 0.42, 0.9, 4, 0.58, 1.05),
  ],
  'lattice 1x4': () => [
    box(0, 0, 0, 4, 1, PH),
    box(0, 0.4, PH, 4, 0.6, BH * 2),
    marks(range(4).flatMap((i) => [seg([i, 0.4, PH], [i + 1, 0.4, BH * 2]), seg([i, 0.4, BH * 2], [i + 1, 0.4, PH])])),
  ],
  'stairs 2x3': () => [
    box(0, 2, 0, 2, 3, 1.8),
    ...studs(grid(2, 1, 0, 2), 1.8),
    box(0, 1, 0, 2, 2, BH),
    ...studs(grid(2, 1, 0, 1), BH),
    box(0, 0, 0, 2, 1, 0.6),
    ...studs(grid(2, 1), 0.6),
  ],
  'octagon 3x3': () => [
    prism(
      range(8).map((i): Pt => [1.5 + 1.5 * Math.cos(rad(22.5 + 45 * i)), 1.5 + 1.5 * Math.sin(rad(22.5 + 45 * i))]),
      'pq',
      0,
      BH,
    ),
    stud(1.5, 1.5, BH),
  ],
  'hexagon plate': () => [
    prism(
      range(6).map((i): Pt => [1.5 + 1.5 * Math.cos(rad(60 * i)), 1.5 + 1.3 * Math.sin(rad(60 * i))]),
      'pq',
      0,
      PH,
    ),
    stud(1.5, 1.5, PH),
  ],
  'triangle plate 2x2': () => [
    prism(
      [
        [0, 0],
        [2, 0],
        [0, 2],
      ],
      'pq',
      0,
      PH,
    ),
    stud(0.5, 0.5, PH),
  ],
  'gem 1x1': () => [
    poly(
      [
        [0.5, 0.5, 0],
        [0, 0, 0.6],
        [1, 0, 0.6],
        [1, 1, 0.6],
        [0, 1, 0.6],
      ],
      [
        [1, 2, 3, 4],
        [0, 1, 2],
        [0, 2, 3],
        [0, 3, 4],
        [0, 4, 1],
      ],
    ),
    poly(
      [
        [0, 0, 0.6],
        [1, 0, 0.6],
        [1, 1, 0.6],
        [0, 1, 0.6],
        [0.5, 0.5, BH],
      ],
      [
        [0, 1, 2, 3],
        [0, 1, 4],
        [1, 2, 4],
        [2, 3, 4],
        [3, 0, 4],
      ],
    ),
  ],
  'tee plate 3x2': () => [box(0, 1, 0, 3, 2, PH), ...studs(grid(3, 1, 0, 1), PH), box(1, 0, 0, 2, 1, PH), stud(1.5, 0.5, PH)],
  'pine tree': () => [cyl(1, 1, 0, 0.5, 0.15), cyl(1, 1, 0.5, 1.6, 1, 0.35), cyl(1, 1, 1.4, 2.5, 0.7, 0.03)],
  'minifig head': () => {
    const e1: V3 = [Math.SQRT1_2, -Math.SQRT1_2, 0]
    const e2: V3 = [0, 0, 1]
    const fc = 0.5 - 0.5 * Math.SQRT1_2 // where the cylinder faces the camera
    const off = 0.16 * Math.SQRT1_2
    return [
      cyl(0.5, 0.5, 0, 1, 0.5),
      stud(0.5, 0.5, 1),
      marks([ringV([fc + off, fc - off, 0.65], e1, e2, 0.05), ringV([fc - off, fc + off, 0.65], e1, e2, 0.05)], true),
      marks([ringV([fc, fc, 0.45], e1, e2, 0.2, 200, 340)]),
    ]
  },
}

function parts(kind: string): Part[] {
  const make = SHAPES[kind]
  if (make) return make()
  const m = /^(\d)x(\d)(p?)$/.exec(kind) // legacy: WxL, WxLp
  if (m) return m[3] ? plate(+m[2], +m[1]) : brick(+m[2], +m[1])
  return brick(4, 2)
}

/**
 * Outline of one brick. `kind` is a catalogue name (see BRICK_KINDS) or
 * `WxL` / `WxLp`. `fit` scales the longer side to that many px so every
 * shape reads as the same size; otherwise `unit` is the px per stud.
 */
export function Brick({ kind = 'brick 2x4', fit, unit = 14 }: { kind?: string; fit?: number; unit?: number }) {
  const id = 'brick' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const ps = parts(kind)
  const all = ps.flatMap((p) => p.pts)
  const minX = Math.min(...all.map((p) => p[0]))
  const maxX = Math.max(...all.map((p) => p[0]))
  const minY = Math.min(...all.map((p) => p[1]))
  const maxY = Math.max(...all.map((p) => p[1]))
  const pad = 0.12
  const w = maxX - minX + pad * 2
  const h = maxY - minY + pad * 2
  const scale = fit ? fit / Math.max(w, h) : unit
  const vb = `${f(minX - pad)} ${f(minY - pad)} ${f(w)} ${f(h)}`
  return (
    <svg
      className="brick"
      width={f(w * scale)}
      height={f(h * scale)}
      viewBox={vb}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <defs>
        {ps.map((_, i) => {
          const ahead = ps.slice(i + 1).flatMap((p) => p.solid)
          if (ahead.length === 0) return null
          return (
            <mask key={i} id={`${id}-${i}`} maskUnits="userSpaceOnUse" x={f(minX - pad)} y={f(minY - pad)} width={f(w)} height={f(h)}>
              <rect x={f(minX - pad)} y={f(minY - pad)} width={f(w)} height={f(h)} fill="#fff" stroke="none" />
              {ahead.map((d, k) => (
                <path key={k} d={d} fill="#000" stroke="#000" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              ))}
            </mask>
          )
        })}
      </defs>
      {ps.map((p, i) => {
        const masked = ps.slice(i + 1).some((q) => q.solid.length > 0)
        return (
          <g key={i} mask={masked ? `url(#${id}-${i})` : undefined}>
            {p.lines.map((d, k) => (
              <path key={k} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

/** Every catalogue shape, numbered and named, for picking. */
export function BrickGallery({
  kinds = BRICK_KINDS,
  from = 0,
  to = kinds.length,
  fit = 54,
  cols = 6,
  cell = 90,
}: {
  kinds?: readonly string[]
  /** slice of the catalogue to show; numbering continues from `from` */
  from?: number
  to?: number
  fit?: number
  cols?: number
  /** cell height in px */
  cell?: number
}) {
  return (
    <div className="bricks" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, '--cell': `${cell}px` } as CSSProperties}>
      {kinds.slice(from, to).map((k, i) => (
        <div key={k} className="bricks__cell">
          <Brick kind={k} fit={fit} />
          <div className="bricks__label">
            <span className="bricks__n">{String(from + i + 1).padStart(2, '0')}</span> {k}
          </div>
        </div>
      ))}
    </div>
  )
}
