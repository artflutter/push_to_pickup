import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeckPosition } from './types'

/** Sentinel meaning "last step of whatever slide we land on". Clamped on arrival. */
export const LAST_STEP = 9999

const CHANNEL = 'push-to-pickup-deck'

function clampPosition(position: DeckPosition, total: number): DeckPosition {
  return { slide: Math.max(0, Math.min(total - 1, position.slide)), step: Math.max(0, position.step) }
}

function readHash(total: number): DeckPosition {
  const m = /^#\/(\d+)(?:\/(\d+))?/.exec(window.location.hash)
  if (!m) return { slide: 0, step: 0 }
  return clampPosition({ slide: Number(m[1]), step: Number(m[2] ?? 0) }, total)
}

export interface Deck extends DeckPosition {
  total: number
  stepCount: number
  next: () => void
  prev: () => void
  goTo: (slide: number, step?: number) => void
  /** Called by the rendered slide once it knows how many fragments it holds. */
  reportSteps: (count: number) => void
  overview: boolean
  setOverview: (v: boolean) => void
  blackout: boolean
}

export function useDeck(total: number): Deck {
  const [pos, setPos] = useState<DeckPosition>(() => readHash(total))
  const [stepCount, setStepCount] = useState(0)
  const [overview, setOverview] = useState(false)
  const [blackout, setBlackout] = useState(false)

  const channel = useRef<BroadcastChannel | null>(null)
  const echo = useRef(false)

  // --- cross-window sync (every open deck window follows) ------------------
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL)
    channel.current = ch
    ch.onmessage = (e: MessageEvent<DeckPosition>) => {
      echo.current = true
      setPos(clampPosition(e.data, total))
    }
    return () => {
      ch.close()
      channel.current = null
    }
  }, [total])

  const move = useCallback((updater: (p: DeckPosition) => DeckPosition) => {
    setPos((prev) => {
      const nextPos = updater(prev)
      if (nextPos.slide === prev.slide && nextPos.step === prev.step) return prev
      return nextPos
    })
  }, [])

  // --- publish position to the hash + the other window ---------------------
  useEffect(() => {
    if (pos.step === LAST_STEP) return // wait for the clamp, don't publish a sentinel
    const hash = `#/${pos.slide}/${pos.step}`
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash)
    }
    if (echo.current) {
      echo.current = false
      return
    }
    channel.current?.postMessage(pos)
  }, [pos])

  useEffect(() => {
    const onHashChange = () => setPos(readHash(total))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [total])

  // --- navigation ----------------------------------------------------------
  const next = useCallback(() => {
    move((p) => {
      if (p.step < stepCount) return { ...p, step: p.step + 1 }
      if (p.slide < total - 1) return { slide: p.slide + 1, step: 0 }
      return p
    })
  }, [move, stepCount, total])

  const prev = useCallback(() => {
    move((p) => {
      if (p.step > 0) return { ...p, step: p.step - 1 }
      if (p.slide > 0) return { slide: p.slide - 1, step: LAST_STEP }
      return p
    })
  }, [move])

  const goTo = useCallback(
    (slide: number, step = 0) => {
      move(() => ({ slide: Math.max(0, Math.min(total - 1, slide)), step }))
    },
    [move, total],
  )

  /** Slides report their fragment count on mount; clamp a LAST_STEP arrival. */
  const reportSteps = useCallback((count: number) => {
    setStepCount(count)
    setPos((p) => (p.step > count ? { ...p, step: count } : p))
  }, [])

  // --- keyboard ------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'n':
          e.preventDefault()
          next()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'p':
          e.preventDefault()
          prev()
          break
        case 'Home':
          e.preventDefault()
          goTo(0)
          break
        case 'End':
          e.preventDefault()
          goTo(total - 1, LAST_STEP)
          break
        case 'o':
          e.preventDefault()
          setOverview((v) => !v)
          break
        case 'Escape':
          setOverview(false)
          break
        case 'b':
        case '.':
          e.preventDefault()
          setBlackout((v) => !v)
          break
        case 'f':
          e.preventDefault()
          if (document.fullscreenElement) void document.exitFullscreen()
          else void document.documentElement.requestFullscreen()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, goTo, total])

  return {
    ...pos,
    total,
    stepCount,
    next,
    prev,
    goTo,
    reportSteps,
    overview,
    setOverview,
    blackout,
  }
}
