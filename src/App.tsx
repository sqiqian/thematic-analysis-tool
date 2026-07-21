import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import { Dashboard } from './components/Dashboard'
import { ProjectView } from './components/ProjectView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/project/:projectId" element={<ProjectViewWrapper />} />
      </Routes>
    </BrowserRouter>
  )
}

function ProjectViewWrapper() {
  const { projectId } = useParams<{ projectId: string }>()
  if (!projectId) return null
  return (
    <div className="h-full">
      <ProjectView projectId={projectId} />
    </div>
  )
}
