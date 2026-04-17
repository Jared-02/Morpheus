import ReactFlow from 'reactflow'
import 'reactflow/dist/style.css'
import { Link, useParams } from 'react-router-dom'
import PageTransition from '../components/ui/PageTransition'
import Skeleton from '../components/ui/Skeleton'
import useNarrativeModelController from '../features/modeling/useNarrativeModelController'
import { nodeTypes, ENTITY_STYLES } from '../shared/graph/nodeTypes'
import {
  buildGraphEdges,
  buildGraphNodes,
  buildL4GraphEdges,
  buildL4GraphNodes,
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
export { ENTITY_STYLES }
export {
  buildGraphNodes,
  buildGraphEdges,
  getHighlightSets,
  sortEventsByChapter,
  sanitizeGraphData,
  buildL4GraphNodes,
  buildL4GraphEdges,
}

export default function KnowledgeGraphPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const {
    graphFeatureEnabled,
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
  } = useNarrativeModelController(projectId)

  if (!graphFeatureEnabled) {
    return (
      <PageTransition>
        <div>
          <div className="page-head" style={{ marginBottom: 16 }}>
            <div>
              <Link
                to={`/project/${projectId}`}
                className="muted"
                style={{ textDecoration: 'none', fontSize: '0.88rem' }}
              >
                ← 返回项目
              </Link>
              <h1 className="title" style={{ marginTop: 6 }}>
                知识图谱
              </h1>
            </div>
          </div>
          <section className="card" style={{ padding: 16 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>
              功能已暂时关闭
            </h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              知识图谱已按当前配置下线，后续需要恢复时可重新开启。
            </p>
            <Link to={`/project/${projectId}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              返回项目概览
            </Link>
          </section>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div>
        <div className="page-head" style={{ marginBottom: 16 }}>
          <div>
            <Link
              to={`/project/${projectId}`}
              className="muted"
              style={{ textDecoration: 'none', fontSize: '0.88rem' }}
            >
              ← 返回项目
            </Link>
            <h1 className="title" style={{ marginTop: 6 }}>
              知识图谱
            </h1>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>
              角色状态、关系事件与时间线一致性视图。
            </p>
          </div>
        </div>

        <div
          style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}
          role="tablist"
          aria-label="知识图谱标签页"
        >
          {tabs.map((item) => (
            <button
              type="button"
              key={item.key}
              role="tab"
              aria-selected={tab === item.key}
              className={`chip-btn ${tab === item.key ? 'active' : ''}`}
              onClick={() => setTab(item.key)}
              style={{ padding: '8px 16px' }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ display: 'grid', gap: 12 }}>
            <Skeleton variant="card" count={3} />
          </div>
        )}

        {!loading && tab === 'graph' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`chip-btn ${showProgressEdges ? 'active' : ''}`}
                onClick={() => setShowProgressEdges((value) => !value)}
                aria-pressed={showProgressEdges}
              >
                {showProgressEdges ? 'progress 已显示' : 'progress 已隐藏'}
              </button>
              <button
                type="button"
                className={`chip-btn ${showAllPairEdges ? 'active' : ''}`}
                onClick={() => setShowAllPairEdges((value) => !value)}
                aria-pressed={showAllPairEdges}
              >
                {showAllPairEdges ? '显示全部历史边' : '仅显示最新关系'}
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={() => setShowAddModal(true)}
                aria-label="添加节点"
              >
                + 添加节点
              </button>
              {selectedNodeIds.size >= 2 && (
                <button
                  type="button"
                  className="chip-btn active"
                  onClick={handleMergeNodes}
                  aria-label="合并节点"
                >
                  ⇈ 合并选中的 {selectedNodeIds.size} 个节点
                </button>
              )}
            </div>
            <div
              className="card"
              style={{
                padding: 0,
                height: 680,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {l4Nodes.length === 0 ? (
                <p className="muted" style={{ padding: 24 }}>
                  暂无角色档案，完成章节后自动生成
                </p>
              ) : (
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick}
                  onPaneClick={onPaneClick}
                  onNodeContextMenu={onNodeContextMenu}
                  nodeTypes={nodeTypes}
                  onInit={(instance) => {
                    flowRef.current = instance
                  }}
                  proOptions={{ hideAttribution: true }}
                  minZoom={0.18}
                  maxZoom={1.3}
                  style={{ background: 'transparent' }}
                />
              )}
            </div>
            {contextMenu && (
              <div
                data-testid="node-context-menu"
                style={{
                  position: 'fixed',
                  top: contextMenu.y,
                  left: contextMenu.x,
                  background: 'var(--graph-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: 'var(--graph-floating-shadow)',
                  zIndex: 50,
                  padding: '4px 0',
                  minWidth: 140,
                }}
              >
                <button
                  type="button"
                  onClick={handleStartEdit}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 16px',
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                  }}
                >
                  ✏ 编辑节点
                </button>
                <button
                  type="button"
                  onClick={handleDeleteNode}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 16px',
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    color: 'var(--danger)',
                  }}
                >
                  ✖ 删除节点
                </button>
              </div>
            )}
            {editingNodeId && (
              <div
                data-testid="edit-node-inline"
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'absolute',
                  top: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--graph-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: 'var(--graph-floating-shadow)',
                  zIndex: 50,
                  padding: '12px 16px',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  ref={editInputRef}
                  type="text"
                  value={editLabel}
                  onChange={(event) => setEditLabel(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && void handleSaveEdit()}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: '0.88rem',
                  }}
                />
                <button type="button" className="btn btn-primary" onClick={() => void handleSaveEdit()} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                  保存
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingNodeId(null)} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                  取消
                </button>
              </div>
            )}
            {showAddModal && (
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'var(--graph-overlay)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 100,
                }}
                onClick={() => setShowAddModal(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setShowAddModal(false)
                }}
                tabIndex={-1}
              >
                <div className="card" style={{ padding: 24, minWidth: 320 }} onClick={(event) => event.stopPropagation()}>
                  <h3 style={{ marginTop: 0, fontSize: '1rem' }}>添加新节点</h3>
                  <input
                    ref={addNodeInputRef}
                    type="text"
                    value={newNodeLabel}
                    onChange={(event) => setNewNodeLabel(event.target.value)}
                    placeholder="节点名称"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: '0.9rem',
                      marginBottom: 12,
                      boxSizing: 'border-box',
                    }}
                    onKeyDown={(event) => event.key === 'Enter' && void handleAddNode()}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                      取消
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => void handleAddNode()}>
                      创建
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && tab === 'timeline' && (
          <section className="card" style={{ padding: 14 }}>
            <h2 style={{ marginTop: 0, fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
              章节事件序列
            </h2>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {sortedEvents.length === 0 && <p className="muted">暂无事件时间线。</p>}
              {sortedEvents.map((event) => (
                <article key={event.event_id} className="card-strong" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span className="chip">第 {event.chapter} 章</span>
                    <span className="metric-label">{event.relation}</span>
                  </div>
                  <p style={{ margin: '8px 0 4px' }}>
                    {event.subject} → {event.object || '未知对象'}
                  </p>
                  <p className="muted" style={{ margin: 0 }}>
                    {event.description || '无描述'}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageTransition>
  )
}
