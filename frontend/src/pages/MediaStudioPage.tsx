import { useState } from 'react'
import { IconDownload, IconSparkles, IconVolume } from '@tabler/icons-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useProjectStore } from '../stores/useProjectStore'
import './MediaStudioPage.css'

type ChapterState = 'done' | 'active' | 'pending'

interface ChapterItem {
  id: string
  chapter: number
  title: string
  duration: string
  status: ChapterState
  progress?: number
  mark: '⊕' | '－'
}

interface SegmentItem {
  id: string
  order: string
  title: string
  summary: string
  role: string
  mood: string
  range: string
  duration: string
  sceneClass: string
}

interface TimelineClip {
  id: string
  label: string
  start: number
  end: number
  colorClass: string
}

interface TimelineTrack {
  id: string
  label: string
  icon: string
  clips: TimelineClip[]
}

const CHAPTER_PIPELINE: ChapterItem[] = [
  { id: 'chapter-1', chapter: 1, title: '雨夜序曲', duration: '04:35', status: 'done', mark: '⊕' },
  { id: 'chapter-2', chapter: 2, title: '霓虹下的影子', duration: '06:12', status: 'done', mark: '⊕' },
  { id: 'chapter-3', chapter: 3, title: '机械心跳', duration: '05:48', status: 'active', progress: 60, mark: '⊕' },
  { id: 'chapter-4', chapter: 4, title: '旧城档案', duration: '06:28', status: 'pending', mark: '－' },
  { id: 'chapter-5', chapter: 5, title: '深层协议', duration: '07:01', status: 'pending', mark: '－' },
  { id: 'chapter-6', chapter: 6, title: '失控边缘', duration: '05:54', status: 'pending', mark: '－' },
  { id: 'chapter-7', chapter: 7, title: '真相碎片', duration: '06:17', status: 'pending', mark: '－' },
]

const SEGMENTS: SegmentItem[] = [
  {
    id: 'segment-1',
    order: '01',
    title: '雨夜街头',
    summary: '细雨像无数根冰冷的钢针，刺进这座城市的霓虹伤口里。',
    role: '旁白',
    mood: '冷峻 / 压抑',
    range: '00:00 - 00:18',
    duration: '18s',
    sceneClass: 'scene-a',
  },
  {
    id: 'segment-2',
    order: '02',
    title: '老爹登场',
    summary: '“别动，小子。这玩意儿比你的命还贵。”',
    role: '老爹',
    mood: '威胁 / 低沉',
    range: '00:18 - 00:32',
    duration: '14s',
    sceneClass: 'scene-b',
  },
  {
    id: 'segment-3',
    order: '03',
    title: '主角独白',
    summary: '这串代码……和父亲失踪那晚的终端记录一模一样。',
    role: '主角',
    mood: '紧张 / 疑惑',
    range: '00:32 - 00:52',
    duration: '20s',
    sceneClass: 'scene-c',
  },
]

const TIMELINE_TICKS = ['00:00', '00:10', '00:20', '00:30', '00:40', '00:50', '01:00', '01:10']

const TIMELINE_TRACKS: TimelineTrack[] = [
  {
    id: 'narration',
    label: '旁白轨',
    icon: '🎙',
    clips: [{ id: 'nar-1', label: '旁白：细雨像无数根冰冷的钢针...', start: 0, end: 28, colorClass: 'clip-narration' }],
  },
  {
    id: 'character-father',
    label: '角色轨 · 老爹',
    icon: '🧍',
    clips: [{ id: 'char-1', label: '老爹：别动，小子。', start: 28, end: 60, colorClass: 'clip-character-a' }],
  },
  {
    id: 'character-main',
    label: '角色轨 · 主角',
    icon: '🧍',
    clips: [{ id: 'char-2', label: '主角：这串代码...', start: 45, end: 78, colorClass: 'clip-character-b' }],
  },
  {
    id: 'sfx',
    label: '音效轨',
    icon: '🔊',
    clips: [
      { id: 'sfx-1', label: '雨声（中）', start: 0, end: 20, colorClass: 'clip-sfx' },
      { id: 'sfx-2', label: '金属摩擦', start: 20, end: 38, colorClass: 'clip-sfx' },
      { id: 'sfx-3', label: '脚步声（远处）', start: 38, end: 58, colorClass: 'clip-sfx' },
      { id: 'sfx-4', label: '电子滴答', start: 58, end: 76, colorClass: 'clip-sfx' },
    ],
  },
  {
    id: 'bgm',
    label: '音乐轨',
    icon: '🎵',
    clips: [
      { id: 'bgm-1', label: 'Dark Ambient 01（淡入）', start: 0, end: 52, colorClass: 'clip-bgm' },
      { id: 'bgm-2', label: 'Dark Ambient 01（淡出）', start: 52, end: 78, colorClass: 'clip-bgm' },
    ],
  },
]

const DIRECTOR_PROMPT = `你是一位专业的音频导演，请根据小说内容进行音频改编。
风格：赛博朋克、悬疑、黑暗氛围
节奏：前期舒缓，逐步推进，高潮强烈
旁白：冷峻、克制、电影感
角色：区分度明显，符合人物性格
音乐：氛围感强，适时推进情绪
音效：增强沉浸感，贴合场景变化`

function getChapterStateLabel(status: ChapterState) {
  if (status === 'done') return '已完成'
  if (status === 'active') return '生成中'
  return '待生成'
}

function getChapterStateClass(status: ChapterState) {
  if (status === 'done') return 'is-done'
  if (status === 'active') return 'is-active'
  return 'is-pending'
}

export default function MediaStudioPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const currentProject = useProjectStore((state) => state.currentProject)
  const [searchParams, setSearchParams] = useSearchParams()

  const [emotionDepth, setEmotionDepth] = useState(70)
  const [tempo, setTempo] = useState(1.05)
  const [musicRatio, setMusicRatio] = useState(35)
  const [narrationRatio, setNarrationRatio] = useState(45)
  const [sfxDensity, setSfxDensity] = useState(50)
  const [pausePreference, setPausePreference] = useState<'short' | 'mid' | 'long'>('mid')
  const [aiOptions, setAiOptions] = useState({
    autoIdentifyRole: true,
    autoMatchVoice: true,
    autoAddMusic: true,
    autoAddSfx: true,
    autoTuneEmotion: true,
  })

  const selectedChapterId = searchParams.get('chapter') ?? 'chapter-3'
  const selectedChapter = CHAPTER_PIPELINE.find((chapter) => chapter.id === selectedChapterId) ?? CHAPTER_PIPELINE[2]
  const chapterCount = currentProject?.chapter_count ?? 12
  const projectLabel = currentProject?.name?.trim() || `Project-${projectId}`

  const handleSelectChapter = (chapterId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('chapter', chapterId)
    setSearchParams(next, { replace: true })
  }

  const toggleAiOption = (key: keyof typeof aiOptions) => {
    setAiOptions((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <div className="mw-page">
      <aside className="mw-directory mw-panel">
        <header className="mw-directory__head">
          <h2>章节音频生产线</h2>
          <p>共 {chapterCount} 章 | 已完成 3 章 | 总时长 2:15:34</p>
        </header>

        <div className="mw-chapter-list">
          {CHAPTER_PIPELINE.map((chapter) => (
            <button
              key={chapter.id}
              type="button"
              className={`mw-chapter-item ${chapter.id === selectedChapter.id ? 'is-selected' : ''}`}
              onClick={() => handleSelectChapter(chapter.id)}
            >
              <div className="mw-chapter-item__title-row">
                <div className="mw-chapter-item__title-line">
                  <span className="mw-chapter-item__index">第{chapter.chapter}章</span>
                  <p className="mw-chapter-item__title">{chapter.title}</p>
                </div>
                <div className="mw-chapter-item__right">
                  <span>{chapter.duration}</span>
                  <em>{chapter.mark}</em>
                </div>
              </div>
              <div className="mw-chapter-item__status-row">
                <span className={`mw-status-pill ${getChapterStateClass(chapter.status)}`}>{getChapterStateLabel(chapter.status)}</span>
                {chapter.status === 'active' && <span>{chapter.progress}%</span>}
              </div>
            </button>
          ))}
          <p className="mw-chapter-list__ellipsis">…</p>
        </div>

        <section className="mw-directory-footer">
          <button type="button" className="mw-directory-action is-accent">
            批量生成后续章节
            <span>▾</span>
          </button>

          <button type="button" className="mw-directory-action">
            <IconDownload size={15} stroke={2} />
            导出整本音频书
          </button>

          <section className="mw-progress-block">
            <h4>整本书生成进度</h4>
            <div className="mw-progress-row">
              <div className="mw-progress-track">
                <span style={{ width: '25%' }} />
              </div>
              <strong>25%</strong>
            </div>
            <p>项目：{projectLabel}</p>
            <p>预计剩余时间：<em>1小时32分钟</em></p>
          </section>

          <button type="button" className="mw-directory-action">
            <IconDownload size={15} stroke={2} />
            生成任务队列（2）
          </button>
        </section>
      </aside>

      <main className="mw-main">
        <section className="mw-script-panel mw-panel">
          <div className="mw-script-panel__head">
            <div className="mw-script-tabs">
              <button type="button" className="is-active">音频制作</button>
              <button type="button">章节原文</button>
            </div>
            <div className="mw-script-summary">字数：5,812 · 预计时长：{selectedChapter.duration}</div>
          </div>

          <div className="mw-script-title-row">
            <h3>音频脚本（AI 生成）</h3>
            <div className="mw-chip-row">
              <span>场景划分已完成</span>
              <span>人物台词已完成</span>
            </div>
          </div>

          <div className="mw-segment-table">
            <div className="mw-segment-table__head">
              <span>段落</span>
              <span>内容摘要</span>
              <span>角色</span>
              <span>情绪/语气</span>
              <span>时长</span>
              <span>操作</span>
            </div>

            {SEGMENTS.map((segment) => (
              <div key={segment.id} className="mw-segment-row">
                <div className="mw-segment-index">{segment.order}</div>
                <div className="mw-segment-summary">
                  <div className={`mw-scene-preview ${segment.sceneClass}`} aria-hidden="true" />
                  <div>
                    <strong>{segment.title}</strong>
                    <p>{segment.summary}</p>
                  </div>
                </div>
                <span className="mw-tag role">{segment.role}</span>
                <span className="mw-tag mood">{segment.mood}</span>
                <div className="mw-segment-duration">
                  <span>{segment.range}</span>
                  <strong>{segment.duration}</strong>
                </div>
                <div className="mw-segment-actions">
                  <button type="button" aria-label="试听">▶</button>
                  <button type="button" aria-label="更多">⋮</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mw-timeline mw-panel">
          <div className="mw-timeline-toolbar">
            <div className="mw-timeline-toolbar__left" />
            <div className="mw-time-readout">00:00:23.15 / 05:48.00</div>
            <div className="mw-zoom-actions">
              <button type="button">◀</button>
              <button type="button">▶</button>
              <button type="button">▮▮</button>
              <span className="mw-slider-dot" />
              <button type="button">＋</button>
            </div>
          </div>

          <div className="mw-track-list">
            <div className="mw-track-ruler">
              <div className="mw-track-ruler__stub" />
              <div className="mw-track-ruler__ticks">
                {TIMELINE_TICKS.map((tick) => <span key={tick}>{tick}</span>)}
              </div>
            </div>

            {TIMELINE_TRACKS.map((track) => (
              <div key={track.id} className="mw-track-row">
                <div className="mw-track-label">
                  <span className="mw-track-label__icon">{track.icon}</span>
                  <span>{track.label}</span>
                </div>
                <div className="mw-track-lane">
                  {track.clips.map((clip) => (
                    <div
                      key={clip.id}
                      className={`mw-clip ${clip.colorClass}`}
                      style={{ left: `${(clip.start / 80) * 100}%`, width: `${((clip.end - clip.start) / 80) * 100}%` }}
                    >
                      {clip.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="mw-track-playhead" />
          </div>

          <div className="mw-timeline-footer">
            <button type="button">↶ 撤销</button>
            <button type="button">↷ 重做</button>
            <button type="button">✂ 剪切</button>
            <button type="button">⎘ 复制</button>
            <button type="button">✂ 分割</button>
            <button type="button">⤧ 对齐</button>
            <button type="button" className="is-active">≋ 吸附开</button>
            <button type="button">⊕ 放大</button>
            <button type="button">⊖ 缩小</button>
            <button type="button">⤢ 适应窗口</button>
          </div>
        </section>
      </main>

      <aside className="mw-inspector mw-panel">
        <div className="mw-inspector-tabs">
          <button type="button" className="is-active">AI 导演</button>
          <button type="button">全局设置</button>
        </div>

        <section className="mw-inspector-block">
          <header>
            <h4>导演指令 (Prompt)</h4>
            <button type="button" className="mw-select-btn">预设模板 ▼</button>
          </header>
          <textarea value={DIRECTOR_PROMPT} readOnly />
          <button type="button" className="mw-btn mw-btn--ghost"><IconSparkles size={14} stroke={1.8} /> 优化提示词</button>
        </section>

        <section className="mw-inspector-block">
          <h4>导演策略</h4>
          <label className="mw-slider-row">
            <span>情绪强度</span>
            <input type="range" min={0} max={100} value={emotionDepth} onChange={(event) => setEmotionDepth(Number(event.currentTarget.value))} />
            <em>{emotionDepth}%</em>
          </label>
          <label className="mw-slider-row">
            <span>节奏速度</span>
            <input type="range" min={0.8} max={1.4} step={0.01} value={tempo} onChange={(event) => setTempo(Number(event.currentTarget.value))} />
            <em>{tempo.toFixed(2)}x</em>
          </label>
          <label className="mw-slider-row">
            <span>音乐占比</span>
            <input type="range" min={0} max={100} value={musicRatio} onChange={(event) => setMusicRatio(Number(event.currentTarget.value))} />
            <em>{musicRatio}%</em>
          </label>
          <label className="mw-slider-row">
            <span>旁白占比</span>
            <input type="range" min={0} max={100} value={narrationRatio} onChange={(event) => setNarrationRatio(Number(event.currentTarget.value))} />
            <em>{narrationRatio}%</em>
          </label>
          <label className="mw-slider-row">
            <span>音效密度</span>
            <input type="range" min={0} max={100} value={sfxDensity} onChange={(event) => setSfxDensity(Number(event.currentTarget.value))} />
            <em>{sfxDensity}%</em>
          </label>

          <div className="mw-pause-select">
            <span>停顿偏好</span>
            <div>
              <button type="button" className={pausePreference === 'short' ? 'is-active' : ''} onClick={() => setPausePreference('short')}>短</button>
              <button type="button" className={pausePreference === 'mid' ? 'is-active' : ''} onClick={() => setPausePreference('mid')}>中</button>
              <button type="button" className={pausePreference === 'long' ? 'is-active' : ''} onClick={() => setPausePreference('long')}>长</button>
            </div>
          </div>
        </section>

        <section className="mw-inspector-block">
          <h4>AI 能力开关</h4>
          <button type="button" className="mw-toggle-row" onClick={() => toggleAiOption('autoIdentifyRole')}>
            <span>自动识别角色</span>
            <span className={`mw-toggle ${aiOptions.autoIdentifyRole ? 'is-on' : ''}`} />
          </button>
          <button type="button" className="mw-toggle-row" onClick={() => toggleAiOption('autoMatchVoice')}>
            <span>自动匹配配音</span>
            <span className={`mw-toggle ${aiOptions.autoMatchVoice ? 'is-on' : ''}`} />
          </button>
          <button type="button" className="mw-toggle-row" onClick={() => toggleAiOption('autoAddMusic')}>
            <span>自动添加音乐</span>
            <span className={`mw-toggle ${aiOptions.autoAddMusic ? 'is-on' : ''}`} />
          </button>
          <button type="button" className="mw-toggle-row" onClick={() => toggleAiOption('autoAddSfx')}>
            <span>自动添加音效</span>
            <span className={`mw-toggle ${aiOptions.autoAddSfx ? 'is-on' : ''}`} />
          </button>
          <button type="button" className="mw-toggle-row" onClick={() => toggleAiOption('autoTuneEmotion')}>
            <span>自动情绪调整</span>
            <span className={`mw-toggle ${aiOptions.autoTuneEmotion ? 'is-on' : ''}`} />
          </button>
        </section>

        <button type="button" className="mw-apply-btn"><IconVolume size={16} stroke={1.8} /> 应用并重新导演</button>
      </aside>
    </div>
  )
}
