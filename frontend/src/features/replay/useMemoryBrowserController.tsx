import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { L4_PROFILE_ENABLED } from '../../config/features'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToastStore } from '../../stores/useToastStore'
import type { CharacterProfile, MemoryFileItem, MemoryResult } from './memoryShared'

export default function useMemoryBrowserController(projectId?: string) {
  const fetchProject = useProjectStore((state) => state.fetchProject)
  const currentProject = useProjectStore((state) => state.currentProject)
  const addToast = useToastStore((state) => state.addToast)

  const [view, setView] = useState<'browse' | 'identity'>('browse')
  const [identity, setIdentity] = useState('')
  const [runtimeState, setRuntimeState] = useState('')
  const [identityLoading, setIdentityLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [query, setQuery] = useState('')
  const [layerFilter, setLayerFilter] = useState('')
  const [results, setResults] = useState<MemoryResult[]>([])
  const [searching, setSearching] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [memoryFiles, setMemoryFiles] = useState<MemoryFileItem[]>([])
  const [memoryFilesLoading, setMemoryFilesLoading] = useState(false)
  const [expandedFilePath, setExpandedFilePath] = useState<string | null>(null)
  const [expandedFileContent, setExpandedFileContent] = useState('')
  const [fileContentLoading, setFileContentLoading] = useState(false)
  const [overviewFilter, setOverviewFilter] = useState('')
  const [fileSearchQuery, setFileSearchQuery] = useState('')

  const [profiles, setProfiles] = useState<CharacterProfile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)

  useEffect(() => {
    if (projectId && currentProject?.id !== projectId) {
      fetchProject(projectId)
    }
  }, [currentProject?.id, fetchProject, projectId])

  const loadIdentity = useCallback(async () => {
    if (!projectId) return
    setIdentityLoading(true)
    try {
      const response = await api.get(`/identity/${projectId}`)
      setIdentity(response.data.content)
      setRuntimeState(response.data.runtime_state || '')
    } catch {
      addToast('error', '加载身份设定失败')
    } finally {
      setIdentityLoading(false)
    }
  }, [addToast, projectId])

  const loadMemoryFiles = useCallback(async () => {
    if (!projectId) return
    setMemoryFilesLoading(true)
    try {
      const response = await api.get(`/projects/${projectId}/memory/files`)
      setMemoryFiles(response.data.files ?? [])
    } catch {
      addToast('error', '加载记忆文件列表失败')
    } finally {
      setMemoryFilesLoading(false)
    }
  }, [addToast, projectId])

  useEffect(() => {
    if (!projectId) return
    void loadIdentity()
    void loadMemoryFiles()
  }, [loadIdentity, loadMemoryFiles, projectId])

  const loadFileContent = useCallback(async (sourcePath: string) => {
    if (!projectId) return
    if (expandedFilePath === sourcePath) {
      setExpandedFilePath(null)
      return
    }

    setExpandedFilePath(sourcePath)
    setFileContentLoading(true)
    try {
      const response = await api.get(`/projects/${projectId}/memory/source`, { params: { source_path: sourcePath } })
      setExpandedFileContent(
        typeof response.data === 'string' ? response.data : response.data.content ?? JSON.stringify(response.data, null, 2),
      )
    } catch {
      setExpandedFileContent('(加载失败)')
    } finally {
      setFileContentLoading(false)
    }
  }, [expandedFilePath, projectId])

  const saveIdentity = useCallback(async () => {
    if (!projectId) return
    setSaving(true)
    try {
      await api.put(`/identity/${projectId}`, { content: identity })
      addToast('success', '身份设定已保存')
    } catch {
      addToast('error', '保存身份设定失败')
    } finally {
      setSaving(false)
    }
  }, [addToast, identity, projectId])

  const loadProfiles = useCallback(async () => {
    if (!projectId) return
    setProfilesLoading(true)
    try {
      const response = await api.get(`/projects/${projectId}/profiles`)
      setProfiles(response.data ?? [])
    } catch {
      addToast('error', '加载角色档案失败')
    } finally {
      setProfilesLoading(false)
    }
  }, [addToast, projectId])

  useEffect(() => {
    if (layerFilter === 'L4' && L4_PROFILE_ENABLED) {
      void loadProfiles()
    }
  }, [layerFilter, loadProfiles])

  const rebuildProfiles = useCallback(async () => {
    if (!projectId) return
    setRebuilding(true)
    try {
      await api.post(`/projects/${projectId}/profiles/rebuild`, {})
      addToast('success', 'L4 档案重建完成')
      void loadProfiles()
    } catch {
      addToast('error', 'L4 档案重建失败')
    } finally {
      setRebuilding(false)
    }
  }, [addToast, loadProfiles, projectId])

  const searchMemory = useCallback(async (opts?: { query?: string; layer?: string; silentWhenEmpty?: boolean }) => {
    const q = (opts?.query ?? query).trim()
    if (!q || !projectId) return
    const layer = opts?.layer ?? layerFilter
    setSearching(true)
    setExpandedId(null)
    try {
      const response = await api.get('/memory/query', {
        timeout: 45000,
        params: { project_id: projectId, query: q, layers: layer || undefined },
      })
      setResults(response.data.results ?? [])
      if ((response.data.results?.length ?? 0) === 0 && !opts?.silentWhenEmpty) {
        addToast('info', '未找到匹配的记忆条目')
      }
    } catch (error: any) {
      const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message || ''))
      addToast('error', isTimeout ? '记忆检索超时，请稍后重试' : '记忆检索失败')
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [addToast, layerFilter, projectId, query])

  const filteredResults = useMemo(
    () => (layerFilter ? results.filter((result) => result.layer === layerFilter) : results),
    [layerFilter, results],
  )

  const handleQuickSearch = useCallback((queryText: string, layer: string) => {
    setQuery(queryText)
    setLayerFilter(layer)
    void searchMemory({ query: queryText, layer, silentWhenEmpty: true })
  }, [searchMemory])

  const filteredFiles = useMemo(() => {
    let list = overviewFilter ? memoryFiles.filter((file) => file.layer === overviewFilter) : memoryFiles
    if (fileSearchQuery.trim()) {
      const q = fileSearchQuery.trim().toLowerCase()
      list = list.filter(
        (file) =>
          file.name.toLowerCase().includes(q) ||
          file.summary.toLowerCase().includes(q) ||
          file.path.toLowerCase().includes(q) ||
          (file.item_type || '').toLowerCase().includes(q),
      )
    }

    const chapterNumFromSummary = (summary: string): number => {
      const match = summary.match(/Chapter\s+(\d+)/i)
      return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY
    }

    return [...list].sort((left, right) => {
      const layerOrder: Record<string, number> = { L1: 0, L2: 1, L3: 2, root: 3 }
      const leftOrder = layerOrder[left.layer] ?? 4
      const rightOrder = layerOrder[right.layer] ?? 4
      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      if (left.layer === 'L3' && right.layer === 'L3') {
        return chapterNumFromSummary(left.summary) - chapterNumFromSummary(right.summary)
      }
      return 0
    })
  }, [fileSearchQuery, memoryFiles, overviewFilter])

  return {
    view,
    setView,
    identity,
    setIdentity,
    runtimeState,
    identityLoading,
    saving,
    saveIdentity,
    query,
    setQuery,
    layerFilter,
    setLayerFilter,
    results,
    searching,
    expandedId,
    setExpandedId,
    memoryFiles,
    memoryFilesLoading,
    loadMemoryFiles,
    expandedFilePath,
    expandedFileContent,
    fileContentLoading,
    loadFileContent,
    overviewFilter,
    setOverviewFilter,
    fileSearchQuery,
    setFileSearchQuery,
    profiles,
    profilesLoading,
    rebuilding,
    rebuildProfiles,
    searchMemory,
    filteredResults,
    handleQuickSearch,
    filteredFiles,
  }
}
