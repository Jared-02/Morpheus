export interface Conflict {
  id: string
  severity: 'P0' | 'P1' | 'P2'
  rule_id: string
  reason: string
  suggested_fix?: string
  evidence_paths?: string[]
  resolved?: boolean
  exempted?: boolean
}

export interface Plan {
  beats: string[]
  conflicts: string[]
  foreshadowing: string[]
  callback_targets: string[]
  role_goals: Record<string, string>
}

export interface PlanQuality {
  status: 'ok' | 'warn' | 'bad' | string
  score: number
  parser_source?: string
  used_fallback?: boolean
  retried?: boolean
  attempts?: number
  template_phrase_hits?: number
  defaulted_fields?: string[]
  issues?: string[]
  warnings?: string[]
}

export interface PlanQualityDebug {
  selected_source?: string
  initial_output_length?: number
  retry_output_length?: number
  initial_output_preview?: string
}

export interface Chapter {
  id: string
  chapter_number: number
  title: string
  goal: string
  plan?: Plan
  plan_quality?: PlanQuality | null
  draft?: string
  final?: string
  status: string
  word_count: number
  conflicts: Conflict[]
}

export const chapterStatusMeta: Record<string, { label: string; hint: string }> = {
  draft: { label: '草稿中', hint: '下一步：完善正文并保存，保存后可进入审核。' },
  reviewing: { label: '待审核', hint: '下一步：先处理冲突项，再提交审批。' },
  revised: { label: '已退回', hint: '下一步：根据退回意见修改，完成后重新提交审批。' },
  approved: { label: '已审批', hint: '当前已审批：如需继续修改，请先重新打开审核。' },
}

export type StreamChannel = 'arbiter' | 'director' | 'setter' | 'stylist'
export type StreamSideChannelText = Record<'director' | 'setter' | 'stylist', string>

export const EMPTY_STREAM_SIDE_CHANNEL_TEXT: StreamSideChannelText = {
  director: '',
  setter: '',
  stylist: '',
}

interface TraceDecisionPayload {
  agent_role?: string
  decision_text?: string
}

export interface TracePayload {
  decisions?: TraceDecisionPayload[]
  channel_snapshot?: Partial<Record<StreamChannel, string>>
}

function sanitizeTraceDecisionText(value?: string) {
  if (!value) return ''
  return value
    .replace(/<\s*think(?:ing)?\s*>[\s\S]*?<\s*\/\s*think(?:ing)?\s*>/gi, '')
    .replace(/```(?:thinking|reasoning)\s*[\s\S]*?```/gi, '')
    .replace(/^\s*(thinking|thoughts?|reasoning)\s*[:：].*(?:\n|$)/gim, '')
    .trim()
}

export function buildStreamSideChannelText(trace?: TracePayload | null): StreamSideChannelText {
  const base: StreamSideChannelText = { ...EMPTY_STREAM_SIDE_CHANNEL_TEXT }
  if (!trace) return base

  const snapshot = trace.channel_snapshot || {}
  for (const channel of ['director', 'setter', 'stylist'] as const) {
    const text = snapshot[channel]
    if (typeof text === 'string' && text.trim()) {
      base[channel] = sanitizeTraceDecisionText(text)
    }
  }

  for (const decision of trace.decisions || []) {
    const role = String(decision.agent_role || '').trim().toLowerCase()
    if (role !== 'director' && role !== 'setter' && role !== 'stylist') continue
    const text = sanitizeTraceDecisionText(decision.decision_text)
    if (!text) continue
    base[role] = text
  }

  return base
}

type BlueprintDetailItem = {
  title: string
  detail: string
}

export type BlueprintValueCard = {
  headline: string
  body: string
}

export type FanqieCreateFormState = {
  intro: string
  protagonist1: string
  protagonist2: string
  targetReader: 'male' | 'female'
  tagsByTab: {
    mainCategory: string
    theme: string
    role: string
    plot: string
  }
}

export const DEFAULT_FANQIE_TAGS = {
  mainCategory: '悬疑脑洞',
  theme: '赛博朋克',
  role: '神探',
  plot: '惊悚游戏',
}

const FANQIE_LOGIN_REQUIRED_CODE = 'FANQIE_LOGIN_REQUIRED'

function splitFanqieTagInput(value: string, maxItems: number) {
  return String(value || '')
    .split(/[,\n，]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
}

export function buildFanqieTagsPayload(form: FanqieCreateFormState['tagsByTab']) {
  return {
    主分类: splitFanqieTagInput(form.mainCategory, 1),
    主题: splitFanqieTagInput(form.theme, 2),
    角色: splitFanqieTagInput(form.role, 2),
    情节: splitFanqieTagInput(form.plot, 2),
  }
}

export function normalizeFanqieTagField(value: unknown, fallback: string, maxItems: number) {
  const text = Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, maxItems).join(', ')
    : String(value || '').trim()
  return text || fallback
}

export function getApiErrorDetail(detailRaw: unknown, fallback: string) {
  if (typeof detailRaw === 'string' && detailRaw.trim()) return detailRaw
  if (detailRaw && typeof detailRaw === 'object') {
    const message = String((detailRaw as any).message || '').trim()
    if (message) return message
  }
  return fallback
}

export function parseFanqieLoginRequired(detailRaw: unknown) {
  if (!detailRaw || typeof detailRaw !== 'object') return null
  const errorCode = String((detailRaw as any).error_code || '').trim()
  if (errorCode !== FANQIE_LOGIN_REQUIRED_CODE) return null
  const loginFlowRaw = String((detailRaw as any).login_flow || '').trim().toLowerCase()
  return {
    message: String((detailRaw as any).message || '请先登录番茄作者后台').trim(),
    loginFlow: loginFlowRaw === 'publish-chapter' ? 'publish-chapter' : 'create-book' as 'publish-chapter' | 'create-book',
  }
}

const BLUEPRINT_NOISE_TOKENS = new Set([
  'id',
  'description',
  'type',
  'item',
  'target',
  'source_chapter',
  'potential_use',
])

export function cleanBlueprintText(raw: string): string {
  const text = String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/^[-•*]\s*/, '')
    .trim()
  if (!text) return ''
  if (BLUEPRINT_NOISE_TOKENS.has(text.toLowerCase())) return ''
  return text
}

export function parseBlueprintDetailItems(
  values: string[],
  options: {
    titleKeys: string[]
    detailKeys: string[]
    ignoreKeys?: string[]
  },
): BlueprintDetailItem[] {
  const normalizeKey = (raw: string) =>
    String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[：:]/g, '')
      .replace(/\s+/g, '_')

  const titleKeys = new Set(options.titleKeys.map(normalizeKey))
  const detailKeys = new Set(options.detailKeys.map(normalizeKey))
  const ignoreKeys = new Set((options.ignoreKeys || []).map(normalizeKey))
  const items: BlueprintDetailItem[] = []
  const flattenedTokens: string[] = []

  for (const raw of values) {
    const source = String(raw || '')
    if (!source.trim()) continue
    const bySlash = source
      .split(/\s*\/\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
    if (bySlash.length > 1) {
      flattenedTokens.push(...bySlash)
      continue
    }
    const byLine = source
      .split(/\r?\n/)
      .map((part) => part.trim())
      .filter(Boolean)
    if (byLine.length > 1) {
      flattenedTokens.push(...byLine)
      continue
    }
    flattenedTokens.push(source.trim())
  }

  let currentTitle = ''
  let currentDetail = ''
  const pushCurrent = () => {
    const title = cleanBlueprintText(currentTitle)
    const detail = cleanBlueprintText(currentDetail)
    if (!title && !detail) return
    items.push({
      title: title || '未命名线索',
      detail: detail || '',
    })
    currentTitle = ''
    currentDetail = ''
  }

  for (let index = 0; index < flattenedTokens.length; index += 1) {
    const token = flattenedTokens[index]
    const key = normalizeKey(token)
    const next = index + 1 < flattenedTokens.length ? flattenedTokens[index + 1] : ''

    if (titleKeys.has(key)) {
      if (currentTitle || currentDetail) pushCurrent()
      currentTitle = next
      currentDetail = ''
      index += 1
      continue
    }
    if (detailKeys.has(key)) {
      currentDetail = next
      index += 1
      continue
    }
    if (ignoreKeys.has(key)) {
      index += 1
      continue
    }

    const cleaned = cleanBlueprintText(token)
    if (!cleaned) continue
    if (!currentTitle) {
      currentTitle = cleaned
      continue
    }
    if (!currentDetail) {
      currentDetail = cleaned
      continue
    }
    pushCurrent()
    currentTitle = cleaned
  }
  if (currentTitle || currentDetail) {
    pushCurrent()
  }

  const deduped = new Map<string, BlueprintDetailItem>()
  for (const item of items) {
    const key = `${item.title}|||${item.detail}`
    if (!deduped.has(key)) deduped.set(key, item)
  }

  return Array.from(deduped.values())
}
