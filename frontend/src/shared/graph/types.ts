export interface EntityNode {
  entity_id: string
  entity_type: string
  name: string
  attrs: Record<string, unknown>
  first_seen_chapter: number
  last_seen_chapter: number
}

export interface EventEdge {
  event_id: string
  subject: string
  relation: string
  object?: string
  chapter: number
  description: string
}

export interface BuildGraphEdgeOptions {
  includeProgress?: boolean
  latestPerPair?: boolean
}

export interface L4GraphNode {
  id: string
  label: string
  overview?: string
  personality?: string
}

export interface L4GraphEdge {
  id: string
  source: string
  target: string
  label: string
}

export interface EntityNodeData {
  label: string
  entityType: string
  attrs: Record<string, unknown>
  firstSeen: number
  lastSeen: number
  highlighted: boolean
  dimmed: boolean
}
