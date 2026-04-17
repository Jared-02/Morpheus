import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { Node, ReactFlowInstance } from 'reactflow'
import { useEdgesState, useNodesState } from 'reactflow'
import { api } from '../../lib/api'
import { GRAPH_FEATURE_ENABLED } from '../../config/features'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToastStore } from '../../stores/useToastStore'
import {
  buildL4GraphEdges,
  buildL4GraphNodes,
  getHighlightSets,
  sortEventsByChapter,
} from '../../shared/graph/utils'
import type { EntityNodeData, EventEdge, L4GraphEdge, L4GraphNode } from '../../shared/graph/types'

type NarrativeTab = 'graph' | 'timeline'

export default function useNarrativeModelController(projectId?: string) {
  const fetchProject = useProjectStore((state) => state.fetchProject)
  const currentProject = useProjectStore((state) => state.currentProject)
  const addToast = useToastStore((state) => state.addToast)

  const [events, setEvents] = useState<EventEdge[]>([])
  const [l4Nodes, setL4Nodes] = useState<L4GraphNode[]>([])
  const [l4Edges, setL4Edges] = useState<L4GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<NarrativeTab>('graph')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showProgressEdges, setShowProgressEdges] = useState(false)
  const [showAllPairEdges, setShowAllPairEdges] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newNodeLabel, setNewNodeLabel] = useState('')
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())

  const flowRef = useRef<ReactFlowInstance | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const addNodeInputRef = useRef<HTMLInputElement | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (projectId && currentProject?.id !== projectId) {
      fetchProject(projectId)
    }
  }, [currentProject?.id, fetchProject, projectId])

  const loadData = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setNodes([])
    setEdges([])
    setSelectedNodeId(null)

    try {
      const [graphRes, eventRes] = await Promise.all([
        api.get(`/projects/${projectId}/graph`),
        api.get(`/events/${projectId}`),
      ])
      setL4Nodes(graphRes.data?.nodes ?? [])
      setL4Edges(graphRes.data?.edges ?? [])
      setEvents(eventRes.data ?? [])
    } catch (error) {
      addToast('error', '加载知识图谱数据失败')
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

  useEffect(() => {
    if (!GRAPH_FEATURE_ENABLED) return
    if (l4Nodes.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const rfNodes = buildL4GraphNodes(l4Nodes, l4Edges)
    const nodeIdSet = new Set(rfNodes.map((node) => node.id))
    const rfEdges = buildL4GraphEdges(l4Edges, nodeIdSet)
    setNodes(rfNodes)
    setEdges(rfEdges)
    setSelectedNodeId(null)

    requestAnimationFrame(() => {
      flowRef.current?.fitView({ padding: 0.36, duration: 420 })
    })
  }, [l4Edges, l4Nodes, setEdges, setNodes])

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

  const resetGraphFocus = useCallback(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({ ...node, data: { ...node.data, highlighted: false, dimmed: false } })),
    )
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        animated: false,
        style: { ...edge.style, stroke: 'var(--graph-edge-stroke)', strokeWidth: 1.5 },
        label: '',
      })),
    )
  }, [setEdges, setNodes])

  const onNodeClick = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      if (event.ctrlKey || event.metaKey) {
        setSelectedNodeIds((current) => {
          const next = new Set(current)
          if (next.has(node.id)) next.delete(node.id)
          else next.add(node.id)
          return next
        })
        return
      }

      setSelectedNodeIds(new Set())
      const clickedId = node.id
      if (selectedNodeId === clickedId) {
        setSelectedNodeId(null)
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
            ? String((edge.data as { relationLabel?: string } | undefined)?.relationLabel || '')
            : '',
          style: {
            ...edge.style,
            stroke: highlightedEdgeIds.has(edge.id) ? 'var(--graph-edge-highlight)' : 'var(--graph-edge-dim)',
            strokeWidth: highlightedEdgeIds.has(edge.id) ? 2.5 : 1,
          },
        })),
      )
    },
    [edges, resetGraphFocus, selectedNodeId, setEdges, setNodes],
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setContextMenu(null)
    setEditingNodeId(null)
    setSelectedNodeIds(new Set())
    resetGraphFocus()
  }, [resetGraphFocus])

  const onNodeContextMenu = useCallback((event: ReactMouseEvent, node: Node) => {
    event.preventDefault()
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY })
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
    if (!editingNodeId || !projectId) return
    try {
      await api.patch(`/projects/${projectId}/graph/nodes/${editingNodeId}`, {
        label: editLabel,
      })
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
      await api.post(`/projects/${projectId}/graph/nodes`, {
        label: newNodeLabel.trim(),
      })
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
    const keepId = ids[0]
    const mergeIds = ids.slice(1)
    try {
      await api.post(`/projects/${projectId}/graph/nodes/merge`, {
        keep_node_id: keepId,
        merge_node_ids: mergeIds,
      })
      setSelectedNodeIds(new Set())
      addToast('success', `已合并 ${mergeIds.length} 个节点`)
      await loadData()
    } catch {
      addToast('error', '合并失败')
    }
  }, [addToast, loadData, projectId, selectedNodeIds])

  const sortedEvents = useMemo(() => sortEventsByChapter(events), [events])
  const tabs: Array<{ key: NarrativeTab; label: string }> = [
    { key: 'graph', label: '关系视图' },
    { key: 'timeline', label: '事件时间线' },
  ]

  return {
    graphFeatureEnabled: GRAPH_FEATURE_ENABLED,
    loading,
    tab,
    setTab,
    tabs,
    showProgressEdges,
    setShowProgressEdges,
    showAllPairEdges,
    setShowAllPairEdges,
    showAddModal,
    setShowAddModal,
    selectedNodeIds,
    l4Nodes,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onNodeClick,
    onPaneClick,
    onNodeContextMenu,
    flowRef,
    contextMenu,
    handleDeleteNode,
    handleStartEdit,
    editingNodeId,
    setEditingNodeId,
    editInputRef,
    editLabel,
    setEditLabel,
    handleSaveEdit,
    addNodeInputRef,
    newNodeLabel,
    setNewNodeLabel,
    handleAddNode,
    handleMergeNodes,
    sortedEvents,
  }
}
