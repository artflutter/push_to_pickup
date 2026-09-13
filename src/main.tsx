import { createRoot } from 'react-dom/client'
import { Deck } from './deck/Deck'
import { Presenter } from './deck/Presenter'
import { Print } from './deck/Print'
import { preloadHighlighter } from './deck/highlighter'
import './styles/theme.css'
import './styles/deck.css'
import './styles/print.css'

preloadHighlighter()

const params = new URLSearchParams(window.location.search)
const View = params.has('presenter') ? Presenter : params.has('print') ? Print : Deck

document.documentElement.dataset.view = params.has('presenter')
  ? 'presenter'
  : params.has('print')
    ? 'print'
    : 'deck'

// No StrictMode: fragments assign their step ordinal during first render, and
// the double-invoke would count every fragment twice.
createRoot(document.getElementById('root')!).render(<View />)
