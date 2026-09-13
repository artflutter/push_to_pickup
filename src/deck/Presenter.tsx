import { useEffect, useState } from 'react'
import { SlideView } from './Slide'
import { Thumb } from './Thumb'
import { useDeck } from './useDeck'
import { slides } from './slides'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function format(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Second-screen view: current slide, what is coming next, notes and a timer.
 * Opens with `s`; stays in sync with the audience window over BroadcastChannel.
 */
export function Presenter() {
  const deck = useDeck(slides.length)
  const clock = useClock()
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  const slide = slides[Math.min(deck.slide, slides.length - 1)]
  const next = slides[deck.slide + 1]

  return (
    <div className="presenter">
      <header className="presenter__bar no-nav">
        <button onClick={() => setRunning((r) => !r)}>{running ? '⏸' : '▶'}</button>
        <button onClick={() => setElapsed(0)}>↺</button>
        <span className="presenter__timer">{format(elapsed)}</span>
        <span className="presenter__clock">{clock.toLocaleTimeString()}</span>
        <span className="presenter__pos">
          slide {deck.slide + 1}/{slides.length} · step {deck.step}/{deck.stepCount}
        </span>
      </header>

      <div className="presenter__grid">
        <div className="presenter__pane">
          <div className="presenter__label">Now</div>
          <Thumb className="presenter__thumb">
            <SlideView slide={slide} step={deck.step} onSteps={deck.reportSteps} />
          </Thumb>
        </div>

        <div className="presenter__side">
          <div className="presenter__pane">
            <div className="presenter__label">Next</div>
            <Thumb className="presenter__thumb">
              {next ? <SlideView slide={next} step={0} frozen /> : <div className="presenter__end">— end —</div>}
            </Thumb>
          </div>

          <div className="presenter__notes">
            <div className="presenter__label">Notes</div>
            <p>{slide.notes ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
