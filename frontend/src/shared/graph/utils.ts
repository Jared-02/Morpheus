import type { Edge, Node } from 'reactflow'
import { MarkerType } from 'reactflow'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceRadial,
  forceCollide,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import type {
  BuildGraphEdgeOptions,
  EntityNode,
  EntityNodeData,
  EventEdge,
  L4GraphEdge,
  L4GraphNode,
} from './types'

const ROLE_NAME_ALIASES: Record<string, string> = {
  primary: '主角',
  protagonist: '主角',
  secondary: '关键配角',
  supporting: '关键配角',
  antagonist: '反派',
}

const ROLE_NAME_IGNORES = new Set(['hidden', 'secret', 'unknown', 'none', 'null'])
const ROLE_NAME_STOPWORDS = new Set([
  '章节',
  '章末',
  '目标',
  '冲突',
  '线索',
  '伏笔',
  '回收',
  '开场',
  '结尾',
  '剧情',
  '故事',
  '万事屋',
  '猪肉铺',
  '猪肉铺2号',
  '长城路',
  '长城路猪肉铺',
  '长城路猪肉铺2号',
  '黑衣人',
  '器官库',
  '数据碎片',
  '都市传',
  '都市怪',
  '都没',
  '后者正',
  '胡说八',
  '任凭赵老板',
  '任谁',
  '后者',
  '前者',
  '通风管',
  '从管',
  '冷静',
])

const ROLE_NAME_PREFIX_BLOCKLIST = [
  '后者',
  '前者',
  '任凭',
  '都没',
  '胡说',
  '据说',
  '听说',
  '如果',
  '但是',
  '只是',
  '这个',
  '那个',
]

const ROLE_NAME_TRAILING_INVALID_CHARS = new Set(['没', '不', '了', '着', '过', '都', '也', '正', '谁', '啥', '么'])
const ROLE_NAME_INTERNAL_INVALID_CHARS = new Set(['者', '说', '没'])
const ROLE_NAME_TITLE_SUFFIXES = ['教授', '医生', '老板', '队长', '先生', '小姐', '同学']

interface SimNode extends SimulationNodeDatum {
  id: string
  degree: number
}

function normalizeRoleName(name?: string) {
  const raw = String(name || '').trim()
  if (!raw) return ''
  const key = raw.toLowerCase()
  if (ROLE_NAME_IGNORES.has(key)) return ''

  let normalized = ROLE_NAME_ALIASES[key] || raw
  normalized = normalized.replace(/^(?:连|那|这|把|对|向|跟|让|与|和)/, '')
  normalized = normalized.replace(/(?:喊|问|说|看|听|追|知|苦|笑|道|叫|答|想|盯|望)$/, '')
  normalized = normalized.trim()

  if (!normalized) return ''
  if (!/^[\u4e00-\u9fff]{2,8}$/.test(normalized)) return ''
  if (normalized.includes('第') && normalized.includes('章')) return ''
  if (ROLE_NAME_STOPWORDS.has(normalized)) return ''
  if (ROLE_NAME_PREFIX_BLOCKLIST.some((prefix) => normalized.startsWith(prefix))) return ''

  if (normalized.length === 2 && ROLE_NAME_TRAILING_INVALID_CHARS.has(normalized[1])) return ''
  if (normalized.length >= 3) {
    if (ROLE_NAME_TRAILING_INVALID_CHARS.has(normalized[normalized.length - 1])) return ''
    for (let i = 1; i < normalized.length; i += 1) {
      if (ROLE_NAME_INTERNAL_INVALID_CHARS.has(normalized[i])) return ''
    }
  }

  const matchedTitleSuffix = ROLE_NAME_TITLE_SUFFIXES.find((suffix) => normalized.endsWith(suffix))
  if (matchedTitleSuffix) {
    const stem = normalized.slice(0, normalized.length - matchedTitleSuffix.length)
    if (!stem || stem.length > 2) return ''
  }

  if (normalized.length > 4 && !matchedTitleSuffix) return ''

  return normalized
}

function isProgressRelation(relation: string) {
  const value = String(relation || '').trim().toLowerCase()
  return value === 'progress' || value === '推进'
}

function makeRfNode(
  node: L4GraphNode,
  position: { x: number; y: number },
  deg: number,
): Node<EntityNodeData> {
  return {
    id: node.id,
    type: 'entity',
    position,
    data: {
      label: node.label,
      entityType: 'character',
      attrs: {
        连接度: deg,
        ...(node.overview ? { 概述: node.overview } : {}),
        ...(node.personality ? { 性格: node.personality } : {}),
      },
      firstSeen: 0,
      lastSeen: 0,
      highlighted: false,
      dimmed: false,
    },
  }
}

export function buildGraphNodes(entities: EntityNode[]): Node<EntityNodeData>[] {
  const cols = 4
  const xGap = 200
  const yGap = 160

  return entities.map((entity, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    return {
      id: entity.entity_id,
      type: 'entity',
      position: { x: col * xGap + 50, y: row * yGap + 50 },
      data: {
        label: entity.name,
        entityType: entity.entity_type,
        attrs: entity.attrs,
        firstSeen: entity.first_seen_chapter,
        lastSeen: entity.last_seen_chapter,
        highlighted: false,
        dimmed: false,
      },
    }
  })
}

export function buildGraphEdges(
  events: EventEdge[],
  entities: EntityNode[],
  options: BuildGraphEdgeOptions = {},
): Edge[] {
  const includeProgress = options.includeProgress ?? false
  const latestPerPair = options.latestPerPair ?? true
  const entityNameToId = new Map<string, string>()
  for (const entity of entities) {
    entityNameToId.set(entity.name, entity.entity_id)
  }

  type EdgeCandidate = {
    source: string
    target: string
    relation: string
    chapter: number
    eventId: string
  }

  const candidates: EdgeCandidate[] = []
  for (const event of events) {
    if (!includeProgress && isProgressRelation(event.relation)) continue
    const sourceId = entityNameToId.get(event.subject)
    const targetId = event.object ? entityNameToId.get(event.object) : undefined
    if (sourceId && targetId) {
      candidates.push({
        source: sourceId,
        target: targetId,
        relation: event.relation,
        chapter: event.chapter,
        eventId: event.event_id,
      })
    }
  }

  const aggregated = new Map<
    string,
    { source: string; target: string; relation: string; latestChapter: number; count: number; eventId: string }
  >()

  for (const item of candidates) {
    const key = `${item.source}::${item.target}::${item.relation}`
    const existing = aggregated.get(key)
    if (!existing) {
      aggregated.set(key, {
        source: item.source,
        target: item.target,
        relation: item.relation,
        latestChapter: item.chapter,
        count: 1,
        eventId: item.eventId,
      })
      continue
    }

    existing.count += 1
    if (item.chapter >= existing.latestChapter) {
      existing.latestChapter = item.chapter
      existing.eventId = item.eventId
    }
  }

  const edges: Edge[] = []
  const relationPriority: Record<string, number> = {
    背叛: 7,
    冲突: 6,
    揭露: 5,
    交易: 4,
    调查: 3,
    合作: 2,
    保护: 1,
    关联: 1,
    progress: 0,
  }

  if (latestPerPair) {
    const byUndirectedPair = new Map<
      string,
      Array<{ source: string; target: string; relation: string; latestChapter: number; count: number; eventId: string }>
    >()
    for (const item of aggregated.values()) {
      const pairKey = [item.source, item.target].sort().join('::')
      const bucket = byUndirectedPair.get(pairKey) ?? []
      bucket.push(item)
      byUndirectedPair.set(pairKey, bucket)
    }

    for (const pairItems of byUndirectedPair.values()) {
      const winner = [...pairItems].sort(
        (a, b) =>
          b.latestChapter - a.latestChapter ||
          (relationPriority[b.relation] ?? 0) - (relationPriority[a.relation] ?? 0) ||
          a.relation.localeCompare(b.relation),
      )[0]
      edges.push({
        id: `edge-${winner.source}-${winner.target}-${winner.relation}`,
        source: winner.source,
        target: winner.target,
        type: 'default',
        label: winner.count > 1 ? `${winner.relation} ×${winner.count}` : winner.relation,
        animated: false,
        style: { stroke: 'var(--graph-edge-stroke)', strokeWidth: 1.5 },
        labelStyle: { fill: 'var(--graph-edge-label)', fontSize: 11 },
        labelBgStyle: { fill: 'var(--graph-edge-label-bg)', fillOpacity: 0.9 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--graph-edge-stroke)' },
      })
    }

    return edges
  }

  const byDirectionalPair = new Map<
    string,
    Array<{ source: string; target: string; relation: string; latestChapter: number; count: number; eventId: string }>
  >()

  for (const item of aggregated.values()) {
    const pairKey = `${item.source}::${item.target}`
    const bucket = byDirectionalPair.get(pairKey) ?? []
    bucket.push(item)
    byDirectionalPair.set(pairKey, bucket)
  }

  for (const pairItems of byDirectionalPair.values()) {
    const bucket = [...pairItems].sort(
      (a, b) =>
        b.latestChapter - a.latestChapter ||
        (relationPriority[b.relation] ?? 0) - (relationPriority[a.relation] ?? 0) ||
        a.relation.localeCompare(b.relation),
    )
    bucket.forEach((item) => {
      edges.push({
        id: `edge-${item.source}-${item.target}-${item.relation}`,
        source: item.source,
        target: item.target,
        type: 'default',
        label: item.count > 1 ? `${item.relation} ×${item.count}` : item.relation,
        animated: false,
        style: { stroke: 'var(--graph-edge-stroke)', strokeWidth: 1.5 },
        labelStyle: { fill: 'var(--graph-edge-label)', fontSize: 11 },
        labelBgStyle: { fill: 'var(--graph-edge-label-bg)', fillOpacity: 0.9 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--graph-edge-stroke)' },
      })
    })
  }

  return edges
}

export function getHighlightSets(
  clickedNodeId: string,
  edges: Edge[],
): { highlightedNodeIds: Set<string>; highlightedEdgeIds: Set<string> } {
  const highlightedNodeIds = new Set<string>([clickedNodeId])
  const highlightedEdgeIds = new Set<string>()

  for (const edge of edges) {
    if (edge.source === clickedNodeId || edge.target === clickedNodeId) {
      highlightedEdgeIds.add(edge.id)
      highlightedNodeIds.add(edge.source)
      highlightedNodeIds.add(edge.target)
    }
  }

  return { highlightedNodeIds, highlightedEdgeIds }
}

export function sortEventsByChapter(events: EventEdge[]): EventEdge[] {
  return [...events].sort((a, b) => a.chapter - b.chapter)
}

export function sanitizeGraphData(
  entities: EntityNode[],
  events: EventEdge[],
): { entities: EntityNode[]; events: EventEdge[] } {
  const merged = new Map<string, EntityNode>()

  for (const entity of entities) {
    const normalizedName = normalizeRoleName(entity.name)
    if (!normalizedName) continue
    const key = `${entity.entity_type}:${normalizedName}`
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, { ...entity, name: normalizedName })
      continue
    }

    merged.set(key, {
      ...existing,
      attrs: { ...(existing.attrs || {}), ...(entity.attrs || {}) },
      first_seen_chapter: Math.min(existing.first_seen_chapter, entity.first_seen_chapter),
      last_seen_chapter: Math.max(existing.last_seen_chapter, entity.last_seen_chapter),
    })
  }

  const sanitizedEntities = [...merged.values()].sort(
    (a, b) => b.last_seen_chapter - a.last_seen_chapter || a.name.localeCompare(b.name),
  )

  const sanitizedEvents: EventEdge[] = []
  for (const event of events) {
    const subject = normalizeRoleName(event.subject)
    if (!subject) continue
    const objectCandidate = event.object ? normalizeRoleName(event.object) : ''
    sanitizedEvents.push({
      ...event,
      subject,
      object: objectCandidate && objectCandidate !== subject ? objectCandidate : undefined,
    })
  }

  return { entities: sanitizedEntities, events: sanitizedEvents }
}

export function buildL4GraphNodes(l4Nodes: L4GraphNode[], l4Edges: L4GraphEdge[]): Node<EntityNodeData>[] {
  if (l4Nodes.length === 0) return []
  if (l4Nodes.length === 1) {
    return [makeRfNode(l4Nodes[0], { x: 0, y: 0 }, 0)]
  }

  const nodeIds = new Set(l4Nodes.map((node) => node.id))
  const degree = new Map<string, number>()
  for (const node of l4Nodes) degree.set(node.id, 0)

  const safeEdges = l4Edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target,
  )

  for (const edge of safeEdges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }

  const maxDegree = Math.max(...degree.values(), 1)
  const radiusScale = 380
  const simNodes: SimNode[] = l4Nodes.map((node) => ({
    id: node.id,
    degree: degree.get(node.id) ?? 0,
    x: 0,
    y: 0,
  }))
  const simLinks: SimulationLinkDatum<SimNode>[] = safeEdges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }))

  const simulation = forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks)
        .id((datum) => datum.id)
        .distance(160)
        .strength(0.3),
    )
    .force('charge', forceManyBody().strength(-300))
    .force(
      'radial',
      forceRadial<SimNode>((datum) => radiusScale * (1 - datum.degree / maxDegree), 0, 0).strength(0.8),
    )
    .force('collide', forceCollide<SimNode>(90))
    .stop()

  for (let i = 0; i < 300; i += 1) simulation.tick()

  const posMap = new Map(simNodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]))
  return l4Nodes.map((node) => {
    const position = posMap.get(node.id) ?? { x: 0, y: 0 }
    return makeRfNode(node, position, degree.get(node.id) ?? 0)
  })
}

export function buildL4GraphEdges(l4Edges: L4GraphEdge[], nodeIds: Set<string>): Edge[] {
  return l4Edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target)
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'default',
      label: edge.label,
      data: { relationLabel: edge.label },
      animated: false,
      style: { stroke: 'var(--graph-edge-stroke)', strokeWidth: 1.5 },
      labelStyle: { fill: 'var(--graph-edge-label)', fontSize: 11 },
      labelBgStyle: { fill: 'var(--graph-edge-label-bg)', fillOpacity: 0.9 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--graph-edge-stroke)' },
    }))
}
