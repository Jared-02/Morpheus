import { useCallback, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Select,
  ScrollArea,
  SegmentedControl,
  Skeleton,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  UnstyledButton,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconArrowRight,
  IconBook2,
  IconDeviceFloppy,
  IconEye,
  IconPlayerStop,
  IconRefresh,
  IconSparkles,
  IconTargetArrow,
  IconTrash,
  IconWriting,
} from '@tabler/icons-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ChapterExportMenu from '../components/chapter/ChapterExportMenu'
import DisabledTooltip from '../components/ui/DisabledTooltip'
import ReadingModeView from '../components/ui/ReadingModeView'
import WorkspaceFrame from '../app/shell/WorkspaceFrame'
import useWritingStudioController from '../features/writing/useWritingStudioController'
import useChapterWorkbenchController from '../features/writing/useChapterWorkbenchController'
import {
  CHAPTER_COUNT_RULE,
  MODE_LABELS,
  WORDS_PER_CHAPTER_RULE,
  dedupeStringItems,
  isDigitsOnly,
} from '../features/writing/writingShared'
import { chapterStatusMeta } from '../features/writing/chapterWorkbenchShared'
import { useProjectStore, type ChapterItem } from '../stores/useProjectStore'
import { validateField } from '../utils/validation'
import AppPanel from '../shared/ui/AppPanel'
import InspectorSection from '../shared/ui/InspectorSection'
import StatusBadge from '../shared/ui/StatusBadge'
import WorkspaceTabs from '../shared/ui/WorkspaceTabs'

type InspectorTab = 'agent' | 'setting' | 'history'
type StatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const INSPECTOR_LABELS: Record<InspectorTab, string> = {
  agent: '灵感 Agent',
  setting: '设定集',
  history: '历史',
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  studio: '多 Agent 协作，适合正式创作与成章生成。',
  quick: '快速试方向、补段落或低成本续写。',
  cinematic: '强调画面感、镜头感和戏剧张力。',
}

function normalizeInspectorTab(value: string | null): InspectorTab {
  if (value === 'setting' || value === 'history') return value
  return 'agent'
}

function statusToneForChapter(status: string): StatusTone {
  switch (String(status || '').toLowerCase()) {
    case 'approved':
      return 'success'
    case 'reviewing':
      return 'accent'
    case 'revised':
      return 'warning'
    default:
      return 'neutral'
  }
}

function formatWordCount(value: number) {
  return `${Number(value || 0).toLocaleString()} 字`
}

function formatTimestamp(timestamp?: number | null) {
  if (!timestamp) return '尚未自动保存'
  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function renderList(items: string[]) {
  if (items.length === 0) {
    return <Text size="sm" c="dimmed">暂无内容</Text>
  }

  return (
    <Stack gap="xs">
      {items.map((item, index) => (
        <Paper key={`${item}-${index}`} p="sm" radius="md" withBorder>
          <Text size="sm">{item}</Text>
        </Paper>
      ))}
    </Stack>
  )
}

interface WritingRailProps {
  projectId: string
  projectName?: string
  chapters: ChapterItem[]
  chaptersError: string | null
  selectedChapterId: string | null
  onSelectChapter: (chapterId: string | null) => void
}

function WritingRail({
  projectId,
  projectName,
  chapters,
  chaptersError,
  selectedChapterId,
  onSelectChapter,
}: WritingRailProps) {
  return (
    <Stack gap="md">
      <AppPanel
        eyebrow="工作入口"
        title="写作工作台"
        description={projectName ? `${projectName} · 批量生成与逐章编辑收敛到同一路由。` : '批量生成与逐章编辑收敛到同一路由。'}
      >
        <Stack gap="xs">
          <Button
            variant={selectedChapterId ? 'subtle' : 'filled'}
            fullWidth
            leftSection={<IconSparkles size={16} stroke={1.8} />}
            onClick={() => onSelectChapter(null)}
          >
            批量生成 / 续写
          </Button>
          <Button
            component={Link}
            to={`/project/${projectId}`}
            variant="subtle"
            fullWidth
            leftSection={<IconArrowLeft size={16} stroke={1.8} />}
          >
            返回项目概览
          </Button>
          <Text size="xs" c="dimmed">
            选中某章会把 URL 切到 `?chapter=...`；切回批量模式会移除该参数。
          </Text>
        </Stack>
      </AppPanel>

      <AppPanel
        eyebrow="章节目录"
        title={`已保存章节 ${chapters.length}`}
        description="左侧 rail 负责卷章跳转，旧章节链接会自动跳回这里。"
      >
        {chaptersError && (
          <Alert color="red" variant="light">
            {chaptersError}
          </Alert>
        )}

        {chapters.length === 0 ? (
          <Paper p="md" radius="lg" withBorder>
            <Stack gap={6} align="flex-start">
              <Group gap="xs">
                <IconBook2 size={16} stroke={1.8} />
                <Text fw={600}>还没有已保存章节</Text>
              </Group>
              <Text size="sm" c="dimmed">
                可以先在当前工作台批量生成首章，再通过本目录进入逐章细修。
              </Text>
            </Stack>
          </Paper>
        ) : (
          <ScrollArea.Autosize mah={540} type="scroll">
            <Stack gap="xs">
              {chapters.map((chapter) => {
                const active = chapter.id === selectedChapterId
                return (
                  <UnstyledButton
                    key={chapter.id}
                    onClick={() => onSelectChapter(chapter.id)}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Paper
                      p="sm"
                      radius="lg"
                      withBorder
                      style={{
                        borderColor: active ? 'var(--accent)' : undefined,
                        background: active ? 'var(--accent-subtle)' : undefined,
                      }}
                    >
                      <Stack gap={6}>
                        <Group justify="space-between" align="center">
                          <Text fw={700} size="sm">第 {chapter.chapter_number} 章</Text>
                          <StatusBadge tone={statusToneForChapter(chapter.status)}>
                            {chapter.status}
                          </StatusBadge>
                        </Group>
                        <Text fw={600} lineClamp={1}>{chapter.title || '未命名章节'}</Text>
                        <Group justify="space-between" gap="xs">
                          <Text size="xs" c="dimmed">{formatWordCount(chapter.word_count)}</Text>
                          <Text size="xs" c="dimmed">冲突 {chapter.conflict_count}</Text>
                        </Group>
                      </Stack>
                    </Paper>
                  </UnstyledButton>
                )
              })}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </AppPanel>
    </Stack>
  )
}

interface SharedWorkspaceProps {
  projectId: string
  projectName?: string
  chapters: ChapterItem[]
  chaptersError: string | null
  selectedChapterId: string | null
  inspectorTab: InspectorTab
  onSelectChapter: (chapterId: string | null) => void
  onInspectorTabChange: (tab: InspectorTab) => void
}

function BatchStudioWorkspace({
  projectId,
  projectName,
  chapters,
  chaptersError,
  selectedChapterId,
  inspectorTab,
  onSelectChapter,
  onInspectorTabChange,
}: SharedWorkspaceProps) {
  const {
    currentProject,
    projectTemplate,
    generating,
    stop,
    sections,
    chapters: generatedChapters,
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
  } = useWritingStudioController()

  const inspector = (
    <WorkspaceTabs
      value={inspectorTab}
      onChange={(value) => onInspectorTabChange(normalizeInspectorTab(value))}
      tabs={[
        {
          value: 'agent',
          label: INSPECTOR_LABELS.agent,
          panel: (
            <Stack gap="md">
              <InspectorSection label="当前模式">
                {MODE_LABELS[form.mode]} · {MODE_DESCRIPTIONS[form.mode]}
              </InspectorSection>
              <InspectorSection label="运行状态">
                {generating
                  ? `正在生成中，已完成 ${metrics.generated}/${form.chapter_count} 章。`
                  : sectionViewModels.length > 0
                    ? `当前流中已生成 ${sectionViewModels.length} 章，可继续阅读或导出。`
                    : '尚未开始生成，先填写创作方向。'}
              </InspectorSection>
              <AppPanel title="生成日志" padding="md">
                <ScrollArea h={320} type="scroll" viewportRef={logRef}>
                  <Stack gap="xs">
                    {logs.length === 0 ? (
                      <Text size="sm" c="dimmed">暂无日志</Text>
                    ) : (
                      dedupeStringItems(logs).map(({ key, value }) => (
                        <Paper key={key} p="sm" radius="md" withBorder>
                          <Text size="sm">{value}</Text>
                        </Paper>
                      ))
                    )}
                  </Stack>
                </ScrollArea>
              </AppPanel>
            </Stack>
          ),
        },
        {
          value: 'setting',
          label: INSPECTOR_LABELS.setting,
          panel: (
            <Stack gap="md">
              <AppPanel title="批量生成设置" padding="md">
                <Stack gap="sm">
                  <TextInput
                    label="章节数"
                    type="number"
                    value={chapterCountInput}
                    onChange={(event) => {
                      const raw = event.currentTarget.value
                      if (!isDigitsOnly(raw)) return
                      setChapterCountInput(raw)
                      if (!raw.trim()) return
                      setForm((previous) => ({ ...previous, chapter_count: Number(raw) }))
                    }}
                    onBlur={() => {
                      if (!chapterCountInput.trim()) {
                        setChapterCountInput(String(form.chapter_count))
                      }
                      setAdvErrors((previous) => ({
                        ...previous,
                        chapter_count: validateField(
                          chapterCountInput.trim() === '' ? form.chapter_count : Number(chapterCountInput),
                          CHAPTER_COUNT_RULE,
                        ),
                      }))
                    }}
                    description={`范围 ${CHAPTER_COUNT_RULE.min}-${CHAPTER_COUNT_RULE.max}，${CHAPTER_COUNT_RULE.hint}`}
                    error={advErrors.chapter_count?.type === 'error' ? advErrors.chapter_count.message : undefined}
                  />
                  <TextInput
                    label="每章目标字数"
                    type="number"
                    value={wordsPerChapterInput}
                    onChange={(event) => {
                      const raw = event.currentTarget.value
                      if (!isDigitsOnly(raw)) return
                      setWordsPerChapterInput(raw)
                      if (!raw.trim()) return
                      setForm((previous) => ({ ...previous, words_per_chapter: Number(raw) }))
                    }}
                    onBlur={() => {
                      if (!wordsPerChapterInput.trim()) {
                        setWordsPerChapterInput(String(form.words_per_chapter))
                      }
                      setAdvErrors((previous) => ({
                        ...previous,
                        words_per_chapter: validateField(
                          wordsPerChapterInput.trim() === '' ? form.words_per_chapter : Number(wordsPerChapterInput),
                          WORDS_PER_CHAPTER_RULE,
                        ),
                      }))
                    }}
                    description={`范围 ${WORDS_PER_CHAPTER_RULE.min}-${WORDS_PER_CHAPTER_RULE.max}，${WORDS_PER_CHAPTER_RULE.hint}`}
                    error={advErrors.words_per_chapter?.type === 'error' ? advErrors.words_per_chapter.message : undefined}
                  />
                  <Switch
                    checked={form.auto_approve}
                    onChange={(event) => setForm((previous) => ({ ...previous, auto_approve: event.currentTarget.checked }))}
                    label="无 P0 冲突自动审批"
                  />
                  {projectTemplate && (
                    <InspectorSection label="当前模板">
                      {projectTemplate.name} · {projectTemplate.promptHint}
                    </InspectorSection>
                  )}
                  {hasAdvValidationError && (
                    <Alert color="yellow" variant="light">
                      高级设置超出范围，开始生成和续写按钮会被禁用。
                    </Alert>
                  )}
                </Stack>
              </AppPanel>
            </Stack>
          ),
        },
        {
          value: 'history',
          label: INSPECTOR_LABELS.history,
          panel: (
            <Stack gap="md">
              <InspectorSection label="批次统计">
                已生成 {metrics.generated} 章，总字数 {metrics.totalWords.toLocaleString()}，P0 冲突 {metrics.totalP0}。
              </InspectorSection>
              <AppPanel title="本次批次目录" padding="md">
                <Stack gap="xs">
                  {tocChapters.length === 0 ? (
                    <Text size="sm" c="dimmed">暂无可跳转章节</Text>
                  ) : (
                    tocChapters.map((chapter) => (
                      <Button
                        key={chapter.id}
                        variant={chapter.id === activeSection?.chapterId ? 'filled' : 'subtle'}
                        onClick={() => scrollToChapter(chapter.id)}
                      >
                        第 {chapter.chapterNumber} 章 · {chapter.title}
                      </Button>
                    ))
                  )}
                </Stack>
              </AppPanel>
            </Stack>
          ),
        },
      ]}
    />
  )

  const toolbar = (
    <>
      <Badge variant="light">已保存章节 {chapters.length}</Badge>
      {generatedChapters.length > 0 && (
        <Badge variant="light">当前流 {generatedChapters.length} 章</Badge>
      )}
      {sections.length > 0 && (
        <Button variant="subtle" leftSection={<IconEye size={16} stroke={1.8} />} onClick={enterReadingMode}>
          阅读模式
        </Button>
      )}
      <ChapterExportMenu allChapters={exportChapters} projectName={currentProject?.name || projectName || '未命名项目'} />
    </>
  )

  return (
    <WorkspaceFrame
      title="文本创作"
      description="左侧管理卷章入口，中央负责批量生成与续写，右侧 Inspector 用于查看日志、设定和批次历史。"
      toolbar={toolbar}
      railTitle="章节目录"
      rail={(
        <WritingRail
          projectId={projectId}
          projectName={projectName}
          chapters={chapters}
          chaptersError={chaptersError}
          selectedChapterId={selectedChapterId}
          onSelectChapter={onSelectChapter}
        />
      )}
      inspectorTitle="Inspector"
      inspector={inspector}
    >
      <Stack gap="md">
        {firstChapterMode && (
          <Alert color="blue" variant="light" title="开始你的第一章">
            这是一个全新的项目，已为你预设生成 1 章。填写创作方向后点击“开始生成”即可进入首章创作。
          </Alert>
        )}

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <AppPanel
          eyebrow="批量生成"
          title="创作方向"
          description="兼容原有项目入口、方向预填和首章引导逻辑。"
          action={
            <Badge variant="light">
              {MODE_LABELS[form.mode]}
            </Badge>
          }
        >
          <Stack gap="md">
            <Textarea
              label="创作方向"
              placeholder="对这批章节的创作方向，如：在接下来 8 章收掉之前埋下的所有伏笔，然后直接大结局。"
              minRows={4}
              autosize
              value={form.batch_direction}
              onChange={(event) => setForm((previous) => ({ ...previous, batch_direction: event.currentTarget.value }))}
            />
            <Stack gap={6}>
              <Text size="sm" fw={600}>生成模式</Text>
              <SegmentedControl
                value={form.mode}
                onChange={(value) => setForm((previous) => ({ ...previous, mode: value as typeof previous.mode }))}
                data={[
                  { value: 'studio', label: MODE_LABELS.studio },
                  { value: 'quick', label: MODE_LABELS.quick },
                  { value: 'cinematic', label: MODE_LABELS.cinematic },
                ]}
              />
              <Text size="xs" c="dimmed">{MODE_DESCRIPTIONS[form.mode]}</Text>
              {projectTemplate && (
                <Text size="xs" c="dimmed">
                  当前项目模板：{projectTemplate.name}。{projectTemplate.promptHint}
                </Text>
              )}
            </Stack>
            <Group gap="sm" wrap="wrap">
              <DisabledTooltip reason={startDisabledReason} disabled={startDisabled}>
                <Button leftSection={<IconSparkles size={16} stroke={1.8} />} onClick={handleStart} disabled={startDisabled}>
                  {generating ? '生成中…' : '开始生成'}
                </Button>
              </DisabledTooltip>

              <DisabledTooltip
                reason={
                  hasAdvValidationError
                    ? '高级设置参数超出范围，请检查后重试'
                    : generating
                      ? '正在生成中，请等待完成或停止当前任务'
                      : continuationPreparing
                        ? '正在准备续写任务'
                        : ''
                }
                disabled={generating || continuationPreparing || hasAdvValidationError}
              >
                <Button
                  variant="subtle"
                  leftSection={<IconRefresh size={16} stroke={1.8} />}
                  onClick={() => void handleContinueFromLatest()}
                  disabled={generating || continuationPreparing || hasAdvValidationError}
                >
                  {continuationPreparing ? '准备续写...' : '从最新章节续写'}
                </Button>
              </DisabledTooltip>

              <DisabledTooltip
                reason={
                  generating
                    ? '正在生成中，请先停止当前任务'
                    : sections.length === 0 && generatedChapters.length === 0 && logs.length === 0
                      ? '当前没有可清空的草稿内容'
                      : '仅清空当前创作台草稿显示，不影响已保存章节'
                }
                disabled={generating || (sections.length === 0 && generatedChapters.length === 0 && logs.length === 0)}
              >
                <Button
                  variant="subtle"
                  onClick={handleClearCurrentDraft}
                  disabled={generating || (sections.length === 0 && generatedChapters.length === 0 && logs.length === 0)}
                >
                  清空当前草稿
                </Button>
              </DisabledTooltip>

              <Button
                variant="subtle"
                color="red"
                leftSection={<IconPlayerStop size={16} stroke={1.8} />}
                onClick={stop}
                disabled={!generating}
              >
                停止
              </Button>
            </Group>
          </Stack>
        </AppPanel>

        <AppPanel
          eyebrow="中央正文区"
          title={readingMode ? '阅读模式' : '实时正文'}
          description={readingMode ? '以沉浸阅读的方式检查当前批次输出。' : '批量生成的章节会实时渲染在这里，可直接切换到阅读模式。'}
        >
          {generating && (
            <Alert color="blue" variant="light">
              正在生成中，已完成 {metrics.generated}/{form.chapter_count} 章。
            </Alert>
          )}

          {readingMode ? (
            <ReadingModeView
              content={activeSection ? `# 第${activeSection.chapterNumber}章 ${activeSection.title}\n\n${activeSection.displayBody}` : markdownText}
              contentType="markdown"
              emptyText="暂无内容可阅读"
              tocItems={readingTocItems}
              tocTitle="章节目录"
              onExit={exitReadingMode}
              onPrevChapter={goToPrevChapter}
              onNextChapter={goToNextChapter}
              hasPrev={activeChapterIdx > 0}
              hasNext={activeChapterIdx < sections.length - 1}
              currentLabel={activeSection ? `第${activeSection.chapterNumber}章 ${activeSection.title}` : undefined}
            />
          ) : (
            <ScrollArea h={620} type="scroll" viewportRef={streamRef as React.RefObject<HTMLDivElement>}>
              <Stack gap="xl">
                {sectionViewModels.length > 0 ? (
                  sectionViewModels.map((section, index) => (
                    <Stack key={section.chapterId} gap="sm">
                      <Group justify="space-between" align="center">
                        <Text fw={700} fz="xl">第{section.chapterNumber}章 {section.title}</Text>
                        <Badge variant="light">{section.waiting ? '生成中' : formatWordCount(section.exportBody.length)}</Badge>
                      </Group>
                      {section.narrativeBody ? (
                        <div className="stream-section">
                          <ReactMarkdown>{section.narrativeBody}</ReactMarkdown>
                        </div>
                      ) : (
                        <Text size="sm" c="dimmed">正在生成这一章，请稍候...</Text>
                      )}
                      {index < sectionViewModels.length - 1 && <Divider />}
                    </Stack>
                  ))
                ) : firstChapterMode ? (
                  <Paper p="xl" radius="lg" withBorder>
                    <Stack gap="sm">
                      <Text fw={700} fz="lg">从第一章开始</Text>
                      <Text size="sm" c="dimmed">输入方向后点击“开始生成”，系统会先为你生成第一章，再回到本工作台继续细修。</Text>
                    </Stack>
                  </Paper>
                ) : (
                  <Paper p="xl" radius="lg" withBorder>
                    <Stack gap="sm" align="center">
                      <IconWriting size={24} stroke={1.8} />
                      <Text fw={700}>正文预览区</Text>
                      <Text size="sm" c="dimmed" ta="center">
                        输入创作提示并点击“开始生成”，这里会实时渲染 Markdown 正文。
                      </Text>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </ScrollArea>
          )}
        </AppPanel>
      </Stack>
    </WorkspaceFrame>
  )
}

function ChapterStudioWorkspace({
  projectId,
  projectName,
  chapters,
  chaptersError,
  selectedChapterId,
  inspectorTab,
  onSelectChapter,
  onInspectorTabChange,
}: SharedWorkspaceProps) {
  const buildRecentAccessPath = useCallback(
    (targetProjectId: string, chapterId: string) => `/project/${targetProjectId}/write?chapter=${chapterId}`,
    [],
  )
  const handleExitChapter = useCallback(() => onSelectChapter(null), [onSelectChapter])

  const {
    currentProject,
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
    projectName: exportProjectName,
    autoSaveLastSaved,
    showDraftRestore,
    fanqieBookIdInput,
    setFanqieBookIdInput,
    fanqieCreateForm,
    setFanqieCreateForm,
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
  } = useChapterWorkbenchController({
    chapterIdOverride: selectedChapterId,
    onNavigateToChapter: (chapterId) => onSelectChapter(chapterId),
    onExitToProject: handleExitChapter,
    recentAccessPathBuilder: buildRecentAccessPath,
  })

  const chapterStatus = chapter?.status || 'draft'
  const statusDescription = chapterStatusMeta[String(chapterStatus).toLowerCase()] || chapterStatusMeta.draft

  const inspector = (
    <WorkspaceTabs
      value={inspectorTab}
      onChange={(value) => onInspectorTabChange(normalizeInspectorTab(value))}
      tabs={[
        {
          value: 'agent',
          label: INSPECTOR_LABELS.agent,
          panel: (
            <Stack gap="md">
              <AppPanel title="灵感与重做提示" padding="md">
                <Stack gap="sm">
                  <Textarea
                    label="方向提示"
                    minRows={4}
                    autosize
                    placeholder="给本章增加明确的重做方向，留空则沿用章节目标。"
                    value={directionHint}
                    onChange={(event) => setDirectionHint(event.currentTarget.value)}
                  />
                  <Group gap="sm" wrap="wrap">
                    <Button
                      variant="subtle"
                      leftSection={<IconTargetArrow size={16} stroke={1.8} />}
                      onClick={() => void generatePlan()}
                      loading={loadingPlan}
                    >
                      生成蓝图
                    </Button>
                    <Button
                      variant="subtle"
                      leftSection={<IconRefresh size={16} stroke={1.8} />}
                      onClick={() => void redoDraft()}
                      disabled={streaming}
                    >
                      重做正文
                    </Button>
                  </Group>
                </Stack>
              </AppPanel>

              <AppPanel title="多 Agent 通道" padding="md">
                <Stack gap="sm">
                  <SegmentedControl
                    value={streamChannel}
                    onChange={(value) => setStreamChannel(value as typeof streamChannel)}
                    data={[
                      { value: 'arbiter', label: '正文' },
                      { value: 'director', label: '导演' },
                      { value: 'setter', label: '设定' },
                      { value: 'stylist', label: '文风' },
                    ]}
                  />
                  <Paper p="sm" radius="md" withBorder>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {activeStreamText.trim() || emptyStreamText}
                    </Text>
                  </Paper>
                </Stack>
              </AppPanel>
            </Stack>
          ),
        },
        {
          value: 'setting',
          label: INSPECTOR_LABELS.setting,
          panel: (
            <Stack gap="md">
              <InspectorSection label="章节状态">
                {statusDescription.label} · {statusDescription.hint}
              </InspectorSection>
              <InspectorSection label="蓝图质量">
                {planQuality
                  ? `状态 ${planQuality.status}，分数 ${planQuality.score ?? '-'}。`
                  : '当前尚未生成蓝图质量评分。'}
              </InspectorSection>
              {planQualityMessages.length > 0 && (
                <AppPanel title="质量提示" padding="md">
                  {renderList(planQualityMessages)}
                </AppPanel>
              )}
              <AppPanel title="节拍" padding="md">
                {renderList(blueprintBeats)}
              </AppPanel>
              <AppPanel title="冲突设计" padding="md">
                {blueprintConflicts.length === 0 ? (
                  <Text size="sm" c="dimmed">暂无蓝图冲突项</Text>
                ) : (
                  <Stack gap="xs">
                    {blueprintConflicts.map((item) => (
                      <Paper key={`${item.headline}-${item.body}`} p="sm" radius="md" withBorder>
                        <Text fw={700} size="sm">{item.headline}</Text>
                        {item.body && <Text size="sm" c="dimmed">{item.body}</Text>}
                      </Paper>
                    ))}
                  </Stack>
                )}
              </AppPanel>
              <AppPanel title="伏笔" padding="md">
                {renderList(blueprintForeshadowing.map((item) => `${item.title}${item.detail ? `：${item.detail}` : ''}`))}
              </AppPanel>
              <AppPanel title="回收目标" padding="md">
                {renderList(blueprintCallbacks.map((item) => `${item.title}${item.detail ? `：${item.detail}` : ''}`))}
              </AppPanel>
            </Stack>
          ),
        },
        {
          value: 'history',
          label: INSPECTOR_LABELS.history,
          panel: (
            <Stack gap="md">
              <InspectorSection label="自动保存">
                最近一次自动保存：{formatTimestamp(autoSaveLastSaved)}
              </InspectorSection>
              <InspectorSection label="冲突概览">
                P0 {p0Conflicts.length} 条，P1 {p1Conflicts.length} 条，P2 {p2Conflicts.length} 条。
              </InspectorSection>

              <AppPanel title="冲突详情" padding="md">
                <Stack gap="xs">
                  {p0Conflicts.length === 0 && p1Conflicts.length === 0 && p2Conflicts.length === 0 ? (
                    <Text size="sm" c="dimmed">当前没有未处理冲突</Text>
                  ) : (
                    [...p0Conflicts, ...p1Conflicts, ...p2Conflicts].map((conflict) => (
                      <Paper key={conflict.id} p="sm" radius="md" withBorder>
                        <Group justify="space-between" align="flex-start">
                          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                            <Text fw={700} size="sm">{conflict.rule_id} · {conflict.reason}</Text>
                            {conflict.suggested_fix && (
                              <Text size="sm" c="dimmed">建议：{conflict.suggested_fix}</Text>
                            )}
                          </Stack>
                          <StatusBadge tone={conflict.severity === 'P0' ? 'danger' : conflict.severity === 'P1' ? 'warning' : 'neutral'}>
                            {conflict.severity}
                          </StatusBadge>
                        </Group>
                      </Paper>
                    ))
                  )}
                </Stack>
              </AppPanel>

              <AppPanel title="外部发布与管理" padding="md">
                <Stack gap="sm">
                  <TextInput
                    label="番茄 book_id"
                    value={fanqieBookIdInput}
                    placeholder="未绑定"
                    onChange={(event) => setFanqieBookIdInput(event.currentTarget.value)}
                    onBlur={(event) => {
                      const next = event.currentTarget.value.trim()
                      if (next !== fanqieBookIdInput.trim()) {
                        setFanqieBookIdInput(next)
                      }
                      void saveFanqieBookId(next)
                    }}
                  />
                  <Group gap="sm" wrap="wrap">
                    <Button
                      component={Link}
                      to={`/project/${projectId}/trace/${selectedChapterId}`}
                      variant="subtle"
                    >
                      决策回放
                    </Button>
                    <Button
                      variant="subtle"
                      onClick={() => void publishChapterExternally()}
                      disabled={publishing || streaming || !draftContent.trim()}
                    >
                      {publishing ? '发布中...' : '一键发布章节'}
                    </Button>
                    <Button variant="subtle" color="yellow" onClick={() => setShowRejectConfirm(true)}>
                      退回重写
                    </Button>
                    <Button
                      variant="subtle"
                      onClick={() => setShowFanqieCreateForm((value) => !value)}
                      disabled={creatingFanqieBook || fillingFanqieByLLM || streaming}
                    >
                      {showFanqieCreateForm ? '收起番茄参数' : '填写番茄参数'}
                    </Button>
                    <Button
                      variant="subtle"
                      onClick={() => void createAndBindFanqieBook()}
                      disabled={creatingFanqieBook || fillingFanqieByLLM || streaming}
                    >
                      {creatingFanqieBook ? '创建中...' : '创建并绑定番茄书本'}
                    </Button>
                    <Button
                      variant="subtle"
                      color="red"
                      leftSection={<IconTrash size={16} stroke={1.8} />}
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={streaming || deletingChapter}
                    >
                      删除本章
                    </Button>
                  </Group>
                  <ChapterExportMenu
                    currentChapter={currentChapterExport}
                    allChapters={allChaptersExport.length > 0 ? allChaptersExport : undefined}
                    projectName={exportProjectName || projectName || '未命名项目'}
                  />
                </Stack>
              </AppPanel>

              {showFanqieCreateForm && (
                <AppPanel title="番茄创建参数" padding="md">
                  <Stack gap="md">
                    <Group gap="sm" wrap="wrap">
                      <Button
                        variant="subtle"
                        onClick={() => void fillFanqieFormWithLLM()}
                        disabled={fillingFanqieByLLM || creatingFanqieBook}
                      >
                        {fillingFanqieByLLM ? 'LLM 填充中...' : 'LLM 填充剩余字段'}
                      </Button>
                      <Text size="xs" c="dimmed">标题固定引用项目名，不参与 LLM 生成。</Text>
                    </Group>

                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                      <TextInput
                        label="书本名称（<=15）"
                        value={String(currentProject?.name || projectName || '')}
                        placeholder="引用项目名"
                        readOnly
                      />
                      <Select
                        label="目标读者"
                        value={fanqieCreateForm.targetReader}
                        onChange={(value) => {
                          setFanqieCreateForm((previous) => ({
                            ...previous,
                            targetReader: value === 'female' ? 'female' : 'male',
                          }))
                        }}
                        data={[
                          { value: 'male', label: '男频' },
                          { value: 'female', label: '女频' },
                        ]}
                        allowDeselect={false}
                      />
                      <TextInput
                        label="主分类（必填，仅 1 个）"
                        value={fanqieCreateForm.tagsByTab.mainCategory}
                        maxLength={24}
                        placeholder="例如：悬疑脑洞"
                        onChange={(event) => {
                          const value = event.currentTarget.value
                          setFanqieCreateForm((previous) => ({
                            ...previous,
                            tagsByTab: { ...previous.tagsByTab, mainCategory: value },
                          }))
                        }}
                      />
                      <TextInput
                        label="主题（最多 2 个）"
                        value={fanqieCreateForm.tagsByTab.theme}
                        maxLength={40}
                        placeholder="逗号分隔，例如：赛博朋克"
                        onChange={(event) => {
                          const value = event.currentTarget.value
                          setFanqieCreateForm((previous) => ({
                            ...previous,
                            tagsByTab: { ...previous.tagsByTab, theme: value },
                          }))
                        }}
                      />
                      <TextInput
                        label="角色（最多 2 个）"
                        value={fanqieCreateForm.tagsByTab.role}
                        maxLength={40}
                        placeholder="逗号分隔，例如：神探"
                        onChange={(event) => {
                          const value = event.currentTarget.value
                          setFanqieCreateForm((previous) => ({
                            ...previous,
                            tagsByTab: { ...previous.tagsByTab, role: value },
                          }))
                        }}
                      />
                      <TextInput
                        label="情节（最多 2 个）"
                        value={fanqieCreateForm.tagsByTab.plot}
                        maxLength={40}
                        placeholder="逗号分隔，例如：惊悚游戏"
                        onChange={(event) => {
                          const value = event.currentTarget.value
                          setFanqieCreateForm((previous) => ({
                            ...previous,
                            tagsByTab: { ...previous.tagsByTab, plot: value },
                          }))
                        }}
                      />
                      <TextInput
                        label="主角名1（可选）"
                        value={fanqieCreateForm.protagonist1}
                        maxLength={5}
                        placeholder="最多5字"
                        onChange={(event) => {
                          const value = event.currentTarget.value
                          setFanqieCreateForm((previous) => ({ ...previous, protagonist1: value }))
                        }}
                      />
                      <TextInput
                        label="主角名2（可选）"
                        value={fanqieCreateForm.protagonist2}
                        maxLength={5}
                        placeholder="最多5字"
                        onChange={(event) => {
                          const value = event.currentTarget.value
                          setFanqieCreateForm((previous) => ({ ...previous, protagonist2: value }))
                        }}
                      />
                    </SimpleGrid>

                    <Text size="xs" c="dimmed">
                      番茄创建要求主分类必填；主题、角色、情节可填 1-2 个，多个标签用逗号分隔。
                    </Text>

                    <Textarea
                      label="作品简介（建议 >=50）"
                      value={fanqieCreateForm.intro}
                      maxLength={500}
                      minRows={4}
                      autosize
                      placeholder="可留空（后端会按项目信息补全）"
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setFanqieCreateForm((previous) => ({ ...previous, intro: value }))
                      }}
                    />

                    <Text size="xs" c="dimmed">
                      当前简介字数：{fanqieCreateForm.intro.trim().length}，若不足 50 字后端会自动补齐。
                    </Text>
                  </Stack>
                </AppPanel>
              )}
            </Stack>
          ),
        },
      ]}
    />
  )

  if (loading) {
    return (
      <WorkspaceFrame
        title="文本创作"
        description="正在加载章节数据。"
        railTitle="章节目录"
        rail={(
          <WritingRail
            projectId={projectId}
            projectName={projectName}
            chapters={chapters}
            chaptersError={chaptersError}
            selectedChapterId={selectedChapterId}
            onSelectChapter={onSelectChapter}
          />
        )}
        inspectorTitle="Inspector"
        inspector={<Skeleton height={420} radius="lg" />}
      >
        <Stack gap="md">
          <Skeleton height={96} radius="lg" />
          <Skeleton height={560} radius="lg" />
        </Stack>
      </WorkspaceFrame>
    )
  }

  const toolbar = (
    <>
      <ActionIcon
        size="lg"
        aria-label="上一章"
        disabled={!hasPrevChapter}
        onClick={() => navigateToChapter(currentChapterIndex - 1)}
      >
        <IconArrowLeft size={18} stroke={1.8} />
      </ActionIcon>
      <ActionIcon
        size="lg"
        aria-label="下一章"
        disabled={!hasNextChapter}
        onClick={() => navigateToChapter(currentChapterIndex + 1)}
      >
        <IconArrowRight size={18} stroke={1.8} />
      </ActionIcon>
      <Button variant="subtle" leftSection={<IconEye size={16} stroke={1.8} />} onClick={enterReadingMode}>
        阅读模式
      </Button>
      <DisabledTooltip
        reason={streaming ? '正在生成中，请等待完成后再保存' : savingDraft ? '正在保存草稿' : ''}
        disabled={streaming || savingDraft}
      >
        <Button
          variant="subtle"
          leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}
          onClick={() => void saveDraft()}
          disabled={streaming || savingDraft}
        >
          {savingDraft ? '保存中...' : '保存草稿'}
        </Button>
      </DisabledTooltip>
      <DisabledTooltip reason={primaryActionReason} disabled={!canSubmitApproval || isGenerating}>
        <Button onClick={() => void (primaryActionLabel === '重新打开审核' ? reopenReview() : reviewDraft('approve'))} disabled={!canSubmitApproval || isGenerating}>
          {primaryActionLabel}
        </Button>
      </DisabledTooltip>
    </>
  )

  return (
    <>
      <WorkspaceFrame
        title="文本创作"
        description={chapter ? `当前正在编辑第 ${chapter.chapter_number} 章。章节切换和 Inspector tab 都会同步到 URL。` : '当前正在编辑章节。'}
        toolbar={toolbar}
        railTitle="章节目录"
        rail={(
          <WritingRail
            projectId={projectId}
            projectName={projectName}
            chapters={chapters}
            chaptersError={chaptersError}
            selectedChapterId={selectedChapterId}
            onSelectChapter={onSelectChapter}
          />
        )}
        inspectorTitle="Inspector"
        inspector={inspector}
      >
        <Stack gap="md">
          {showDraftRestore && (
            <Alert color="yellow" variant="light" title="检测到未恢复的本地草稿">
              <Stack gap="sm">
                <Text size="sm">你有一份本地自动保存草稿与远端正文不一致，可以选择恢复或丢弃。</Text>
                <Group gap="sm">
                  <Button variant="subtle" onClick={handleRestoreDraft}>恢复本地草稿</Button>
                  <Button variant="subtle" color="red" onClick={handleDiscardDraft}>丢弃本地草稿</Button>
                </Group>
              </Stack>
            </Alert>
          )}

          <AppPanel
            eyebrow="逐章编辑"
            title={chapter ? `第 ${chapter.chapter_number} 章 · ${chapter.title}` : '章节编辑'}
            description={chapter?.goal || '当前章节暂无目标描述'}
            action={
              <Group gap="xs">
                <StatusBadge tone={statusToneForChapter(chapterStatus)}>{statusDescription.label}</StatusBadge>
                {streamingStage && <Badge variant="light">{streamingStage}</Badge>}
              </Group>
            }
          >
            {readingMode ? (
              <ReadingModeView
                content={readingContent}
                contentType="markdown"
                emptyText="暂无内容"
                tocItems={readingTocItems}
                tocTitle="章节目录"
                onExit={exitReadingMode}
                onPrevChapter={hasPrevChapter ? () => navigateToChapter(currentChapterIndex - 1) : undefined}
                onNextChapter={hasNextChapter ? () => navigateToChapter(currentChapterIndex + 1) : undefined}
                hasPrev={hasPrevChapter}
                hasNext={hasNextChapter}
                currentLabel={chapter ? `第 ${chapter.chapter_number} 章 · ${chapter.title}` : undefined}
              />
            ) : (
              <Stack gap="md">
                <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
                  <Stack gap={6} style={{ flex: 1, minWidth: 220 }}>
                    <Text size="sm" fw={600}>编辑视图</Text>
                    <SegmentedControl
                      value={streamChannel}
                      onChange={(value) => setStreamChannel(value as typeof streamChannel)}
                      data={[
                        { value: 'arbiter', label: '正文' },
                        { value: 'director', label: '导演' },
                        { value: 'setter', label: '设定' },
                        { value: 'stylist', label: '文风' },
                      ]}
                    />
                  </Stack>
                  <Text size="xs" c="dimmed">最近自动保存：{formatTimestamp(autoSaveLastSaved)}</Text>
                </Group>

                {streamChannel === 'arbiter' ? (
                  <Textarea
                    value={draftContent}
                    onChange={(event) => setDraftContent(event.currentTarget.value)}
                    autosize
                    minRows={24}
                    maxRows={40}
                    placeholder="在这里继续修改本章正文。"
                  />
                ) : (
                  <Paper p="lg" radius="lg" withBorder>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap', minHeight: 420 }}>
                      {activeStreamText.trim() || emptyStreamText}
                    </Text>
                  </Paper>
                )}
              </Stack>
            )}
          </AppPanel>
        </Stack>
      </WorkspaceFrame>

      <Modal opened={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="确认删除当前章节？" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">删除后会回到批量生成视图，旧深链接也会失效。</Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
            <Button color="red" onClick={() => void handleDeleteChapter()} loading={deletingChapter}>确认删除</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={showRejectConfirm} onClose={() => setShowRejectConfirm(false)} title="确认退回当前章节？" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">退回后章节会回到修改状态，便于继续补稿与重审。</Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={() => setShowRejectConfirm(false)}>取消</Button>
            <Button
              color="yellow"
              onClick={() => {
                setShowRejectConfirm(false)
                void reviewDraft('reject')
              }}
            >
              确认退回
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}

export default function WritingStudioPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentProject = useProjectStore((state) => state.currentProject)
  const chapters = useProjectStore((state) => state.chapters)
  const chaptersError = useProjectStore((state) => state.chaptersError)
  const fetchProject = useProjectStore((state) => state.fetchProject)
  const fetchChapters = useProjectStore((state) => state.fetchChapters)

  useEffect(() => {
    if (projectId && currentProject?.id !== projectId) {
      void fetchProject(projectId)
    }
  }, [currentProject?.id, fetchProject, projectId])

  useEffect(() => {
    if (projectId) {
      void fetchChapters(projectId)
    }
  }, [fetchChapters, projectId])

  const selectedChapterId = searchParams.get('chapter')?.trim() || null
  const inspectorTab = normalizeInspectorTab(searchParams.get('inspector'))
  const sortedChapters = useMemo(
    () => [...chapters].sort((left, right) => left.chapter_number - right.chapter_number),
    [chapters],
  )

  const updateSearchParams = useCallback((updates: Record<string, string | null>, replace = false) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      for (const [key, value] of Object.entries(updates)) {
        if (value == null || value === '') {
          next.delete(key)
        } else {
          next.set(key, value)
        }
      }
      return next
    }, { replace })
  }, [setSearchParams])

  const handleSelectChapter = useCallback((chapterId: string | null) => {
    updateSearchParams({ chapter: chapterId }, false)
  }, [updateSearchParams])

  const handleInspectorTabChange = useCallback((tab: InspectorTab) => {
    updateSearchParams({ inspector: tab === 'agent' ? null : tab }, true)
  }, [updateSearchParams])

  if (!projectId) {
    return null
  }

  const sharedProps: SharedWorkspaceProps = {
    projectId,
    projectName: currentProject?.id === projectId ? currentProject.name : undefined,
    chapters: sortedChapters,
    chaptersError,
    selectedChapterId,
    inspectorTab,
    onSelectChapter: handleSelectChapter,
    onInspectorTabChange: handleInspectorTabChange,
  }

  return selectedChapterId
    ? <ChapterStudioWorkspace {...sharedProps} />
    : <BatchStudioWorkspace {...sharedProps} />
}
