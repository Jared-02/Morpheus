import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '../components/ui/PageTransition'
import DisabledTooltip from '../components/ui/DisabledTooltip'
import { validateField, type FieldError } from '../utils/validation'
import { api } from '../lib/api'
import ChapterTOC from '../components/chapter/ChapterTOC'
import ChapterExportMenu from '../components/chapter/ChapterExportMenu'
import AgentProgressBar from '../components/chapter/AgentProgressBar'
import ReadingModeView from '../components/ui/ReadingModeView'
import type { ChapterContent } from '../services/exportService'
import { useSSEStream } from '../hooks/useSSEStream'
import { useStreamStore, type GenerationForm, type StreamChapter } from '../stores/useStreamStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useToastStore } from '../stores/useToastStore'
import { useActivityStore } from '../stores/useActivityStore'
import { useUIStore } from '../stores/useUIStore'
import { getStoryTemplateById } from '../config/storyTemplates'
import { isFirstChapterEntry, clearFirstChapterEntry } from '../utils/firstChapterOnboarding'
import { guideGenerationError } from '../utils/errorGuidance'

/* ── SVG 图标 ── */

export const IconBookOpen = () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
)

/* ── 常量 ── */

const MODE_LABELS: Record<string, string> = {
    studio: '工作室',
    quick: '快速',
    cinematic: '电影感',
}

const CHAPTER_COUNT_RULE = { min: 1, max: 60, hint: '推荐 8-12 章' } as const
const WORDS_PER_CHAPTER_RULE = { min: 300, max: 12000, hint: '推荐 1200-2000 字' } as const
const CONTINUATION_FALLBACK_PROMPT = '延续当前故事，推进未决冲突与人物关系，章尾保留下一章触发点。'

type PersistedWritingSettings = Pick<
    GenerationForm,
    'mode' | 'chapter_count' | 'words_per_chapter' | 'auto_approve'
>

function isDigitsOnly(value: string) {
    return /^\d*$/.test(value)
}

function hasInvalidAdvancedSettings(form: Pick<GenerationForm, 'chapter_count' | 'words_per_chapter'>) {
    return form.chapter_count < CHAPTER_COUNT_RULE.min
        || form.chapter_count > CHAPTER_COUNT_RULE.max
        || form.words_per_chapter < WORDS_PER_CHAPTER_RULE.min
        || form.words_per_chapter > WORDS_PER_CHAPTER_RULE.max
}

function normalizePersistedSettings(raw: unknown): PersistedWritingSettings | null {
    if (!raw || typeof raw !== 'object') return null
    const data = raw as Partial<Record<keyof PersistedWritingSettings, unknown>>

    const mode = data.mode === 'studio' || data.mode === 'quick' || data.mode === 'cinematic' ? data.mode : null
    const chapterCountNum = typeof data.chapter_count === 'number' ? data.chapter_count : Number(data.chapter_count)
    const wordsNum = typeof data.words_per_chapter === 'number' ? data.words_per_chapter : Number(data.words_per_chapter)
    const autoApprove = typeof data.auto_approve === 'boolean' ? data.auto_approve : true

    if (!mode || Number.isNaN(chapterCountNum) || Number.isNaN(wordsNum)) return null

    return {
        mode,
        chapter_count: Math.max(CHAPTER_COUNT_RULE.min, Math.min(CHAPTER_COUNT_RULE.max, Math.floor(chapterCountNum))),
        words_per_chapter: Math.max(WORDS_PER_CHAPTER_RULE.min, Math.min(WORDS_PER_CHAPTER_RULE.max, Math.floor(wordsNum))),
        auto_approve: autoApprove,
    }
}

function stripDuplicateChapterHeading(text: string, chapterNumber: number, chapterTitle: string): string {
    const source = String(text || '').trim()
    if (!source) return ''
    const lines = source.split(/\r?\n/)
    const firstLine = lines[0]?.trim() ?? ''
    const title = chapterTitle.trim()
    if (!title) return source

    const firstLineCompact = firstLine.replace(/\s+/g, '')
    const headingCompact = `第${chapterNumber}章${title}`.replace(/\s+/g, '')
    if (firstLineCompact === headingCompact || firstLine === title) {
        return lines.slice(1).join('\n').trim()
    }
    return source
}

function dedupeStringItems(items: string[]) {
    const seen = new Map<string, number>()
    return items.map((item) => {
        const occurrence = seen.get(item) ?? 0
        seen.set(item, occurrence + 1)
        return { key: `${item}-${occurrence}`, value: item }
    })
}

function composeSectionBody(
    body: string,
    chapterNumber: number,
    chapterTitle: string,
    waiting: boolean,
): { narrativeBody: string; displayBody: string; exportBody: string } {
    const narrative = stripDuplicateChapterHeading(body, chapterNumber, chapterTitle)
    const exportBody = narrative.trim()
    return {
        narrativeBody: narrative,
        exportBody,
        displayBody: exportBody || (waiting ? '> 正在生成这一章，请稍候...' : ''),
    }
}

/* ── 脉冲加载指示器 ── */

function PulseIndicator({ generated, total }: { generated: number; total: number }) {
    return (
        <div className="writing-pulse">
            <span className="writing-pulse__dot" />
            <span className="writing-pulse__text">
                正在生成中… {generated}/{total} 章已完成
            </span>
        </div>
    )
}

/* ── 主页面 ── */

export default function WritingConsolePage() {
    const { projectId } = useParams<{ projectId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const { start, stop, generating } = useSSEStream()
    const addToast = useToastStore((s) => s.addToast)
    const addRecord = useActivityStore((s) => s.addRecord)

    const sections = useStreamStore((s) => s.sections)
    const chapters = useStreamStore((s) => s.chapters)
    const logs = useStreamStore((s) => s.logs)
    const error = useStreamStore((s) => s.error)
    const clearStream = useStreamStore((s) => s.clearStream)

    const currentProject = useProjectStore((s) => s.currentProject)
    const fetchProject = useProjectStore((s) => s.fetchProject)

    const readingMode = useUIStore((s) => s.readingMode)
    const enterReadingMode = useUIStore((s) => s.enterReadingMode)
    const exitReadingMode = useUIStore((s) => s.exitReadingMode)

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

    /* ── 加载项目信息 ── */
    useEffect(() => {
        if (projectId && currentProject?.id !== projectId) {
            fetchProject(projectId)
        }
    }, [projectId, currentProject, fetchProject])

    /* ── 读取并持久化高级设置（按项目） ── */
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
            setForm((prev) => ({
                ...prev,
                ...parsed,
            }))
        } catch {
            // Ignore localStorage parse/access failures.
        } finally {
            settingsHydratedRef.current = true
        }
    }, [settingsStorageKey])

    useEffect(() => {
        if (!settingsStorageKey || !settingsHydratedRef.current) return
        const payload: PersistedWritingSettings = {
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
    }, [
        settingsStorageKey,
        form.mode,
        form.chapter_count,
        form.words_per_chapter,
        form.auto_approve,
    ])

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
    }, [projectId, clearStream])

    /* ── 从项目概览接收快速启动参数 ── */
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

    /* ── 首章引导模式检测 ── */
    useEffect(() => {
        if (firstChapterCheckedRef.current || firstChapterCheckInFlightRef.current || !projectId) return
        if (!isFirstChapterEntry(searchParams)) return

        firstChapterCheckInFlightRef.current = true
        api.get(`/projects/${projectId}/chapters`)
            .then((res) => {
                const list = Array.isArray(res.data) ? res.data : []
                if (list.length === 0) {
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
    }, [projectId, searchParams, setSearchParams, addToast])

    /* ── Escape 退出阅读模式 ── */
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && readingMode) {
                exitReadingMode()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [readingMode, exitReadingMode])

    /* ── 阅读模式章节导航 ── */
    const goToPrevChapter = useCallback(() => {
        setActiveChapterIdx((i) => Math.max(0, i - 1))
    }, [])

    const goToNextChapter = useCallback(() => {
        setActiveChapterIdx((i) => Math.min(sections.length - 1, i + 1))
    }, [sections.length])

    const selectReadingChapter = useCallback((idx: number) => {
        setActiveChapterIdx(Math.max(0, Math.min(idx, sections.length - 1)))
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [sections.length])

    const sectionViewModels = useMemo(
        () =>
            sections.map((section) => {
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
        () =>
            sectionViewModels.map((section, idx) => ({
                id: section.chapterId,
                label: `第${section.chapterNumber}章 · ${section.title}`,
                active: idx === activeChapterIdx,
                onClick: () => selectReadingChapter(idx),
            })),
        [sectionViewModels, activeChapterIdx, selectReadingChapter],
    )

    /* ── Markdown 合成 ── */
    const markdownText = useMemo(() => {
        if (sectionViewModels.length === 0) return ''
        return sectionViewModels
            .map((s) => {
                const body = s.displayBody.trim() || '> 正在生成这一章，请稍候...'
                return `# 第${s.chapterNumber}章 ${s.title}\n\n${body}`
            })
            .join('\n\n---\n\n')
    }, [sectionViewModels])

    /* ── 自动滚动 ── */
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
            for (let i = 0; i < sectionElements.length; i += 1) {
                if (sectionElements[i].offsetTop <= scrollAnchor) {
                    nextIdx = i
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

    /* ── 统计 ── */
    const metrics = useMemo(() => {
        const totalWords = chapters.reduce((sum, c) => sum + c.word_count, 0)
        const totalP0 = chapters.reduce((sum, c) => sum + c.p0_count, 0)
        return { generated: chapters.length, totalWords, totalP0 }
    }, [chapters])

    /* ── 目录数据 ── */
    const tocChapters = useMemo(() => {
        return sectionViewModels.map((s) => ({
            id: s.chapterId,
            chapterNumber: s.chapterNumber,
            title: s.title,
            wordCount: s.exportBody.length,
        }))
    }, [sectionViewModels])

    /* ── 导出数据 ── */
    const exportChapters: ChapterContent[] = useMemo(() => {
        return sectionViewModels
            .filter((s) => s.exportBody.trim().length > 0)
            .map((s) => ({
                chapterNumber: s.chapterNumber,
                title: s.title,
                content: s.exportBody,
            }))
    }, [sectionViewModels])

    const reportInvalidAdvancedSettings = useCallback(() => {
        addToast('error', '高级设置参数超出范围，请检查后重试', {
            context: '创作设置',
            detail: `章节数范围 ${CHAPTER_COUNT_RULE.min}-${CHAPTER_COUNT_RULE.max}，每章目标字数范围 ${WORDS_PER_CHAPTER_RULE.min}-${WORDS_PER_CHAPTER_RULE.max}`,
        })
    }, [addToast])

    const getGuidedErrorDetail = useCallback((message: string) => {
        return guideGenerationError(message).suggestion
    }, [])

    /* ── 开始生成 ── */
    function handleStart() {
        const currentForm = latestFormRef.current
        if (!projectId || generating) return
        if (hasInvalidAdvancedSettings(currentForm)) {
            reportInvalidAdvancedSettings()
            return
        }
        setFirstChapterMode(false)
        addToast('info', '开始生成，请稍候…')
        start({
            projectId,
            form: currentForm,
            onChapterStart: (ch: StreamChapter) => {
                addToast('info', `开始第 ${ch.chapter_number} 章：${ch.title}`)
            },
            onChapterDone: (ch: StreamChapter) => {
                addToast('success', `第 ${ch.chapter_number} 章完成（${ch.word_count} 字）`)
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
                onChapterStart: (ch: StreamChapter) => {
                    addToast('info', `开始第 ${ch.chapter_number} 章：${ch.title}`)
                },
                onChapterDone: (ch: StreamChapter) => {
                    addToast('success', `第 ${ch.chapter_number} 章完成（${ch.word_count} 字）`)
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

    /* ── 章节跳转 ── */
    function scrollToChapter(chapterId: string) {
        const idx = sections.findIndex((s) => s.chapterId === chapterId)
        if (idx < 0 || !streamRef.current) return
        setActiveChapterIdx(idx)
        // 简单实现：按比例滚动
        const el = streamRef.current
        const ratio = idx / Math.max(sections.length, 1)
        el.scrollTo({ top: ratio * el.scrollHeight, behavior: 'smooth' })
    }

    /* ── "开始生成"按钮禁用状态 ── */
    const hasAdvValidationError = hasInvalidAdvancedSettings(form)
    const startDisabled = !projectId || generating || hasAdvValidationError
    const startDisabledReason = !projectId
        ? '缺少项目信息'
        : generating
            ? '正在生成中，请等待完成或停止当前任务'
            : hasAdvValidationError
                ? '高级设置参数超出范围，请检查后重试'
                : ''

    /* ── 阅读模式渲染 ── */
    if (readingMode) {
        const readingMarkdown = activeSection
            ? `# 第${activeSection.chapterNumber}章 ${activeSection.title}\n\n${activeSection.displayBody}`
            : markdownText

        return (
            <ReadingModeView
                content={readingMarkdown}
                contentType="markdown"
                emptyText="暂无内容可阅读"
                tocItems={readingTocItems}
                tocTitle="章节选择"
                onExit={exitReadingMode}
                onPrevChapter={goToPrevChapter}
                onNextChapter={goToNextChapter}
                hasPrev={activeChapterIdx > 0}
                hasNext={activeChapterIdx < sections.length - 1}
                currentLabel={
                    activeSection
                        ? `第${activeSection.chapterNumber}章 ${activeSection.title}`
                        : undefined
                }
            />
        )
    }

    return (
        <PageTransition>
            <div className="writing-page">
                <div className="writing-header">
                    <div>
                        <h1 className="writing-header__title">创作控制台</h1>
                        <p className="writing-header__sub">
                            {currentProject?.name || '加载中…'} · {MODE_LABELS[form.mode]}
                        </p>
                        <p className="muted" style={{ marginTop: 6, marginBottom: 0, fontSize: '0.82rem' }}>
                            本页负责批量生成与续写。章节细修、审批和冲突处理请在章节工作台完成。
                        </p>
                    </div>
                </div>

                <div className={`writing-body${auxPanelOpen ? ' writing-body--with-panel' : ''}`}>
                    <section className="writing-main">
                        <AnimatePresence>
                            {generating && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <PulseIndicator generated={metrics.generated} total={form.chapter_count} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="writing-main__tools">
                            <div className="writing-main__tools-left">
                                <button
                                    type="button"
                                    className={`chip-btn ${auxPanelOpen ? 'active' : ''}`}
                                    onClick={() => setAuxPanelOpen((v) => !v)}
                                >
                                    {auxPanelOpen ? '隐藏辅助面板' : '显示辅助面板'}
                                </button>
                                {auxPanelOpen && (
                                    <>
                                        <button
                                            type="button"
                                            className={`chip-btn ${auxPanelTab === 'toc' ? 'active' : ''}`}
                                            onClick={() => setAuxPanelTab('toc')}
                                        >
                                            目录
                                        </button>
                                        <button
                                            type="button"
                                            className={`chip-btn ${auxPanelTab === 'stats' ? 'active' : ''}`}
                                            onClick={() => setAuxPanelTab('stats')}
                                        >
                                            统计
                                        </button>
                                        <button
                                            type="button"
                                            className={`chip-btn ${auxPanelTab === 'logs' ? 'active' : ''}`}
                                            onClick={() => setAuxPanelTab('logs')}
                                        >
                                            日志
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="writing-main__tools-right">
                                {sections.length > 0 && (
                                    <button
                                        type="button"
                                        className="chip-btn"
                                        onClick={enterReadingMode}
                                        title="进入阅读模式"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    >
                                        <IconBookOpen /> 阅读模式
                                    </button>
                                )}
                                {exportChapters.length > 0 && (
                                    <ChapterExportMenu
                                        allChapters={exportChapters}
                                        projectName={currentProject?.name || '未命名项目'}
                                    />
                                )}
                            </div>
                        </div>

                        <article className="stream-paper" ref={streamRef}>
                            {sectionViewModels.length > 0 ? (
                                sectionViewModels.map((section, idx) => (
                                    <section key={section.chapterId} className="stream-section">
                                        <h1 className="stream-section__title">第{section.chapterNumber}章 {section.title}</h1>
                                        {generating && <AgentProgressBar chapterId={section.chapterId} />}
                                        {section.narrativeBody && (
                                            <ReactMarkdown>{section.narrativeBody}</ReactMarkdown>
                                        )}
                                        {!section.narrativeBody && (
                                            <p className="placeholder-text">正在生成这一章，请稍候...</p>
                                        )}
                                        {idx < sectionViewModels.length - 1 && <hr />}
                                    </section>
                                ))
                            ) : firstChapterMode ? (
                                <div className="first-chapter-guide">
                                    <h2 style={{ marginTop: 0 }}>开始你的第一章</h2>
                                    <p>这是一个全新的项目，还没有任何章节。</p>
                                    <ol style={{ paddingLeft: '1.2em', lineHeight: 1.8 }}>
                                        <li>在下方「创作方向」中输入第一章的方向或主题</li>
                                        <li>选择生成模式（推荐「工作室」模式获得最佳质量）</li>
                                        <li>点击「开始生成」，AI 将为你创作第一章</li>
                                    </ol>
                                    <p className="muted" style={{ fontSize: '0.82rem' }}>
                                        生成完成后，可前往章节工作台进行细修和审批。
                                    </p>
                                </div>
                            ) : (
                                <p className="placeholder-text">
                                    输入创作提示并点击「开始生成」，这里会实时渲染 Markdown 正文。
                                </p>
                            )}
                        </article>
                    </section>

                    {auxPanelOpen && (
                        <aside className="writing-aux-panel">
                            {auxPanelTab === 'toc' && (
                                <>
                                    <p className="writing-aux-panel__title">章节目录</p>
                                    {tocChapters.length > 0 ? (
                                        <ChapterTOC
                                            chapters={tocChapters}
                                            activeChapterId={activeSection?.chapterId}
                                            onSelect={scrollToChapter}
                                        />
                                    ) : (
                                        <p className="placeholder-text">暂无目录数据</p>
                                    )}
                                </>
                            )}
                            {auxPanelTab === 'stats' && (
                                <>
                                    <p className="writing-aux-panel__title">生成统计</p>
                                    <div className="writing-stats">
                                        <div className="writing-stats__item">
                                            <span className="writing-stats__label">已生成</span>
                                            <strong>{metrics.generated} 章</strong>
                                        </div>
                                        <div className="writing-stats__item">
                                            <span className="writing-stats__label">总字数</span>
                                            <strong>{metrics.totalWords.toLocaleString()}</strong>
                                        </div>
                                        <div className="writing-stats__item">
                                            <span className="writing-stats__label">P0 冲突</span>
                                            <strong>{metrics.totalP0}</strong>
                                        </div>
                                    </div>
                                </>
                            )}
                            {auxPanelTab === 'logs' && (
                                <>
                                    <p className="writing-aux-panel__title">生成日志</p>
                                    <div className="writing-logs" ref={logRef}>
                                        {logs.length === 0 ? (
                                            <p className="placeholder-text">暂无日志</p>
                                        ) : (
                                            dedupeStringItems(logs).map(({ key, value }) => (
                                                <p key={key} className="writing-logs__line">{value}</p>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </aside>
                    )}
                </div>

                <div className="writing-composer-dock">
                    <div className="composer-panel">
                        <p className="writing-composer-dock__title">创作方向</p>
                        <p className="writing-composer-dock__subtitle">输入创作方向后开始生成或续写。梗概已在项目创建时存入记忆。</p>
                        <div className="writing-composer-dock__prompt">
                            <textarea
                                className="composer-input"
                                rows={3}
                                value={form.batch_direction}
                                onChange={(e) => setForm((p) => ({ ...p, batch_direction: e.target.value }))}
                                placeholder="对这批章节的创作方向，如：在接下来8章收掉之前埋下的所有伏笔，然后直接大结局"
                            />
                            {projectTemplate && (
                                <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.8rem' }}>
                                    当前项目模板：{projectTemplate.name}。{projectTemplate.promptHint}
                                </p>
                            )}
                        </div>

                        <div className="composer-actions">
                            <div className="mode-group">
                                {(['studio', 'quick', 'cinematic'] as const).map((mode) => (
                                    <button
                                        type="button"
                                        key={mode}
                                        className={`chip-btn ${form.mode === mode ? 'active' : ''}`}
                                        onClick={() => setForm((p) => ({ ...p, mode }))}
                                    >
                                        {MODE_LABELS[mode]}
                                    </button>
                                ))}
                                <span className="mode-help-trigger">
                                    <button
                                        type="button"
                                        className="mode-help-trigger__button"
                                        aria-label="生成模式说明"
                                        onMouseEnter={() => setModeHelpOpen(true)}
                                        onMouseLeave={() => setModeHelpOpen(false)}
                                        onFocus={() => setModeHelpOpen(true)}
                                        onBlur={() => setModeHelpOpen(false)}
                                    >
                                        ?
                                    </button>
                                    {modeHelpOpen && (
                                        <span className="disabled-tooltip disabled-tooltip--bottom mode-help-tooltip" role="tooltip">
                                            <strong style={{ display: 'block', marginBottom: 6 }}>模式说明</strong>
                                            <span><b>工作室</b>：多 Agent 串行协作，规划更完整，适合正式创作与复杂章节生成。</span>
                                            <span><b>快速</b>：更快返回结果，适合试方向、补小段或快速续写。</span>
                                            <span><b>电影感</b>：更强调画面感、镜头感和戏剧张力，适合关键场面。</span>
                                            <span className="disabled-tooltip__arrow" />
                                        </span>
                                    )}
                                </span>
                            </div>

                            <DisabledTooltip reason={startDisabledReason} disabled={startDisabled}>
                                <button
                                    type="button"
                                    className="primary-btn"
                                    onClick={handleStart}
                                    disabled={startDisabled}
                                >
                                    {generating ? '生成中…' : '开始生成'}
                                </button>
                            </DisabledTooltip>

                            <DisabledTooltip
                                reason={
                                    !projectId
                                        ? '缺少项目信息'
                                        : hasAdvValidationError
                                            ? '高级设置参数超出范围，请检查后重试'
                                        : generating
                                            ? '正在生成中，请等待完成或停止当前任务'
                                            : continuationPreparing
                                                ? '正在准备续写任务'
                                                : ''
                                }
                                disabled={!projectId || generating || continuationPreparing || hasAdvValidationError}
                            >
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => void handleContinueFromLatest()}
                                    disabled={!projectId || generating || continuationPreparing || hasAdvValidationError}
                                >
                                    {continuationPreparing ? '准备续写...' : '从最新章节续写'}
                                </button>
                            </DisabledTooltip>

                            <DisabledTooltip
                                reason={
                                    generating
                                        ? '正在生成中，请先停止当前任务'
                                        : (sections.length === 0 && chapters.length === 0 && logs.length === 0)
                                            ? '当前没有可清空的草稿内容'
                                            : '仅清空当前创作台草稿显示，不影响已保存章节'
                                }
                                disabled={generating || (sections.length === 0 && chapters.length === 0 && logs.length === 0)}
                            >
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleClearCurrentDraft}
                                    disabled={generating || (sections.length === 0 && chapters.length === 0 && logs.length === 0)}
                                >
                                    清空当前草稿
                                </button>
                            </DisabledTooltip>

                            <button type="button" className="ghost-btn" onClick={stop} disabled={!generating}>
                                停止
                            </button>
                        </div>

                        <div className="advanced-box" style={{ marginTop: 12 }}>
                            <div className="metric-label" style={{ marginBottom: 10 }}>生成设置</div>
                            <div className="settings-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: 0 }}>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="adv-chapter-count">章节数</label>
                                    <input
                                        id="adv-chapter-count"
                                        className={`field-control${advErrors.chapter_count?.type === 'error' ? ' field-error' : ''}`}
                                        type="number"
                                        min={1}
                                        max={60}
                                        value={chapterCountInput}
                                        onChange={(e) => {
                                            const raw = e.target.value
                                            if (!isDigitsOnly(raw)) return
                                            setChapterCountInput(raw)
                                            if (raw === '') return
                                            setForm((p) => ({ ...p, chapter_count: Number(raw) }))
                                        }}
                                        onBlur={() => {
                                            if (chapterCountInput.trim() === '') {
                                                setChapterCountInput(String(form.chapter_count))
                                            }
                                            setAdvErrors((prev) => ({
                                                ...prev,
                                                chapter_count: validateField(
                                                    chapterCountInput.trim() === '' ? form.chapter_count : Number(chapterCountInput),
                                                    CHAPTER_COUNT_RULE,
                                                ),
                                            }))
                                        }}
                                    />
                                    {advErrors.chapter_count && (
                                        <span className={`field-message--${advErrors.chapter_count.type}`}>
                                            {advErrors.chapter_count.message}
                                        </span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="adv-words-per-chapter">每章目标字数</label>
                                    <input
                                        id="adv-words-per-chapter"
                                        className={`field-control${advErrors.words_per_chapter?.type === 'error' ? ' field-error' : ''}`}
                                        type="number"
                                        min={300}
                                        max={12000}
                                        value={wordsPerChapterInput}
                                        onChange={(e) => {
                                            const raw = e.target.value
                                            if (!isDigitsOnly(raw)) return
                                            setWordsPerChapterInput(raw)
                                            if (raw === '') return
                                            setForm((p) => ({ ...p, words_per_chapter: Number(raw) }))
                                        }}
                                        onBlur={() => {
                                            if (wordsPerChapterInput.trim() === '') {
                                                setWordsPerChapterInput(String(form.words_per_chapter))
                                            }
                                            setAdvErrors((prev) => ({
                                                ...prev,
                                                words_per_chapter: validateField(
                                                    wordsPerChapterInput.trim() === '' ? form.words_per_chapter : Number(wordsPerChapterInput),
                                                    WORDS_PER_CHAPTER_RULE,
                                                ),
                                            }))
                                        }}
                                    />
                                    {advErrors.words_per_chapter && (
                                        <span className={`field-message--${advErrors.words_per_chapter.type}`}>
                                            {advErrors.words_per_chapter.message}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={form.auto_approve}
                                        onChange={(e) =>
                                            setForm((p) => ({ ...p, auto_approve: e.target.checked }))
                                        }
                                    />
                                    <span className="toggle-switch__track" />
                                    <span className="toggle-switch__label">无 P0 冲突自动审批</span>
                                </label>
                                <span className="muted" style={{ fontSize: '0.78rem', lineHeight: 1.3 }}>
                                    生成完成后，若章节无 P0 级冲突则自动通过审批。
                                </span>
                            </div>
                        </div>

                        {error && <p className="error-line">{error}</p>}
                    </div>
                </div>
            </div>
        </PageTransition>
    )
}
