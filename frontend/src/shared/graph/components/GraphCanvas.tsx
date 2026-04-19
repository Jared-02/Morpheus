import type {
  Edge,
  Node,
  NodeMouseHandler,
  NodeTypes,
  OnEdgesChange,
  OnNodesChange,
  ReactFlowInstance,
} from 'reactflow'
import ReactFlow from 'reactflow'
import 'reactflow/dist/style.css'
import { Paper, Stack, Text } from '@mantine/core'
import type { EntityNodeData } from '../types'

interface GraphCanvasProps {
  ariaLabel: string
  height?: number
  nodes: Node<EntityNodeData>[]
  edges: Edge[]
  nodeTypes: NodeTypes
  onNodesChange?: OnNodesChange
  onEdgesChange?: OnEdgesChange
  onNodeClick?: NodeMouseHandler
  onPaneClick?: () => void
  onNodeContextMenu?: NodeMouseHandler
  onInit?: (instance: ReactFlowInstance) => void
  emptyTitle: string
  emptyDescription: string
}

export default function GraphCanvas({
  ariaLabel,
  height = 620,
  nodes,
  edges,
  nodeTypes,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onPaneClick,
  onNodeContextMenu,
  onInit,
  emptyTitle,
  emptyDescription,
}: GraphCanvasProps) {
  return (
    <Paper radius="xl" p={0} style={{ height, overflow: 'hidden', position: 'relative' }}>
      {nodes.length === 0 ? (
        <Stack h="100%" justify="center" align="center" gap={8} p="xl">
          <Text fw={700}>{emptyTitle}</Text>
          <Text size="sm" c="dimmed" ta="center" maw={360}>
            {emptyDescription}
          </Text>
        </Stack>
      ) : (
        <ReactFlow
          aria-label={ariaLabel}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          onInit={onInit}
          minZoom={0.16}
          maxZoom={1.4}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'transparent' }}
        />
      )}
    </Paper>
  )
}
