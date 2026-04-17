import type { GenerationForm } from '../../stores/useStreamStore'

export const MODE_LABELS: Record<string, string> = {
  studio: '工作室',
  quick: '快速',
  cinematic: '电影感',
}

export const CHAPTER_COUNT_RULE = { min: 1, max: 60, hint: '推荐 8-12 章' } as const
export const WORDS_PER_CHAPTER_RULE = { min: 300, max: 12000, hint: '推荐 1200-2000 字' } as const
export const CONTINUATION_FALLBACK_PROMPT = '延续当前故事，推进未决冲突与人物关系，章尾保留下一章触发点。'

export type PersistedWritingSettings = Pick<
  GenerationForm,
  'mode' | 'chapter_count' | 'words_per_chapter' | 'auto_approve'
>

export function isDigitsOnly(value: string) {
  return /^\d*$/.test(value)
}

export function hasInvalidAdvancedSettings(form: Pick<GenerationForm, 'chapter_count' | 'words_per_chapter'>) {
  return form.chapter_count < CHAPTER_COUNT_RULE.min
    || form.chapter_count > CHAPTER_COUNT_RULE.max
    || form.words_per_chapter < WORDS_PER_CHAPTER_RULE.min
    || form.words_per_chapter > WORDS_PER_CHAPTER_RULE.max
}

export function normalizePersistedSettings(raw: unknown): PersistedWritingSettings | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<Record<keyof PersistedWritingSettings, unknown>>

  const mode = data.mode === 'studio' || data.mode === 'quick' || data.mode === 'cinematic' ? data.mode : null
  const chapterCountNum = typeof data.chapter_count === 'number' ? data.chapter_count : Number(data.chapter_count)
  const wordsNum = typeof data.words_per_chapter === 'number' ? data.words_per_chapter : Number(data.words_per_chapter)
  const autoApprove = typeof data.auto_approve === 'boolean' ? data.auto_approve : true

  if (!mode || Number.isNaN(chapterCountNum) || Number.isNaN(wordsNum)) return null

  return {
    mode,
    chapter_count: Math.max(CHAPTER_COUNT_RULE.min, Math.min(CHAPTER_COUNT_RULE.max, Math.floor(chapterCountNum))),
    words_per_chapter: Math.max(WORDS_PER_CHAPTER_RULE.min, Math.min(WORDS_PER_CHAPTER_RULE.max, Math.floor(wordsNum))),
    auto_approve: autoApprove,
  }
}

function stripDuplicateChapterHeading(text: string, chapterNumber: number, chapterTitle: string): string {
  const source = String(text || '').trim()
  if (!source) return ''
  const lines = source.split(/\r?\n/)
  const firstLine = lines[0]?.trim() ?? ''
  const title = chapterTitle.trim()
  if (!title) return source

  const firstLineCompact = firstLine.replace(/\s+/g, '')
  const headingCompact = `第${chapterNumber}章${title}`.replace(/\s+/g, '')
  if (firstLineCompact === headingCompact || firstLine === title) {
    return lines.slice(1).join('\n').trim()
  }
  return source
}

export function dedupeStringItems(items: string[]) {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const occurrence = seen.get(item) ?? 0
    seen.set(item, occurrence + 1)
    return { key: `${item}-${occurrence}`, value: item }
  })
}

export function composeSectionBody(
  body: string,
  chapterNumber: number,
  chapterTitle: string,
  waiting: boolean,
): { narrativeBody: string; displayBody: string; exportBody: string } {
  const narrative = stripDuplicateChapterHeading(body, chapterNumber, chapterTitle)
  const exportBody = narrative.trim()
  return {
    narrativeBody: narrative,
    exportBody,
    displayBody: exportBody || (waiting ? '> 正在生成这一章，请稍候...' : ''),
  }
}
