import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/push_to_pickup/' : '/',
  plugins: [
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
  server: { port: 5273, open: false },
  build: { target: 'es2022', outDir: mode === 'pages' ? 'dist/pages' : 'dist' },
}))
