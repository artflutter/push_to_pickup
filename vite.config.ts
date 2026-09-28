import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/push_to_pickup/' : '/',
  resolve: {
    alias: mode === 'pages' ? [{
      find: /^\.\/slides$/,
      replacement: decodeURIComponent(new URL('./src/deck/slides.pages.ts', import.meta.url).pathname),
    }] : [],
  },
  plugins: [
    {
      name: 'pages-opening-slide-only',
      generateBundle() {
        if (mode !== 'pages') return
        const slides = [...this.getModuleIds()].filter(id => /\/src\/slides\/.*\.mdx$/.test(id))
        if (slides.length !== 1 || !slides[0].endsWith('/010-title.mdx')) {
          this.error('The Pages build must include only 010-title.mdx.')
        }
      },
    },
    {
      // MDX must run before the react plugin so JSX gets transformed + fast-refreshed
      enforce: 'pre',
      ...mdx({
        providerImportSource: '@mdx-js/react',
        remarkPlugins: [
          remarkGfm,
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: 'frontmatter' }],
        ],
      }),
    },
    react({ include: /\.(jsx|tsx|mdx)$/ }),
  ],
  server: { port: 5273, open: true },
  build: { target: 'es2022', outDir: mode === 'pages' ? 'dist/pages' : 'dist' },
}))
