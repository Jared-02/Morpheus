import ReactMarkdown from 'react-markdown'
import { AnimatePresence, motion } from 'framer-motion'
import PageTransition from '../components/ui/PageTransition'
import DisabledTooltip from '../components/ui/DisabledTooltip'
import { validateField } from '../utils/validation'
import ChapterTOC from '../components/chapter/ChapterTOC'
import ChapterExportMenu from '../components/chapter/ChapterExportMenu'
import AgentProgressBar from '../components/chapter/AgentProgressBar'
import ReadingModeView from '../components/ui/ReadingModeView'
import useWritingStudioController from '../features/writing/useWritingStudioController'
import {
  CHAPTER_COUNT_RULE,
  MODE_LABELS,
  WORDS_PER_CHAPTER_RULE,
  dedupeStringItems,
  isDigitsOnly,
} from '../features/writing/writingShared'

export const IconBookOpen = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
)

function PulseIndicator({ generated, total }: { generated: number; total: number }) {
  return (
    <div className="writing-pulse">
      <span className="writing-pulse__dot" />
      <span className="writing-pulse__text">正在生成中… {generated}/{total} 章已完成</span>
    </div>
  )
}

export default function WritingConsolePage() {
  const {
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
  } = useWritingStudioController()

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
        currentLabel={activeSection ? `第${activeSection.chapterNumber}章 ${activeSection.title}` : undefined}
      />
    )
  }

  return (
    <PageTransition>
      <div className="writing-page">
        <div className="writing-header">
          <div>
            <h1 className="writing-header__title">创作控制台</h1>
            <p className="writing-header__sub">{currentProject?.name || '加载中…'} · {MODE_LABELS[form.mode]}</p>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0, fontSize: '0.82rem' }}>
              本页负责批量生成与续写。章节细修、审批和冲突处理请在章节工作台完成。
            </p>
          </div>
        </div>

        <div className={`writing-body${auxPanelOpen ? ' writing-body--with-panel' : ''}`}>
          <section className="writing-main">
            <AnimatePresence>
              {generating && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                  <PulseIndicator generated={metrics.generated} total={form.chapter_count} />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="writing-main__tools">
              <div className="writing-main__tools-left">
                <button type="button" className={`chip-btn ${auxPanelOpen ? 'active' : ''}`} onClick={() => setAuxPanelOpen((value) => !value)}>
                  {auxPanelOpen ? '隐藏辅助面板' : '显示辅助面板'}
                </button>
                {auxPanelOpen && (
                  <>
                    <button type="button" className={`chip-btn ${auxPanelTab === 'toc' ? 'active' : ''}`} onClick={() => setAuxPanelTab('toc')}>
                      目录
                    </button>
                    <button type="button" className={`chip-btn ${auxPanelTab === 'stats' ? 'active' : ''}`} onClick={() => setAuxPanelTab('stats')}>
                      统计
                    </button>
                    <button type="button" className={`chip-btn ${auxPanelTab === 'logs' ? 'active' : ''}`} onClick={() => setAuxPanelTab('logs')}>
                      日志
                    </button>
                  </>
                )}
              </div>
              <div className="writing-main__tools-right">
                {sections.length > 0 && (
                  <button type="button" className="chip-btn" onClick={enterReadingMode} title="进入阅读模式" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <IconBookOpen /> 阅读模式
                  </button>
                )}
                {exportChapters.length > 0 && (
                  <ChapterExportMenu allChapters={exportChapters} projectName={currentProject?.name || '未命名项目'} />
                )}
              </div>
            </div>

            <article className="stream-paper" ref={streamRef}>
              {sectionViewModels.length > 0 ? (
                sectionViewModels.map((section, index) => (
                  <section key={section.chapterId} className="stream-section">
                    <h1 className="stream-section__title">第{section.chapterNumber}章 {section.title}</h1>
                    {generating && <AgentProgressBar chapterId={section.chapterId} />}
                    {section.narrativeBody ? <ReactMarkdown>{section.narrativeBody}</ReactMarkdown> : <p className="placeholder-text">正在生成这一章，请稍候...</p>}
                    {index < sectionViewModels.length - 1 && <hr />}
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
                <p className="placeholder-text">输入创作提示并点击「开始生成」，这里会实时渲染 Markdown 正文。</p>
              )}
            </article>
          </section>

          {auxPanelOpen && (
            <aside className="writing-aux-panel">
              {auxPanelTab === 'toc' && (
                <>
                  <p className="writing-aux-panel__title">章节目录</p>
                  {tocChapters.length > 0 ? (
                    <ChapterTOC chapters={tocChapters} activeChapterId={activeSection?.chapterId} onSelect={scrollToChapter} />
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
              <textarea className="composer-input" rows={3} value={form.batch_direction} onChange={(event) => setForm((prev) => ({ ...prev, batch_direction: event.target.value }))} placeholder="对这批章节的创作方向，如：在接下来8章收掉之前埋下的所有伏笔，然后直接大结局" />
              {projectTemplate && (
                <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.8rem' }}>
                  当前项目模板：{projectTemplate.name}。{projectTemplate.promptHint}
                </p>
              )}
            </div>

            <div className="composer-actions">
              <div className="mode-group">
                {(['studio', 'quick', 'cinematic'] as const).map((mode) => (
                  <button type="button" key={mode} className={`chip-btn ${form.mode === mode ? 'active' : ''}`} onClick={() => setForm((prev) => ({ ...prev, mode }))}>
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
                <button type="button" className="primary-btn" onClick={handleStart} disabled={startDisabled}>
                  {generating ? '生成中…' : '开始生成'}
                </button>
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
                <button type="button" className="btn btn-secondary" onClick={() => void handleContinueFromLatest()} disabled={generating || continuationPreparing || hasAdvValidationError}>
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
                <button type="button" className="btn btn-secondary" onClick={handleClearCurrentDraft} disabled={generating || (sections.length === 0 && chapters.length === 0 && logs.length === 0)}>
                  清空当前草稿
                </button>
              </DisabledTooltip>

              <button type="button" className="ghost-btn" onClick={stop} disabled={!generating}>停止</button>
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
                    onChange={(event) => {
                      const raw = event.target.value
                      if (!isDigitsOnly(raw)) return
                      setChapterCountInput(raw)
                      if (raw === '') return
                      setForm((prev) => ({ ...prev, chapter_count: Number(raw) }))
                    }}
                    onBlur={() => {
                      if (chapterCountInput.trim() === '') {
                        setChapterCountInput(String(form.chapter_count))
                      }
                      setAdvErrors((prev) => ({
                        ...prev,
                        chapter_count: validateField(chapterCountInput.trim() === '' ? form.chapter_count : Number(chapterCountInput), CHAPTER_COUNT_RULE),
                      }))
                    }}
                  />
                  {advErrors.chapter_count && <span className={`field-message--${advErrors.chapter_count.type}`}>{advErrors.chapter_count.message}</span>}
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
                    onChange={(event) => {
                      const raw = event.target.value
                      if (!isDigitsOnly(raw)) return
                      setWordsPerChapterInput(raw)
                      if (raw === '') return
                      setForm((prev) => ({ ...prev, words_per_chapter: Number(raw) }))
                    }}
                    onBlur={() => {
                      if (wordsPerChapterInput.trim() === '') {
                        setWordsPerChapterInput(String(form.words_per_chapter))
                      }
                      setAdvErrors((prev) => ({
                        ...prev,
                        words_per_chapter: validateField(wordsPerChapterInput.trim() === '' ? form.words_per_chapter : Number(wordsPerChapterInput), WORDS_PER_CHAPTER_RULE),
                      }))
                    }}
                  />
                  {advErrors.words_per_chapter && <span className={`field-message--${advErrors.words_per_chapter.type}`}>{advErrors.words_per_chapter.message}</span>}
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="toggle-switch">
                  <input type="checkbox" checked={form.auto_approve} onChange={(event) => setForm((prev) => ({ ...prev, auto_approve: event.target.checked }))} />
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
