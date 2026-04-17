import { Link } from 'react-router-dom'
import ChapterExportMenu from '../components/chapter/ChapterExportMenu'
import DisabledTooltip from '../components/ui/DisabledTooltip'
import ReadingModeView from '../components/ui/ReadingModeView'
import Skeleton from '../components/ui/Skeleton'
import PageTransition from '../components/ui/PageTransition'
import useChapterWorkbenchController from '../features/writing/useChapterWorkbenchController'

/* ── SVG 图标 ── */

export const IconBookOpen = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
)

export default function ChapterWorkbenchPage() {
    const {
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
        autoSaveLastSaved,
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
    } = useChapterWorkbenchController()

    /* ── 无 chapterId：显示章节选择列表 ── */
    if (!chapterId) {
        return (
            <PageTransition>
                <div>
                    <div className="page-head">
                        <div>
                            <Link to={`/project/${projectId}`} className="muted" style={{ textDecoration: 'none' }}>
                                ← 返回项目
                            </Link>
                            <h1 className="title" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <IconBookOpen /> 章节工作台
                            </h1>
                            <p className="subtitle">请选择一个章节进入工作台：</p>
                        </div>
                    </div>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Skeleton variant="card" count={3} />
                        </div>
                    ) : storeChapters.length === 0 ? (
                        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                            <p className="muted">暂无章节，请先在项目详情页创建章节或使用创作控制台生成。</p>
                            <Link to={`/project/${projectId}`} className="btn btn-primary" style={{ marginTop: 12, textDecoration: 'none', display: 'inline-block' }}>
                                返回项目详情
                            </Link>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {sortedChapters.map((ch, idx) => (
                                <button type="button"
                                    key={ch.id}
                                    onClick={() => navigateToChapter(idx)}
                                    className="card clickable-card"
                                    style={{
                                        padding: '14px 18px',
                                        textAlign: 'left',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <span>
                                        第 {ch.chapter_number} 章{ch.title ? ` · ${ch.title}` : ''}
                                    </span>
                                    <span className="chip">{ch.status}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </PageTransition>
        )
    }

    /* ── 骨架屏加载状态 ── */
    if (loading) {
        return (
            <PageTransition>
                <div style={{ padding: 18 }}>
                    <Skeleton variant="text" count={2} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr', gap: 14, marginTop: 16 }}>
                        <div style={{ display: 'grid', gap: 12 }}>
                            <Skeleton variant="card" />
                            <Skeleton variant="card" />
                        </div>
                        <Skeleton variant="card" />
                    </div>
                </div>
            </PageTransition>
        )
    }

    if (!chapter) {
        return (
            <PageTransition>
                <div className="card" style={{ padding: 18 }}>
                    <p style={{ marginTop: 0 }}>章节数据不可用</p>
                    <Link to={`/project/${projectId}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                        返回项目详情
                    </Link>
                </div>
            </PageTransition>
        )
    }

    /* ── 阅读模式 ── */
    if (readingMode) {
        return (
            <PageTransition>
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
                    currentLabel={`第 ${chapter.chapter_number} 章 · ${chapter.title}`}
                />
            </PageTransition>
        )
    }

    /* ── 正常模式 ── */
    return (
        <PageTransition>
            <div>
                {/* 页面头部 */}
                <div className="page-head">
                    <div>
                        <Link to={`/project/${projectId}`} className="muted" style={{ textDecoration: 'none' }}>
                            ← 返回项目
                        </Link>
                        <h1 className="title" style={{ marginTop: 6 }}>
                            第 {chapter.chapter_number} 章 · {chapter.title}
                        </h1>
                        <p className="subtitle" style={{ marginBottom: 0 }}>
                            {chapter.goal}
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', width: '100%', flexBasis: '100%' }}>
                        <div className="grid-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirm(true)} disabled={streaming || deletingChapter}>
                                {deletingChapter ? '处理中...' : '删除本章'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={enterReadingMode}>
                                阅读模式
                            </button>
                            <Link
                                to={`/project/${projectId}/trace/${chapterId}`}
                                className="btn btn-secondary"
                                style={{ textDecoration: 'none' }}
                            >
                                决策回放
                            </Link>
                        </div>
                        <div className="grid-actions" style={{ marginLeft: 'auto' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowFanqieCreateForm((v) => !v)}
                                disabled={creatingFanqieBook || fillingFanqieByLLM || streaming}
                            >
                                {showFanqieCreateForm ? '收起番茄参数' : '填写番茄参数'}
                            </button>
                            <DisabledTooltip
                                reason={
                                    creatingFanqieBook
                                        ? '正在创建番茄书本，请稍候'
                                        : streaming
                                            ? '请先等待当前生成流程结束'
                                            : '将调用 Playwright 在番茄后台创建新书并自动绑定 book_id'
                                }
                                disabled={creatingFanqieBook || fillingFanqieByLLM || streaming}
                            >
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => void createAndBindFanqieBook()}
                                    disabled={creatingFanqieBook || fillingFanqieByLLM || streaming}
                                >
                                    {creatingFanqieBook ? '创建中...' : '创建并绑定番茄书本'}
                                </button>
                            </DisabledTooltip>
                            <ChapterExportMenu
                                currentChapter={currentChapterExport}
                                allChapters={allChaptersExport.length > 0 ? allChaptersExport : undefined}
                                projectName={projectName}
                            />
                            <DisabledTooltip
                                reason={
                                    publishing
                                        ? '正在发布，请稍候'
                                        : !draftContent.trim()
                                            ? '当前无可发布正文'
                                            : '请先等待当前生成流程结束'
                                }
                                disabled={publishing || streaming || !draftContent.trim()}
                            >
                                <button type="button"
                                    className="btn btn-primary"
                                    onClick={() => void publishChapterExternally()}
                                    disabled={publishing || streaming || !draftContent.trim()}
                                >
                                    {publishing ? '发布中...' : '一键发布章节'}
                                </button>
                            </DisabledTooltip>
                            <span className="muted" style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                book_id：
                                <input
                                    type="text"
                                    className="input"
                                    aria-label="番茄 book_id"
                                    style={{ width: 120, fontSize: '0.78rem', padding: '2px 6px' }}
                                    value={fanqieBookIdInput}
                                    placeholder="未绑定"
                                    onChange={(e) => {
                                        setFanqieBookIdInput(e.target.value)
                                    }}
                                    onBlur={(e) => {
                                        const val = e.target.value.trim()
                                        if (val !== (currentProject?.fanqie_book_id || '')) {
                                            setFanqieBookIdInput(val)
                                            void saveFanqieBookId(val)
                                        } else if (e.target.value !== val) {
                                            setFanqieBookIdInput(val)
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                    }}
                                />
                            </span>
                        </div>
                    </div>
                </div>

                {showFanqieCreateForm && (
                    <section className="card" style={{ padding: 14, marginBottom: 14 }}>
                        <h3 className="section-title" style={{ marginTop: 0, marginBottom: 12 }}>番茄创建参数</h3>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                            <button type="button"
                                className="btn btn-secondary"
                                onClick={() => void fillFanqieFormWithLLM()}
                                disabled={fillingFanqieByLLM || creatingFanqieBook}
                            >
                                {fillingFanqieByLLM ? 'LLM 填充中...' : 'LLM 填充剩余字段'}
                            </button>
                            <span className="muted" style={{ fontSize: '0.78rem', alignSelf: 'center' }}>
                                标题固定引用项目名，不参与 LLM 生成。
                            </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 10 }}>
                            <label>
                                <div className="metric-label" style={{ marginBottom: 6 }}>书本名称（≤15）</div>
                                <input
                                    className="input"
                                    value={String(currentProject?.name || '')}
                                    maxLength={15}
                                    readOnly
                                    placeholder="引用项目名"
                                />
                            </label>
                            <label>
                                <div className="metric-label" style={{ marginBottom: 6 }}>目标读者</div>
                                <select
                                    className="select"
                                    value={fanqieCreateForm.targetReader}
                                    onChange={(e) =>
                                        setFanqieCreateForm((prev) => ({
                                            ...prev,
                                            targetReader: e.target.value === 'female' ? 'female' : 'male',
                                        }))
                                    }
                                >
                                    <option value="male">男频</option>
                                    <option value="female">女频</option>
                                    </select>
                                </label>
                            <label>
                                <div className="metric-label" style={{ marginBottom: 6 }}>主分类（必填，仅 1 个）</div>
                                <input
                                    className="input"
                                    value={fanqieCreateForm.tagsByTab.mainCategory}
                                    maxLength={24}
                                    onChange={(e) =>
                                        setFanqieCreateForm((prev) => ({
                                            ...prev,
                                            tagsByTab: { ...prev.tagsByTab, mainCategory: e.target.value },
                                        }))
                                    }
                                    placeholder="例如：悬疑脑洞"
                                />
                            </label>
                            <label>
                                <div className="metric-label" style={{ marginBottom: 6 }}>主题（最多 2 个）</div>
                                <input
                                    className="input"
                                    value={fanqieCreateForm.tagsByTab.theme}
                                    maxLength={40}
                                    onChange={(e) =>
                                        setFanqieCreateForm((prev) => ({
                                            ...prev,
                                            tagsByTab: { ...prev.tagsByTab, theme: e.target.value },
                                        }))
                                    }
                                    placeholder="逗号分隔，例如：赛博朋克"
                                />
                            </label>
                            <label>
                                <div className="metric-label" style={{ marginBottom: 6 }}>角色（最多 2 个）</div>
                                <input
                                    className="input"
                                    value={fanqieCreateForm.tagsByTab.role}
                                    maxLength={40}
                                    onChange={(e) =>
                                        setFanqieCreateForm((prev) => ({
                                            ...prev,
                                            tagsByTab: { ...prev.tagsByTab, role: e.target.value },
                                        }))
                                    }
                                    placeholder="逗号分隔，例如：神探"
                                />
                            </label>
                            <label>
                                <div className="metric-label" style={{ marginBottom: 6 }}>情节（最多 2 个）</div>
                                <input
                                    className="input"
                                    value={fanqieCreateForm.tagsByTab.plot}
                                    maxLength={40}
                                    onChange={(e) =>
                                        setFanqieCreateForm((prev) => ({
                                            ...prev,
                                            tagsByTab: { ...prev.tagsByTab, plot: e.target.value },
                                        }))
                                    }
                                    placeholder="逗号分隔，例如：惊悚游戏"
                                />
                            </label>
                            <label>
                                <div className="metric-label" style={{ marginBottom: 6 }}>主角名1（可选）</div>
                                <input
                                    className="input"
                                    value={fanqieCreateForm.protagonist1}
                                    maxLength={5}
                                    onChange={(e) =>
                                        setFanqieCreateForm((prev) => ({ ...prev, protagonist1: e.target.value }))
                                    }
                                    placeholder="最多5字"
                                />
                            </label>
                            <label>
                                <div className="metric-label" style={{ marginBottom: 6 }}>主角名2（可选）</div>
                                <input
                                    className="input"
                                    value={fanqieCreateForm.protagonist2}
                                    maxLength={5}
                                    onChange={(e) =>
                                        setFanqieCreateForm((prev) => ({ ...prev, protagonist2: e.target.value }))
                                    }
                                    placeholder="最多5字"
                                />
                            </label>
                        </div>
                        <div className="muted" style={{ marginTop: 6, fontSize: '0.78rem' }}>
                            番茄创建要求主分类必填；主题、角色、情节可填 1-2 个，多个标签用逗号分隔。
                        </div>
                        <label style={{ display: 'block', marginTop: 10 }}>
                            <div className="metric-label" style={{ marginBottom: 6 }}>作品简介（建议 ≥50）</div>
                            <textarea
                                className="input"
                                value={fanqieCreateForm.intro}
                                maxLength={500}
                                onChange={(e) =>
                                    setFanqieCreateForm((prev) => ({ ...prev, intro: e.target.value }))
                                }
                                placeholder="可留空（后端会按项目信息补全）"
                                style={{ minHeight: 100, resize: 'vertical' }}
                            />
                        </label>
                        <div className="muted" style={{ marginTop: 6, fontSize: '0.78rem' }}>
                            当前简介字数：{fanqieCreateForm.intro.trim().length}，若不足 50 字后端会自动补齐。
                        </div>
                    </section>
                )}

                {/* 主体内容 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.08fr)', gap: 16, alignItems: 'start' }}>
                    {/* 左栏 */}
                    <div style={{ display: 'grid', gap: 12 }}>
                        {/* 章节蓝图 */}
                        <section className="card" style={{ padding: 14 }}>
                            <h2 className="section-title">章节蓝图</h2>
                            {planQuality && String(planQuality.status).toLowerCase() !== 'ok' && (
                                <div
                                    className={`blueprint-quality-alert ${String(planQuality.status).toLowerCase() === 'bad' ? 'blueprint-quality-alert--bad' : ''}`}
                                    role="status"
                                >
                                    <div className="blueprint-quality-alert__head">
                                        <span>蓝图质量告警</span>
                                        <span>评分 {planQuality.score ?? '-'}</span>
                                    </div>
                                    {planQualityMessages.length > 0 && (
                                        <ul className="blueprint-quality-alert__list">
                                            {planQualityMessages.map((msg, idx) => (
                                                <li key={`${msg}-${idx}`}>{msg}</li>
                                            ))}
                                        </ul>
                                    )}
                                    {planQuality?.retried && (
                                        <p className="blueprint-quality-alert__meta">
                                            已自动重试 {planQuality.attempts || 1} 次；仍建议人工微调蓝图后再生成正文。
                                        </p>
                                    )}
                                </div>
                            )}
                            {!chapter.plan && <p className="muted">尚未生成蓝图。</p>}
                            {chapter.plan && (
                                <div className="blueprint-panel">
                                    <div className="blueprint-group">
                                        <div className="blueprint-group__head">
                                            <div className="metric-label">节拍</div>
                                            <span className="chip">{blueprintBeats.length}</span>
                                        </div>
                                        {blueprintBeats.length === 0 && (
                                            <p className="muted" style={{ margin: '6px 0 0' }}>暂无节拍。</p>
                                        )}
                                        {blueprintBeats.length > 0 && (
                                            <ol className="blueprint-list">
                                                {blueprintBeats.map((item, i) => (
                                                    <li key={`${item}-${i}`} className="blueprint-item">
                                                        <span className="blueprint-item__index">{i + 1}</span>
                                                        <p className="blueprint-item__text">{item}</p>
                                                    </li>
                                                ))}
                                            </ol>
                                        )}
                                    </div>

                                    <div className="blueprint-group">
                                        <div className="blueprint-group__head">
                                            <div className="metric-label">冲突点</div>
                                            <span className="chip p1">{blueprintConflicts.length}</span>
                                        </div>
                                        {blueprintConflicts.length === 0 && (
                                            <p className="muted" style={{ margin: '6px 0 0' }}>暂无冲突点。</p>
                                        )}
                                        {blueprintConflicts.length > 0 && (
                                            <ul className="blueprint-list">
                                                {blueprintConflicts.map((item, i) => (
                                                    <li key={`${item.headline}-${item.body}-${i}`} className="blueprint-item blueprint-item--conflict">
                                                        <span className="blueprint-item__tag">冲突</span>
                                                        <div>
                                                            <p className="blueprint-item__text" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                                                {item.headline}
                                                            </p>
                                                            {item.body && (
                                                                <p className="blueprint-item__text" style={{ marginTop: 4 }}>
                                                                    {item.body}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    <div className="blueprint-group">
                                        <div className="blueprint-group__head">
                                            <div className="metric-label">伏笔与回收</div>
                                        </div>
                                        <div className="blueprint-grid">
                                            <article className="blueprint-detail-card">
                                                <div className="blueprint-detail-card__title">埋伏笔</div>
                                                {blueprintForeshadowing.length === 0 && (
                                                    <p className="muted" style={{ margin: '6px 0 0' }}>暂无伏笔。</p>
                                                )}
                                                {blueprintForeshadowing.length > 0 && (
                                                    <ul className="blueprint-detail-list">
                                                        {blueprintForeshadowing.map((item, i) => (
                                                            <li key={`${item.title}-${i}`} className="blueprint-detail-item">
                                                                <p className="blueprint-detail-item__title">{item.title}</p>
                                                                {item.detail && <p className="blueprint-detail-item__detail">{item.detail}</p>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </article>

                                            <article className="blueprint-detail-card">
                                                <div className="blueprint-detail-card__title">回收目标</div>
                                                {blueprintCallbacks.length === 0 && (
                                                    <p className="muted" style={{ margin: '6px 0 0' }}>暂无回收目标。</p>
                                                )}
                                                {blueprintCallbacks.length > 0 && (
                                                    <ul className="blueprint-detail-list">
                                                        {blueprintCallbacks.map((item, i) => (
                                                            <li key={`${item.title}-${i}`} className="blueprint-detail-item">
                                                                <p className="blueprint-detail-item__title">{item.title}</p>
                                                                {item.detail && <p className="blueprint-detail-item__detail">{item.detail}</p>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </article>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button type="button" className="btn btn-secondary" onClick={generatePlan} disabled={loadingPlan || streaming}>
                                    {loadingPlan ? '生成中...' : chapter.plan ? '重新生成蓝图' : '生成蓝图'}
                                </button>
                            </div>
                        </section>

                    </div>

                    {/* 右栏 */}
                    <div className="workbench-right-column" style={{ display: 'grid', gap: 12 }}>
                        {/* 正文草稿 */}
                        <section className="card" style={{ padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                <h2 className="section-title">正文草稿</h2>
                                <span className="chip">字数 {chapter.word_count || draftContent.length}</span>
                            </div>

                        <section className="card-strong" style={{ marginTop: 12, padding: 12, display: 'grid', gap: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <div>
                                    <div className="section-title" style={{ margin: 0, fontSize: '0.92rem' }}>章节修改方向</div>
                                    <div className="muted" style={{ marginTop: 4, fontSize: '0.8rem' }}>
                                        右侧统一处理正文修改、蓝图重生与本章重做，让审核和修改保持在同一上下文里。
                                    </div>
                                </div>
                                <button type="button" className="btn btn-secondary" onClick={generatePlan} disabled={loadingPlan || streaming}>
                                    {loadingPlan ? '生成中...' : chapter.plan ? '重新生成蓝图' : '生成蓝图'}
                                </button>
                            </div>
                            <textarea
                                className="textarea"
                                rows={4}
                                placeholder="描述你想怎么改这一章，如：把背叛改成暗中保护的误会"
                                value={directionHint}
                                onChange={(e) => setDirectionHint(e.target.value)}
                                disabled={loadingPlan || streaming}
                            />
                        </section>

                        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {!chapter.plan && (
                                <button type="button" className="btn btn-secondary" onClick={generatePlan} disabled={loadingPlan || streaming}>
                                    先生成蓝图
                                </button>
                            )}
                            <DisabledTooltip reason="正在生成中，请等待完成或停止当前任务" disabled={streaming}>
                                <button type="button" className="btn btn-primary" disabled={streaming} onClick={() => void redoDraft()}>
                                    {streaming ? (streamingStage || '重做中...') : '重做本章'}
                                </button>
                            </DisabledTooltip>
                            <button type="button" className="btn btn-secondary" disabled={savingDraft || streaming} onClick={saveDraft}>
                                {savingDraft ? '保存中...' : '保存编辑并重检'}
                            </button>
                            {autoSaveLastSaved && (
                                <span className="muted" style={{ fontSize: '0.8rem', alignSelf: 'center' }}>
                                    已自动保存
                                </span>
                            )}
                        </div>

                        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="metric-label">流式通道</span>
                            <button type="button"
                                className={streamChannel === 'arbiter' ? 'btn btn-primary' : 'btn btn-secondary'}
                                onClick={() => setStreamChannel('arbiter')}
                                disabled={streaming && streamChannel !== 'arbiter' && draftContent.length === 0}
                            >
                                终稿
                            </button>
                            <button type="button"
                                className={streamChannel === 'director' ? 'btn btn-primary' : 'btn btn-secondary'}
                                onClick={() => setStreamChannel('director')}
                            >
                                导演
                            </button>
                            <button type="button"
                                className={streamChannel === 'setter' ? 'btn btn-primary' : 'btn btn-secondary'}
                                onClick={() => setStreamChannel('setter')}
                            >
                                设定
                            </button>
                            <button type="button"
                                className={streamChannel === 'stylist' ? 'btn btn-primary' : 'btn btn-secondary'}
                                onClick={() => setStreamChannel('stylist')}
                            >
                                润色
                            </button>
                        </div>

                        {hasLaterChapters && (
                                <div className="blueprint-quality-alert" style={{ marginTop: 12 }}>
                                    <div className="metric-label" style={{ color: 'var(--warning)' }}>重做本章衔接风险</div>
                                    <div className="muted" style={{ marginTop: 4, fontSize: '0.84rem' }}>
                                        后续章节已存在，重做本章可能导致与后续章节的衔接出现不一致。建议重做后立即检查一致性冲突。
                                    </div>
                            </div>
                        )}

                        <div style={{ marginTop: 12 }}>
                            <textarea
                                className="textarea workbench-channel-viewer__textarea"
                                rows={22}
                                value={activeStreamText || emptyStreamText}
                                onChange={(e) => {
                                    if (streamChannel !== 'arbiter') return
                                    setDraftContent(e.target.value)
                                }}
                                readOnly={streamChannel !== 'arbiter'}
                                style={{ minHeight: 480, overflow: 'auto', resize: 'vertical', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
                            />
                        </div>

                        <div className="grid-actions" style={{ marginTop: 12, alignItems: 'center', gap: 10 }}>
                            <div className="card-strong" style={{ padding: '8px 10px', minWidth: 260 }}>
                                <div className="metric-label">当前状态：{statusMeta.label}</div>
                                <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>{statusMeta.hint}</div>
                                {p0Conflicts.length > 0 && (
                                    <div style={{ fontSize: '0.82rem', marginTop: 4, color: 'var(--warning)' }}>
                                        当前阻断：存在未解决 P0 冲突，请先处理后再审批。
                                    </div>
                                )}
                            </div>
                            <DisabledTooltip
                                reason={primaryActionReason}
                                disabled={!canSubmitApproval}
                            >
                                <button type="button"
                                    className="btn btn-primary"
                                    onClick={() => (isApproved ? reopenReview() : reviewDraft('approve'))}
                                    disabled={!canSubmitApproval}
                                >
                                    {primaryActionLabel}
                                </button>
                            </DisabledTooltip>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowRejectConfirm(true)} disabled={isGenerating}>
                                退回重写
                            </button>
                            {p0Conflicts.length > 0 && (
                                <span className="muted" style={{ fontSize: '0.85rem' }}>
                                    存在 {p0Conflicts.length} 个 P0 冲突需解决
                                </span>
                            )}
                        </div>

                        </section>

                        <section className="card" style={{ padding: 14 }}>
                            <h2 className="section-title">一致性冲突</h2>
                            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <span className="chip p0">P0 {p0Conflicts.length}</span>
                                <span className="chip p1">P1 {p1Conflicts.length}</span>
                                <span className="chip p2">P2 {p2Conflicts.length}</span>
                            </div>
                            <div style={{ marginTop: 12, display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto' }}>
                                {(chapter.conflicts || []).length === 0 && (
                                    <p className="muted" style={{ margin: 0 }}>当前无冲突。</p>
                                )}
                                {(chapter.conflicts || []).map((conflict) => (
                                    <article key={conflict.id} className="card-strong" style={{ padding: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                            <span className={`chip ${conflict.severity.toLowerCase()}`}>{conflict.severity}</span>
                                            <span className="metric-label">{conflict.rule_id}</span>
                                        </div>
                                        <p style={{ margin: '8px 0 0' }}>{conflict.reason}</p>
                                        {conflict.suggested_fix && (
                                            <p className="muted" style={{ margin: '6px 0 0' }}>建议：{conflict.suggested_fix}</p>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                {/* 退回重写确认对话框 */}
                {showRejectConfirm && (
                    <div className="modal-backdrop">
                        <div className="card" style={{ padding: 20, textAlign: 'center', maxWidth: 360 }}>
                            <p style={{ margin: '0 0 8px', fontWeight: 500 }}>确认退回重写？</p>
                            <p className="muted" style={{ margin: '0 0 16px' }}>
                                退回后当前草稿将标记为需要重写，此操作不可撤销。
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectConfirm(false)}>取消</button>
                                <button type="button" className="btn btn-primary" onClick={() => { setShowRejectConfirm(false); reviewDraft('reject') }}>确认退回</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 删除章节确认对话框 */}
                {showDeleteConfirm && (
                    <div className="modal-backdrop">
                        <div className="card" style={{ padding: 20, textAlign: 'center', maxWidth: 420 }}>
                            <p style={{ margin: '0 0 8px', fontWeight: 500 }}>确认删除当前章节？</p>
                            <p className="muted" style={{ margin: '0 0 16px' }}>
                                删除后将返回项目页。如仍需该章节，请回到创作控制台重新生成或在项目页新建章节。
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deletingChapter}>
                                    取消
                                </button>
                                <button type="button" className="btn btn-primary" onClick={() => void handleDeleteChapter()} disabled={deletingChapter}>
                                    {deletingChapter ? '删除中...' : '确认删除'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 草稿恢复对话框 */}
                {showDraftRestore && (
                    <div className="modal-backdrop">
                        <div className="card" style={{ padding: 20, textAlign: 'center', maxWidth: 360 }}>
                            <p style={{ margin: '0 0 8px', fontWeight: 500 }}>发现本地草稿</p>
                            <p className="muted" style={{ margin: '0 0 16px' }}>
                                上次编辑的内容尚未保存到服务器，是否恢复？
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                                <button type="button" className="btn btn-secondary" onClick={handleDiscardDraft}>丢弃草稿</button>
                                <button type="button" className="btn btn-primary" onClick={handleRestoreDraft}>恢复草稿</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    )
}
