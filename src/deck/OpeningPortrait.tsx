import { useId, useState } from 'react'
import { motion } from 'motion/react'
import { CLAWD } from './ClaudeMark'
import { useSlide } from './slideContext'

// Portrait coordinates match the original 391 × 391 photograph.
const MUSTACHE = 'M 0 -1 C -7 -14 -19 -13 -28 -5 C -37 4 -49 0 -48 -9 C -53 -3 -49 6 -42 9 C -24 16 -9 9 0 -1 Z'
const INK_STROKE = 'M 0 -1 C -12 5 -25 6 -35 5 S -51 -1 -48 -9'

/** The opening photo and its finished mustache, without deck steps or Clawd. */
export function MustachedPortrait({ src }: { src: string }) {
  return <svg viewBox="0 0 391 391" role="img" aria-label="Vasyl Dytsiak with a handlebar mustache">
    <image href={src} width="391" height="391" />
    <g transform="translate(205 228)">
      {[1, -1].map(direction => <path key={direction} d={MUSTACHE} fill="#211527" transform={`scale(${direction} 1)`} />)}
    </g>
  </svg>
}

/** Two opening-slide jokes, both registered as ordinary reversible deck steps. */
export function OpeningPortrait({ src }: { src: string }) {
  const slide = useSlide()
  useState(() => slide.register(2))
  const id = useId()
  const mustache = slide.static || slide.step >= 1
  const mascot = slide.static || slide.step >= 2

  return <div className="avatar opening-portrait">
    <img src={src} />
    <svg className="opening-portrait__overlay" viewBox="0 0 391 391">
      <g transform="translate(205 228)">
        <motion.g initial={false}
          animate={{ opacity: mustache ? 1 : 0 }} transition={{ duration: 0.12 }}>
          {[1, -1].map((direction, i) => <g key={direction} transform={`scale(${direction} 1)`}>
            <defs>
              <mask id={`${id}-ink-${i}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="-64" y="-26" width="78" height="56">
                {/* A zero-length round dash paints endpoint dots, including the curl.
                    Flat caps and a longer gap reveal only the continuous ink stroke. */}
                <motion.path d={INK_STROKE} fill="none" stroke="#fff" strokeWidth="32" strokeLinecap="butt"
                  initial={false} animate={{ pathLength: mustache ? 1 : 0, pathSpacing: 2 }}
                  transition={{ duration: mustache ? 0.5 : 0.2, delay: mustache ? i * 0.38 : 0, ease: 'easeInOut' }} />
              </mask>
            </defs>
            <path d={MUSTACHE} fill="#211527" mask={`url(#${id}-ink-${i})`} />
          </g>)}
        </motion.g>
      </g>

      {/* The feet follow the upper-right contour of the hair, not the photo's edge. */}
      <g transform="translate(244 78) rotate(28)">
        <motion.g className="opening-portrait__mascot" initial={false}
          style={{ originX: 0, originY: 0, transformBox: 'view-box' }}
          animate={{ opacity: mascot ? 1 : 0, y: mascot ? 0 : -78, scale: mascot ? 1 : 0.82, rotate: mascot ? 0 : -16 }}
          transition={mascot
            ? { type: 'spring', stiffness: 230, damping: 15, mass: 0.7, opacity: { duration: 0.15 } }
            : { duration: 0.2, ease: 'easeIn' }}>
          <g transform="scale(4.4) translate(-12 -18)">
            <path d={CLAWD} fill="#fff" />
          </g>
        </motion.g>
      </g>
    </svg>
  </div>
}
