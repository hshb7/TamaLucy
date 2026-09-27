import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-600.css'
import '@fontsource/dotgothic16/latin-400.css'
import './styles.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

try {
  registerSW({ immediate: true })
} catch {
  // service workers unavailable (private mode, embedded preview): app still works online
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
