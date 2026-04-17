import type { ReactNode } from 'react'
import { L4_PROFILE_ENABLED } from '../../config/features'

export interface MemoryResult {
  item_id: string
  layer: 'L1' | 'L2' | 'L3'
  source_path: string
  summary: string
  evidence?: string
  content?: string
  combined_score?: number
  score?: number
}

export interface CharacterProfile {
  profile_id: string
  character_name: string
  overview?: string
  personality?: string
  relationships?: Array<{ source_character: string; target_character: string; relation_type: string; chapter: number }>
  state_changes?: Array<{ character: string; attribute: string; before: string; after: string; chapter: number }>
}

export interface MemoryFileItem {
  layer: string
  name: string
  path: string
  summary: string
  item_type: string
  size_bytes: number
  modified_at: string
}

export const LAYER_OPTIONS = [
  { value: '', label: '全部层级' },
  { value: 'L1', label: '仅 L1' },
  { value: 'L2', label: '仅 L2' },
  { value: 'L3', label: '仅 L3' },
  ...(L4_PROFILE_ENABLED ? [{ value: 'L4', label: '角色档案 L4' }] : []),
]

export const QUICK_QUERIES = [
  { label: '主角动机', query: '主角 目标 动机', layer: '' },
  { label: '最近冲突', query: '冲突 对峙 误解', layer: 'L2' },
  { label: '伏笔回收', query: '伏笔 回收 线索', layer: 'L3' },
  { label: '时间线', query: '时间线 顺序 先后', layer: '' },
]

export const LAYER_META: Record<string, { label: string; color: string; desc: string }> = {
  L1: { label: 'L1 稳态', color: 'var(--memory-layer-l1-border)', desc: '世界观 · 角色约束 · 文风契约' },
  L2: { label: 'L2 过程', color: 'var(--memory-layer-l2-border)', desc: '章节决策 · 临时线索 · 创作日志' },
  L3: { label: 'L3 长期', color: 'var(--memory-layer-l3-border)', desc: '章节摘要 · 事件卡 · 关系变化' },
  root: { label: '根目录', color: 'var(--memory-layer-root-border)', desc: '项目级配置文件' },
}

const SNIPPET_HIT_PATTERN = /(\[\[H\]\][\s\S]*?\[\[\/H\]\]|\[[^\]\n]{1,80}\])/g

function compactText(text: string | undefined): string {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

export function getMemorySnippet(result: MemoryResult, limit: number): string {
  const raw = compactText(result.evidence) || compactText(result.content)
  if (!raw) return ''
  return raw.length <= limit ? raw : `${raw.slice(0, limit)}…`
}

export function renderSnippetWithHighlight(text: string, shouldHighlight: boolean): ReactNode {
  if (!shouldHighlight || !text) return text
  const parts = text.split(SNIPPET_HIT_PATTERN)
  if (parts.length === 1) return text

  return parts.map((part, index) => {
    if (!part) return null
    const taggedMatch = part.match(/^\[\[H\]\]([\s\S]*?)\[\[\/H\]\]$/)
    if (taggedMatch) {
      return <mark key={`mark-t-${index}`} className="memory-hit-mark">{taggedMatch[1]}</mark>
    }
    const legacyMatch = part.match(/^\[([^\]\n]{1,80})\]$/)
    if (legacyMatch) {
      return <mark key={`mark-l-${index}`} className="memory-hit-mark">{legacyMatch[1]}</mark>
    }
    return <span key={`t-${index}`}>{part}</span>
  })
}

export function resolveChapterIdFromSourcePath(sourcePath: string): string | null {
  const match = sourcePath.match(/(?:^|\/)chapters\/([^/]+)\.md$/)
  return match ? match[1] : null
}

export const COLLAPSED_SNIPPET_LIMIT = 96
export const EXPANDED_SNIPPET_LIMIT = 180
