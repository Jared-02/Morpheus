import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { Edge, Node, ReactFlowInstance } from 'reactflow'
import { MarkerType, useEdgesState, useNodesState } from 'reactflow'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { GRAPH_FEATURE_ENABLED } from '../../config/features'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToastStore } from '../../stores/useToastStore'
import { buildL4GraphEdges, buildL4GraphNodes, buildL4GridNodes, getHighlightSets, sortEventsByChapter } from '../../shared/graph/utils'
import type { EntityNodeData, EventEdge, L4GraphEdge, L4GraphNode } from '../../shared/graph/types'

export type NarrativeWorkspaceTab = 'graph' | 'scene-map' | 'scenes' | 'matrix' | 'timeline'
export type NarrativeLayoutMode = 'radial' | 'grid'
export type NarrativeScopeMode = 'global' | 'chapter'

interface SceneCardViewModel {
  id: string
  chapterId: string
  chapterNumber: number
  title: string
  synopsis: string
  goal: string
  wordCount: number
  conflictCount: number
  eventCount: number
  participants: string[]
  keyRelation: string
}

interface CharacterViewModel {
  id: string
  label: string
  overview: string
  personality: string
  relationCount: number
  eventCount: number
  firstActiveChapter: number | null
  lastActiveChapter: number | null
  coreConflict: string
  tags: string[]
}

type InspectorSelection =
  | { kind: 'character'; id: string }
  | { kind: 'scene'; id: string }
  | null

const WORKSPACE_TABS: Array<{ value: NarrativeWorkspaceTab; label: string }> = [
  { value: 'graph', label: '角色图谱' },
  { value: 'scene-map', label: '场景关系' },
  { value: 'scenes', label: '场景卡片' },
  { value: 'matrix', label: '角色矩阵' },
  { value: 'timeline', label: '事件时间线' },
]

function normalizeWorkspaceTab(value: string | null): NarrativeWorkspaceTab {
  if (value === 'scene-map' || value === 'scenes' || value === 'matrix' || value === 'timeline') {
    return value
  }
  return 'graph'
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function intersectStrings(left: string[], right: string[]) {
  const rightSet = new Set(right)
  return left.filter((item) => rightSet.has(item))
}

function summarizeConflict(events: EventEdge[]) {
  const critical = events.find((event) => ['背叛', '冲突', '揭露', '调查'].includes(event.relation))
  if (critical?.description) return critical.description
  if (critical?.object) return `${critical.subject} 与 ${critical.object} 的${critical.relation}`
  if (events[0]?.description) return events[0].description
  return '当前没有明确冲突记录，建议结合章节目标补充建模。'
}

function buildSceneMapNodes(sceneCards: SceneCardViewModel[], selectedChapterId: string | null): Node<EntityNodeData>[] {
  const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(sceneCards.length, 1))))
  const xGap = 250
  const yGap = 180

  return sceneCards.map((scene, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const active = selectedChapterId === scene.chapterId
    return {
      id: `scene-${scene.chapterId}`,
      type: 'entity',
      position: { x: column * xGap, y: row * yGap },
      data: {
        label: `第 ${scene.chapterNumber} 章`,
        entityType: active ? 'character' : 'location',
        attrs: {
          标题: scene.title,
          事件: scene.eventCount,
          冲突: scene.conflictCount,
          关键关系: scene.keyRelation,
        },
        firstSeen: scene.chapterNumber,
        lastSeen: scene.chapterNumber,
        highlighted: active,
        dimmed: selectedChapterId ? !active : false,
      },
    }
  })
}

function buildSceneMapEdges(sceneCards: SceneCardViewModel[]): Edge[] {
  if (sceneCards.length <= 1) return []

  return sceneCards.slice(1).map((scene, index) => {
    const previous = sceneCards[index]
    const sharedParticipants = intersectStrings(previous.participants, scene.participants)
    const label = sharedParticipants.length > 0
      ? `共享角色 ${sharedParticipants.slice(0, 2).join(' / ')}`
      : '叙事推进'

    return {
      id: `scene-edge-${previous.chapterId}-${scene.chapterId}`,
      source: `scene-${previous.chapterId}`,
      target: `scene-${scene.chapterId}`,
      type: 'default',
      label,
      animated: false,
      style: { stroke: 'var(--graph-edge-stroke)', strokeWidth: 1.5 },
      labelStyle: { fill: 'var(--graph-edge-label)', fontSize: 11 },
      labelBgStyle: { fill: 'var(--graph-edge-label-bg)', fillOpacity: 0.9 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--graph-edge-stroke)' },
    }
  })
}

export default function useNarrativeModelController(projectId?: string) {
  const fetchProject = useProjectStore((state) => state.fetchProject)
  const fetchChapters = useProjectStore((state) => state.fetchChapters)
  const currentProject = useProjectStore((state) => state.currentProject)
  const chapters = useProjectStore((state) => state.chapters)
  const chaptersError = useProjectStore((state) => state.chaptersError)
  const addToast = useToastStore((state) => state.addToast)
  const [searchParams, setSearchParams] = useSearchParams()

  const [events, setEvents] = useState<EventEdge[]>([])
  const [l4Nodes, setL4Nodes] = useState<L4GraphNode[]>([])
  const [l4Edges, setL4Edges] = useState<L4GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [layoutMode, setLayoutMode] = useState<NarrativeLayoutMode>('radial')
  const [scopeMode, setScopeMode] = useState<NarrativeScopeMode>('global')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newNodeLabel, setNewNodeLabel] = useState('')
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [inspectorSelection, setInspectorSelection] = useState<InspectorSelection>(null)
  const [inspectorLabelDraft, setInspectorLabelDraft] = useState('')
  const [savingInspectorLabel, setSavingInspectorLabel] = useState(false)
  const [deletingSelectedCharacter, setDeletingSelectedCharacter] = useState(false)

  const flowRef = useRef<ReactFlowInstance | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const addNodeInputRef = useRef<HTMLInputElement | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const workspaceTab = normalizeWorkspaceTab(searchParams.get('tab'))
  const selectedChapterId = searchParams.get('chapter')
  const selectedChapter = selectedChapterId ? chapters.find((chapter) => chapter.id === selectedChapterId) ?? null : null

  const setSearchParamState = useCallback((updater: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams)
    updater(next)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const setWorkspaceTab = useCallback((tab: NarrativeWorkspaceTab) => {
    setSearchParamState((next) => {
      next.set('tab', tab)
    })
  }, [setSearchParamState])

  const handleSelectChapter = useCallback((chapterId: string | null) => {
    setSearchParamState((next) => {
      if (chapterId) {
        next.set('chapter', chapterId)
      } else {
        next.delete('chapter')
      }
    })
    setScopeMode(chapterId ? 'chapter' : 'global')
    setInspectorSelection(chapterId ? { kind: 'scene', id: chapterId } : null)
  }, [setSearchParamState])

  useEffect(() => {
    if (!selectedChapterId) {
      setScopeMode('global')
    }
  }, [selectedChapterId])

  useEffect(() => {
    if (!selectedChapterId) return
    if (chapters.length === 0) return
    if (chapters.some((chapter) => chapter.id === selectedChapterId)) return
    handleSelectChapter(null)
  }, [chapters, handleSelectChapter, selectedChapterId])

  useEffect(() => {
    if (!projectId) return
    if (currentProject?.id !== projectId) {
      void fetchProject(projectId)
    }
    void fetchChapters(projectId)
  }, [currentProject?.id, fetchChapters, fetchProject, projectId])

  const loadData = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
    setSelectedNodeIds(new Set())

    try {
      const [graphRes, eventRes] = await Promise.all([
        api.get(`/projects/${projectId}/graph`),
        api.get(`/events/${projectId}`),
      ])
      setL4Nodes(graphRes.data?.nodes ?? [])
      setL4Edges(graphRes.data?.edges ?? [])
      setEvents(eventRes.data ?? [])
    } catch (error) {
      addToast('error', '加载叙事建模数据失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [addToast, projectId, setEdges, setNodes])

  useEffect(() => {
    if (!projectId) return
    if (!GRAPH_FEATURE_ENABLED) {
      setLoading(false)
      setEvents([])
      setL4Nodes([])
      setL4Edges([])
      return
    }

    void loadData()
  }, [loadData, projectId])

  const chapterScopedEvents = useMemo(() => {
    if (!selectedChapter || scopeMode !== 'chapter') return events
    return events.filter((event) => event.chapter === selectedChapter.chapter_number)
  }, [events, scopeMode, selectedChapter])

  const activeRoleLabels = useMemo(() => {
    if (scopeMode !== 'chapter') return null
    return new Set(uniqueStrings(chapterScopedEvents.flatMap((event) => [event.subject, event.object ?? ''])))
  }, [chapterScopedEvents, scopeMode])

  const visibleGraphNodes = useMemo(() => {
    if (!activeRoleLabels) return l4Nodes
    return l4Nodes.filter((node) => activeRoleLabels.has(node.label))
  }, [activeRoleLabels, l4Nodes])

  const visibleGraphNodeIds = useMemo(() => new Set(visibleGraphNodes.map((node) => node.id)), [visibleGraphNodes])

  const visibleGraphEdges = useMemo(() => {
    if (visibleGraphNodeIds.size === 0) return []
    return l4Edges.filter((edge) => visibleGraphNodeIds.has(edge.source) && visibleGraphNodeIds.has(edge.target))
  }, [l4Edges, visibleGraphNodeIds])

  useEffect(() => {
    if (!GRAPH_FEATURE_ENABLED) return
    if (visibleGraphNodes.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const nextNodes = layoutMode === 'grid'
      ? buildL4GridNodes(visibleGraphNodes, visibleGraphEdges)
      : buildL4GraphNodes(visibleGraphNodes, visibleGraphEdges)
    const nodeIdSet = new Set(nextNodes.map((node) => node.id))
    const nextEdges = buildL4GraphEdges(visibleGraphEdges, nodeIdSet)
    setNodes(nextNodes)
    setEdges(nextEdges)
    setSelectedNodeId(null)

    requestAnimationFrame(() => {
      flowRef.current?.fitView({ padding: 0.28, duration: 360 })
    })
  }, [layoutMode, setEdges, setNodes, visibleGraphEdges, visibleGraphNodes])

  useEffect(() => {
    if (editingNodeId) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [editingNodeId])

  useEffect(() => {
    if (showAddModal) {
      addNodeInputRef.current?.focus()
    }
  }, [showAddModal])

  const fitGraphView = useCallback(() => {
    flowRef.current?.fitView({ padding: 0.28, duration: 320 })
  }, [])

  const resetGraphFocus = useCallback(() => {
    setSelectedNodeId(null)
    setInspectorSelection((current) => (current?.kind === 'character' ? null : current))
    setSelectedNodeIds(new Set())
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({ ...node, data: { ...node.data, highlighted: false, dimmed: false } })),
    )
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        animated: false,
        label: String((edge.data as { relationLabel?: string } | undefined)?.relationLabel || edge.label || ''),
        style: { ...edge.style, stroke: 'var(--graph-edge-stroke)', strokeWidth: 1.5 },
      })),
    )
  }, [setEdges, setNodes])

  const onNodeClick = useCallback((event: ReactMouseEvent, node: Node) => {
    if (event.ctrlKey || event.metaKey) {
      setSelectedNodeIds((current) => {
        const next = new Set(current)
        if (next.has(node.id)) next.delete(node.id)
        else next.add(node.id)
        return next
      })
      return
    }

    const clickedId = node.id
    setSelectedNodeIds(new Set())
    setInspectorSelection({ kind: 'character', id: clickedId })

    if (selectedNodeId === clickedId) {
      resetGraphFocus()
      return
    }

    setSelectedNodeId(clickedId)
    const { highlightedNodeIds, highlightedEdgeIds } = getHighlightSets(clickedId, edges)

    setNodes((currentNodes) =>
      currentNodes.map((currentNode) => ({
        ...currentNode,
        data: {
          ...currentNode.data,
          highlighted: highlightedNodeIds.has(currentNode.id),
          dimmed: !highlightedNodeIds.has(currentNode.id),
        },
      })),
    )

    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        animated: highlightedEdgeIds.has(edge.id),
        label: highlightedEdgeIds.has(edge.id)
          ? String((edge.data as { relationLabel?: string } | undefined)?.relationLabel || edge.label || '')
          : '',
        style: {
          ...edge.style,
          stroke: highlightedEdgeIds.has(edge.id) ? 'var(--graph-edge-highlight)' : 'var(--graph-edge-dim)',
          strokeWidth: highlightedEdgeIds.has(edge.id) ? 2.5 : 1,
        },
      })),
    )
  }, [edges, resetGraphFocus, selectedNodeId, setEdges, setNodes])

  const onPaneClick = useCallback(() => {
    setContextMenu(null)
    setEditingNodeId(null)
    resetGraphFocus()
  }, [resetGraphFocus])

  const onNodeContextMenu = useCallback((event: ReactMouseEvent, node: Node) => {
    event.preventDefault()
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY })
    setInspectorSelection({ kind: 'character', id: node.id })
  }, [])

  const handleDeleteNode = useCallback(async () => {
    if (!contextMenu || !projectId) return
    try {
      await api.delete(`/projects/${projectId}/graph/nodes/${contextMenu.nodeId}`)
      setContextMenu(null)
      addToast('success', '节点已删除')
      await loadData()
    } catch {
      addToast('error', '删除失败')
    }
  }, [addToast, contextMenu, loadData, projectId])

  const handleStartEdit = useCallback(() => {
    if (!contextMenu) return
    const node = nodes.find((item) => item.id === contextMenu.nodeId)
    setEditLabel(node?.data.label ?? '')
    setEditingNodeId(contextMenu.nodeId)
    setContextMenu(null)
  }, [contextMenu, nodes])

  const handleSaveEdit = useCallback(async () => {
    if (!editingNodeId || !projectId || !editLabel.trim()) return
    try {
      await api.patch(`/projects/${projectId}/graph/nodes/${editingNodeId}`, { label: editLabel.trim() })
      setEditingNodeId(null)
      addToast('success', '节点已更新')
      await loadData()
    } catch {
      addToast('error', '更新失败')
    }
  }, [addToast, editLabel, editingNodeId, loadData, projectId])

  const handleAddNode = useCallback(async () => {
    if (!newNodeLabel.trim() || !projectId) return
    try {
      await api.post(`/projects/${projectId}/graph/nodes`, { label: newNodeLabel.trim() })
      setShowAddModal(false)
      setNewNodeLabel('')
      addToast('success', '节点已创建')
      await loadData()
    } catch {
      addToast('error', '创建失败')
    }
  }, [addToast, loadData, newNodeLabel, projectId])

  const handleMergeNodes = useCallback(async () => {
    if (selectedNodeIds.size < 2 || !projectId) return
    const ids = [...selectedNodeIds]
    try {
      await api.post(`/projects/${projectId}/graph/nodes/merge`, {
        keep_node_id: ids[0],
        merge_node_ids: ids.slice(1),
      })
      setSelectedNodeIds(new Set())
      addToast('success', `已合并 ${ids.length - 1} 个节点`)
      await loadData()
    } catch {
      addToast('error', '合并失败')
    }
  }, [addToast, loadData, projectId, selectedNodeIds])

  const sortedEvents = useMemo(() => sortEventsByChapter(events), [events])

  const sceneCards = useMemo<SceneCardViewModel[]>(() => {
    return chapters.map((chapter) => {
      const relatedEvents = sortedEvents.filter((event) => event.chapter === chapter.chapter_number)
      const participants = uniqueStrings(relatedEvents.flatMap((event) => [event.subject, event.object ?? '']))
      return {
        id: chapter.id,
        chapterId: chapter.id,
        chapterNumber: chapter.chapter_number,
        title: chapter.title || `第 ${chapter.chapter_number} 章`,
        synopsis: chapter.synopsis || '当前尚未生成场景摘要，可先用章节概述补位。',
        goal: chapter.goal || '尚未填写章节目标。',
        wordCount: chapter.word_count,
        conflictCount: chapter.conflict_count,
        eventCount: relatedEvents.length,
        participants: participants.slice(0, 6),
        keyRelation: relatedEvents[0]?.relation || '推进',
      }
    })
  }, [chapters, sortedEvents])

  const visibleSceneCards = useMemo(() => {
    if (scopeMode !== 'chapter' || !selectedChapterId) return sceneCards
    return sceneCards.filter((scene) => scene.chapterId === selectedChapterId)
  }, [sceneCards, scopeMode, selectedChapterId])

  const relationCountByNodeId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const node of l4Nodes) counts.set(node.id, 0)
    for (const edge of l4Edges) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1)
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1)
    }
    return counts
  }, [l4Edges, l4Nodes])

  const characterMatrix = useMemo<CharacterViewModel[]>(() => {
    return l4Nodes.map((node) => {
      const relatedEvents = sortedEvents.filter((event) => event.subject === node.label || event.object === node.label)
      const activeChapters = relatedEvents.map((event) => event.chapter)
      return {
        id: node.id,
        label: node.label,
        overview: node.overview || '当前未沉淀角色概述，可在章节推进后逐步补齐。',
        personality: node.personality || '暂无显式性格标签',
        relationCount: relationCountByNodeId.get(node.id) ?? 0,
        eventCount: relatedEvents.length,
        firstActiveChapter: activeChapters.length > 0 ? Math.min(...activeChapters) : null,
        lastActiveChapter: activeChapters.length > 0 ? Math.max(...activeChapters) : null,
        coreConflict: summarizeConflict(relatedEvents),
        tags: uniqueStrings([node.personality, node.overview]).slice(0, 3),
      }
    })
  }, [l4Nodes, relationCountByNodeId, sortedEvents])

  const visibleCharacterMatrix = useMemo(() => {
    if (!activeRoleLabels) return characterMatrix
    return characterMatrix.filter((character) => activeRoleLabels.has(character.label))
  }, [activeRoleLabels, characterMatrix])

  const sceneMapNodes = useMemo(() => buildSceneMapNodes(visibleSceneCards, selectedChapterId), [selectedChapterId, visibleSceneCards])
  const sceneMapEdges = useMemo(() => buildSceneMapEdges(visibleSceneCards), [visibleSceneCards])

  const selectCharacter = useCallback((characterId: string) => {
    setInspectorSelection({ kind: 'character', id: characterId })
  }, [])

  const selectScene = useCallback((chapterId: string) => {
    setInspectorSelection({ kind: 'scene', id: chapterId })
    handleSelectChapter(chapterId)
  }, [handleSelectChapter])

  const onSceneNodeClick = useCallback((_event: ReactMouseEvent, node: Node) => {
    const chapterId = node.id.replace(/^scene-/, '')
    selectScene(chapterId)
  }, [selectScene])

  const selectedCharacter = useMemo(() => {
    if (inspectorSelection?.kind === 'character') {
      return characterMatrix.find((character) => character.id === inspectorSelection.id) ?? null
    }
    if (selectedNodeId) {
      return characterMatrix.find((character) => character.id === selectedNodeId) ?? null
    }
    return null
  }, [characterMatrix, inspectorSelection, selectedNodeId])

  const selectedScene = useMemo(() => {
    if (inspectorSelection?.kind === 'scene') {
      return sceneCards.find((scene) => scene.chapterId === inspectorSelection.id) ?? null
    }
    if (selectedChapterId) {
      return sceneCards.find((scene) => scene.chapterId === selectedChapterId) ?? null
    }
    return null
  }, [inspectorSelection, sceneCards, selectedChapterId])

  useEffect(() => {
    if (selectedCharacter) {
      setInspectorLabelDraft(selectedCharacter.label)
    }
  }, [selectedCharacter])

  const saveSelectedCharacterLabel = useCallback(async () => {
    if (!projectId || !selectedCharacter || !inspectorLabelDraft.trim()) return
    setSavingInspectorLabel(true)
    try {
      await api.patch(`/projects/${projectId}/graph/nodes/${selectedCharacter.id}`, {
        label: inspectorLabelDraft.trim(),
      })
      addToast('success', '角色名称已保存')
      await loadData()
    } catch {
      addToast('error', '保存角色名称失败')
    } finally {
      setSavingInspectorLabel(false)
    }
  }, [addToast, inspectorLabelDraft, loadData, projectId, selectedCharacter])

  const deleteSelectedCharacter = useCallback(async () => {
    if (!projectId || !selectedCharacter) return
    setDeletingSelectedCharacter(true)
    try {
      await api.delete(`/projects/${projectId}/graph/nodes/${selectedCharacter.id}`)
      setInspectorSelection(null)
      addToast('success', '角色节点已删除')
      await loadData()
    } catch {
      addToast('error', '删除角色节点失败')
    } finally {
      setDeletingSelectedCharacter(false)
    }
  }, [addToast, loadData, projectId, selectedCharacter])

  const projectMetrics = useMemo(() => ({
    chapterCount: currentProject?.chapter_count ?? chapters.length,
    entityCount: currentProject?.entity_count ?? l4Nodes.length,
    eventCount: currentProject?.event_count ?? events.length,
    status: currentProject?.status ?? 'draft',
  }), [chapters.length, currentProject, events.length, l4Nodes.length])

  return {
    graphFeatureEnabled: GRAPH_FEATURE_ENABLED,
    loading,
    currentProject,
    chapters,
    chaptersError,
    workspaceTab,
    workspaceTabs: WORKSPACE_TABS,
    setWorkspaceTab,
    selectedChapterId,
    selectedChapter,
    handleSelectChapter,
    scopeMode,
    setScopeMode,
    layoutMode,
    setLayoutMode,
    projectMetrics,
    sceneCards: visibleSceneCards,
    allSceneCards: sceneCards,
    characterMatrix: visibleCharacterMatrix,
    allCharacterMatrix: characterMatrix,
    selectedCharacter,
    selectedScene,
    selectCharacter,
    selectScene,
    sortedEvents,
    flowRef,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onNodeClick,
    onPaneClick,
    onNodeContextMenu,
    fitGraphView,
    resetGraphFocus,
    refreshGraphData: loadData,
    sceneMapNodes,
    sceneMapEdges,
    onSceneNodeClick,
    contextMenu,
    handleDeleteNode,
    handleStartEdit,
    editingNodeId,
    setEditingNodeId,
    editInputRef,
    editLabel,
    setEditLabel,
    handleSaveEdit,
    showAddModal,
    setShowAddModal,
    addNodeInputRef,
    newNodeLabel,
    setNewNodeLabel,
    handleAddNode,
    selectedNodeIds,
    handleMergeNodes,
    inspectorLabelDraft,
    setInspectorLabelDraft,
    saveSelectedCharacterLabel,
    savingInspectorLabel,
    deleteSelectedCharacter,
    deletingSelectedCharacter,
  }
}
