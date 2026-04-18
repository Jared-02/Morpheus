import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import WritingStudioPage from '../WritingStudioPage'
import LegacyChapterRedirect from '../LegacyChapterRedirect'
import { mantineTheme } from '../../theme/mantineTheme'

const mockFetchProject = vi.fn()
const mockFetchChapters = vi.fn()

const mockProjectStore = {
  currentProject: { id: 'proj-1', name: '霜城编年史' },
  chapters: [
    { id: 'ch-1', chapter_number: 1, title: '雪夜惊变', goal: '', synopsis: '', status: 'draft', word_count: 1200, conflict_count: 1 },
    { id: 'ch-2', chapter_number: 2, title: '潜伏反击', goal: '', synopsis: '', status: 'reviewing', word_count: 1800, conflict_count: 0 },
  ],
  chaptersError: null,
  fetchProject: mockFetchProject,
  fetchChapters: mockFetchChapters,
}

const mockWritingController = {
  currentProject: { id: 'proj-1', name: '霜城编年史' },
  projectTemplate: { name: '长篇模板', promptHint: '聚焦主线冲突与推进节奏。' },
  generating: false,
  stop: vi.fn(),
  sections: [],
  chapters: [],
  logs: ['规划 Agent 已启动'],
  error: null,
  readingMode: false,
  enterReadingMode: vi.fn(),
  exitReadingMode: vi.fn(),
  streamRef: { current: null },
  logRef: { current: null },
  activeChapterIdx: 0,
  form: {
    batch_direction: '让主角在前两章建立误判。',
    mode: 'studio',
    chapter_count: 8,
    words_per_chapter: 1600,
    auto_approve: true,
  },
  setForm: vi.fn(),
  chapterCountInput: '8',
  setChapterCountInput: vi.fn(),
  wordsPerChapterInput: '1600',
  setWordsPerChapterInput: vi.fn(),
  continuationPreparing: false,
  advErrors: {},
  setAdvErrors: vi.fn(),
  firstChapterMode: false,
  sectionViewModels: [],
  activeSection: null,
  readingTocItems: [],
  markdownText: '',
  metrics: { generated: 0, totalWords: 0, totalP0: 0 },
  tocChapters: [],
  exportChapters: [],
  handleStart: vi.fn(),
  handleContinueFromLatest: vi.fn(),
  handleClearCurrentDraft: vi.fn(),
  scrollToChapter: vi.fn(),
  startDisabled: false,
  startDisabledReason: '',
  hasAdvValidationError: false,
  goToPrevChapter: vi.fn(),
  goToNextChapter: vi.fn(),
}

const mockChapterController = {
  chapter: {
    id: 'ch-1',
    chapter_number: 1,
    title: '雪夜惊变',
    goal: '主角在雪夜第一次意识到自己被利用。',
    status: 'draft',
  },
  loading: false,
  readingMode: false,
  enterReadingMode: vi.fn(),
  exitReadingMode: vi.fn(),
  readingContent: '章节正文',
  draftContent: '这是章节草稿内容。',
  setDraftContent: vi.fn(),
  streamChannel: 'arbiter',
  setStreamChannel: vi.fn(),
  activeStreamText: '这是章节草稿内容。',
  emptyStreamText: '暂无通道内容',
  loadingPlan: false,
  streaming: false,
  streamingStage: null,
  savingDraft: false,
  publishing: false,
  creatingFanqieBook: false,
  fillingFanqieByLLM: false,
  showFanqieCreateForm: false,
  setShowFanqieCreateForm: vi.fn(),
  showRejectConfirm: false,
  setShowRejectConfirm: vi.fn(),
  showDeleteConfirm: false,
  setShowDeleteConfirm: vi.fn(),
  deletingChapter: false,
  directionHint: '把背叛感再压深一点。',
  setDirectionHint: vi.fn(),
  p0Conflicts: [],
  p1Conflicts: [{ id: 'p1', severity: 'P1', rule_id: 'R-1', reason: '角色称谓前后不一致' }],
  p2Conflicts: [],
  isGenerating: false,
  canSubmitApproval: true,
  primaryActionLabel: '提交审批',
  primaryActionReason: '',
  blueprintBeats: ['雪地追踪', '误认同伴', '局势翻转'],
  blueprintConflicts: [],
  blueprintForeshadowing: [],
  blueprintCallbacks: [],
  planQuality: null,
  planQualityMessages: [],
  currentChapterIndex: 0,
  hasPrevChapter: false,
  hasNextChapter: true,
  navigateToChapter: vi.fn(),
  readingTocItems: [],
  currentChapterExport: { chapterNumber: 1, title: '雪夜惊变', content: '这是章节草稿内容。' },
  allChaptersExport: [{ chapterNumber: 1, title: '雪夜惊变', content: '这是章节草稿内容。' }],
  projectName: '霜城编年史',
  autoSaveLastSaved: 1710000000000,
  showDraftRestore: false,
  fanqieBookIdInput: '',
  setFanqieBookIdInput: vi.fn(),
  fanqieCreateForm: {
    intro: '',
    protagonist1: '',
    protagonist2: '',
    targetReader: 'male',
    tagsByTab: {
      mainCategory: '悬疑脑洞',
      theme: '赛博朋克',
      role: '神探',
      plot: '惊悚游戏',
    },
  },
  setFanqieCreateForm: vi.fn(),
  generatePlan: vi.fn(),
  redoDraft: vi.fn(),
  reviewDraft: vi.fn(),
  reopenReview: vi.fn(),
  saveDraft: vi.fn(),
  publishChapterExternally: vi.fn(),
  createAndBindFanqieBook: vi.fn(),
  saveFanqieBookId: vi.fn(),
  fillFanqieFormWithLLM: vi.fn(),
  handleDeleteChapter: vi.fn(),
  handleRestoreDraft: vi.fn(),
  handleDiscardDraft: vi.fn(),
}

vi.mock('../../stores/useProjectStore', () => ({
  useProjectStore: (selector: (state: typeof mockProjectStore) => unknown) => selector(mockProjectStore),
}))

vi.mock('../../features/writing/useWritingStudioController', () => ({
  default: () => mockWritingController,
}))

vi.mock('../../features/writing/useChapterWorkbenchController', () => ({
  default: () => mockChapterController,
}))

vi.mock('../../components/chapter/ChapterExportMenu', () => ({
  default: () => <div data-testid="export-menu">导出菜单</div>,
}))

vi.mock('../../components/ui/ReadingModeView', () => ({
  default: () => <div data-testid="reading-mode-view">阅读模式</div>,
}))

function LocationProbe() {
  const location = useLocation()
  return (
    <div>
      <div data-testid="location-pathname">{location.pathname}</div>
      <div data-testid="location-search">{location.search}</div>
    </div>
  )
}

function renderWritingStudio(initialPath: string) {
  return render(
    <MantineProvider theme={mantineTheme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/project/:projectId/write" element={<><WritingStudioPage /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  )
}

function renderLegacyRedirect(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/project/:projectId/chapter" element={<LegacyChapterRedirect />} />
        <Route path="/project/:projectId/chapter/:chapterId" element={<LegacyChapterRedirect />} />
        <Route path="/project/:projectId/write" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WritingStudioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })

  it('在批量模式下渲染新工作台和章节目录', () => {
    renderWritingStudio('/project/proj-1/write')

    expect(screen.getAllByText('文本创作').length).toBeGreaterThan(0)
    expect(screen.getAllByText('创作方向').length).toBeGreaterThan(0)
    expect(screen.getByText('批量生成 / 续写')).toBeInTheDocument()
    expect(screen.getByText('雪夜惊变')).toBeInTheDocument()
    expect(mockFetchChapters).toHaveBeenCalledWith('proj-1')
  })

  it('点击章节目录会把 URL 切到 query 驱动的章节模式', () => {
    renderWritingStudio('/project/proj-1/write')

    fireEvent.click(screen.getByText('潜伏反击'))

    expect(screen.getByTestId('location-search').textContent).toContain('chapter=ch-2')
  })

  it('点击 Inspector tab 会把 tab 状态写回 URL', () => {
    renderWritingStudio('/project/proj-1/write')

    fireEvent.click(screen.getByRole('tab', { name: '历史' }))

    expect(screen.getByTestId('location-search').textContent).toContain('inspector=history')
  })

  it('带 chapter 查询参数时进入逐章编辑模式', () => {
    renderWritingStudio('/project/proj-1/write?chapter=ch-1&inspector=history')

    expect(screen.getByText('第 1 章 · 雪夜惊变')).toBeInTheDocument()
    expect(screen.getByText(/最近一次自动保存/)).toBeInTheDocument()
  })

  it('逐章模式保留决策回放入口和番茄参数入口', () => {
    renderWritingStudio('/project/proj-1/write?chapter=ch-1&inspector=history')

    expect(screen.getByText('决策回放').closest('a')).toHaveAttribute('href', '/project/proj-1/trace/ch-1')
    expect(screen.getByText('填写番茄参数')).toBeInTheDocument()
    expect(screen.getByText('创建并绑定番茄书本')).toBeInTheDocument()
  })
})

describe('LegacyChapterRedirect', () => {
  it('把旧章节深链接重定向到新的写作工作台 query 路由', () => {
    renderLegacyRedirect('/project/proj-1/chapter/ch-2?inspector=history')

    expect(screen.getByTestId('location-pathname')).toHaveTextContent('/project/proj-1/write')
    expect(screen.getByTestId('location-search').textContent).toContain('chapter=ch-2')
    expect(screen.getByTestId('location-search').textContent).toContain('inspector=history')
  })
})
