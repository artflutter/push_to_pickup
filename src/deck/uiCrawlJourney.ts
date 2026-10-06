import { alignContour, bounds, outlinePath, smooth, snakeBody, SNAKE_CELL, type Point } from './uiCrawlMotion'

export const CRAWL_TICK = 0.14
export const ENTRY_END = 3.6
const PAGE = 720
const MORPH_TIME = 0.8
const directions = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]
const key = (p: Point) => `${p.x},${p.y}`
const mix = (a: number, b: number, p: number) => a + (b - a) * p
const blend = (a: Point[], b: Point[], p: number) => a.map((v, i) => ({ x: mix(v.x, b[i].x, p), y: mix(v.y, b[i].y, p) }))
const randomTurn = () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000

export type Worm = { origin: Point; cells: Point[] }
export type CrawlArtwork = { points: Point[]; target: Point[] }
export type CrawlPhase = 'entry' | 'roam' | 'exit' | 'arrived'
export type JourneyFrame = {
  paths: string[]; cards: number[]; fills: number[]; camera: number
  blue: number; donor: number; black: number; title: number; phase: CrawlPhase
  headlight: Point & { angle: number; opacity: number }
}
type Exit = { states: Worm[]; contours: Point[][]; target: Point[]; duration: number }

export const wormContour = (worm: Worm) => snakeBody([...worm.cells].reverse(), worm.cells.length - 1, worm.origin)
const move = (worm: Worm, head: Point): Worm => ({ origin: worm.origin, cells: [head, ...worm.cells.slice(0, -1)] })
const copy = (worm: Worm): Worm => ({ origin: { ...worm.origin }, cells: worm.cells.map(p => ({ ...p })) })

/** The lamp sits on the leading face of the head cell and points away from its neck. */
const headlightAt = (worm: Worm, opacity: number): JourneyFrame['headlight'] => {
  const [head, neck] = worm.cells
  const dx = head.x - neck.x, dy = head.y - neck.y
  return {
    x: worm.origin.x + (head.x + dx / 2) * SNAKE_CELL,
    y: worm.origin.y + (head.y + dy / 2) * SNAKE_CELL,
    angle: Math.atan2(dy, dx) * 180 / Math.PI,
    opacity,
  }
}

/** Fresh entropy at every grid tick: no repeating route and no fixed destinations. */
export function wander(worm: Worm, random = randomTurn): Worm {
  const head = worm.cells[0]
  const occupied = new Set(worm.cells.slice(0, -1).map(key))
  const options = directions.map(d => ({ x: head.x + d.x, y: head.y + d.y })).filter(p => {
    const x = worm.origin.x + p.x * SNAKE_CELL
    const y = worm.origin.y + p.y * SNAKE_CELL + PAGE
    return x >= 40 && x <= 1240 && y >= 60 && y <= 640 && !occupied.has(key(p))
  })
  return options.length ? move(worm, options[Math.floor(random() * options.length)]) : worm
}

/** A shortest grid route starts with the exact live head, neck, and tail. */
export function routeToCard(worm: Worm, destination: Point): Worm[] {
  const start = worm.cells[0]
  const goal = {
    x: Math.round((destination.x - worm.origin.x) / SNAKE_CELL),
    y: Math.round((destination.y - PAGE * 2 - worm.origin.y) / SNAKE_CELL),
  }
  const blocked = new Set(worm.cells.slice(1).map(key))
  const queue = [start]
  const parents = new Map<string, Point | null>([[key(start), null]])
  for (let i = 0; i < queue.length && !parents.has(key(goal)); i++) {
    const head = queue[i]
    for (const d of directions) {
      const p = { x: head.x + d.x, y: head.y + d.y }
      const x = worm.origin.x + p.x * SNAKE_CELL, y = worm.origin.y + p.y * SNAKE_CELL
      if (x < 40 || x > 1240 || y < -PAGE * 2 + 40 || y > -PAGE + 640 || blocked.has(key(p)) || parents.has(key(p))) continue
      parents.set(key(p), head)
      queue.push(p)
    }
  }
  if (!parents.has(key(goal))) throw new Error('No crawl route to the UI card')
  const heads: Point[] = []
  for (let p: Point | null = goal; p; p = parents.get(key(p)) ?? null) heads.unshift(p)
  const states = [copy(worm)]
  for (const head of heads.slice(1)) states.push(move(states[states.length - 1], head))
  return states
}

function departure(art: CrawlArtwork, part: number) {
  const box = bounds(art.points)
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const initial: Worm = {
    origin: { x: center.x, y: center.y - SNAKE_CELL },
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
  }
  const states = [initial]
  const walk = (x: number, y: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const worm = states[states.length - 1], head = worm.cells[0]
      states.push(move(worm, { x: head.x + x, y: head.y + y }))
    }
  }
  const first = part === 1 ? 4 : 2
  walk(0, -1, first)
  walk(part === 2 ? 1 : -1, 0, 2)
  walk(0, -1, 18 - first)
  const contours = states.map((worm, tick) => {
    const body = wormContour(worm)
    if (tick >= 4) return body
    const at = bounds(body)
    const intact = alignContour(body, art.points).map(p => ({
      x: p.x + at.x + at.width / 2 - center.x,
      y: p.y + at.y + at.height / 2 - center.y,
    }))
    return blend(intact, body, smooth((tick - 1) / 3))
  })
  return { states, contours }
}

/** Mutable bodies live across the pause; only an explicit next starts their exit. */
export class CrawlJourney {
  phase: CrawlPhase
  worms: Worm[]
  frame: JourneyFrame
  private entryTime: number
  private roamTime = 0
  private exitTime = 0
  private exitEnd = 0
  private opening = false
  private exits: Exit[] = []
  private departures: ReturnType<typeof departure>[]
  private entryTicks = [-1, -1, -1]

  constructor(private artwork: CrawlArtwork[], fromVendor: boolean, complete = false, private random = randomTurn) {
    this.departures = artwork.map(departure)
    this.worms = this.departures.map(d => copy(d.states[d.states.length - 1]))
    this.entryTime = fromVendor ? 0 : ENTRY_END
    this.phase = fromVendor ? 'entry' : 'roam'
    this.frame = { paths: this.worms.map(w => outlinePath(wormContour(w))), cards: [0, 0, 0], fills: [0, 0, 0],
      headlight: headlightAt(this.worms[0], fromVendor ? 0 : 1),
      camera: fromVendor ? 0 : PAGE, blue: fromVendor ? 1 : 0, donor: fromVendor ? 1 : 0, black: 1, title: 0, phase: this.phase }
    if (complete) {
      this.setOpen(true)
      this.exitTime = this.exitEnd
      this.renderExit()
    } else if (fromVendor) this.renderEntry()
    this.frame = { ...this.frame, phase: this.phase }
  }

  setOpen(open: boolean) {
    this.opening = open
    if (open && this.phase === 'roam') this.beginExit()
    else if (!open && this.phase === 'arrived') this.phase = 'exit'
    this.frame = { ...this.frame, phase: this.phase }
  }

  private beginExit() {
    this.exits = this.worms.map((worm, i) => {
      const target = this.artwork[i].target
      const box = bounds(target)
      const states = routeToCard(worm, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
      const contours = states.map(wormContour)
      return { states, contours, target: alignContour(contours[contours.length - 1], target).map(p => ({ x: p.x, y: p.y - PAGE * 2 })),
        duration: (states.length - 1) * CRAWL_TICK }
    })
    this.exitEnd = Math.max(...this.exits.map(e => e.duration)) + MORPH_TIME
    this.exitTime = 0
    this.phase = 'exit'
    this.renderExit()
  }

  advance(seconds: number) {
    if (this.phase === 'entry') {
      this.entryTime = Math.min(ENTRY_END, this.entryTime + seconds)
      this.renderEntry()
      if (this.entryTime >= ENTRY_END) {
        this.phase = 'roam'
        this.frame = { ...this.frame, headlight: headlightAt(this.worms[0], 1) }
        if (this.opening) this.beginExit()
      }
    } else if (this.phase === 'roam') {
      this.roamTime += seconds
      let moved = false
      while (this.roamTime >= CRAWL_TICK) {
        this.roamTime -= CRAWL_TICK
        this.worms = this.worms.map(w => wander(w, this.random))
        moved = true
      }
      if (moved) this.frame = { ...this.frame, paths: this.worms.map(w => outlinePath(wormContour(w))), headlight: headlightAt(this.worms[0], 1) }
    } else if (this.phase === 'exit') {
      this.exitTime = Math.max(0, Math.min(this.exitEnd, this.exitTime + (this.opening ? seconds : -seconds)))
      this.renderExit()
      if (!this.opening && this.exitTime === 0) {
        this.worms = this.exits.map(e => copy(e.states[0]))
        this.phase = 'roam'
      }
    }
    this.frame = { ...this.frame, phase: this.phase }
    return this.frame
  }

  private renderEntry() {
    const paths = [...this.frame.paths]
    this.departures.forEach((d, i) => {
      const tick = Math.min(d.states.length - 1, Math.max(0, Math.floor((this.entryTime - .25 - i * .12) / CRAWL_TICK)))
      if (tick !== this.entryTicks[i]) paths[i] = outlinePath(d.contours[tick])
      this.entryTicks[i] = tick
    })
    this.frame = { ...this.frame, paths, camera: PAGE * smooth((this.entryTime - .8) / (ENTRY_END - .8)),
      blue: 1 - smooth((this.entryTime - 1.45) / 1.3), donor: 1 - smooth((this.entryTime - .4) / 1.2) }
  }

  private renderExit() {
    const camera = PAGE + PAGE * smooth((this.exitTime - .25) / (this.exitEnd - MORPH_TIME - .25))
    const morphs = this.exits.map(e => smooth((this.exitTime - e.duration) / MORPH_TIME))
    const litWorm = this.exits[0].states[Math.min(this.exits[0].states.length - 1, Math.floor(this.exitTime / CRAWL_TICK + 1e-8))]
    this.frame = {
      ...this.frame, camera,
      headlight: headlightAt(litWorm, 1 - morphs[0]),
      paths: this.exits.map((e, i) => {
        const tick = Math.min(e.contours.length - 1, Math.floor(this.exitTime / CRAWL_TICK + 1e-8))
        return outlinePath(blend(e.contours[tick], e.target, morphs[i]))
      }),
      cards: morphs.map(p => smooth((p - .85) / .15)), fills: morphs,
      black: 1 - smooth((camera - PAGE - 360) / 360), title: smooth((camera - PAGE - 360) / 360),
    }
    if (this.exitTime >= this.exitEnd) this.phase = 'arrived'
  }
}
