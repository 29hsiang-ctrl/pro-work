import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { SettingsProvider } from './context/SettingsContext.jsx'
import { ProjectProvider } from './context/ProjectContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SettingsProvider>
        <ProjectProvider>
          <App />
        </ProjectProvider>
      </SettingsProvider>
    </AuthProvider>
  </StrictMode>,
)
