import { createContext, useContext } from 'react'

export interface SlideRuntime {
  /** Current step inside this slide. 0 = nothing revealed yet. */
  step: number
  /** Called once per fragment during its first render. Returns its 1-based ordinal. */
  register: (at?: number) => number
  /** True in the presenter preview / overview — fragments render fully revealed. */
  static: boolean
  /** False for a retained neighbouring scene; it must not cue the traveller. */
  active?: boolean
  /** Move the deck on (next step or next slide) — for choreographies that end by themselves. Absent in static views. */
  advance?: () => void
  /** Position of this slide in the deck (0-based). Absent in static views. */
  index?: number
}

export const SlideContext = createContext<SlideRuntime>({
  step: 0,
  register: () => 1,
  static: true,
})

export const useSlide = () => useContext(SlideContext)
