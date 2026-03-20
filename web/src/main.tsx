import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { LocaleProvider } from './i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </LocaleProvider>
  </StrictMode>,
)
