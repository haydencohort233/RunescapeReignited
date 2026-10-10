import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { validateContent } from './content/validate'

// Content typos (an unknown item id, a zero craft time) fail loudly in
// development instead of silently doing nothing in game.
if (import.meta.env.DEV) {
  for (const problem of validateContent()) console.error(`[content] ${problem}`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
