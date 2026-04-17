export interface AgentDecision {
  id: string
  agent_role: string
  input_refs: string[]
  decision_text: string
  reasoning?: string
  timestamp: string
}

export interface Conflict {
  id: string
  severity: 'P0' | 'P1' | 'P2'
  rule_id: string
  reason: string
  suggested_fix?: string
  evidence_paths?: string[]
}

export interface TraceData {
  id: string
  chapter_id: number
  decisions: AgentDecision[]
  memory_hits: Array<Record<string, unknown>>
  conflicts_detected: Conflict[]
  final_draft?: string
}

export const AGENT_ROLE_COLORS: Record<string, { color: string; borderColor: string; label: string }> = {
  director: { color: 'var(--trace-director-bg)', borderColor: 'var(--trace-director-border)', label: '导演' },
  worldbuilder: { color: 'var(--trace-worldbuilder-bg)', borderColor: 'var(--trace-worldbuilder-border)', label: '设定官' },
  continuity: { color: 'var(--trace-continuity-bg)', borderColor: 'var(--trace-continuity-border)', label: '连续性审校' },
  stylist: { color: 'var(--trace-stylist-bg)', borderColor: 'var(--trace-stylist-border)', label: '文风润色' },
  arbiter: { color: 'var(--trace-arbiter-bg)', borderColor: 'var(--trace-arbiter-border)', label: '裁决器' },
}

export const SEVERITY_STYLES: Record<string, string> = {
  p0: 'var(--trace-severity-p0-bg)',
  p1: 'var(--trace-severity-p1-bg)',
  p2: 'var(--trace-severity-p2-bg)',
}

export function getRoleStyle(role: string) {
  return AGENT_ROLE_COLORS[role] ?? { color: 'var(--trace-default-bg)', borderColor: 'var(--trace-default-border)', label: role }
}

export function sanitizeDecisionText(text?: string) {
  if (!text) return ''
  return text
    .replace(/<\s*think(?:ing)?\s*>[\s\S]*?<\s*\/\s*think(?:ing)?\s*>/gi, '')
    .replace(/```(?:thinking|reasoning)\s*[\s\S]*?```/gi, '')
    .replace(/^\s*(thinking|thoughts?|reasoning)\s*[:：].*(?:\n|$)/gim, '')
    .trim()
}

export function formatDecisionTime(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '--:--:--'
  return date.toLocaleTimeString()
}
