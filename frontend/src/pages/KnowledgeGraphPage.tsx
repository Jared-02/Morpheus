import { Navigate, useParams } from 'react-router-dom'
import { nodeTypes, ENTITY_STYLES } from '../shared/graph/nodeTypes'
import {
  buildGraphEdges,
  buildGraphNodes,
  buildL4GraphEdges,
  buildL4GraphNodes,
  buildL4GridNodes,
  getHighlightSets,
  sanitizeGraphData,
  sortEventsByChapter,
} from '../shared/graph/utils'

export type {
  BuildGraphEdgeOptions,
  EntityNode,
  EventEdge,
  L4GraphEdge,
  L4GraphNode,
} from '../shared/graph/types'
export { ENTITY_STYLES, nodeTypes }
export {
  buildGraphNodes,
  buildGraphEdges,
  getHighlightSets,
  sortEventsByChapter,
  sanitizeGraphData,
  buildL4GraphNodes,
  buildL4GridNodes,
  buildL4GraphEdges,
}

export default function KnowledgeGraphPage() {
  const { projectId } = useParams<{ projectId: string }>()

  if (!projectId) {
    return <Navigate to="/" replace />
  }

  return <Navigate to={`/project/${projectId}/model?tab=graph`} replace />
}
