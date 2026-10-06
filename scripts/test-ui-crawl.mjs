import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

const output = mkdtempSync(join(tmpdir(), 'push-to-pickup-crawl-'))
after(() => rmSync(output, { recursive: true, force: true }))
execFileSync('node_modules/.bin/tsc', ['--ignoreConfig', '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck',
  '--outDir', output, 'src/deck/uiCrawlJourney.ts', 'src/deck/uiCrawlMotion.ts'])
const { CrawlJourney, CRAWL_TICK, ENTRY_END, routeToCard } = createRequire(import.meta.url)(join(output, 'uiCrawlJourney.js'))

const rectangle = (x, y, w, h) => Array.from({ length: 96 }, (_, i) => {
  const u = i / 24, t = u % 1
  return u < 1 ? { x: x + w * t, y } : u < 2 ? { x: x + w, y: y + h * t }
    : u < 3 ? { x: x + w * (1 - t), y: y + h } : { x, y: y + h * (1 - t) }
})
const artwork = [
  { points: rectangle(312, 194, 64, 78), target: rectangle(72, 153, 560, 495) },
  { points: rectangle(811, 288, 41, 121), target: rectangle(648, 153, 560, 239) },
  { points: rectangle(1068, 288, 41, 121), target: rectangle(648, 409, 560, 239) },
]
function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000 }
}
function validBody(worm) {
  assert.equal(new Set(worm.cells.map(p => `${p.x},${p.y}`)).size, 3)
  for (let i = 1; i < worm.cells.length; i++) {
    const a = worm.cells[i - 1], b = worm.cells[i]
    assert.equal(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 1)
  }
}

test('the empty canvas keeps roaming without a timeout, within its bounds', () => {
  let draws = 0
  const random = seeded(7)
  const journey = new CrawlJourney(artwork, true, false, () => { draws++; return random() })
  journey.advance(ENTRY_END)
  assert.equal(journey.phase, 'roam')
  const positions = new Set()
  for (let tick = 0; tick < 6000; tick++) {
    const frame = journey.advance(CRAWL_TICK)
    assert.equal(frame.phase, 'roam')
    assert.equal(frame.camera, 720)
    assert.equal(frame.black, 1)
    assert.equal(frame.blue, 0)
    assert.equal(frame.donor, 0)
    assert.equal(frame.title, 0)
    assert.deepEqual(frame.cards, [0, 0, 0])
    for (const worm of journey.worms) {
      validBody(worm)
      for (const cell of worm.cells) {
        const x = worm.origin.x + cell.x * 40, y = worm.origin.y + cell.y * 40 + 720
        assert.ok(x >= 40 && x <= 1240 && y >= 60 && y <= 640)
      }
    }
    positions.add(JSON.stringify(journey.worms.map(w => w.cells[0])))
  }
  assert.equal(draws, 18000)
  assert.ok(positions.size > 5900)
})

test('next routes the current bodies without changing a single outline point', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const journey = new CrawlJourney(artwork, false, false, seeded(seed))
    for (let i = 0; i < seed * 7; i++) journey.advance(CRAWL_TICK)
    const before = structuredClone(journey.frame)
    const worms = structuredClone(journey.worms)
    journey.setOpen(true)
    assert.equal(journey.phase, 'exit')
    assert.deepEqual(journey.frame.paths, before.paths)
    assert.equal(journey.frame.camera, before.camera)
    for (let part = 0; part < 3; part++) {
      const target = artwork[part].target
      const center = { x: (target[0].x + target[48].x) / 2, y: (target[0].y + target[48].y) / 2 }
      const route = routeToCard(worms[part], center)
      assert.deepEqual(route[0], worms[part])
      route.forEach(validBody)
      for (let i = 1; i < route.length; i++) assert.deepEqual(route[i].cells.slice(1), route[i - 1].cells.slice(0, -1))
    }
    journey.advance(60)
    assert.equal(journey.phase, 'arrived')
    assert.equal(journey.frame.camera, 1440)
    assert.deepEqual(journey.frame.cards, [1, 1, 1])
  }
})

test('an early next finishes the departure before continuing to the UI', () => {
  const journey = new CrawlJourney(artwork, true)
  journey.advance(.2)
  const before = structuredClone(journey.frame)
  journey.setOpen(true)
  assert.deepEqual(journey.frame, before)
  journey.advance(ENTRY_END)
  assert.equal(journey.phase, 'exit')
  assert.equal(journey.frame.camera, 720)
  journey.advance(60)
  assert.equal(journey.phase, 'arrived')
})

test('back retraces partial and complete exits, then resumes at the original body', () => {
  for (const time of [.39, 60]) {
    const journey = new CrawlJourney(artwork, false, false, seeded(42))
    journey.advance(3)
    const bodies = structuredClone(journey.worms), paths = [...journey.frame.paths]
    journey.setOpen(true)
    journey.advance(time)
    const turn = structuredClone(journey.frame.paths)
    journey.setOpen(false)
    assert.deepEqual(journey.frame.paths, turn)
    journey.advance(60)
    assert.equal(journey.phase, 'roam')
    assert.deepEqual(journey.worms, bodies)
    assert.deepEqual(journey.frame.paths, paths)
    journey.advance(CRAWL_TICK)
    assert.notDeepEqual(journey.worms, bodies)
  }
})

test('direct entry and static rendering can show the completed cards', () => {
  const journey = new CrawlJourney(artwork, false, true)
  assert.equal(journey.frame.phase, 'arrived')
  assert.equal(journey.frame.camera, 1440)
  assert.equal(journey.frame.black, 0)
  assert.equal(journey.frame.title, 1)
  assert.deepEqual(journey.frame.cards, [1, 1, 1])
})
