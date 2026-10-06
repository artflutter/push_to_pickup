import type { ComponentType } from 'react'

export type Layout = 'title' | 'card' | 'section' | 'default' | 'full' | 'quote' | 'end'

export interface SlideMeta {
  /** Big text for `title` / `card` / `section` / `end` layouts. */
  title?: string
  subtitle?: string
  layout?: Layout
  /** Author notes — not rendered anywhere. */
  notes?: string
  /** Optional background override, any CSS background value. */
  background?: string
  /** `light` flips the slide to white paper with ink text (site's white sections). */
  theme?: 'dark' | 'light'
  /** Hide from the deck without deleting the file. */
  draft?: boolean
}

export interface SlideModule extends SlideMeta {
  id: string
  path: string
  Content: ComponentType<Record<string, unknown>>
}

export interface DeckPosition {
  slide: number
  step: number
}
