import { useCallback, useEffect, useRef, useState } from 'react'
import { useProjectStore, type ProjectCreateForm } from '../../stores/useProjectStore'
import { useToastStore } from '../../stores/useToastStore'
import { api } from '../../lib/api'

interface ProjectCreateModalProps {
    open: boolean
    onClose: () => void
}

const GENRE_PRESETS = ['奇幻', '科幻', '悬疑', '历史', '都市']

interface StoryTemplate {
    id: string
    name: string
    category: string
    description: string
    genre_suggestion?: string
    style_suggestion?: string
    default_taboos?: string[]
    prompt_hint?: string
    recommended?: {
        target_length?: number
        chapter_count?: number
        words_per_chapter?: number
        chapter_range?: [number, number]
    }
}

const defaultForm: ProjectCreateForm = {
    name: '',
    genre: '奇幻',
    style: '冷峻现实主义',
    template_id: '',
    target_length: 300000,
    taboo_constraints: '',
}

export default function ProjectCreateModal({ open, onClose }: ProjectCreateModalProps) {
    const createProject = useProjectStore((s) => s.createProject)
    const addToast = useToastStore((s) => s.addToast)
    const [creating, setCreating] = useState(false)
    const [form, setForm] = useState<ProjectCreateForm>({ ...defaultForm })
    const [targetLengthInput, setTargetLengthInput] = useState(String(defaultForm.target_length))
    const [templates, setTemplates] = useState<StoryTemplate[]>([])
    const [loadingTemplates, setLoadingTemplates] = useState(false)
    const nameInputRef = useRef<HTMLInputElement | null>(null)
    const handleCreateRef = useRef<() => Promise<void>>(async () => {})

    const handleCreate = useCallback(async () => {
        const parsedTargetLength = Number(targetLengthInput)
        const normalizedTargetLength = Number.isFinite(parsedTargetLength) && parsedTargetLength > 0
            ? parsedTargetLength
            : form.target_length
        const normalizedForm: ProjectCreateForm = {
            ...form,
            name: form.name.trim(),
            genre: form.genre.trim(),
            style: form.style.trim(),
            template_id: form.template_id?.trim() || '',
            taboo_constraints: form.taboo_constraints.trim(),
            target_length: normalizedTargetLength,
            synopsis: form.synopsis?.trim() || undefined,
        }
        if (!normalizedForm.name || !normalizedForm.genre) return
        setCreating(true)
        try {
            await createProject(normalizedForm)
            setForm({ ...defaultForm })
            setTargetLengthInput(String(defaultForm.target_length))
            addToast('success', '项目创建成功')
            onClose()
        } catch {
            addToast('error', '项目创建失败，请重试')
        } finally {
            setCreating(false)
        }
    }, [form, targetLengthInput, createProject, addToast, onClose])

    useEffect(() => {
        if (!open) return
        const timer = window.setTimeout(() => nameInputRef.current?.focus(), 0)
        return () => {
            window.clearTimeout(timer)
        }
    }, [open])

    useEffect(() => {
        if (!open || templates.length > 0 || loadingTemplates) return
        setLoadingTemplates(true)
        void api
            .get('/story-templates')
            .then((res) => {
                const items = Array.isArray(res?.data?.templates) ? (res.data.templates as StoryTemplate[]) : []
                setTemplates(items)
            })
            .catch(() => {
                setTemplates([])
            })
            .finally(() => {
                setLoadingTemplates(false)
            })
    }, [open, templates.length, loadingTemplates])

    useEffect(() => {
        setTargetLengthInput(String(form.target_length))
    }, [form.target_length])

    useEffect(() => {
        handleCreateRef.current = handleCreate
    }, [handleCreate])

    useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !creating) {
                onClose()
            }
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'enter') {
                event.preventDefault()
                void handleCreateRef.current()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [open, creating, onClose])

    if (!open) return null

    const selectedTemplate = templates.find((item) => item.id === form.template_id)

    const applyTemplate = (template: StoryTemplate) => {
        setForm((prev) => {
            const mergedTaboos = new Set(
                prev.taboo_constraints
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
            )
            for (const item of template.default_taboos || []) {
                mergedTaboos.add(item)
            }
            const nextTargetLength = template.recommended?.target_length ?? prev.target_length
            const genreShouldFill = !prev.genre.trim() || prev.genre.trim() === defaultForm.genre
            const styleShouldFill = !prev.style.trim() || prev.style.trim() === defaultForm.style
            return {
                ...prev,
                template_id: template.id,
                genre: genreShouldFill ? (template.genre_suggestion || prev.genre) : prev.genre,
                style: styleShouldFill ? (template.style_suggestion || prev.style) : prev.style,
                target_length: nextTargetLength,
                taboo_constraints: Array.from(mergedTaboos).join(', '),
            }
        })
        if (template.recommended?.target_length) {
            setTargetLengthInput(String(template.recommended.target_length))
        }
        addToast('info', `已应用模板建议：${template.name}`)
    }

    const formatLength = (len?: number) => {
        if (!len) return null
        if (len >= 10000) return `~${Math.round(len / 10000)}万字`
        return `~${len}字`
    }

    return (
        <div className="modal-backdrop" aria-modal="true" role="dialog">
            <div
                className="card modal-card"
                style={{
                    width: '50%',
                    maxWidth: '50%',
                    maxHeight: '88vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <h2 style={{ marginTop: 0, marginBottom: 12, fontWeight: 600, letterSpacing: '-0.02em', flexShrink: 0 }}>创建小说项目</h2>

                <div style={{ display: 'grid', gap: 12, overflowY: 'auto', minHeight: 0 }}>
                    {/* 模板选择 — 自适应网格，自动换行 */}
                    <div>
                        <div className="metric-label" style={{ marginBottom: 6 }}>创作模板</div>
                        {loadingTemplates ? (
                            <div className="muted" style={{ fontSize: '0.78rem' }}>正在加载模板…</div>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateRows: 'repeat(2, auto)',
                                    gridAutoFlow: 'column',
                                    gridAutoColumns: '1fr',
                                    gap: 8,
                                }}
                            >
                                <button
                                    type="button"
                                    className="card-strong"
                                    onClick={() => setForm({ ...form, template_id: '' })}
                                    style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        border: !form.template_id ? '1.5px solid var(--accent)' : '1px solid var(--glass-border)',
                                        background: !form.template_id ? 'var(--accent-subtle)' : undefined,
                                        borderRadius: 8,
                                        transition: 'border-color 0.15s, background 0.15s',
                                    }}
                                >
                                    <div style={{ fontWeight: 500, fontSize: '0.82rem' }}>自由创作</div>
                                </button>
                                {templates.map((t) => {
                                    const isSelected = form.template_id === t.id
                                    return (
                                        <button
                                            type="button"
                                            key={t.id}
                                            className="card-strong"
                                            onClick={() => applyTemplate(t)}
                                            style={{
                                                padding: '8px 12px',
                                                cursor: 'pointer',
                                                border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--glass-border)',
                                                background: isSelected ? 'var(--accent-subtle)' : undefined,
                                                borderRadius: 8,
                                                transition: 'border-color 0.15s, background 0.15s',
                                            }}
                                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--glass-hover)' }}
                                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = '' }}
                                        >
                                            <div style={{ fontWeight: 500, fontSize: '0.82rem' }}>{t.name}</div>
                                            {formatLength(t.recommended?.target_length) && (
                                                <div className="muted" style={{ fontSize: '0.72rem', marginTop: 2 }}>
                                                    {formatLength(t.recommended?.target_length)}
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                        {selectedTemplate && (
                            <div className="muted" style={{ marginTop: 6, fontSize: '0.78rem' }}>
                                {selectedTemplate.description}
                                {selectedTemplate.prompt_hint ? ` · ${selectedTemplate.prompt_hint}` : ''}
                            </div>
                        )}
                    </div>

                    {/* 项目名称 — 独占一行 */}
                    <label>
                        <div className="metric-label" style={{ marginBottom: 4 }}>项目名称</div>
                        <input
                            className="input"
                            ref={nameInputRef}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="例如：霜城编年史"
                        />
                    </label>

                    {/* 题材 + 文风 — 两列 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <label>
                            <div className="metric-label" style={{ marginBottom: 6 }}>题材</div>
                            <input
                                className="input"
                                list="project-genre-options"
                                value={form.genre}
                                onChange={(e) => setForm({ ...form, genre: e.target.value })}
                                placeholder="例如：赛博修仙 / 太空歌剧 / 克苏鲁"
                            />
                            <datalist id="project-genre-options">
                                {GENRE_PRESETS.map((genre) => (
                                    <option key={genre} value={genre} />
                                ))}
                            </datalist>
                            <div className="muted" style={{ marginTop: 6, fontSize: '0.78rem' }}>
                                可直接输入自定义题材，也可选择常用题材
                            </div>
                        </label>
                        <label>
                            <div className="metric-label" style={{ marginBottom: 6 }}>文风契约</div>
                            <input
                                className="input"
                                value={form.style}
                                onChange={(e) => setForm({ ...form, style: e.target.value })}
                            />
                        </label>
                    </div>

                    {/* 目标篇幅 + 禁忌约束 — 两列 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <label>
                            <div className="metric-label" style={{ marginBottom: 4 }}>目标篇幅（字）</div>
                            <input
                                className="input"
                                type="number"
                                step={10000}
                                value={targetLengthInput}
                                onChange={(e) => {
                                    const raw = e.target.value
                                    if (!/^\d*$/.test(raw)) return
                                    setTargetLengthInput(raw)
                                    if (raw === '') return
                                    setForm({ ...form, target_length: Number(raw) })
                                }}
                                onBlur={() => {
                                    if (targetLengthInput.trim() === '') {
                                        setTargetLengthInput(String(form.target_length))
                                    }
                                }}
                            />
                        </label>
                        <label>
                            <div className="metric-label" style={{ marginBottom: 4 }}>禁忌约束</div>
                            <input
                                className="input"
                                value={form.taboo_constraints}
                                onChange={(e) => setForm({ ...form, taboo_constraints: e.target.value })}
                                placeholder="逗号分隔，如：主角开局无敌"
                            />
                        </label>
                    </div>

                    {/* 故事梗概 */}
                    <label>
                        <div className="metric-label" style={{ marginBottom: 4 }}>故事梗概</div>
                        <textarea
                            className="textarea"
                            rows={2}
                            placeholder="主角是谁、冲突是什么、目标是什么"
                            value={form.synopsis || ''}
                            onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
                        />
                        <div className="muted" style={{ marginTop: 4, fontSize: '0.75rem' }}>
                            写入 L1 身份记忆，生成时自动引用
                        </div>
                    </label>
                </div>

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <span className="muted" style={{ fontSize: '0.75rem' }}>
                        <kbd>Ctrl/Cmd + Enter</kbd> 创建 · <kbd>Esc</kbd> 关闭
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={creating}>
                            取消
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={creating || !form.name.trim() || !form.genre.trim()}>
                            {creating ? '创建中...' : '创建项目'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
