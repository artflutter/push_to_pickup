import { createRoot } from 'react-dom/client'
import { Deck } from './deck/Deck'
import { Print } from './deck/Print'
import { preloadHighlighter } from './deck/highlighter'
import './styles/theme.css'
import './styles/deck.css'
import './styles/print.css'

preloadHighlighter()

// Offline first: the built deck caches itself (scripts/offline.mjs), so it
// still opens with no network once it has been loaded.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
}

const params = new URLSearchParams(window.location.search)
const View = params.has('print') ? Print : Deck

document.documentElement.dataset.view = params.has('print') ? 'print' : 'deck'

// No StrictMode: fragments assign their step ordinal during first render, and
// the double-invoke would count every fragment twice.
createRoot(document.getElementById('root')!).render(<View />)
