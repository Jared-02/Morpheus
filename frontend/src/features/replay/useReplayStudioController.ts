import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToastStore } from '../../stores/useToastStore'
import type { TraceData } from './replayShared'

export default function useReplayStudioController(projectId?: string, chapterId?: string) {
  const fetchProject = useProjectStore((state) => state.fetchProject) ?? (() => Promise.resolve(undefined))
  const storeChapters = useProjectStore((state) => state.chapters) ?? []
  const fetchChapters = useProjectStore((state) => state.fetchChapters) ?? (() => Promise.resolve([]))
  const addToast = useToastStore((state) => state.addToast)
  const navigate = useNavigate()

  const [trace, setTrace] = useState<TraceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId)
    }
  }, [fetchProject, projectId])

  useEffect(() => {
    if (!projectId || chapterId) return
    setLoading(true)
    void fetchChapters(projectId).finally(() => setLoading(false))
  }, [chapterId, fetchChapters, projectId])

  const loadTrace = useCallback(async () => {
    if (!chapterId) return
    setLoading(true)
    try {
      const response = await api.get(`/trace/${chapterId}`)
      setTrace(response.data)
      setSelectedDecisionId(response.data.decisions?.[0]?.id ?? null)
    } catch {
      addToast('error', '获取决策回放数据失败')
      setTrace(null)
    } finally {
      setLoading(false)
    }
  }, [addToast, chapterId])

  useEffect(() => {
    if (chapterId) {
      void loadTrace()
    }
  }, [chapterId, loadTrace])

  const selectedDecision = useMemo(
    () => trace?.decisions.find((decision) => decision.id === selectedDecisionId) ?? null,
    [selectedDecisionId, trace],
  )

  const sortedChapters = useMemo(
    () => [...storeChapters].sort((left, right) => left.chapter_number - right.chapter_number),
    [storeChapters],
  )

  const openChapterTrace = useCallback(
    (targetChapterId: string) => {
      if (!projectId) return
      navigate(`/project/${projectId}/trace/${targetChapterId}`)
    },
    [navigate, projectId],
  )

  return {
    loading,
    trace,
    sortedChapters,
    selectedDecisionId,
    setSelectedDecisionId,
    selectedDecision,
    openChapterTrace,
  }
}
