import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import type { HighlighterCore } from 'shiki/core'
import { ShikiMagicMove } from 'shiki-magic-move/react'
import 'shiki-magic-move/style.css'
import { getHighlighter, THEME } from './highlighter'
import { useSlide } from './slideContext'

function useHighlighter(): HighlighterCore | null {
  const [hl, setHl] = useState<HighlighterCore | null>(null)
  useEffect(() => {
    let alive = true
    void getHighlighter().then((h) => alive && setHl(h))
    return () => {
      alive = false
    }
  }, [])
  return hl
}

/** "1-3,7" -> Set{1,2,3,7} */
function parseLines(spec: string): Set<number> {
  const lines = new Set<number>()
  for (const part of spec.split(',')) {
    const [from, to] = part.split('-').map((n) => Number(n.trim()))
    if (!Number.isFinite(from)) continue
    for (let i = from; i <= (Number.isFinite(to) ? to : from); i++) lines.add(i)
  }
  return lines
}

interface CodeProps {
  children?: ReactNode
  code?: string
  lang?: string
  title?: string
  /**
   * Progressive line focus. Pipe-separated groups, one click each:
   *   marks="1-4|6-9|12"
   * The first group shows with the slide, every later group costs a step.
   */
  marks?: string
  /** Type size of the code. Long listings need `sm`; a 4-liner can take `lg`. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Code({ children, code, lang = 'dart', title, marks, size = 'md', className }: CodeProps) {
  const source = (code ?? (typeof children === 'string' ? children : '')).replace(/\n$/, '')
  const highlighter = useHighlighter()
  const [html, setHtml] = useState<string>('')
  const slide = useSlide()

  const groups = marks ? marks.split('|').map((g) => g.trim()) : []
  const [ordinals] = useState(() => groups.slice(1).map(() => slide.register()))

  let active = 0
  for (let i = 0; i < ordinals.length; i++) {
    if (slide.static || slide.step >= ordinals[i]) active = i + 1
  }
  const marked = groups.length ? parseLines(groups[active]) : null

  useEffect(() => {
    if (!highlighter) return
    setHtml(
      highlighter.codeToHtml(source, {
        lang,
        theme: THEME,
        transformers: [
          {
            line(node, line) {
              if (!marked) return
              this.addClassToHast(node, marked.has(line) ? 'line--on' : 'line--off')
            },
          },
        ],
      }),
    )
  }, [highlighter, source, lang, marked])

  return (
    <figure className={`code code--${size} ${className ?? ''}`}>
      {title && <figcaption className="code__title">{title}</figcaption>}
      {html ? (
        <div className="code__body" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="code__body code__body--raw">
          <code>{source}</code>
        </pre>
      )}
    </figure>
  )
}

interface CodeMorphProps {
  /** One entry per state of the code. Each state after the first costs a step. */
  steps: string[]
  lang?: string
  title?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Token-level morph between code states — the "watch this refactor happen"
 * effect. Far more readable than swapping two static blocks.
 */
export function CodeMorph({ steps, lang = 'dart', title, size = 'md' }: CodeMorphProps) {
  const highlighter = useHighlighter()
  const slide = useSlide()
  const [ordinals] = useState(() => steps.slice(1).map(() => slide.register()))

  let index = 0
  for (let i = 0; i < ordinals.length; i++) {
    if (slide.static || slide.step >= ordinals[i]) index = i + 1
  }

  const code = (steps[index] ?? '').replace(/\n$/, '')

  return (
    <figure className={`code code--morph code--${size}`}>
      {title && <figcaption className="code__title">{title}</figcaption>}
      <div className="code__body">
        {highlighter ? (
          <ShikiMagicMove
            highlighter={highlighter}
            lang={lang}
            theme={THEME}
            code={code}
            options={{ duration: 550, stagger: 2, lineNumbers: false }}
          />
        ) : (
          <pre className="code__body--raw">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </figure>
  )
}

/** MDX maps fenced code blocks here: ```dart … ``` */
export function Pre({ children }: { children?: ReactNode }) {
  const child = children as ReactElement<{ className?: string; children?: ReactNode }> | undefined
  const className = child?.props?.className ?? ''
  const lang = /language-(\w[\w-]*)/.exec(className)?.[1] ?? 'text'
  const source = typeof child?.props?.children === 'string' ? child.props.children : ''
  return <Code code={source} lang={lang} />
}
