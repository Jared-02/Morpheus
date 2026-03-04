import { useStreamStore, type AgentStageId, type ChapterStageEvent } from '../../stores/useStreamStore'

const AGENT_PIPELINE: { id: AgentStageId; name: string }[] = [
    { id: 'director', name: '导演' },
    { id: 'setter', name: '设定官' },
    { id: 'stylist', name: '润色' },
    { id: 'arbiter', name: '裁决' },
]

const AGENT_ORDER: AgentStageId[] = AGENT_PIPELINE.map((s) => s.id)

type StepStatus = 'pending' | 'active' | 'completed' | 'failed'

function resolveStepStatus(stageId: AgentStageId, current: ChapterStageEvent | undefined): StepStatus {
    if (!current) return 'pending'
    const currentIdx = AGENT_ORDER.indexOf(current.stage)
    const thisIdx = AGENT_ORDER.indexOf(stageId)
    if (currentIdx < 0) return 'pending'
    if (thisIdx < currentIdx) return 'completed'
    if (thisIdx > currentIdx) return 'pending'
    if (current.status === 'completed') return 'completed'
    if (current.status === 'failed') return 'failed'
    return 'active'
}

const STATUS_STYLES: Record<StepStatus, React.CSSProperties> = {
    pending: { background: 'var(--bg-2)', color: 'var(--text-tertiary)' },
    active: { background: 'var(--accent-subtle)', color: 'var(--accent)', borderColor: 'var(--accent-border)' },
    completed: { background: 'var(--success-subtle)', color: 'var(--success)' },
    failed: { background: 'var(--danger-subtle)', color: 'var(--danger)' },
}

function StepIndicator({ status }: { status: StepStatus }) {
    if (status === 'completed') return <span aria-hidden="true" style={{ fontSize: 12 }}>&#10003;</span>
    if (status === 'failed') return <span aria-hidden="true" style={{ fontSize: 12 }}>&#10007;</span>
    if (status === 'active') return <span aria-hidden="true" className="agent-progress__spinner" />
    return <span aria-hidden="true" style={{ fontSize: 10, opacity: 0.4 }}>&#9679;</span>
}

export default function AgentProgressBar({ chapterId }: { chapterId: string }) {
    const stage = useStreamStore((s) => s.stages[chapterId])

    if (!stage) return null

    const pct = Math.max(0, Math.min(100, stage.progress_pct ?? 0))
    const valueText = `${stage.agent_name || stage.stage} ${stage.status === 'completed' ? '完成' : '进行中'}，${pct}%`

    return (
        <div className="agent-progress" role="progressbar" aria-label="智能体协作进度" aria-valuetext={valueText} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="agent-progress__steps">
                {AGENT_PIPELINE.map((agent) => {
                    const status = resolveStepStatus(agent.id, stage)
                    return (
                        <div
                            key={agent.id}
                            className="agent-progress__step"
                            style={STATUS_STYLES[status]}
                            data-status={status}
                        >
                            <StepIndicator status={status} />
                            <span className="agent-progress__label">{agent.name}</span>
                        </div>
                    )
                })}
            </div>
            <div className="agent-progress__bar-track">
                <div className="agent-progress__bar-fill" style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}
