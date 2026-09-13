import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'

/** Languages bundled into the deck. Add more as the talk grows. */
export const LANGS = [
  'dart',
  'swift',
  'kotlin',
  'objective-c',
  'typescript',
  'javascript',
  'json',
  'yaml',
  'bash',
  'diff',
] as const

export const THEME = 'vitesse-dark'

let pending: Promise<HighlighterCore> | null = null

/**
 * One lazily-created highlighter for the whole deck. Oniguruma (wasm) rather
 * than the JS engine — Swift and Kotlin grammars lean on lookbehind.
 */
export function getHighlighter(): Promise<HighlighterCore> {
  pending ??= createHighlighterCore({
    themes: [import('shiki/themes/vitesse-dark.mjs')],
    langs: [
      import('shiki/langs/dart.mjs'),
      import('shiki/langs/swift.mjs'),
      import('shiki/langs/kotlin.mjs'),
      import('shiki/langs/objective-c.mjs'),
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/yaml.mjs'),
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/diff.mjs'),
    ],
    engine: createOnigurumaEngine(import('shiki/wasm')),
  })
  return pending
}

/** Warm the highlighter up front so the first code slide doesn't flash. */
export function preloadHighlighter() {
  void getHighlighter()
}
