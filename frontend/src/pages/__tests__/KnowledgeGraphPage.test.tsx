import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import KnowledgeGraphPage, {
  buildGraphEdges,
  buildGraphNodes,
  buildL4GraphEdges,
  buildL4GraphNodes,
  buildL4GridNodes,
  ENTITY_STYLES,
  getHighlightSets,
  sanitizeGraphData,
  sortEventsByChapter,
  type EntityNode,
  type EventEdge,
  type L4GraphEdge,
  type L4GraphNode,
} from '../KnowledgeGraphPage'

vi.mock('reactflow', () => ({
  Handle: () => <div />,
  Position: { Left: 'left', Right: 'right' },
  MarkerType: { ArrowClosed: 'arrowclosed' },
}))

const sampleEntities: EntityNode[] = [
  { entity_id: 'e1', entity_type: 'character', name: '李明', attrs: { age: 25, role: '主角' }, first_seen_chapter: 1, last_seen_chapter: 5 },
  { entity_id: 'e2', entity_type: 'location', name: '冰霜城', attrs: { climate: '寒冷' }, first_seen_chapter: 1, last_seen_chapter: 3 },
  { entity_id: 'e3', entity_type: 'item', name: '火焰剑', attrs: {}, first_seen_chapter: 2, last_seen_chapter: 4 },
]

const sampleEvents: EventEdge[] = [
  { event_id: 'ev1', subject: '李明', relation: '前往', object: '冰霜城', chapter: 1, description: '主角出发前往冰霜城' },
  { event_id: 'ev2', subject: '李明', relation: '获得', object: '火焰剑', chapter: 2, description: '主角获得火焰剑' },
  { event_id: 'ev3', subject: '李明', relation: '战斗', chapter: 3, description: '主角在冰霜城战斗' },
]

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="redirect-target">{`${location.pathname}${location.search}`}</div>
}

describe('KnowledgeGraphPage redirect', () => {
  it('keeps legacy /graph route and redirects into the new narrative model workspace', async () => {
    render(
      <MemoryRouter initialEntries={['/project/proj-1/graph']}>
        <Routes>
          <Route path="/project/:projectId/graph" element={<KnowledgeGraphPage />} />
          <Route path="/project/:projectId/model" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('redirect-target')).toHaveTextContent('/project/proj-1/model?tab=graph')
  })
})

describe('buildGraphNodes', () => {
  it('creates a React Flow node for each entity', () => {
    const nodes = buildGraphNodes(sampleEntities)
    expect(nodes).toHaveLength(3)
    expect(nodes[0].id).toBe('e1')
    expect(nodes[0].data.label).toBe('李明')
    expect(nodes[0].data.entityType).toBe('character')
  })
})

describe('buildGraphEdges', () => {
  it('maps matched event relations into edges', () => {
    const edges = buildGraphEdges(sampleEvents, sampleEntities)
    expect(edges).toHaveLength(2)
    expect(edges[0].source).toBe('e1')
    expect(edges[0].target).toBe('e2')
    expect(edges[0].label).toBe('前往')
  })

  it('filters progress relations by default', () => {
    const edges = buildGraphEdges([
      { event_id: 'ev-p', subject: '李明', relation: 'progress', object: '冰霜城', chapter: 1, description: '' },
      { event_id: 'ev-c', subject: '李明', relation: '冲突', object: '火焰剑', chapter: 2, description: '' },
    ], sampleEntities)
    expect(edges.map((edge) => edge.label)).toEqual(['冲突'])
  })
})

describe('getHighlightSets', () => {
  it('returns the clicked node together with directly connected nodes and edges', () => {
    const edges = buildGraphEdges(sampleEvents, sampleEntities)
    const { highlightedNodeIds, highlightedEdgeIds } = getHighlightSets('e1', edges)
    expect(highlightedNodeIds).toEqual(new Set(['e1', 'e2', 'e3']))
    expect(highlightedEdgeIds.size).toBe(2)
  })
})

describe('sortEventsByChapter', () => {
  it('sorts events in ascending chapter order without mutating input', () => {
    const original = [
      { event_id: 'a', subject: 'X', relation: 'r', chapter: 3, description: '' },
      { event_id: 'b', subject: 'Y', relation: 'r', chapter: 1, description: '' },
      { event_id: 'c', subject: 'Z', relation: 'r', chapter: 2, description: '' },
    ] satisfies EventEdge[]

    const sorted = sortEventsByChapter(original)
    expect(sorted.map((event) => event.chapter)).toEqual([1, 2, 3])
    expect(original.map((event) => event.chapter)).toEqual([3, 1, 2])
  })
})

describe('sanitizeGraphData', () => {
  it('normalizes placeholder role names and removes hidden noise', () => {
    const sanitized = sanitizeGraphData(
      [
        { entity_id: 'a', entity_type: 'character', name: 'primary', attrs: {}, first_seen_chapter: 2, last_seen_chapter: 2 },
        { entity_id: 'b', entity_type: 'character', name: 'secondary', attrs: {}, first_seen_chapter: 2, last_seen_chapter: 2 },
        { entity_id: 'c', entity_type: 'character', name: 'hidden', attrs: {}, first_seen_chapter: 2, last_seen_chapter: 2 },
      ],
      [
        { event_id: 'ev-a', subject: 'primary', relation: 'progress', object: 'secondary', chapter: 2, description: '' },
        { event_id: 'ev-b', subject: 'hidden', relation: 'progress', object: 'primary', chapter: 3, description: '' },
      ],
    )

    expect(sanitized.entities.map((item) => item.name)).toEqual(['主角', '关键配角'])
    expect(sanitized.events).toHaveLength(1)
    expect(sanitized.events[0].subject).toBe('主角')
    expect(sanitized.events[0].object).toBe('关键配角')
  })
})

describe('ENTITY_STYLES', () => {
  it('keeps distinct visual identities for character, location and item nodes', () => {
    const types = ['character', 'location', 'item'] as const
    expect(new Set(types.map((type) => ENTITY_STYLES[type].color)).size).toBe(3)
    expect(new Set(types.map((type) => ENTITY_STYLES[type].borderColor)).size).toBe(3)
    expect(new Set(types.map((type) => ENTITY_STYLES[type].shape)).size).toBe(3)
  })
})

describe('L4 graph helpers', () => {
  it('places the most connected node closer to the center in radial layout', () => {
    const nodes: L4GraphNode[] = [
      { id: 'hub', label: 'Hub', overview: '', personality: '' },
      { id: 'a', label: 'A', overview: '', personality: '' },
      { id: 'b', label: 'B', overview: '', personality: '' },
      { id: 'c', label: 'C', overview: '', personality: '' },
      { id: 'leaf', label: 'Leaf', overview: '', personality: '' },
    ]
    const edges: L4GraphEdge[] = [
      { id: 'e1', source: 'hub', target: 'a', label: '' },
      { id: 'e2', source: 'hub', target: 'b', label: '' },
      { id: 'e3', source: 'hub', target: 'c', label: '' },
      { id: 'e4', source: 'hub', target: 'leaf', label: '' },
      { id: 'e5', source: 'a', target: 'b', label: '' },
    ]

    const result = buildL4GraphNodes(nodes, edges)
    const hubNode = result.find((node) => node.id === 'hub')!
    const leafNode = result.find((node) => node.id === 'leaf')!
    const hubDistance = Math.sqrt(hubNode.position.x ** 2 + hubNode.position.y ** 2)
    const leafDistance = Math.sqrt(leafNode.position.x ** 2 + leafNode.position.y ** 2)
    expect(hubDistance).toBeLessThan(leafDistance)
  })

  it('can also lay out nodes into a readable grid', () => {
    const result = buildL4GridNodes([
      { id: 'n1', label: 'A', overview: '', personality: '' },
      { id: 'n2', label: 'B', overview: '', personality: '' },
      { id: 'n3', label: 'C', overview: '', personality: '' },
      { id: 'n4', label: 'D', overview: '', personality: '' },
    ], [])

    expect(new Set(result.map((node) => `${node.position.x}:${node.position.y}`)).size).toBe(4)
  })

  it('keeps only edges whose source and target both exist in the visible node set', () => {
    const edges = buildL4GraphEdges([
      { id: 'e1', source: 'a', target: 'b', label: '合作' },
      { id: 'e2', source: 'a', target: 'missing', label: '误连' },
    ], new Set(['a', 'b']))

    expect(edges).toHaveLength(1)
    expect(edges[0].label).toBe('合作')
  })
})
