import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-600.css'
import '@fontsource/dotgothic16/latin-400.css'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { isNativeApp } from './native.ts'

// offline support for the web app (the iPhone app already has its files built in)
if (!isNativeApp) {
  try {
    registerSW({ immediate: true })
  } catch {
    // service workers unavailable (private mode, embedded preview): app still works online
  }
}

// `#write` opens the post office (for sending letters) instead of the game.
const writing = () => location.hash.startsWith('#write')
const mode = writing()
const Root = lazy(() => (mode ? import('./write/PostOffice.tsx') : import('./App.tsx')))
window.addEventListener('hashchange', () => writing() !== mode && location.reload())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
)
