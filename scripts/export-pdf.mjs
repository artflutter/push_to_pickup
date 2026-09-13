/**
 * Builds the deck and prints `?print` to a single PDF.
 *
 * Playwright is not a dependency — install it only when you want the PDF:
 *   npm i -D playwright && npx playwright install chromium
 *
 * Without it, open http://localhost:5273/?print and use the browser's
 * "Save as PDF" (landscape, no margins, background graphics on).
 */
import { build, preview } from 'vite'

const OUT = process.argv[2] ?? 'out/push-to-pickup.pdf'

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error(
    '\nplaywright not installed. Either:\n' +
      '  npm i -D playwright && npx playwright install chromium && npm run pdf\n' +
      '  …or run `npm run dev`, open /?print and Save as PDF.\n',
  )
  process.exit(1)
}

await build()
const server = await preview({ preview: { port: 4273, open: false } })
const url = server.resolvedUrls.local[0]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.goto(`${url}?print`, { waitUntil: 'networkidle' })
// Give shiki's wasm highlighter a beat to replace the raw <pre> fallbacks.
await page.waitForFunction(() => document.querySelectorAll('.shiki').length > 0, null, { timeout: 15_000 })
await page.emulateMedia({ media: 'print' })
await page.pdf({
  path: OUT,
  width: '1280px',
  height: '720px',
  printBackground: true,
  pageRanges: '1-',
})

await browser.close()
await server.close()
console.log(`\nwrote ${OUT}`)
