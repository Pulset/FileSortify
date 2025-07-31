import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { LoggerProvider } from './contexts/LoggerContext.tsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <LoggerProvider>
    <App />
  </LoggerProvider>
)