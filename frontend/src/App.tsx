import { lazy, Suspense } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import StudioAppShell from './app/shell/StudioAppShell'
import ErrorBoundary from './components/ui/ErrorBoundary'
import Skeleton from './components/ui/Skeleton'

const ProjectList = lazy(() => import('./pages/ProjectList'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const WritingStudioPage = lazy(() => import('./pages/WritingStudioPage'))
const LegacyChapterRedirect = lazy(() => import('./pages/LegacyChapterRedirect'))
const MemoryBrowserPage = lazy(() => import('./pages/MemoryBrowserPage'))
const KnowledgeGraphPage = lazy(() => import('./pages/KnowledgeGraphPage'))
const TraceReplayPage = lazy(() => import('./pages/TraceReplayPage'))
const NarrativeModelPage = lazy(() => import('./pages/NarrativeModelPage'))
const ReplayStudioPage = lazy(() => import('./pages/ReplayStudioPage'))
const AgentStudioPage = lazy(() => import('./pages/AgentStudioPage'))
const MediaStudioPage = lazy(() => import('./pages/MediaStudioPage'))
const StoryboardStudioPage = lazy(() => import('./pages/StoryboardStudioPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="app-layout__content"><Skeleton variant="card" count={3} /></div>}>
        <Routes>
          <Route path="/project/:projectId" element={<StudioAppShell />}>
            <Route index element={<ProjectDetail />} />
            <Route path="write" element={<WritingStudioPage />} />
            <Route path="model" element={<NarrativeModelPage />} />
            <Route path="replay" element={<ReplayStudioPage />} />
            <Route path="agents" element={<AgentStudioPage />} />
            <Route path="media" element={<Navigate to="audio-book" replace />} />
            <Route path="media/audio-book" element={<MediaStudioPage />} />
            <Route path="media/storyboard" element={<StoryboardStudioPage />} />
          </Route>

          <Route path="/project/:projectId/chapter" element={<LegacyChapterRedirect />} />
          <Route path="/project/:projectId/chapter/:chapterId" element={<LegacyChapterRedirect />} />

          <Route element={<AppLayout />}>
            <Route path="/" element={<ProjectList />} />
            <Route path="/project/:projectId/memory" element={<MemoryBrowserPage />} />
            <Route path="/project/:projectId/graph" element={<KnowledgeGraphPage />} />
            <Route path="/project/:projectId/trace" element={<TraceReplayPage />} />
            <Route path="/project/:projectId/trace/:chapterId" element={<TraceReplayPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
