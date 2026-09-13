/// <reference types="vite/client" />

declare module '*.mdx' {
  import type { ComponentType } from 'react'
  export const frontmatter: Record<string, unknown> | undefined
  const MDXComponent: ComponentType<Record<string, unknown>>
  export default MDXComponent
}
