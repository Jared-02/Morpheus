import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import './StoryboardStudioPage.css'

interface BoardShot {
  id: string
  scene: string
  camera: string
  mood: string
  duration: string
}

const SHOTS: BoardShot[] = [
  { id: 'shot-1', scene: '雨夜街头，主角背影入画', camera: '远景 / 平移', mood: '压抑', duration: '5s' },
  { id: 'shot-2', scene: '霓虹反射在水洼，角色抬头', camera: '中景 / 推近', mood: '悬疑', duration: '7s' },
  { id: 'shot-3', scene: '老爹压低声音递出芯片', camera: '近景 / 手持', mood: '紧张', duration: '6s' },
]

export default function StoryboardStudioPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const chapter = searchParams.get('chapter') ?? 'chapter-3'

  const chapterLabel = useMemo(() => {
    if (chapter === 'chapter-1') return '第1章 雨夜序曲'
    if (chapter === 'chapter-2') return '第2章 霓虹下的影子'
    return '第3章 机械心跳'
  }, [chapter])

  return (
    <div className="sb-page">
      <section className="sb-header sb-panel">
        <h2>AI 漫剧工作台</h2>
        <p>项目：{projectId} · 当前章节：{chapterLabel}</p>
      </section>

      <section className="sb-board sb-panel">
        <header>
          <h3>分镜时间线</h3>
          <button type="button">生成分镜草案</button>
        </header>
        <div className="sb-canvas">
          <div className="sb-canvas__guide">Storyboard Canvas</div>
        </div>
      </section>

      <section className="sb-list sb-panel">
        <header>
          <h3>镜头列表</h3>
        </header>
        <div className="sb-table">
          <div className="sb-table__head">
            <span>镜头</span>
            <span>画面描述</span>
            <span>机位</span>
            <span>情绪</span>
            <span>时长</span>
          </div>
          {SHOTS.map((shot, idx) => (
            <div key={shot.id} className="sb-table__row">
              <span>{String(idx + 1).padStart(2, '0')}</span>
              <span>{shot.scene}</span>
              <span>{shot.camera}</span>
              <span>{shot.mood}</span>
              <span>{shot.duration}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
