import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { useState as reactUseState } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import NarrativeModelPage from '../NarrativeModelPage'
import { mantineTheme } from '../../theme/mantineTheme'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToastStore } from '../../stores/useToastStore'

const mockApiGet = vi.fn()
const mockApiPatch = vi.fn()
const mockApiDelete = vi.fn()
const mockApiPost = vi.fn()

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}))

vi.mock('reactflow', () => {
  const Position = { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' }
  const MarkerType = { ArrowClosed: 'arrowclosed' }

  function ReactFlow({ nodes, edges, onNodeClick, onPaneClick, onNodeContextMenu, nodeTypes, onInit }: any) {
    const EntityComp = nodeTypes?.entity
    onInit?.({ fitView: vi.fn() })
    return (
      <div data-testid="reactflow-canvas" onClick={() => onPaneClick?.()}>
        {nodes?.map((node: any) => (
          <div
            key={node.id}
            data-testid={`rf-node-${node.id}`}
            onClick={(event) => {
              event.stopPropagation()
              onNodeClick?.(event, node)
            }}
            onContextMenu={(event) => onNodeContextMenu?.(event, node)}
          >
            {EntityComp ? <EntityComp id={node.id} data={node.data} type="entity" /> : node.data.label}
          </div>
        ))}
        {edges?.map((edge: any) => (
          <div key={edge.id} data-testid={`rf-edge-${edge.id}`}>
            {edge.label}
          </div>
        ))}
      </div>
    )
  }

  return {
    default: ReactFlow,
    useNodesState: (init: any[]) => {
      const [nodes, setNodes] = reactUseState(init)
      return [nodes, setNodes, vi.fn()]
    },
    useEdgesState: (init: any[]) => {
      const [edges, setEdges] = reactUseState(init)
      return [edges, setEdges, vi.fn()]
    },
    Handle: ({ type, position }: any) => <div data-testid={`handle-${type}-${position}`} />,
    Position,
    MarkerType,
  }
})

function LocationProbe() {
  const location = useLocation()
  return (
    <div>
      <div data-testid="location-pathname">{location.pathname}</div>
      <div data-testid="location-search">{location.search}</div>
    </div>
  )
}

function renderPage(initialPath = '/project/proj-1/model') {
  return render(
    <MantineProvider theme={mantineTheme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/project/:projectId/model" element={<><NarrativeModelPage /><LocationProbe /></>} />
          <Route path="/project/:projectId" element={<div>项目概览</div>} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))

  useToastStore.setState({ toasts: [] })
  useProjectStore.setState({
    projects: [],
    currentProject: {
      id: 'proj-1',
      name: '霜港纪事',
      genre: '奇幻',
      style: '冷峻现实主义',
      status: 'active',
      chapter_count: 2,
      entity_count: 2,
      event_count: 3,
      target_length: 120000,
    },
    chapters: [
      { id: 'ch-1', chapter_number: 1, title: '霜港夜巡', goal: '建立追捕关系。', synopsis: '主角在霜港第一次追踪对手。', status: 'draft', word_count: 1800, conflict_count: 1 },
      { id: 'ch-2', chapter_number: 2, title: '雪巷反击', goal: '让对手正式反扑。', synopsis: '双方在雪巷正面交锋。', status: 'reviewing', word_count: 2200, conflict_count: 2 },
    ],
    loading: false,
    chaptersError: null,
    fetchProject: vi.fn().mockResolvedValue(undefined),
    fetchChapters: vi.fn().mockResolvedValue(undefined),
  } as any)

  mockApiGet.mockImplementation((url: string) => {
    if (url === '/projects/proj-1/graph') {
      return Promise.resolve({
        data: {
          nodes: [
            { id: 'char-1', label: '林雾', overview: '被迫追查港口异动的记录官。', personality: '克制' },
            { id: 'char-2', label: '苏筠', overview: '在暗处操盘的对手。', personality: '锋利' },
          ],
          edges: [
            { id: 'edge-1', source: 'char-1', target: 'char-2', label: '追查' },
          ],
        },
      })
    }

    if (url === '/events/proj-1') {
      return Promise.resolve({
        data: [
          { event_id: 'ev-1', subject: '林雾', relation: '追查', object: '苏筠', chapter: 1, description: '林雾在霜港锁定苏筠的踪迹。' },
          { event_id: 'ev-2', subject: '苏筠', relation: '背叛', object: '林雾', chapter: 2, description: '苏筠在雪巷设局反制林雾。' },
          { event_id: 'ev-3', subject: '林雾', relation: '合作', object: '苏筠', chapter: 2, description: '双方短暂结盟以躲开巡夜队。' },
        ],
      })
    }

    return Promise.resolve({ data: [] })
  })

  mockApiPatch.mockResolvedValue({ data: { ok: true } })
  mockApiDelete.mockResolvedValue({ data: { ok: true } })
  mockApiPost.mockResolvedValue({ data: { ok: true } })
})

describe('NarrativeModelPage', () => {
  it('renders the Phase 4 modeling workspace shell and core navigation', async () => {
    renderPage()

    expect(screen.getByRole('heading', { name: '叙事建模' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '角色图谱' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '场景关系' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '场景卡片' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '角色矩阵' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('reactflow-canvas')).toBeInTheDocument()
    })
    expect(screen.getByText('霜港夜巡')).toBeInTheDocument()
    expect(screen.getByText('雪巷反击')).toBeInTheDocument()
  })

  it('syncs chapter selection into the route search params', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('第 1 章')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByText('第 1 章')[0])

    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent('chapter=ch-1')
    })
  })

  it('opens the character inspector from graph selection and saves renaming actions', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('rf-node-char-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('rf-node-char-1'))
    expect(await screen.findByDisplayValue('林雾')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '林雾-重命名' } })
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }))

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/projects/proj-1/graph/nodes/char-1', { label: '林雾-重命名' })
    })
  })

  it('renders scene cards and character matrix in their dedicated tabs', async () => {
    renderPage('/project/proj-1/model?tab=scenes')

    expect(await screen.findByText('场景卡与章节矩阵')).toBeInTheDocument()
    expect(screen.getByDisplayValue('建立追捕关系。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '角色矩阵' }))
    expect(await screen.findByText('角色资料与冲突矩阵')).toBeInTheDocument()
    expect(screen.getByText('林雾')).toBeInTheDocument()
    expect(screen.getByText('苏筠')).toBeInTheDocument()
  })
})
