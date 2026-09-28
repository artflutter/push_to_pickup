import Content, { frontmatter } from '../slides/010-title.mdx'
import type { SlideModule } from './types'

// A build-time replacement for ./slides: no other MDX slide is imported.
export const slides: SlideModule[] = [{
  ...frontmatter,
  id: '010-title',
  path: '../slides/010-title.mdx',
  Content,
}]
