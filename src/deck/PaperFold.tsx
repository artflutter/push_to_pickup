import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { MotionValue } from 'motion/react'
import { PAPER, PAPER_PANELS, paperAt } from './betweenMotion'

/** A printed sheet: each strip keeps its material width and rotates at a crease.
 * The live UI stays mounted underneath; inert copies are made once per squeeze,
 * so no slide hooks, card highlights or layout measurements run on the folds.
 */
export function PaperFold({ progress, source }: { progress: MotionValue<number>; source: RefObject<HTMLDivElement | null> }) {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const panels = [...el.querySelectorAll<HTMLElement>('.paper-fold__panel')]
    const shades = [...el.querySelectorAll<HTMLElement>('.paper-fold__shade')]
    const prints = [...el.querySelectorAll<HTMLElement>('.paper-fold__print')]
    let captured = false

    const capture = () => {
      const section = source.current?.querySelector('.slide')
      if (!section) return false
      const paper = section.cloneNode(true) as HTMLElement
      paper.removeAttribute('data-slide')
      paper.classList.add('paper-fold__copy')
      // The earlier vendor hand-off is already over and is not printed paper.
      paper.querySelector('.ui-crawl__overlay')?.remove()
      prints.forEach(print => print.replaceChildren(paper.cloneNode(true)))
      return true
    }

    const update = (p: number) => {
      const { left, cosine, angle, fold, opacity } = paperAt(p)
      const visible = fold > 0 && opacity > 0
      if (visible && !captured) captured = capture()
      el.style.visibility = visible && captured ? 'visible' : 'hidden'
      el.style.opacity = String(opacity)
      if (p === 0) captured = false
      if (!visible) return
      let x = left
      panels.forEach((panel, i) => {
        const width = PAPER_PANELS[i]
        // A valley is shared by both adjoining edges. No stretching or seams.
        const z = i % 2 ? -width * fold : 0
        const rotation = (i % 2 ? -angle : angle) * 180 / Math.PI
        panel.style.transform = `translate3d(${x}px, ${PAPER.y}px, ${z}px) rotateY(${rotation}deg)`
        shades[i].style.opacity = String(fold)
        x += width * cosine
      })
    }
    update(progress.get())
    return progress.on('change', update)
  }, [progress, source])

  let offset = PAPER.x
  return <div ref={root} className="paper-fold" aria-hidden="true" inert>
    <div className="paper-fold__camera">
      <div className="paper-fold__sheet">
        {PAPER_PANELS.map((width, i) => {
          const left = -offset
          offset += width
          return <div key={i} className="paper-fold__panel" style={{ width, height: PAPER.height }}>
            <div className="paper-fold__print" style={{ left, top: -PAPER.y }} />
            <div className="paper-fold__shade" />
          </div>
        })}
      </div>
    </div>
  </div>
}
