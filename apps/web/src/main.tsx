import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ProjectProvider } from './contexts/ProjectContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </StrictMode>
)
