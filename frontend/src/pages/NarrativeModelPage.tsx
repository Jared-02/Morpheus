import { Text } from '@mantine/core'
import StudioPlaceholderPage from './StudioPlaceholderPage'

export default function NarrativeModelPage() {
  return (
    <StudioPlaceholderPage
      title="叙事建模"
      description="新的叙事建模页已经挂到 Studio shell，下阶段会把图谱、结构树和 Inspector 逐步迁入同一工作台。"
      phaseLabel="Phase 1 宿主"
      summary="新顶栏、左 rail、中央画布位和右 Inspector 响应式骨架已就位。"
      milestone="Phase 4"
      fallbackRoute={(projectId) => `/project/${projectId}/graph`}
      fallbackLabel="返回旧版知识图谱"
      railTitle="左侧 rail"
      railItems={[
        { title: '结构树', detail: '未来承载卷章结构、建模入口和筛选模式切换。' },
        { title: '上下文导航', detail: '移动端会退化为 Drawer，确保图谱页面仍可操作。' },
      ]}
      inspectorTitle="右侧 Inspector"
      inspectorItems={[
        { label: '主职责', value: '展示角色属性、成长弧线、核心冲突、标签与保存动作。' },
        { label: '本周完成', value: '先打通壳层、主题、导航和面板布局，不挪动现有图谱业务逻辑。' },
      ]}
      nextSteps={[
        '抽离 KnowledgeGraphPage 的画布、布局和节点渲染逻辑。',
        '沉淀 shared/graph 基础层，复用 React Flow + ELK + d3-force。',
        '把 Inspector 状态收回 modeling controller，而不是继续堆在单页里。',
      ]}
      highlight={<Text size="sm">当前图谱生产入口仍是旧版 `/project/:projectId/graph`，新路由用于稳定壳层和信息架构。</Text>}
    />
  )
}
