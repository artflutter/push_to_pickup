import type { ComponentType } from 'react'
import type { SlideMeta, SlideModule } from './types'

type RawModule = {
  default: ComponentType<Record<string, unknown>>
  frontmatter?: SlideMeta
}

// Slides are ordered by filename. Prefix with numbers: 010-title.mdx, 020-intro.mdx …
// Gaps of 10 leave room to insert without renaming everything.
const modules = import.meta.glob<RawModule>('../slides/*.mdx', { eager: true })

export const slides: SlideModule[] = Object.entries(modules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, mod]) => ({
    id: path.split('/').pop()!.replace(/\.mdx$/, ''),
    path,
    Content: mod.default,
    ...(mod.frontmatter ?? {}),
  }))
  .filter((slide) => !slide.draft)
