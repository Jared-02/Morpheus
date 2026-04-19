import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconFocus2,
  IconRefresh,
  IconSitemap,
  IconSparkles,
  IconTrash,
  IconUsersGroup,
} from '@tabler/icons-react'
import { Link, useParams } from 'react-router-dom'
import WorkspaceFrame from '../app/shell/WorkspaceFrame'
import useNarrativeModelController, { type NarrativeScopeMode, type NarrativeWorkspaceTab } from '../features/modeling/useNarrativeModelController'
import { nodeTypes } from '../shared/graph/nodeTypes'
import GraphCanvas from '../shared/graph/components/GraphCanvas'
import GraphInspector from '../shared/graph/components/GraphInspector'
import GraphToolbar from '../shared/graph/components/GraphToolbar'
import AppPanel from '../shared/ui/AppPanel'

function formatWordCount(value: number) {
  return `${Number(value || 0).toLocaleString()} 字`
}

function formatChapterRange(start: number | null, end: number | null) {
  if (!start || !end) return '尚未进入章节事件链'
  if (start === end) return `集中在第 ${start} 章`
  return `从第 ${start} 章延伸到第 ${end} 章`
}

function scopeDescription(scopeMode: NarrativeScopeMode, selectedChapterLabel?: string) {
  if (scopeMode === 'chapter' && selectedChapterLabel) {
    return `当前聚焦 ${selectedChapterLabel}，仅展示本章相关角色与场景。`
  }
  return '当前为全局视角，适合梳理角色关系、章节推进和整体建模结构。'
}

export default function NarrativeModelPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const {
    graphFeatureEnabled,
    loading,
    currentProject,
    chapters,
    chaptersError,
    workspaceTab,
    workspaceTabs,
    setWorkspaceTab,
    selectedChapter,
    selectedChapterId,
    handleSelectChapter,
    scopeMode,
    setScopeMode,
    layoutMode,
    setLayoutMode,
    projectMetrics,
    sceneCards,
    allSceneCards,
    characterMatrix,
    allCharacterMatrix,
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
    refreshGraphData,
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
  } = useNarrativeModelController(projectId)

  const selectedChapterLabel = selectedChapter ? `第 ${selectedChapter.chapter_number} 章 ${selectedChapter.title}` : undefined

  const handleScopeChange = (value: string) => {
    const nextScope = value === 'chapter' ? 'chapter' : 'global'
    if (nextScope === 'chapter' && !selectedChapter) return
    setScopeMode(nextScope)
  }

  const toolbar = (
    <Group gap="xs" wrap="wrap">
      <Badge variant="light">{projectMetrics.status}</Badge>
      <Badge variant="light">章节 {projectMetrics.chapterCount}</Badge>
      <Badge variant="light">角色 {projectMetrics.entityCount}</Badge>
      <Badge variant="light">事件 {projectMetrics.eventCount}</Badge>
      <Button
        component={Link}
        to={`/project/${projectId}`}
        variant="subtle"
        leftSection={<IconArrowLeft size={16} stroke={1.8} />}
      >
        返回项目概览
      </Button>
    </Group>
  )

  const rail = (
    <Stack gap="md">
      <AppPanel
        eyebrow="建模入口"
        title="叙事工作区"
        description="左 rail 负责切换角色图谱、场景关系、场景卡片和角色矩阵。"
      >
        <Stack gap="xs">
          {workspaceTabs.map((tab) => {
            const active = workspaceTab === tab.value
            return (
              <Button
                key={tab.value}
                variant={active ? 'filled' : 'subtle'}
                justify="flex-start"
                leftSection={tab.value === 'matrix' ? <IconUsersGroup size={16} stroke={1.8} /> : <IconSitemap size={16} stroke={1.8} />}
                onClick={() => setWorkspaceTab(tab.value as NarrativeWorkspaceTab)}
              >
                {tab.label}
              </Button>
            )
          })}
        </Stack>
      </AppPanel>

      <AppPanel
        eyebrow="卷章结构"
        title={`已同步 ${chapters.length} 章`}
        description="章节按钮既是结构树入口，也能切成当前章节聚焦模式。"
      >
        {chaptersError && (
          <Alert color="red" variant="light">
            {chaptersError}
          </Alert>
        )}

        <Stack gap="xs">
          <Button
            variant={scopeMode === 'global' && !selectedChapterId ? 'filled' : 'subtle'}
            justify="flex-start"
            onClick={() => handleSelectChapter(null)}
          >
            全局视角
          </Button>
          {chapters.map((chapter) => {
            const active = selectedChapterId === chapter.id
            return (
              <UnstyledButton key={chapter.id} onClick={() => selectScene(chapter.id)}>
                <Paper
                  p="sm"
                  radius="lg"
                  withBorder
                  style={{
                    borderColor: active ? 'var(--accent)' : undefined,
                    background: active ? 'var(--accent-subtle)' : undefined,
                  }}
                >
                  <Stack gap={6}>
                    <Group justify="space-between" align="center">
                      <Text fw={700} size="sm">第 {chapter.chapter_number} 章</Text>
                      <Badge variant="light">冲突 {chapter.conflict_count}</Badge>
                    </Group>
                    <Text fw={600} lineClamp={1}>{chapter.title || '未命名章节'}</Text>
                    <Text size="xs" c="dimmed">{formatWordCount(chapter.word_count)}</Text>
                  </Stack>
                </Paper>
              </UnstyledButton>
            )
          })}
        </Stack>
      </AppPanel>

      <AppPanel
        eyebrow="建模基线"
        title={currentProject?.name || '当前项目'}
        description={scopeDescription(scopeMode, selectedChapterLabel)}
      >
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">项目状态</Text>
            <Text size="sm" fw={700}>{projectMetrics.status}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">场景卡</Text>
            <Text size="sm" fw={700}>{allSceneCards.length}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">角色矩阵</Text>
            <Text size="sm" fw={700}>{allCharacterMatrix.length}</Text>
          </Group>
          <Text size="xs" c="dimmed">
            当前选中的章节会同步驱动场景关系、角色矩阵和 Inspector 的上下文。
          </Text>
        </Stack>
      </AppPanel>
    </Stack>
  )

  const inspector = selectedCharacter ? (
    <GraphInspector
      eyebrow="角色 Inspector"
      title={selectedCharacter.label}
      description="右侧集中展示角色资料、成长弧线、核心冲突和命名保存动作。"
      sections={[
        { label: '角色资料', value: selectedCharacter.overview },
        { label: '成长弧线', value: `${formatChapterRange(selectedCharacter.firstActiveChapter, selectedCharacter.lastActiveChapter)}，共参与 ${selectedCharacter.eventCount} 条事件。` },
        { label: '核心冲突', value: selectedCharacter.coreConflict },
        { label: '关联强度', value: `当前与 ${selectedCharacter.relationCount} 条关系边相连，适合继续补充冲突与动机标签。` },
      ]}
      actions={(
        <Stack gap="sm">
          <TextInput
            label="角色名称"
            value={inspectorLabelDraft}
            onChange={(event) => setInspectorLabelDraft(event.currentTarget.value)}
            description="支持直接在 Inspector 中修改节点名称并回写。"
          />
          <Group grow>
            <Button
              leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}
              onClick={() => void saveSelectedCharacterLabel()}
              loading={savingInspectorLabel}
              disabled={!inspectorLabelDraft.trim()}
            >
              保存名称
            </Button>
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={16} stroke={1.8} />}
              onClick={() => void deleteSelectedCharacter()}
              loading={deletingSelectedCharacter}
            >
              删除节点
            </Button>
          </Group>
          {selectedCharacter.tags.length > 0 && (
            <Group gap="xs">
              {selectedCharacter.tags.map((tag) => (
                <Badge key={tag} variant="light">{tag}</Badge>
              ))}
            </Group>
          )}
        </Stack>
      )}
    />
  ) : selectedScene ? (
    <GraphInspector
      eyebrow="场景 Inspector"
      title={`第 ${selectedScene.chapterNumber} 章 · ${selectedScene.title}`}
      description="场景卡与场景关系图共享同一套 Inspector，避免再跳回旧项目详情页查看。"
      sections={[
        { label: '章节目标', value: selectedScene.goal },
        { label: '场景摘要', value: selectedScene.synopsis },
        { label: '核心关系', value: `${selectedScene.keyRelation} · 本章记录 ${selectedScene.eventCount} 条事件，冲突 ${selectedScene.conflictCount} 个。` },
        { label: '参与角色', value: selectedScene.participants.length > 0 ? selectedScene.participants.join(' / ') : '当前章节暂无角色参与记录。' },
      ]}
      actions={(
        <Group grow>
          <Button variant="light" onClick={() => setWorkspaceTab('scene-map')}>
            切到场景关系
          </Button>
          <Button variant="light" onClick={() => setScopeMode('chapter')} disabled={!selectedChapter}>
            仅看本章
          </Button>
        </Group>
      )}
    />
  ) : (
    <GraphInspector
      eyebrow="项目 Inspector"
      title={currentProject?.name || '叙事建模'}
      description="先从左侧章节结构树切一个焦点，或在中央选中角色/场景以查看更细的建模信息。"
      sections={[
        { label: '项目基线', value: `${projectMetrics.chapterCount} 章 · ${projectMetrics.entityCount} 角色节点 · ${projectMetrics.eventCount} 条事件。` },
        { label: '当前视角', value: scopeDescription(scopeMode, selectedChapterLabel) },
        { label: '推荐动作', value: '先在角色图谱确认关键人物，再切到场景卡片补齐章节目标与冲突。' },
      ]}
      actions={(
        <Button fullWidth variant="light" leftSection={<IconSparkles size={16} stroke={1.8} />} onClick={() => setWorkspaceTab('graph')}>
          进入角色图谱
        </Button>
      )}
    />
  )

  const renderLoading = () => (
    <Stack gap="lg">
      <Skeleton height={88} radius="xl" />
      <Skeleton height={620} radius="xl" />
      <Grid>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Skeleton height={220} radius="xl" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Skeleton height={220} radius="xl" />
        </Grid.Col>
      </Grid>
    </Stack>
  )

  const renderGraphWorkspace = () => (
    <Stack gap="lg">
      <AppPanel
        eyebrow="角色图谱"
        title="角色关系画布"
        description="React Flow 负责角色拓扑，结构树和 Inspector 共同完成选中、过滤与回写。"
      >
        <Stack gap="md">
          <GraphToolbar
            layoutLabel="布局模式"
            layoutValue={layoutMode}
            layoutOptions={[
              { value: 'radial', label: '关系聚焦' },
              { value: 'grid', label: '矩阵铺开' },
            ]}
            onLayoutChange={(value) => setLayoutMode(value === 'grid' ? 'grid' : 'radial')}
            scopeLabel="分析范围"
            scopeValue={scopeMode}
            scopeOptions={[
              { value: 'global', label: '全局' },
              { value: 'chapter', label: '当前章节' },
            ]}
            onScopeChange={handleScopeChange}
            primaryActions={(
              <>
                <Button variant="light" onClick={() => setShowAddModal(true)}>+ 添加角色</Button>
                <Button variant="light" leftSection={<IconFocus2 size={16} stroke={1.8} />} onClick={fitGraphView}>
                  自动聚焦
                </Button>
                <Button variant="light" leftSection={<IconRefresh size={16} stroke={1.8} />} onClick={() => void refreshGraphData()}>
                  刷新
                </Button>
              </>
            )}
            secondaryActions={(
              <>
                <Button variant="subtle" onClick={resetGraphFocus}>清空高亮</Button>
                {selectedNodeIds.size >= 2 && (
                  <Button variant="subtle" onClick={() => void handleMergeNodes()}>
                    合并选中 {selectedNodeIds.size} 个节点
                  </Button>
                )}
              </>
            )}
          />
          <GraphCanvas
            ariaLabel="叙事建模角色图谱"
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            onInit={(instance) => {
              flowRef.current = instance
            }}
            emptyTitle="暂无角色节点"
            emptyDescription="完成章节生成或手动添加角色后，这里会自动汇聚角色关系。"
          />
        </Stack>
      </AppPanel>
    </Stack>
  )

  const renderSceneMapWorkspace = () => (
    <Stack gap="lg">
      <AppPanel
        eyebrow="场景关系"
        title="章节推进画布"
        description="同样使用 React Flow 展示章节推进与共享角色，让场景关系不再散落在表格和详情页里。"
      >
        <Stack gap="md">
          <GraphToolbar
            layoutLabel="场景视图"
            layoutValue="grid"
            layoutOptions={[
              { value: 'grid', label: '章节序列' },
              { value: 'grid-alt', label: '场景卡联查' },
            ]}
            onLayoutChange={() => undefined}
            scopeLabel="分析范围"
            scopeValue={scopeMode}
            scopeOptions={[
              { value: 'global', label: '全局' },
              { value: 'chapter', label: '当前章节' },
            ]}
            onScopeChange={handleScopeChange}
            primaryActions={(
              <>
                <Button variant="light" onClick={() => setWorkspaceTab('scenes')}>查看场景卡</Button>
                <Button variant="light" onClick={fitGraphView}>聚焦画布</Button>
              </>
            )}
            secondaryActions={<Text size="sm" c="dimmed">点击节点可把 Inspector 切到对应章节的目标、摘要和参与角色。</Text>}
          />
          <GraphCanvas
            ariaLabel="叙事建模场景关系图"
            nodes={sceneMapNodes}
            edges={sceneMapEdges}
            nodeTypes={nodeTypes}
            onNodeClick={onSceneNodeClick}
            emptyTitle="暂无章节场景"
            emptyDescription="先创建章节或完成首章生成，场景关系图会自动出现。"
          />
        </Stack>
      </AppPanel>
    </Stack>
  )

  const renderSceneCardsWorkspace = () => (
    <AppPanel
      eyebrow="场景卡片"
      title="场景卡与章节矩阵"
      description="Phase 4 把原先分散在项目详情里的章节信息收敛成可点击的建模卡片。"
    >
      <Grid>
        {sceneCards.map((scene) => {
          const active = selectedChapterId === scene.chapterId
          return (
            <Grid.Col key={scene.chapterId} span={{ base: 12, md: 6, xl: 4 }}>
              <Card
                radius="xl"
                padding="lg"
                withBorder
                style={{
                  cursor: 'pointer',
                  borderColor: active ? 'var(--accent)' : undefined,
                  background: active ? 'var(--accent-subtle)' : undefined,
                }}
                onClick={() => selectScene(scene.chapterId)}
              >
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Text fw={700}>第 {scene.chapterNumber} 章</Text>
                    <Badge variant="light">{scene.keyRelation}</Badge>
                  </Group>
                  <Text fz="lg" fw={700}>{scene.title}</Text>
                  <Text size="sm" c="dimmed" lineClamp={3}>{scene.synopsis}</Text>
                  <Textarea
                    label="章节目标"
                    value={scene.goal}
                    readOnly
                    autosize
                    minRows={3}
                  />
                  <Group gap="xs">
                    <Badge variant="outline">{formatWordCount(scene.wordCount)}</Badge>
                    <Badge variant="outline">事件 {scene.eventCount}</Badge>
                    <Badge variant="outline">冲突 {scene.conflictCount}</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    参与角色：{scene.participants.length > 0 ? scene.participants.join(' / ') : '暂无参与角色'}
                  </Text>
                </Stack>
              </Card>
            </Grid.Col>
          )
        })}
      </Grid>
    </AppPanel>
  )

  const renderMatrixWorkspace = () => (
    <AppPanel
      eyebrow="角色矩阵"
      title="角色资料与冲突矩阵"
      description="用 Mantine Card + Grid 把角色档案、关系强度和冲突线索排成同页可扫的矩阵。"
    >
      <Grid>
        {characterMatrix.map((character) => {
          const active = selectedCharacter?.id === character.id
          return (
            <Grid.Col key={character.id} span={{ base: 12, md: 6, xl: 4 }}>
              <Card
                radius="xl"
                padding="lg"
                withBorder
                style={{
                  cursor: 'pointer',
                  borderColor: active ? 'var(--accent)' : undefined,
                  background: active ? 'var(--accent-subtle)' : undefined,
                }}
                onClick={() => selectCharacter(character.id)}
              >
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Text fz="lg" fw={700}>{character.label}</Text>
                    <ThemeIcon variant="light" size="lg" radius="xl">
                      <IconUsersGroup size={18} stroke={1.8} />
                    </ThemeIcon>
                  </Group>
                  <Text size="sm" c="dimmed" lineClamp={2}>{character.overview}</Text>
                  <Text size="sm">性格：{character.personality}</Text>
                  <Group gap="xs">
                    <Badge variant="outline">关系 {character.relationCount}</Badge>
                    <Badge variant="outline">事件 {character.eventCount}</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">{formatChapterRange(character.firstActiveChapter, character.lastActiveChapter)}</Text>
                  <Paper p="sm" radius="lg">
                    <Text size="xs" fw={700} c="dimmed">核心冲突</Text>
                    <Text size="sm" mt={4} lineClamp={3}>{character.coreConflict}</Text>
                  </Paper>
                </Stack>
              </Card>
            </Grid.Col>
          )
        })}
      </Grid>
    </AppPanel>
  )

  const renderTimelineWorkspace = () => (
    <AppPanel
      eyebrow="事件时间线"
      title="章节事件回放"
      description="时间线继续保留章节顺序，但现在直接嵌在建模工作台中，便于与图谱和场景卡联动。"
    >
      <Stack gap="sm">
        {sortedEvents.length === 0 ? (
          <Text size="sm" c="dimmed">当前项目还没有可用于建模的事件记录。</Text>
        ) : (
          sortedEvents.map((event) => (
            <Card key={event.event_id} radius="xl" padding="lg" withBorder>
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Badge variant="light">第 {event.chapter} 章</Badge>
                  <Badge variant="outline">{event.relation}</Badge>
                </Group>
                <Text fw={700}>{event.subject} {event.object ? `-> ${event.object}` : ''}</Text>
                <Text size="sm" c="dimmed">{event.description || '暂无事件说明'}</Text>
              </Stack>
            </Card>
          ))
        )}
      </Stack>
    </AppPanel>
  )

  const renderMain = () => {
    if (!graphFeatureEnabled) {
      return (
        <Alert color="yellow" variant="light">
          当前环境已关闭图谱能力，叙事建模工作台仍保留结构树、场景卡和角色矩阵壳层。
        </Alert>
      )
    }

    if (loading) return renderLoading()

    switch (workspaceTab) {
      case 'scene-map':
        return renderSceneMapWorkspace()
      case 'scenes':
        return renderSceneCardsWorkspace()
      case 'matrix':
        return renderMatrixWorkspace()
      case 'timeline':
        return renderTimelineWorkspace()
      case 'graph':
      default:
        return renderGraphWorkspace()
    }
  }

  return (
    <>
      <WorkspaceFrame
        title="叙事建模"
        description="整合项目详情与图谱能力，把角色关系、章节场景、角色矩阵和 Inspector 收敛到同一工作台。"
        toolbar={toolbar}
        railTitle="结构树"
        rail={rail}
        inspectorTitle="Inspector"
        inspector={inspector}
      >
        {renderMain()}
      </WorkspaceFrame>

      {contextMenu && (
        <Paper
          data-testid="model-node-context-menu"
          shadow="lg"
          radius="lg"
          p={6}
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 3000 }}
        >
          <Stack gap={4}>
            <Button variant="subtle" justify="flex-start" onClick={handleStartEdit}>
              重命名节点
            </Button>
            <Button variant="subtle" color="red" justify="flex-start" onClick={() => void handleDeleteNode()}>
              删除节点
            </Button>
          </Stack>
        </Paper>
      )}

      <Modal
        opened={Boolean(editingNodeId)}
        onClose={() => setEditingNodeId(null)}
        title="编辑角色节点"
        centered
      >
        <Stack gap="md">
          <TextInput
            ref={editInputRef}
            label="节点名称"
            value={editLabel}
            onChange={(event) => setEditLabel(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setEditingNodeId(null)}>
              取消
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={!editLabel.trim()}>
              保存
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="添加角色节点"
        centered
      >
        <Stack gap="md">
          <TextInput
            ref={addNodeInputRef}
            label="角色名称"
            value={newNodeLabel}
            onChange={(event) => setNewNodeLabel(event.currentTarget.value)}
            placeholder="例如：林雾 / 苏筠 / 监察官"
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setShowAddModal(false)}>
              取消
            </Button>
            <Button onClick={() => void handleAddNode()} disabled={!newNodeLabel.trim()}>
              创建节点
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
