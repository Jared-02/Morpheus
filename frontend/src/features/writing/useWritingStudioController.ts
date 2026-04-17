import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { FieldError } from '../../utils/validation'
import { api } from '../../lib/api'
import { useSSEStream } from '../../hooks/useSSEStream'
import { useStreamStore, type GenerationForm, type StreamChapter } from '../../stores/useStreamStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToastStore } from '../../stores/useToastStore'
import { useActivityStore } from '../../stores/useActivityStore'
import { useUIStore } from '../../stores/useUIStore'
import { getStoryTemplateById } from '../../config/storyTemplates'
import { clearFirstChapterEntry, isFirstChapterEntry } from '../../utils/firstChapterOnboarding'
import { guideGenerationError } from '../../utils/errorGuidance'
import {
  CHAPTER_COUNT_RULE,
  CONTINUATION_FALLBACK_PROMPT,
  WORDS_PER_CHAPTER_RULE,
  composeSectionBody,
  hasInvalidAdvancedSettings,
  normalizePersistedSettings,
} from './writingShared'

export default function useWritingStudioController() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { start, stop, generating } = useSSEStream()
  const addToast = useToastStore((state) => state.addToast)
  const addRecord = useActivityStore((state) => state.addRecord)

  const sections = useStreamStore((state) => state.sections)
  const chapters = useStreamStore((state) => state.chapters)
  const logs = useStreamStore((state) => state.logs)
  const error = useStreamStore((state) => state.error)
  const clearStream = useStreamStore((state) => state.clearStream)

  const currentProject = useProjectStore((state) => state.currentProject)
  const fetchProject = useProjectStore((state) => state.fetchProject)

  const readingMode = useUIStore((state) => state.readingMode)
  const enterReadingMode = useUIStore((state) => state.enterReadingMode)
  const exitReadingMode = useUIStore((state) => state.exitReadingMode)

  const streamRef = useRef<HTMLElement | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)

  const [activeChapterIdx, setActiveChapterIdx] = useState(0)
  const [form, setForm] = useState<GenerationForm>({
    batch_direction: '',
    mode: 'studio',
    chapter_count: 8,
    words_per_chapter: 1600,
    auto_approve: true,
  })
  const [chapterCountInput, setChapterCountInput] = useState('8')
  const [wordsPerChapterInput, setWordsPerChapterInput] = useState('1600')
  const [continuationPreparing, setContinuationPreparing] = useState(false)
  const [auxPanelOpen, setAuxPanelOpen] = useState(true)
  const [auxPanelTab, setAuxPanelTab] = useState<'toc' | 'stats' | 'logs'>('toc')
  const [modeHelpOpen, setModeHelpOpen] = useState(false)
  const [advErrors, setAdvErrors] = useState<Record<string, FieldError | null>>({})
  const [firstChapterMode, setFirstChapterMode] = useState(false)

  const prefillAppliedRef = useRef(false)
  const firstChapterCheckedRef = useRef(false)
  const firstChapterCheckInFlightRef = useRef(false)
  const lastProjectIdRef = useRef<string | null>(null)
  const settingsLoadedRef = useRef<string | null>(null)
  const settingsHydratedRef = useRef(false)
  const lastSavedSettingsRef = useRef<string | null>(null)
  const latestFormRef = useRef(form)

  latestFormRef.current = form

  const settingsStorageKey = useMemo(
    () => (projectId ? `writing-console-settings:${projectId}` : null),
    [projectId],
  )
  const projectTemplate = useMemo(
    () => getStoryTemplateById(currentProject?.template_id),
    [currentProject?.template_id],
  )

  useEffect(() => {
    if (projectId && currentProject?.id !== projectId) {
      fetchProject(projectId)
    }
  }, [currentProject, fetchProject, projectId])

  useEffect(() => {
    if (!settingsStorageKey) return
    if (settingsLoadedRef.current === settingsStorageKey) return
    settingsLoadedRef.current = settingsStorageKey
    settingsHydratedRef.current = false
    try {
      const raw = localStorage.getItem(settingsStorageKey)
      if (!raw) return
      const parsed = normalizePersistedSettings(JSON.parse(raw))
      if (!parsed) return
      lastSavedSettingsRef.current = JSON.stringify(parsed)
      setForm((prev) => ({ ...prev, ...parsed }))
    } catch {
      // Ignore localStorage parse/access failures.
    } finally {
      settingsHydratedRef.current = true
    }
  }, [settingsStorageKey])

  useEffect(() => {
    if (!settingsStorageKey || !settingsHydratedRef.current) return
    const payload = {
      mode: form.mode,
      chapter_count: form.chapter_count,
      words_per_chapter: form.words_per_chapter,
      auto_approve: form.auto_approve,
    }
    const serialized = JSON.stringify(payload)
    if (lastSavedSettingsRef.current === serialized) return
    try {
      localStorage.setItem(settingsStorageKey, serialized)
      lastSavedSettingsRef.current = serialized
    } catch {
      // Ignore localStorage write failures.
    }
  }, [form.auto_approve, form.chapter_count, form.mode, form.words_per_chapter, settingsStorageKey])

  useEffect(() => {
    setChapterCountInput(String(form.chapter_count))
  }, [form.chapter_count])

  useEffect(() => {
    setWordsPerChapterInput(String(form.words_per_chapter))
  }, [form.words_per_chapter])

  useEffect(() => {
    if (!projectId) return
    if (lastProjectIdRef.current === null) {
      lastProjectIdRef.current = projectId
      return
    }
    if (lastProjectIdRef.current === projectId) return

    lastProjectIdRef.current = projectId
    clearStream()
    setForm((prev) => ({ ...prev, batch_direction: '' }))
    setFirstChapterMode(false)
    prefillAppliedRef.current = false
    firstChapterCheckedRef.current = false
    firstChapterCheckInFlightRef.current = false
    setActiveChapterIdx(0)
  }, [clearStream, projectId])

  useEffect(() => {
    if (prefillAppliedRef.current) return

    const direction = searchParams.get('direction')?.trim() ?? ''
    const hasDirection = direction.length > 0

    if (!hasDirection) {
      prefillAppliedRef.current = true
      return
    }

    setForm((prev) => {
      const next = { ...prev }
      if (hasDirection && !prev.batch_direction.trim()) {
        next.batch_direction = direction
      }
      return next
    })

    prefillAppliedRef.current = true
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('direction')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (firstChapterCheckedRef.current || firstChapterCheckInFlightRef.current || !projectId) return
    if (!isFirstChapterEntry(searchParams)) return

    firstChapterCheckInFlightRef.current = true
    api.get(`/projects/${projectId}/chapters`)
      .then((response) => {
        const list = Array.isArray(response.data) ? response.data : []
        const hasPersistedChapter = list.some((item) => Boolean(item?.has_persisted_content))
        if (!hasPersistedChapter) {
          setFirstChapterMode(true)
          setForm((prev) => ({ ...prev, chapter_count: 1 }))
          setChapterCountInput('1')
          addToast('info', '首次创作：已为你预设生成 1 章，填写创作方向后点击「开始生成」即可。')
        }
        firstChapterCheckedRef.current = true
        clearFirstChapterEntry(setSearchParams)
      })
      .catch(() => {
        firstChapterCheckInFlightRef.current = false
      })
      .finally(() => {
        if (firstChapterCheckedRef.current) {
          firstChapterCheckInFlightRef.current = false
        }
      })
  }, [addToast, projectId, searchParams, setSearchParams])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && readingMode) {
        exitReadingMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [exitReadingMode, readingMode])

  const goToPrevChapter = useCallback(() => {
    setActiveChapterIdx((index) => Math.max(0, index - 1))
  }, [])

  const goToNextChapter = useCallback(() => {
    setActiveChapterIdx((index) => Math.min(sections.length - 1, index + 1))
  }, [sections.length])

  const selectReadingChapter = useCallback((index: number) => {
    setActiveChapterIdx(Math.max(0, Math.min(index, sections.length - 1)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [sections.length])

  const sectionViewModels = useMemo(
    () => sections.map((section) => {
      const bodies = composeSectionBody(section.body, section.chapterNumber, section.title, section.waiting)
      return {
        ...section,
        narrativeBody: bodies.narrativeBody,
        displayBody: bodies.displayBody,
        exportBody: bodies.exportBody,
      }
    }),
    [sections],
  )

  const activeSection = sectionViewModels[activeChapterIdx]
  const readingTocItems = useMemo(
    () => sectionViewModels.map((section, index) => ({
      id: section.chapterId,
      label: `第${section.chapterNumber}章 · ${section.title}`,
      active: index === activeChapterIdx,
      onClick: () => selectReadingChapter(index),
    })),
    [activeChapterIdx, sectionViewModels, selectReadingChapter],
  )

  const markdownText = useMemo(() => {
    if (sectionViewModels.length === 0) return ''
    return sectionViewModels
      .map((section) => {
        const body = section.displayBody.trim() || '> 正在生成这一章，请稍候...'
        return `# 第${section.chapterNumber}章 ${section.title}\n\n${body}`
      })
      .join('\n\n---\n\n')
  }, [sectionViewModels])

  useEffect(() => {
    if (!markdownText || !streamRef.current) return
    streamRef.current.scrollTop = streamRef.current.scrollHeight
  }, [markdownText])

  useEffect(() => {
    const container = streamRef.current
    if (!container || sectionViewModels.length === 0) return

    const handleScroll = () => {
      const sectionElements = Array.from(container.querySelectorAll<HTMLElement>('.stream-section'))
      if (sectionElements.length === 0) return

      const scrollAnchor = container.scrollTop + 24
      let nextIdx = 0
      for (let index = 0; index < sectionElements.length; index += 1) {
        if (sectionElements[index].offsetTop <= scrollAnchor) {
          nextIdx = index
        } else {
          break
        }
      }

      setActiveChapterIdx((prev) => (prev === nextIdx ? prev : nextIdx))
    }

    handleScroll()
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [sectionViewModels])

  useEffect(() => {
    if (!logRef.current || logs.length === 0) return
    logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const metrics = useMemo(() => {
    const totalWords = chapters.reduce((sum, chapter) => sum + chapter.word_count, 0)
    const totalP0 = chapters.reduce((sum, chapter) => sum + chapter.p0_count, 0)
    return { generated: chapters.length, totalWords, totalP0 }
  }, [chapters])

  const tocChapters = useMemo(
    () => sectionViewModels.map((section) => ({
      id: section.chapterId,
      chapterNumber: section.chapterNumber,
      title: section.title,
      wordCount: section.exportBody.length,
    })),
    [sectionViewModels],
  )

  const exportChapters = useMemo(
    () => sectionViewModels
      .filter((section) => section.exportBody.trim().length > 0)
      .map((section) => ({
        chapterNumber: section.chapterNumber,
        title: section.title,
        content: section.exportBody,
      })),
    [sectionViewModels],
  )

  const reportInvalidAdvancedSettings = useCallback(() => {
    addToast('error', '高级设置参数超出范围，请检查后重试', {
      context: '创作设置',
      detail: `章节数范围 ${CHAPTER_COUNT_RULE.min}-${CHAPTER_COUNT_RULE.max}，每章目标字数范围 ${WORDS_PER_CHAPTER_RULE.min}-${WORDS_PER_CHAPTER_RULE.max}`,
    })
  }, [addToast])

  const getGuidedErrorDetail = useCallback((message: string) => {
    return guideGenerationError(message).suggestion
  }, [])

  function handleStart() {
    const currentForm = latestFormRef.current
    if (!projectId || generating) return
    if (!currentForm.batch_direction.trim()) return
    if (hasInvalidAdvancedSettings(currentForm)) {
      reportInvalidAdvancedSettings()
      return
    }

    setFirstChapterMode(false)
    addToast('info', '开始生成，请稍候…')
    start({
      projectId,
      form: currentForm,
      onChapterStart: (chapter: StreamChapter) => {
        addToast('info', `开始第 ${chapter.chapter_number} 章：${chapter.title}`)
      },
      onChapterDone: (chapter: StreamChapter) => {
        addToast('success', `第 ${chapter.chapter_number} 章完成（${chapter.word_count} 字）`)
      },
      onError: (err: string) => {
        addToast('error', '流式生成中断', {
          context: '流式生成',
          actions: [
            { label: '从断点续写', onClick: () => void handleContinueFromLatest() },
            { label: '重新开始', onClick: () => { stop(); handleStart() } },
          ],
          detail: getGuidedErrorDetail(err),
        })
        addRecord({ type: 'generate', description: '流式生成中断', status: 'error', retryAction: () => void handleContinueFromLatest() })
      },
      onComplete: () => {
        addToast('success', '全部章节生成完成！')
        addRecord({ type: 'generate', description: '全部章节生成完成', status: 'success' })
      },
    })
  }

  async function handleContinueFromLatest() {
    const currentForm = latestFormRef.current
    if (!projectId || generating || continuationPreparing) return
    if (hasInvalidAdvancedSettings(currentForm)) {
      reportInvalidAdvancedSettings()
      return
    }

    setContinuationPreparing(true)
    try {
      const chapterRes = await api.get(`/projects/${projectId}/chapters`)
      const chapterList = Array.isArray(chapterRes.data) ? chapterRes.data : []
      const latestChapterNumber = chapterList.reduce((max, chapter) => {
        const chapterNo = Number(chapter?.chapter_number || 0)
        return Number.isFinite(chapterNo) ? Math.max(max, chapterNo) : max
      }, 0)
      const startChapterNumber = latestChapterNumber > 0 ? latestChapterNumber + 1 : 1
      const continuationPrompt = currentForm.batch_direction.trim() || CONTINUATION_FALLBACK_PROMPT
      if (!currentForm.batch_direction.trim()) {
        addToast('info', '未填写创作方向，已使用默认续写提示。')
      }
      addToast('info', `从第 ${startChapterNumber} 章开始续写。`)
      start({
        projectId,
        form: {
          ...currentForm,
          batch_direction: continuationPrompt,
          continuation_mode: true,
        },
        onChapterStart: (chapter: StreamChapter) => {
          addToast('info', `开始第 ${chapter.chapter_number} 章：${chapter.title}`)
        },
        onChapterDone: (chapter: StreamChapter) => {
          addToast('success', `第 ${chapter.chapter_number} 章完成（${chapter.word_count} 字）`)
        },
        onError: (err: string) => {
          addToast('error', '续写中断', {
            context: '续写任务',
            actions: [
              { label: '继续续写', onClick: () => void handleContinueFromLatest() },
              { label: '重新开始', onClick: () => { stop(); void handleContinueFromLatest() } },
            ],
            detail: getGuidedErrorDetail(err),
          })
          addRecord({ type: 'generate', description: '续写任务中断', status: 'error', retryAction: () => void handleContinueFromLatest() })
        },
        onComplete: () => {
          addToast('success', '续写批次完成！')
          addRecord({ type: 'generate', description: '续写批次完成', status: 'success' })
        },
      })
    } catch (error: any) {
      addToast('error', '准备续写失败', {
        context: '续写任务',
        detail: getGuidedErrorDetail(error?.response?.data?.detail || error?.message || '准备续写失败'),
      })
    } finally {
      setContinuationPreparing(false)
    }
  }

  function handleClearCurrentDraft() {
    if (generating) return
    if (sections.length === 0 && chapters.length === 0 && logs.length === 0) return
    const confirmed = window.confirm('确认清空当前创作草稿显示区？该操作不影响已保存章节。')
    if (!confirmed) return
    clearStream()
    addToast('success', '已清空当前创作草稿显示区')
  }

  function scrollToChapter(chapterId: string) {
    const index = sections.findIndex((section) => section.chapterId === chapterId)
    if (index < 0 || !streamRef.current) return
    setActiveChapterIdx(index)
    const element = streamRef.current
    const ratio = index / Math.max(sections.length, 1)
    element.scrollTo({ top: ratio * element.scrollHeight, behavior: 'smooth' })
  }

  const hasAdvValidationError = hasInvalidAdvancedSettings(form)
  const hasEmptyBatchDirection = !form.batch_direction.trim()
  const startDisabled = !projectId || generating || hasAdvValidationError || hasEmptyBatchDirection
  const startDisabledReason = !projectId
    ? '缺少项目信息'
    : generating
      ? '正在生成中，请等待完成或停止当前任务'
      : hasAdvValidationError
        ? '高级设置参数超出范围，请检查后重试'
        : hasEmptyBatchDirection
          ? '请填写创作方向'
          : ''

  return {
    projectId,
    currentProject,
    projectTemplate,
    generating,
    stop,
    sections,
    chapters,
    logs,
    error,
    readingMode,
    enterReadingMode,
    exitReadingMode,
    streamRef,
    logRef,
    activeChapterIdx,
    form,
    setForm,
    chapterCountInput,
    setChapterCountInput,
    wordsPerChapterInput,
    setWordsPerChapterInput,
    continuationPreparing,
    auxPanelOpen,
    setAuxPanelOpen,
    auxPanelTab,
    setAuxPanelTab,
    modeHelpOpen,
    setModeHelpOpen,
    advErrors,
    setAdvErrors,
    firstChapterMode,
    sectionViewModels,
    activeSection,
    readingTocItems,
    markdownText,
    metrics,
    tocChapters,
    exportChapters,
    handleStart,
    handleContinueFromLatest,
    handleClearCurrentDraft,
    scrollToChapter,
    startDisabled,
    startDisabledReason,
    hasAdvValidationError,
    goToPrevChapter,
    goToNextChapter,
  }
}
