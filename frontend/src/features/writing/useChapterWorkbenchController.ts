import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, LLM_TIMEOUT } from '../../lib/api'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToastStore } from '../../stores/useToastStore'
import { useActivityStore } from '../../stores/useActivityStore'
import { useRecentAccessStore } from '../../stores/useRecentAccessStore'
import { useUIStore } from '../../stores/useUIStore'
import { useAutoSave } from '../../hooks/useAutoSave'
import type { ChapterContent } from '../../services/exportService'
import {
  buildFanqieTagsPayload,
  buildStreamSideChannelText,
  chapterStatusMeta,
  cleanBlueprintText,
  DEFAULT_FANQIE_TAGS,
  EMPTY_STREAM_SIDE_CHANNEL_TEXT,
  getApiErrorDetail,
  normalizeFanqieTagField,
  parseBlueprintDetailItems,
  parseFanqieLoginRequired,
  type BlueprintValueCard,
  type Chapter,
  type FanqieCreateFormState,
  type PlanQuality,
  type PlanQualityDebug,
  type StreamChannel,
  type StreamSideChannelText,
  type TracePayload,
} from './chapterWorkbenchShared'

type ReviewAction = 'approve' | 'reject'

interface ChapterWorkbenchControllerOptions {
  chapterIdOverride?: string | null
  onNavigateToChapter?: (chapterId: string) => void
  onExitToProject?: () => void
  recentAccessPathBuilder?: (projectId: string, chapterId: string) => string
}

function sanitizeReadingModeText(value: string) {
  return String(value || '')
    .replace(/<(?:think|thinking)>[\s\S]*?<\/(?:think|thinking)>/gi, '')
    .replace(/【\s*(?:thinking|thoughts?|reasoning)\s*[:：][^】]*】/gi, '')
    .replace(/^\s*\[(?:thinking|thoughts?|reasoning)\s*[:：][^\]]*]\s*$/gim, '')
    .trim()
}

async function readStreamChannelText(chapterId: string): Promise<StreamSideChannelText> {
  try {
    const response = await api.get(`/trace/${chapterId}`)
    return buildStreamSideChannelText(response.data as TracePayload)
  } catch {
    return { ...EMPTY_STREAM_SIDE_CHANNEL_TEXT }
  }
}

async function deleteChapterRequest(targetChapterId: string) {
  try {
    await api.delete(`/chapters/${targetChapterId}`)
  } catch (error: any) {
    if (error?.response?.status === 405) {
      await api.post(`/chapters/${targetChapterId}/delete`)
      return
    }
    throw error
  }
}

export default function useChapterWorkbenchController(options: ChapterWorkbenchControllerOptions = {}) {
  const {
    chapterIdOverride,
    onNavigateToChapter,
    onExitToProject,
    recentAccessPathBuilder,
  } = options
  const { projectId, chapterId: routeChapterId } = useParams<{ projectId: string; chapterId: string }>()
  const chapterId = chapterIdOverride ?? routeChapterId
  const navigate = useNavigate()

  const currentProject = useProjectStore((state) => state.currentProject)
  const storeChapters = useProjectStore((state) => state.chapters)
  const fetchChapters = useProjectStore((state) => state.fetchChapters)
  const fetchProject = useProjectStore((state) => state.fetchProject)
  const invalidateCache = useProjectStore((state) => state.invalidateCache)
  const addToast = useToastStore((state) => state.addToast)
  const addRecord = useActivityStore((state) => state.addRecord)
  const addAccess = useRecentAccessStore((state) => state.addAccess)
  const removeChapter = useRecentAccessStore((state) => state.removeChapter)
  const readingMode = useUIStore((state) => state.readingMode)
  const enterReadingMode = useUIStore((state) => state.enterReadingMode)
  const exitReadingMode = useUIStore((state) => state.exitReadingMode)

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)
  const [draftContent, setDraftContent] = useState('')
  const [streamChannel, setStreamChannel] = useState<StreamChannel>('arbiter')
  const [streamChannelText, setStreamChannelText] = useState<StreamSideChannelText>({
    ...EMPTY_STREAM_SIDE_CHANNEL_TEXT,
  })
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamingStage, setStreamingStage] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [creatingFanqieBook, setCreatingFanqieBook] = useState(false)
  const [fillingFanqieByLLM, setFillingFanqieByLLM] = useState(false)
  const [showFanqieCreateForm, setShowFanqieCreateForm] = useState(false)
  const [fanqieBookIdInput, setFanqieBookIdInput] = useState(currentProject?.fanqie_book_id || '')
  const [fanqieCreateForm, setFanqieCreateForm] = useState<FanqieCreateFormState>({
    intro: '',
    protagonist1: '',
    protagonist2: '',
    targetReader: 'male',
    tagsByTab: { ...DEFAULT_FANQIE_TAGS },
  })
  const [showDraftRestore, setShowDraftRestore] = useState(false)
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingChapter, setDeletingChapter] = useState(false)
  const [directionHint, setDirectionHint] = useState('')

  const readingModeRef = useRef(readingMode)
  readingModeRef.current = readingMode

  const autoSave = useAutoSave({
    key: `draft-${chapterId}`,
    content: draftContent,
    debounceMs: 2000,
  })
  const hasLocalDraft = autoSave.hasDraft
  const localDraftContent = autoSave.draftContent
  const clearLocalDraft = autoSave.clearDraft

  const loadChapter = useCallback(async () => {
    if (!chapterId) return
    try {
      const response = await api.get(`/chapters/${chapterId}`)
      setChapter(response.data)
      setDraftContent(response.data.draft ?? response.data.final ?? '')
      const nextStreamText = await readStreamChannelText(chapterId)
      setStreamChannelText(nextStreamText)
    } catch (error: any) {
      console.error(error)
      if (error?.response?.status === 404) {
        removeChapter(chapterId)
        addToast('warning', '该章节已不存在，已从最近访问中移除')
        if (projectId) {
          if (onExitToProject) {
            onExitToProject()
          } else {
            navigate(`/project/${projectId}`)
          }
        }
      } else {
        addToast('error', '加载章节失败，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }, [addToast, chapterId, navigate, onExitToProject, projectId, removeChapter])

  useEffect(() => {
    if (projectId && currentProject?.id !== projectId) {
      void fetchProject(projectId)
    }
  }, [currentProject?.id, fetchProject, projectId])

  useEffect(() => {
    if (!projectId || chapterId) return
    setLoading(true)
    void fetchChapters(projectId).finally(() => setLoading(false))
  }, [chapterId, fetchChapters, projectId])

  useEffect(() => {
    if (!chapterId) return
    setLoading(true)
    void loadChapter()
    if (projectId) {
      try {
        void fetchProject(projectId)
      } catch {
        // Ignore project preload errors here; chapter load handles the primary UX.
      }
      void fetchChapters(projectId)
    }
  }, [chapterId, fetchChapters, fetchProject, loadChapter, projectId])

  useEffect(() => {
    setFanqieBookIdInput(currentProject?.fanqie_book_id || '')
  }, [currentProject?.fanqie_book_id])

  useEffect(() => {
    if (chapter && chapterId && projectId) {
        addAccess({
          type: 'chapter',
          id: chapterId,
          name: `第 ${chapter.chapter_number} 章 · ${chapter.title}`,
          path: recentAccessPathBuilder
            ? recentAccessPathBuilder(projectId, chapterId)
            : `/project/${projectId}/chapter/${chapterId}`,
          projectId,
        })
      }
  }, [addAccess, chapter, chapterId, projectId, recentAccessPathBuilder])

  useEffect(() => {
    return () => {
      if (readingModeRef.current) {
        exitReadingMode()
      }
    }
  }, [exitReadingMode])

  useEffect(() => {
    if (loading || streaming || !chapter || !hasLocalDraft) return
    const localDraft = localDraftContent ?? ''
    const remoteDraft = chapter.draft ?? chapter.final ?? ''
    if (!localDraft) return

    if (localDraft === remoteDraft) {
      clearLocalDraft()
      setShowDraftRestore(false)
      return
    }
    setShowDraftRestore(true)
  }, [chapter, clearLocalDraft, hasLocalDraft, loading, localDraftContent, streaming])

  const saveDraft = useCallback(async () => {
    if (!chapterId) return
    setSavingDraft(true)
    try {
      const response = await api.put(`/chapters/${chapterId}/draft`, { draft: draftContent })
      setChapter(response.data.chapter)
      setDraftContent(response.data.chapter?.draft ?? draftContent)
      clearLocalDraft()
      if (projectId) {
        invalidateCache('project', projectId)
        invalidateCache('chapters', projectId)
        await Promise.all([
          fetchProject(projectId, { force: true }),
          fetchChapters(projectId, { force: true }),
        ])
      }
      addToast('success', '草稿保存成功')
      addRecord({ type: 'save', description: '草稿保存成功', status: 'success' })
    } catch (error: any) {
      console.error(error)
      addToast('error', '保存草稿失败', {
        context: '草稿保存',
        actions: [{ label: '重试', onClick: () => void saveDraft() }],
        detail: error?.response?.data?.detail || error?.message,
      })
      addRecord({ type: 'save', description: '草稿保存失败', status: 'error', retryAction: () => void saveDraft() })
    } finally {
      setSavingDraft(false)
    }
  }, [
    addRecord,
    addToast,
    chapterId,
    clearLocalDraft,
    draftContent,
    fetchChapters,
    fetchProject,
    invalidateCache,
    projectId,
  ])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return
      if (savingDraft || streaming) return
      event.preventDefault()
      void saveDraft()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveDraft, savingDraft, streaming])

  const handleRestoreDraft = useCallback(() => {
    const restored = autoSave.restoreDraft()
    if (restored) {
      setDraftContent(restored)
    }
    setShowDraftRestore(false)
  }, [autoSave])

  const handleDiscardDraft = useCallback(() => {
    autoSave.discardDraft()
    setShowDraftRestore(false)
  }, [autoSave])

  const p0Conflicts = useMemo(
    () => (chapter?.conflicts || []).filter((conflict) => conflict.severity === 'P0' && !conflict.resolved && !conflict.exempted),
    [chapter],
  )
  const p1Conflicts = useMemo(
    () => (chapter?.conflicts || []).filter((conflict) => conflict.severity === 'P1'),
    [chapter],
  )
  const p2Conflicts = useMemo(
    () => (chapter?.conflicts || []).filter((conflict) => conflict.severity === 'P2'),
    [chapter],
  )

  const isGenerating = streaming
  const statusKey = String(chapter?.status || 'draft').toLowerCase()
  const statusMeta = chapterStatusMeta[statusKey] || chapterStatusMeta.draft
  const isApproved = statusKey === 'approved'
  const canApproveDraft = !isGenerating && p0Conflicts.length === 0 && (!!draftContent.trim() || isApproved)
  const canSubmitApproval = isApproved ? !isGenerating : canApproveDraft
  const primaryActionLabel = isApproved ? '重新打开审核' : '提交审批'
  const primaryActionReason = isApproved
    ? isGenerating
      ? '正在生成中，请等待完成或停止当前任务'
      : '当前章节已审批，如需修改请先重新打开审核'
    : p0Conflicts.length > 0
      ? '存在 P0 冲突，请先解决后再审批'
      : !draftContent.trim()
        ? '无草稿内容'
        : '正在生成中，请等待完成或停止当前任务'

  const blueprintBeats = useMemo(
    () => (chapter?.plan?.beats || []).map(cleanBlueprintText).filter(Boolean),
    [chapter?.plan?.beats],
  )
  const blueprintConflicts = useMemo<BlueprintValueCard[]>(
    () =>
      parseBlueprintDetailItems(chapter?.plan?.conflicts || [], {
        titleKeys: ['type', '冲突', '冲突类型'],
        detailKeys: ['description', '说明'],
      }).map((item) => ({
        headline: item.title,
        body: item.detail,
      })),
    [chapter?.plan?.conflicts],
  )
  const blueprintForeshadowing = useMemo(
    () =>
      parseBlueprintDetailItems(chapter?.plan?.foreshadowing || [], {
        titleKeys: ['item', '伏笔', '埋伏笔'],
        detailKeys: ['description', '说明'],
      }),
    [chapter?.plan?.foreshadowing],
  )
  const blueprintCallbacks = useMemo(
    () =>
      parseBlueprintDetailItems(chapter?.plan?.callback_targets || [], {
        titleKeys: ['target', '回收目标'],
        detailKeys: ['potential_use', '用途', '回收方式'],
        ignoreKeys: ['source_chapter'],
      }),
    [chapter?.plan?.callback_targets],
  )
  const planQuality = chapter?.plan_quality || null
  const planQualityMessages = useMemo(() => {
    if (!planQuality) return [] as string[]
    const issues = Array.isArray(planQuality.issues) ? planQuality.issues : []
    const warnings = Array.isArray(planQuality.warnings) ? planQuality.warnings : []
    return [...issues, ...warnings].filter(Boolean)
  }, [planQuality])

  const sortedChapters = useMemo(
    () => [...storeChapters].sort((left, right) => left.chapter_number - right.chapter_number),
    [storeChapters],
  )
  const currentChapterIndex = useMemo(
    () => sortedChapters.findIndex((item) => item.id === chapterId),
    [chapterId, sortedChapters],
  )
  const hasPrevChapter = currentChapterIndex > 0
  const hasNextChapter = currentChapterIndex >= 0 && currentChapterIndex < sortedChapters.length - 1

  const navigateToChapter = useCallback((index: number) => {
    const target = sortedChapters[index]
    if (target && projectId) {
      if (onNavigateToChapter) {
        onNavigateToChapter(target.id)
      } else {
        navigate(`/project/${projectId}/chapter/${target.id}`)
      }
    }
  }, [navigate, onNavigateToChapter, projectId, sortedChapters])

  const readingTocItems = useMemo(
    () =>
      sortedChapters.map((item, index) => ({
        id: item.id,
        label: `第${item.chapter_number}章 · ${item.title || '未命名章节'}`,
        active: index === currentChapterIndex,
        onClick: () => navigateToChapter(index),
      })),
    [currentChapterIndex, navigateToChapter, sortedChapters],
  )

  const currentChapterExport: ChapterContent | undefined = chapter
    ? {
      chapterNumber: chapter.chapter_number,
      title: chapter.title,
      content: chapter.final || chapter.draft || draftContent || '',
    }
    : undefined

  const allChaptersExport: ChapterContent[] = useMemo(
    () =>
      storeChapters
        .filter((item) => item.word_count > 0)
        .map((item) => ({
          chapterNumber: item.chapter_number,
          title: item.title,
          content: '',
        })),
    [storeChapters],
  )

  const generatePlan = useCallback(async () => {
    if (!chapterId) return
    setLoadingPlan(true)
    try {
      const response = await api.post(
        `/chapters/${chapterId}/plan`,
        { direction_hint: directionHint.trim() || undefined },
        { timeout: LLM_TIMEOUT },
      )
      const quality = response?.data?.quality as PlanQuality | undefined
      const qualityDebug = response?.data?.quality_debug as PlanQualityDebug | undefined
      if (response?.data?.plan) {
        setChapter((previous) => (previous
          ? {
            ...previous,
            plan: response.data.plan,
            plan_quality: quality || previous.plan_quality || null,
          }
          : previous))
      }
      await loadChapter()
      addToast('success', '蓝图生成成功')
      if (quality && String(quality.status).toLowerCase() !== 'ok') {
        const debugMeta = qualityDebug
          ? `解析来源=${quality.parser_source || '-'}；选用=${qualityDebug.selected_source || '-'}；初次输出长度=${qualityDebug.initial_output_length ?? 0}；重试输出长度=${qualityDebug.retry_output_length ?? 0}`
          : ''
        const detail = [...(quality.issues || []), ...(quality.warnings || []), debugMeta].filter(Boolean).join('；')
        addToast('warning', '蓝图质量告警', {
          context: `质量分 ${quality.score ?? '-'}，建议继续重试或手动微调`,
          detail: detail || '蓝图已生成，但结构质量未达到最佳阈值。',
        })
      }
      addRecord({ type: 'generate', description: '蓝图生成成功', status: 'success' })
    } catch (error: any) {
      console.error(error)
      addToast('error', '蓝图生成失败', {
        context: '蓝图生成',
        actions: [{ label: '重试', onClick: () => void generatePlan() }],
        detail: error?.response?.data?.detail || error?.message,
      })
      addRecord({ type: 'generate', description: '蓝图生成失败', status: 'error', retryAction: () => void generatePlan() })
    } finally {
      setLoadingPlan(false)
    }
  }, [addRecord, addToast, chapterId, directionHint, loadChapter])

  const redoDraft = useCallback(async () => {
    if (!chapterId || !chapter) return
    setStreaming(true)
    setStreamChannel('arbiter')
    setShowDraftRestore(false)
    setDraftContent('')
    setStreamChannelText({ ...EMPTY_STREAM_SIDE_CHANNEL_TEXT })

    const controller = new AbortController()
    try {
      const response = await fetch(`/api/chapters/${chapterId}/one-shot/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: directionHint.trim() || chapter.goal,
          mode: 'studio',
          target_words: 1600,
          override_goal: true,
          rewrite_plan: true,
        }),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        const detail = await response.text()
        throw new Error(detail || `HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() || ''
        for (const frame of frames) {
          const lines = frame.split('\n').map((line) => line.trim()).filter(Boolean)
          let eventName = 'message'
          const dataLines: string[] = []
          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim()
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
          }
          const raw = dataLines.join('\n')
          if (!raw) continue
          const payload = JSON.parse(raw)
          if (eventName === 'stage') {
            setStreamingStage(payload.label || payload.stage)
            continue
          }
          if (eventName === 'chunk') {
            setDraftContent((previous) => previous + String(payload.chunk || ''))
            continue
          }
          if (eventName === 'done') {
            clearLocalDraft()
            setShowDraftRestore(false)
            setStreaming(false)
            setStreamingStage(null)
            await loadChapter()
            addToast('success', '本章重做完成')
            addRecord({ type: 'generate', description: '本章重做完成', status: 'success' })
            return
          }
          if (eventName === 'error') {
            throw new Error(payload.detail || '本章重做失败')
          }
        }
      }
    } catch (error: any) {
      setStreaming(false)
      setStreamingStage(null)
      addToast('error', '本章重做失败', {
        context: '章节重做',
        detail: error?.message,
        actions: [{ label: '重试', onClick: () => void redoDraft() }],
      })
      addRecord({ type: 'generate', description: '本章重做失败', status: 'error', retryAction: () => void redoDraft() })
    }
  }, [addRecord, addToast, chapter, chapterId, clearLocalDraft, directionHint, loadChapter])

  const reviewDraft = useCallback(async (action: ReviewAction) => {
    if (!chapterId) return
    try {
      await api.post('/review', { chapter_id: chapterId, action }, { timeout: LLM_TIMEOUT })
      if (projectId) {
        invalidateCache('chapters', projectId)
      }
      await loadChapter()
      addToast('success', action === 'approve' ? '审批通过，可进入下一章节继续创作' : '已退回重写')
      addRecord({ type: 'approve', description: action === 'approve' ? '审批通过' : '退回重写', status: 'success' })
    } catch (error: any) {
      console.error(error)
      const detail = error?.response?.data?.detail || error?.message
      const isP0PolicyError = detail === 'P0 conflicts must be resolved before approval' || detail === 'P0 conflicts cannot be exempted'
      addToast('error', isP0PolicyError ? '需先解决 P0 冲突后再审批' : '提交审批失败', {
        context: '审批操作',
        actions: [{ label: '重试', onClick: () => void reviewDraft(action) }],
        detail,
      })
      addRecord({ type: 'approve', description: '审批操作失败', status: 'error', retryAction: () => void reviewDraft(action) })
    }
  }, [addRecord, addToast, chapterId, invalidateCache, loadChapter, projectId])

  const reopenReview = useCallback(async () => {
    if (!chapterId) return
    try {
      await api.post('/review', { chapter_id: chapterId, action: 'rescan' }, { timeout: LLM_TIMEOUT })
      await loadChapter()
      addToast('success', '已重新打开审核，可继续修改后再提交审批')
      addRecord({ type: 'approve', description: '重新打开审核', status: 'success' })
    } catch (error: any) {
      console.error(error)
      addToast('error', '重新打开审核失败', {
        context: '审批操作',
        actions: [{ label: '重试', onClick: () => void reopenReview() }],
        detail: error?.response?.data?.detail || error?.message,
      })
      addRecord({
        type: 'approve',
        description: '重新打开审核失败',
        status: 'error',
        retryAction: () => void reopenReview(),
      })
    }
  }, [addRecord, addToast, chapterId, loadChapter])

  const requestFanqieLoginWindow = useCallback((flow: 'create-book' | 'publish-chapter') => {
    return api.post('/fanqie/open-login-window', { flow }, { timeout: 15000 })
  }, [])

  const handleFanqieLoginRequired = useCallback(async (
    detailRaw: unknown,
    flow: 'create-book' | 'publish-chapter',
    retryAction: () => Promise<void>,
    context: string,
  ) => {
    const loginRequired = parseFanqieLoginRequired(detailRaw)
    if (!loginRequired) return false

    let openFailedDetail = ''
    try {
      await requestFanqieLoginWindow(flow)
    } catch (openError: any) {
      const openDetailRaw = openError?.response?.data?.detail
      openFailedDetail = getApiErrorDetail(openDetailRaw, openError?.message || '打开番茄登录窗口失败')
    }

    addToast(openFailedDetail ? 'error' : 'warning', '请先登录番茄作者后台', {
      context,
      detail: openFailedDetail
        ? `检测到当前未登录，且自动打开登录窗口失败：${openFailedDetail}`
        : '已为你打开番茄登录窗口，请在弹出的 Chromium 窗口完成登录后再重试。',
      actions: [
        { label: '重试', onClick: () => void retryAction() },
        { label: '重新打开登录窗口', onClick: () => void requestFanqieLoginWindow(flow) },
      ],
    })
    return true
  }, [addToast, requestFanqieLoginWindow])

  const publishChapterExternally = useCallback(async () => {
    if (!chapterId || !chapter) return
    const content = (draftContent || chapter.final || chapter.draft || '').trim()
    if (!content) {
      addToast('error', '当前章节内容为空，无法发布')
      return
    }

    setPublishing(true)
    try {
      const response = await api.post(
        `/chapters/${chapterId}/publish`,
        {
          title: `第${chapter.chapter_number}章 ${chapter.title}`.trim(),
          content,
        },
        { timeout: 300000 },
      )
      const payload = response.data || {}
      if (projectId) {
        invalidateCache('project', projectId)
        await fetchProject(projectId, { force: true })
      }
      addToast('success', `发布成功：第 ${payload.chapter_number ?? chapter.chapter_number} 章`)
      addRecord({
        type: 'save',
        description: `一键发布成功（book_id=${payload.book_id || 'N/A'}）`,
        status: 'success',
      })
    } catch (error: any) {
      console.error(error)
      const detailRaw = error?.response?.data?.detail
      if (await handleFanqieLoginRequired(detailRaw, 'publish-chapter', publishChapterExternally, '番茄发布')) {
        addRecord({
          type: 'save',
          description: '番茄登录已打开，等待重试发布',
          status: 'error',
          retryAction: () => void publishChapterExternally(),
        })
        return
      }
      const detail = getApiErrorDetail(detailRaw, error?.message || '一键发布失败')
      addToast('error', '一键发布失败', {
        context: '番茄发布',
        detail,
        actions: [{ label: '重试', onClick: () => void publishChapterExternally() }],
      })
      addRecord({
        type: 'save',
        description: '一键发布失败',
        status: 'error',
        retryAction: () => void publishChapterExternally(),
      })
    } finally {
      setPublishing(false)
    }
  }, [
    addRecord,
    addToast,
    chapter,
    chapterId,
    draftContent,
    fetchProject,
    handleFanqieLoginRequired,
    invalidateCache,
    projectId,
  ])

  const createAndBindFanqieBook = useCallback(async () => {
    if (!projectId) return
    const titleRef = String(currentProject?.name || '').trim()
    const payload = {
      title: titleRef,
      intro: fanqieCreateForm.intro.trim(),
      protagonist1: fanqieCreateForm.protagonist1.trim(),
      protagonist2: fanqieCreateForm.protagonist2.trim(),
      target_reader: fanqieCreateForm.targetReader,
      tags_by_tab: buildFanqieTagsPayload(fanqieCreateForm.tagsByTab),
    }
    if (!payload.title) {
      addToast('error', '缺少可引用标题，请先确认项目名称')
      return
    }
    setCreatingFanqieBook(true)
    try {
      const response = await api.post(`/projects/${projectId}/fanqie/create-book`, payload, { timeout: 300000 })
      const result = response.data || {}
      invalidateCache('project', projectId)
      await fetchProject(projectId, { force: true })
      addToast('success', `番茄书本创建并绑定成功（book_id=${result.book_id || 'N/A'}）`)
      addRecord({
        type: 'create',
        description: `番茄书本创建成功（book_id=${result.book_id || 'N/A'}）`,
        status: 'success',
      })
    } catch (error: any) {
      console.error(error)
      const detailRaw = error?.response?.data?.detail
      if (await handleFanqieLoginRequired(detailRaw, 'create-book', createAndBindFanqieBook, '番茄创建')) {
        addRecord({
          type: 'create',
          description: '番茄登录已打开，等待重试创建',
          status: 'error',
          retryAction: () => void createAndBindFanqieBook(),
        })
        return
      }
      const detail = getApiErrorDetail(detailRaw, error?.message || '番茄书本创建失败')
      addToast('error', '番茄书本创建失败', {
        context: '番茄创建',
        detail,
        actions: [{ label: '重试', onClick: () => void createAndBindFanqieBook() }],
      })
      addRecord({
        type: 'create',
        description: '番茄书本创建失败',
        status: 'error',
        retryAction: () => void createAndBindFanqieBook(),
      })
    } finally {
      setCreatingFanqieBook(false)
    }
  }, [
    addRecord,
    addToast,
    currentProject?.name,
    fanqieCreateForm,
    fetchProject,
    handleFanqieLoginRequired,
    invalidateCache,
    projectId,
  ])

  const saveFanqieBookId = useCallback(async (bookId: string) => {
    if (!projectId) return
    try {
      await api.patch(`/projects/${projectId}`, { fanqie_book_id: bookId || null })
      void fetchProject(projectId, { force: true })
      addToast('success', bookId ? `book_id 已更新为 ${bookId}` : 'book_id 已清除')
    } catch (error: any) {
      addToast('error', `保存 book_id 失败：${error?.message || '未知错误'}`)
    }
  }, [addToast, fetchProject, projectId])

  const fillFanqieFormWithLLM = useCallback(async () => {
    if (!projectId) return
    setFillingFanqieByLLM(true)
    try {
      const response = await api.post(
        `/projects/${projectId}/fanqie/create-book/suggest`,
        { prompt: chapter?.goal || '' },
        { timeout: 120000 },
      )
      const result = response.data || {}
      setFanqieCreateForm((previous) => ({
        ...previous,
        intro: String(result.intro || previous.intro || ''),
        protagonist1: String(result.protagonist1 || previous.protagonist1 || ''),
        protagonist2: String(result.protagonist2 || previous.protagonist2 || ''),
        targetReader: result.target_reader === 'female' ? 'female' : 'male',
        tagsByTab: {
          mainCategory: normalizeFanqieTagField(result.tags_by_tab?.['主分类'], previous.tagsByTab.mainCategory, 1),
          theme: normalizeFanqieTagField(result.tags_by_tab?.['主题'], previous.tagsByTab.theme, 2),
          role: normalizeFanqieTagField(result.tags_by_tab?.['角色'], previous.tagsByTab.role, 2),
          plot: normalizeFanqieTagField(result.tags_by_tab?.['情节'], previous.tagsByTab.plot, 2),
        },
      }))
      addToast('success', 'LLM 已填充番茄创建参数')
    } catch (error: any) {
      console.error(error)
      const detailRaw = error?.response?.data?.detail
      const detail = typeof detailRaw === 'string'
        ? detailRaw
        : detailRaw?.message || error?.message || 'LLM 填充失败'
      addToast('error', 'LLM 填充失败', {
        context: '番茄参数',
        detail,
      })
    } finally {
      setFillingFanqieByLLM(false)
    }
  }, [addToast, chapter?.goal, projectId])

  const projectName = currentProject?.name ?? '小说项目'
  const hasLaterChapters = useMemo(
    () => storeChapters.some((item) => item.chapter_number > (chapter?.chapter_number || 0)),
    [chapter?.chapter_number, storeChapters],
  )

  const handleDeleteChapter = useCallback(async () => {
    if (!chapter || !chapterId || !projectId) return
    setDeletingChapter(true)
    const snapshot = {
      chapter_number: chapter.chapter_number,
      title: chapter.title,
      goal: chapter.goal,
    }
    try {
      await deleteChapterRequest(chapterId)
      removeChapter(chapterId)
      invalidateCache('project', projectId)
      invalidateCache('chapters', projectId)
      addToast('success', `第 ${snapshot.chapter_number} 章已删除`)
      addRecord({ type: 'delete', description: `删除章节: ${snapshot.title}`, status: 'success' })
      if (onExitToProject) {
        onExitToProject()
      } else {
        navigate(`/project/${projectId}`)
      }
    } catch (error: any) {
      addToast('error', '删除章节失败', {
        context: '章节删除',
        detail: error?.response?.data?.detail || error?.message,
        actions: [{
          label: '重试',
          onClick: () => {
            setShowDeleteConfirm(true)
          },
        }],
      })
      addRecord({ type: 'delete', description: '删除章节失败', status: 'error' })
    } finally {
      setDeletingChapter(false)
      setShowDeleteConfirm(false)
    }
  }, [
    addRecord,
    addToast,
    chapter,
    chapterId,
    invalidateCache,
    navigate,
    onExitToProject,
    projectId,
    removeChapter,
  ])

  const activeStreamText = streamChannel === 'arbiter'
    ? draftContent
    : streamChannelText[streamChannel]
  const emptyStreamText = streamChannel === 'arbiter'
    ? '当前暂无正文，请先在创作控制台生成，或基于已有内容在此继续修改。'
    : '等待该阶段输出...'
  const readingContent = useMemo(
    () => sanitizeReadingModeText(chapter?.final || chapter?.draft || draftContent || ''),
    [chapter?.draft, chapter?.final, draftContent],
  )

  return {
    projectId,
    chapterId,
    currentProject,
    storeChapters,
    sortedChapters,
    chapter,
    loading,
    readingMode,
    enterReadingMode,
    exitReadingMode,
    readingContent,
    draftContent,
    setDraftContent,
    streamChannel,
    setStreamChannel,
    activeStreamText,
    emptyStreamText,
    loadingPlan,
    streaming,
    streamingStage,
    savingDraft,
    publishing,
    creatingFanqieBook,
    fillingFanqieByLLM,
    showFanqieCreateForm,
    setShowFanqieCreateForm,
    fanqieBookIdInput,
    setFanqieBookIdInput,
    fanqieCreateForm,
    setFanqieCreateForm,
    autoSaveLastSaved: autoSave.lastSaved,
    showDraftRestore,
    showRejectConfirm,
    setShowRejectConfirm,
    showDeleteConfirm,
    setShowDeleteConfirm,
    deletingChapter,
    directionHint,
    setDirectionHint,
    p0Conflicts,
    p1Conflicts,
    p2Conflicts,
    isGenerating,
    statusMeta,
    isApproved,
    canSubmitApproval,
    primaryActionLabel,
    primaryActionReason,
    blueprintBeats,
    blueprintConflicts,
    blueprintForeshadowing,
    blueprintCallbacks,
    planQuality,
    planQualityMessages,
    currentChapterIndex,
    hasPrevChapter,
    hasNextChapter,
    navigateToChapter,
    readingTocItems,
    currentChapterExport,
    allChaptersExport,
    projectName,
    hasLaterChapters,
    generatePlan,
    redoDraft,
    reviewDraft,
    reopenReview,
    saveDraft,
    publishChapterExternally,
    createAndBindFanqieBook,
    saveFanqieBookId,
    fillFanqieFormWithLLM,
    handleDeleteChapter,
    handleRestoreDraft,
    handleDiscardDraft,
  }
}
