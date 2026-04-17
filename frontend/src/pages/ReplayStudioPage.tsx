import { Text } from '@mantine/core'
import StudioPlaceholderPage from './StudioPlaceholderPage'

export default function ReplayStudioPage() {
  return (
    <StudioPlaceholderPage
      title="智策回溯"
      description="轨迹回放和记忆浏览的整合宿主已经建立，后续会在这里合并时间轴、记忆搜索和章节切换。"
      phaseLabel="Phase 1 宿主"
      summary="新回溯工作台的布局和移动端抽屉策略已先行固定。"
      milestone="Phase 5"
      fallbackRoute={(projectId) => `/project/${projectId}/trace`}
      fallbackLabel="返回旧版决策回放"
      railTitle="时间轴"
      railItems={[
        { title: '章节上下文', detail: '左侧面板将承接章节切换、Agent 序列和筛选入口。' },
        { title: '联查入口', detail: '未来在同页联动轨迹、冲突和记忆，不再跳多个独立页面。' },
      ]}
      inspectorTitle="集成策略"
      inspectorItems={[
        { label: '旧路由保留', value: 'Phase 5 前继续保留 `/trace` 和 `/memory` 旧入口，避免测试和收藏失效。' },
        { label: '移动端退化', value: 'Inspector 在小屏下默认折叠到 Drawer，优先保证时间轴和内容可读。' },
      ]}
      nextSteps={[
        '抽离 TraceReplayPage 的决策序列与详情逻辑。',
        '抽离 MemoryBrowserPage 的搜索、筛选和详情逻辑。',
        '增加章节切换、同步记忆和搜索联动。',
      ]}
      highlight={<Text size="sm">本周先固定导航与容器边界，后续再把轨迹和记忆查询真正搬进来。</Text>}
    />
  )
}
