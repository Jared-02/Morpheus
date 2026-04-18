import { Navigate, useLocation, useParams } from 'react-router-dom'

export default function LegacyChapterRedirect() {
  const { projectId, chapterId } = useParams<{ projectId: string; chapterId?: string }>()
  const location = useLocation()

  if (!projectId) {
    return <Navigate to="/" replace />
  }

  const nextSearch = new URLSearchParams(location.search)
  if (chapterId) {
    nextSearch.set('chapter', chapterId)
  } else {
    nextSearch.delete('chapter')
  }

  const target = `/project/${projectId}/write${nextSearch.toString() ? `?${nextSearch.toString()}` : ''}`
  return <Navigate to={target} replace />
}
