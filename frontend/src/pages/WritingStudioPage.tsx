import { Text } from '@mantine/core'
import StudioPlaceholderPage from './StudioPlaceholderPage'

export default function WritingStudioPage() {
  return (
    <StudioPlaceholderPage
      title="文本创作"
      description="新的文本创作工作台将在保留批量生成、章节切换、深链接与保存链路的前提下，分阶段迁入新壳层。"
      phaseLabel="Phase 3 预留"
      summary="文本创作工作台路由与壳层边界已预留。"
      milestone="Phase 3"
      fallbackRoute={(projectId) => `/project/${projectId}/write`}
      fallbackLabel="返回旧版创作控制台"
      railTitle="迁移清单"
      railItems={[
        { title: '章节目录', detail: '左侧 rail 将承接卷章导航、快速跳转与批量生成入口。' },
        { title: '顶部工具栏', detail: '章节切换、统计、发布动作和入口状态会统一收口到顶部二级工具栏。' },
      ]}
      inspectorTitle="功能对等"
      inspectorItems={[
        { label: '必须保留', value: '批量生成、章节切换、章节保存、深链接进入、蓝图和冲突可见。' },
        { label: '当前状态', value: '第 1 周仅完成壳层接入，写作业务仍留在旧工作台。' },
      ]}
      nextSteps={[
        '抽离生成表单、章节导航、日志区和统计区 controller。',
        '把批量生成和逐章编辑合并到统一工作区布局。',
        '在功能对等后再把 `/project/:projectId/write` 切到新页面。',
      ]}
      highlight={<Text size="sm">当前生产入口仍然是旧版 `WritingConsolePage`，这里仅作为后续迁移的宿主预留。</Text>}
    />
  )
}
