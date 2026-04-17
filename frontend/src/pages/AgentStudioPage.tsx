import { Text } from '@mantine/core'
import StudioPlaceholderPage from './StudioPlaceholderPage'

export default function AgentStudioPage() {
  return (
    <StudioPlaceholderPage
      title="智能体"
      description="智能体模块当前缺少成熟后端接口，本周先把页面壳层、路由宿主和信息密度方向固定下来。"
      phaseLabel="Phase 6 预留"
      summary="智能体配置中心的工作台入口已经准备好，后续可以直接接本地 schema 或 mock 数据。"
      milestone="Phase 6"
      fallbackRoute={(projectId) => `/project/${projectId}`}
      fallbackLabel="返回项目概览"
      railTitle="实验区"
      railItems={[
        { title: 'Agent 卡片区', detail: '后续会展示多 Agent 角色、启停状态、职责和实验版本。' },
        { title: '参数草案', detail: '当前先为 schema 与 mock 数据预留承载区域。' },
      ]}
      inspectorTitle="接口策略"
      inspectorItems={[
        { label: '首阶段', value: '优先接前端 view model 和本地配置，不把后端能力缺口带进 MVP。' },
        { label: '后续扩展', value: '如需持久化，再补最小 agents 配置接口。' },
      ]}
      nextSteps={[
        '定义 Agent 配置 schema 和前端 view model。',
        '用 mock data 跑通卡片区、实验面板和保存反馈。',
        '资源允许时再追加后端配置接口。',
      ]}
      highlight={<Text size="sm">这里的目标不是提早做完整功能，而是先把未来模块放进统一的 Studio 信息架构。</Text>}
    />
  )
}
