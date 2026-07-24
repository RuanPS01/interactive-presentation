import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter evita 404 em deep-links/refresh no GitHub Pages (subpath). */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
