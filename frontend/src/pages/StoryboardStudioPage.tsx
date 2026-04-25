import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useProjectStore } from '../stores/useProjectStore'
import './StoryboardStudioPage.css'

type ChapterStatus = 'done' | 'working' | 'pending'

interface StoryChapter {
  id: string
  chapterNumber: number
  title: string
  duration: string
  minutes: number
  status: ChapterStatus
  progress?: number
}

interface SceneCard {
  id: string
  code: string
  duration: string
  title: string
  summary: string
  role: string
  mood: string
  camera: string
  effect: string
  source: string
  voice: string
  subtitle: string
  range: string
  imageClass: string
}

interface TimelineClip {
  id: string
  label: string
  start: number
  end: number
  className: string
}

interface TimelineTrack {
  id: string
  label: string
  icon: string
  clips: TimelineClip[]
}

const FALLBACK_CHAPTERS: StoryChapter[] = [
  { id: 'chapter-1', chapterNumber: 1, title: '雨夜序曲', duration: '05:48', minutes: 12, status: 'done' },
  { id: 'chapter-2', chapterNumber: 2, title: '霓虹下的影子', duration: '07:32', minutes: 15, status: 'done' },
  { id: 'chapter-3', chapterNumber: 3, title: '机械心跳', duration: '08:21', minutes: 18, status: 'working', progress: 60 },
  { id: 'chapter-4', chapterNumber: 4, title: '虚拟之心', duration: '09:45', minutes: 20, status: 'pending' },
  { id: 'chapter-5', chapterNumber: 5, title: '失控边缘', duration: '07:18', minutes: 16, status: 'pending' },
  { id: 'chapter-6', chapterNumber: 6, title: '终章·重启', duration: '08:50', minutes: 16, status: 'pending' },
]

const SCENE_CARDS: SceneCard[] = [
  {
    id: 'scene-1',
    code: '01',
    duration: '5.2s',
    title: 'Scene 01',
    summary: '雨一直下，仿佛这座城市在哭泣。',
    role: '夜行者',
    mood: '冷峻 / 压抑 / 紧张',
    camera: '慢推近',
    effect: '雨滴 / 灯光',
    source: '第3章·片段01',
    voice: '夜行者·男声（低沉）',
    subtitle: '自动匹配',
    range: '00:00 - 00:05.2',
    imageClass: 'scene-a',
  },
  {
    id: 'scene-2',
    code: '02',
    duration: '6.1s',
    title: 'Scene 02',
    summary: '她的眼神里藏着秘密，也藏着这座城市的真相。',
    role: '夜行者',
    mood: '冷峻 / 压抑 / 紧张',
    camera: '中景跟随',
    effect: '雨滴 / 霓虹闪烁',
    source: '第3章·片段02',
    voice: '夜行者·男声（低沉）',
    subtitle: '自动匹配',
    range: '00:05.2 - 00:11.3',
    imageClass: 'scene-b',
  },
  {
    id: 'scene-3',
    code: '03',
    duration: '4.0s',
    title: 'Scene 03',
    summary: '巨幕上的她在注视着我，每一帧都像未解的谜题。',
    role: '夜行者',
    mood: '冷峻 / 压抑 / 紧张',
    camera: '慢推近',
    effect: '屏幕闪烁 / 光影切换',
    source: '第3章·片段03',
    voice: '夜行者·男声（低沉）',
    subtitle: '自动匹配',
    range: '00:11.3 - 00:16.1',
    imageClass: 'scene-c',
  },
  {
    id: 'scene-4',
    code: '04',
    duration: '5.0s',
    title: 'Scene 04',
    summary: '机械的心脏在跳动，我，还要机遇？',
    role: '夜行者',
    mood: '冷峻 / 紧张',
    camera: '特写',
    effect: '机械运转 / 红灯闪烁',
    source: '第3章·片段04',
    voice: '夜行者·男声（低沉）',
    subtitle: '自动匹配',
    range: '00:16.1 - 00:21.1',
    imageClass: 'scene-d',
  },
]

const RULER_TICKS = [
  '00:00',
  '00:05',
  '00:10',
  '00:15',
  '00:20',
  '00:25',
  '00:30',
  '00:35',
  '00:40',
  '00:45',
  '00:50',
  '00:55',
  '01:00',
  '01:05',
  '01:10',
]

const TIMELINE_SCENES: TimelineClip[] = [
  { id: 'timeline-s1', label: 'Scene01\n5.2s', start: 0, end: 7, className: 'is-scene' },
  { id: 'timeline-s2', label: 'Scene02\n6.1s', start: 7, end: 15, className: 'is-scene' },
  { id: 'timeline-s3', label: 'Scene03\n4.8s', start: 15, end: 21, className: 'is-scene' },
  { id: 'timeline-s4', label: 'Scene04\n6.0s', start: 21, end: 29, className: 'is-scene' },
  { id: 'timeline-s5', label: 'Scene05\n5.3s', start: 29, end: 36, className: 'is-scene-alt' },
  { id: 'timeline-s6', label: 'Scene06\n6.7s', start: 36, end: 45, className: 'is-scene-alt' },
  { id: 'timeline-s7', label: 'Scene07\n6.6s', start: 45, end: 54, className: 'is-scene' },
  { id: 'timeline-s8', label: 'Scene08\n3.9s', start: 54, end: 60, className: 'is-scene' },
]

const TIMELINE_TRACKS: TimelineTrack[] = [
  {
    id: 'dialog',
    label: '对齐轨（角色）',
    icon: '🎙',
    clips: [
      { id: 'd1', label: '夜行者·男声（低沉）', start: 0, end: 14, className: 'is-dialog' },
      { id: 'd2', label: '夜行者·女声（温冷）', start: 15, end: 30, className: 'is-dialog-alt' },
      { id: 'd3', label: '夜行者·男声（低沉）', start: 32, end: 47, className: 'is-dialog' },
      { id: 'd4', label: '夜行者·男声（低沉）', start: 48, end: 60, className: 'is-dialog' },
    ],
  },
  {
    id: 'sfx',
    label: '音效轨（环境）',
    icon: '🔗',
    clips: [
      { id: 'sfx1', label: '雨声（中）', start: 0, end: 14, className: 'is-sfx' },
      { id: 'sfx2', label: '脚步声（远处）', start: 16, end: 30, className: 'is-sfx' },
      { id: 'sfx3', label: '机械运转', start: 31, end: 42, className: 'is-sfx' },
      { id: 'sfx4', label: '电子滴答', start: 43, end: 52, className: 'is-sfx' },
      { id: 'sfx5', label: '风声（强）', start: 53, end: 60, className: 'is-sfx' },
    ],
  },
  {
    id: 'bgm',
    label: '音乐轨（BGM）',
    icon: '🎵',
    clips: [
      { id: 'bgm1', label: 'Dark Ambient 01（淡入）', start: 0, end: 30, className: 'is-bgm' },
      { id: 'bgm2', label: 'Dark Ambient 01（推进）', start: 31, end: 60, className: 'is-bgm' },
    ],
  },
]

const DIRECTOR_PROMPT = `赛博朋克风格，冷色调，雨夜，霓虹灯。
未来城市，高楼林立，光影对比强烈，电影级构图，画面细节丰富。
营造冷峻、压抑、紧张的氛围。`

function mapChapterStatus(rawStatus: string): ChapterStatus {
  const status = rawStatus.toLowerCase()
  if (status.includes('done') || status.includes('complete') || status.includes('finished')) return 'done'
  if (status.includes('generating') || status.includes('running') || status.includes('active')) return 'working'
  return 'pending'
}

function getStatusText(status: ChapterStatus) {
  if (status === 'done') return '已完成'
  if (status === 'working') return '制作中'
  return '未生成'
}

function getStatusClass(status: ChapterStatus) {
  if (status === 'done') return 'is-done'
  if (status === 'working') return 'is-working'
  return 'is-pending'
}

export default function StoryboardStudioPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const chapters = useProjectStore((state) => state.chapters)
  const fetchChapters = useProjectStore((state) => state.fetchChapters)

  const [visualPower, setVisualPower] = useState(70)
  const [splitDensity, setSplitDensity] = useState(60)
  const [cutFrequency, setCutFrequency] = useState(50)
  const [subtitlePower, setSubtitlePower] = useState(80)
  const [narrationSpeed, setNarrationSpeed] = useState(6.1)
  const [audioMood, setAudioMood] = useState(70)
  const [ambienceDensity, setAmbienceDensity] = useState(50)

  const [autoSwitches, setAutoSwitches] = useState({
    autoStoryboard: true,
    autoSplit: true,
    autoSubtitle: true,
    autoVoice: true,
    autoColor: true,
    autoAmbience: true,
  })

  useEffect(() => {
    if (!projectId) return
    void fetchChapters(projectId)
  }, [projectId, fetchChapters])

  const chapterPipeline = useMemo(() => {
    if (!chapters.length) return FALLBACK_CHAPTERS

    return chapters
      .slice()
      .sort((a, b) => a.chapter_number - b.chapter_number)
      .map((chapter) => ({
        id: chapter.id,
        chapterNumber: chapter.chapter_number,
        title: chapter.title || `第${chapter.chapter_number}章`,
        duration: '--:--',
        minutes: Math.max(8, Math.round((chapter.word_count || 2800) / 220)),
        status: mapChapterStatus(chapter.status || ''),
        progress: mapChapterStatus(chapter.status || '') === 'working' ? 60 : undefined,
      }))
  }, [chapters])

  const selectedChapterId = searchParams.get('chapter')
  const selectedChapter =
    chapterPipeline.find((chapter) => chapter.id === selectedChapterId)
    ?? chapterPipeline.find((chapter) => chapter.status === 'working')
    ?? chapterPipeline[0]

  const completedChapters = chapterPipeline.filter((chapter) => chapter.status === 'done').length

  const handleSelectChapter = (chapterId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('chapter', chapterId)
    setSearchParams(next, { replace: true })
  }

  const toggleSwitch = (key: keyof typeof autoSwitches) => {
    setAutoSwitches((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <div className="sbn-page">
      <aside className="sbn-panel sbn-left">
        <header className="sbn-left__head">
          <h2>章节漫剧生产线</h2>
          <p>共 {chapterPipeline.length} 章 | 已完成 {completedChapters} 章</p>
          <p>预计时长 2:15:34</p>
        </header>

        <div className="sbn-left__list">
          {chapterPipeline.map((chapter) => {
            const selected = chapter.id === selectedChapter.id
            return (
              <button
                key={chapter.id}
                type="button"
                className={`sbn-chapter-card ${selected ? 'is-selected' : ''}`}
                onClick={() => handleSelectChapter(chapter.id)}
              >
                <div className="sbn-chapter-card__title">
                  <strong>第{chapter.chapterNumber}章 · {chapter.title}</strong>
                  <span className={`sbn-status ${getStatusClass(chapter.status)}`}>{getStatusText(chapter.status)}</span>
                </div>
                <div className="sbn-chapter-card__meta">
                  <span>{chapter.minutes}个分镜</span>
                  <span>{chapter.duration}</span>
                </div>
                {chapter.status === 'working' && (
                  <div className="sbn-progress-row">
                    <div className="sbn-progress-track"><span style={{ width: `${chapter.progress ?? 0}%` }} /></div>
                    <em>{chapter.progress ?? 0}%</em>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <footer className="sbn-left__foot">
          <button type="button" className="sbn-left__action is-primary">✦ 批量生成漫剧</button>
          <button type="button" className="sbn-left__action">⇩ 批量导出漫剧</button>
          <button type="button" className="sbn-left__action">⌁ 生成任务队列</button>
        </footer>
      </aside>

      <main className="sbn-center">
        <section className="sbn-panel sbn-storyboard">
          <header className="sbn-storyboard__head">
            <div className="sbn-title-row">
              <h3>第{selectedChapter.chapterNumber}章：{selectedChapter.title}</h3>
              <span className="sbn-badge is-working">制作中</span>
            </div>
            <div className="sbn-head-actions">
              <button type="button">✓ 已保存 10:30</button>
              <button type="button">↶ 撤销</button>
              <button type="button">↻ 恢复</button>
            </div>
          </header>

          <div className="sbn-tool-row">
            <button type="button">⟳ 智能匹配字幕</button>
            <button type="button">✦ 自动分镜优化</button>
            <button type="button">◈ 重排分镜</button>
            <button type="button">分镜排序 ▾</button>
            <div className="sbn-tool-row__view">
              <button type="button" className="is-active">▦</button>
              <button type="button">☰</button>
            </div>
          </div>

          <div className="sbn-scene-grid">
            {SCENE_CARDS.map((scene) => (
              <article key={scene.id} className="sbn-scene-card">
                <div className={`sbn-scene-card__poster ${scene.imageClass}`}>
                  <span className="sbn-scene-card__index">{scene.code}</span>
                  <span className="sbn-scene-card__duration">{scene.duration}</span>
                </div>
                <div className="sbn-scene-card__body">
                  <h4>{scene.title}</h4>
                  <p>{scene.summary}</p>
                  <p><strong>角色：</strong>{scene.role}</p>
                  <p><strong>情绪：</strong>{scene.mood}</p>
                  <p><strong>镜头：</strong>{scene.camera}</p>
                  <p><strong>动效：</strong>{scene.effect}</p>
                </div>
                <div className="sbn-scene-card__meta">
                  <p><strong>来源：</strong>{scene.source}</p>
                  <p><strong>配音：</strong>{scene.voice}</p>
                  <p><strong>字幕：</strong>{scene.subtitle} <span>{scene.range}</span></p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="sbn-panel sbn-timeline">
          <header className="sbn-timeline__head">
            <h4>分镜时间线（基于音频结构自动对齐）</h4>
            <div className="sbn-timeline__zoom">
              <button type="button">🔍+</button>
              <button type="button">🔍-</button>
              <button type="button">—</button>
              <div className="sbn-mini-slider"><span /></div>
              <button type="button">适应长度</button>
            </div>
          </header>

          <div className="sbn-ruler">
            {RULER_TICKS.map((tick) => <span key={tick}>{tick}</span>)}
          </div>

          <div className="sbn-scene-lane">
            <button type="button" className="sbn-scene-play" aria-label="播放分镜时间线">▶</button>
            <div className="sbn-scene-lane__clips">
              {TIMELINE_SCENES.map((clip) => (
                <div
                  key={clip.id}
                  className={`sbn-scene-clip ${clip.className}`}
                  style={{ left: `${(clip.start / 60) * 100}%`, width: `${((clip.end - clip.start) / 60) * 100}%` }}
                >
                  {clip.label.split('\n').map((line) => <span key={line}>{line}</span>)}
                </div>
              ))}
            </div>
            <button type="button" className="sbn-add-clip">＋</button>
          </div>

          <div className="sbn-track-list">
            {TIMELINE_TRACKS.map((track) => (
              <div key={track.id} className="sbn-track-row">
                <div className="sbn-track-row__label">
                  <span>{track.icon}</span>
                  <strong>{track.label}</strong>
                </div>
                <div className="sbn-track-row__lane">
                  {track.clips.map((clip) => (
                    <div
                      key={clip.id}
                      className={`sbn-track-clip ${clip.className}`}
                      style={{ left: `${(clip.start / 60) * 100}%`, width: `${((clip.end - clip.start) / 60) * 100}%` }}
                    >
                      {clip.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="sbn-playhead" />
          </div>
        </section>
      </main>

      <aside className="sbn-panel sbn-right">
        <header className="sbn-right__head">
          <h3>AI视觉导演</h3>
          <p>当前章节：第{selectedChapter.chapterNumber}章 · {selectedChapter.title}</p>
          <p>叙事节奏：紧张递进</p>
          <p>音频基调：冷峻 / 压抑</p>
        </header>

        <section className="sbn-right__block">
          <div className="sbn-block-head">
            <h4>视觉提示词 (Prompt)</h4>
            <button type="button">预设模板 ▾</button>
          </div>
          <textarea readOnly value={DIRECTOR_PROMPT} />
          <button type="button" className="sbn-ghost-btn">✧ 优化提示词</button>
        </section>

        <section className="sbn-right__block">
          <h4>视觉参数</h4>
          <label>
            <span>动效强度</span>
            <input type="range" min={0} max={100} value={visualPower} onChange={(event) => setVisualPower(Number(event.currentTarget.value))} />
            <em>{visualPower}%</em>
          </label>
          <label>
            <span>分镜密度</span>
            <input type="range" min={0} max={100} value={splitDensity} onChange={(event) => setSplitDensity(Number(event.currentTarget.value))} />
            <em>{splitDensity}%</em>
          </label>
          <label>
            <span>转场频率</span>
            <input type="range" min={0} max={100} value={cutFrequency} onChange={(event) => setCutFrequency(Number(event.currentTarget.value))} />
            <em>{cutFrequency}%</em>
          </label>
          <label>
            <span>字幕强度</span>
            <input type="range" min={0} max={100} value={subtitlePower} onChange={(event) => setSubtitlePower(Number(event.currentTarget.value))} />
            <em>{subtitlePower}%</em>
          </label>
        </section>

        <section className="sbn-right__block">
          <h4>音频参数</h4>
          <label>
            <span>语速</span>
            <input type="range" min={1} max={8} step={0.1} value={narrationSpeed} onChange={(event) => setNarrationSpeed(Number(event.currentTarget.value))} />
            <em>{narrationSpeed.toFixed(2)}x</em>
          </label>
          <label>
            <span>情绪强度</span>
            <input type="range" min={0} max={100} value={audioMood} onChange={(event) => setAudioMood(Number(event.currentTarget.value))} />
            <em>{audioMood}%</em>
          </label>
          <label>
            <span>环境音强度</span>
            <input type="range" min={0} max={100} value={ambienceDensity} onChange={(event) => setAmbienceDensity(Number(event.currentTarget.value))} />
            <em>{ambienceDensity}%</em>
          </label>
        </section>

        <section className="sbn-right__block">
          <h4>智能生成选项</h4>
          <button type="button" className="sbn-toggle-row" onClick={() => toggleSwitch('autoStoryboard')}>
            <span>自动生成插图</span>
            <span className={`sbn-toggle ${autoSwitches.autoStoryboard ? 'is-on' : ''}`} />
          </button>
          <button type="button" className="sbn-toggle-row" onClick={() => toggleSwitch('autoSplit')}>
            <span>自动分镜</span>
            <span className={`sbn-toggle ${autoSwitches.autoSplit ? 'is-on' : ''}`} />
          </button>
          <button type="button" className="sbn-toggle-row" onClick={() => toggleSwitch('autoSubtitle')}>
            <span>自动字幕</span>
            <span className={`sbn-toggle ${autoSwitches.autoSubtitle ? 'is-on' : ''}`} />
          </button>
          <button type="button" className="sbn-toggle-row" onClick={() => toggleSwitch('autoVoice')}>
            <span>自动匹配音频</span>
            <span className={`sbn-toggle ${autoSwitches.autoVoice ? 'is-on' : ''}`} />
          </button>
          <button type="button" className="sbn-toggle-row" onClick={() => toggleSwitch('autoColor')}>
            <span>自动匹配角色音色</span>
            <span className={`sbn-toggle ${autoSwitches.autoColor ? 'is-on' : ''}`} />
          </button>
          <button type="button" className="sbn-toggle-row" onClick={() => toggleSwitch('autoAmbience')}>
            <span>自动生成环境音</span>
            <span className={`sbn-toggle ${autoSwitches.autoAmbience ? 'is-on' : ''}`} />
          </button>
        </section>

        <button type="button" className="sbn-apply-btn">✦ 应用并生成漫剧</button>
        <p className="sbn-estimate">预计耗时：2分18秒（18个分镜）</p>
      </aside>
    </div>
  )
}
