import { Text } from '@mantine/core'
import StudioPlaceholderPage from './StudioPlaceholderPage'

export default function MediaStudioPage() {
  return (
    <StudioPlaceholderPage
      title="媒体创作"
      description="媒体创作暂不依赖后端音频或镜头接口，本周先完成壳层、参数区和任务区的布局宿主。"
      phaseLabel="Phase 6 预留"
      summary="媒体工作台已进入统一的顶栏导航，后续可以用前端 schema 先跑通交互。"
      milestone="Phase 6"
      fallbackRoute={(projectId) => `/project/${projectId}`}
      fallbackLabel="返回项目概览"
      railTitle="参数面板"
      railItems={[
        { title: '音色池 / 模板', detail: '后续在左侧承接预设、素材池和生成参数。' },
        { title: '任务队列', detail: '中央主区将展示生成任务、导出入口和历史结果。' },
      ]}
      inspectorTitle="落地边界"
      inspectorItems={[
        { label: '首阶段', value: '先用 mock schema 闭环 UI，不绑定真实音频生成链路。' },
        { label: '后续接入', value: '资源允许后再接音频生成、镜头脚本和资源库接口。' },
      ]}
      nextSteps={[
        '定义生成参数、任务状态和导出视图模型。',
        '完成 mock 数据驱动的创建、排队和查看链路。',
        '后续再接真实媒体生成接口。',
      ]}
      highlight={<Text size="sm">这部分当前只解决结构问题，不提前承诺不存在的后端能力。</Text>}
    />
  )
}
