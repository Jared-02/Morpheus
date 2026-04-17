import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

declare const process: { env: Record<string, string | undefined> }

const API_BASE = process.env.E2E_API_BASE_URL || 'http://localhost:8000/api'
const SCREENSHOT_DIR = '../output/playwright'

const VIEWPORTS = {
  desktop: { width: 1728, height: 1117 },
  narrow: { width: 1280, height: 960 },
  mobile: { width: 430, height: 932 },
} as const

async function createProjectFromModal(page: Page, name: string) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '创作项目' })).toBeVisible()

  await page.getByRole('button', { name: '新建项目' }).click()
  const modal = page.locator('.modal-card').first()
  await expect(modal).toBeVisible()

  await modal.getByLabel('项目名称').fill(name)
  await modal.getByPlaceholder('例如：赛博修仙 / 太空歌剧 / 克苏鲁').fill('太空歌剧')
  await modal.getByRole('textbox', { name: '文风契约' }).fill('冷峻现实主义')
  await modal.getByRole('button', { name: '创建项目' }).click()
  await expect(modal).toHaveCount(0)

  const card = page.locator('.project-card', { hasText: name }).first()
  await expect(card).toBeVisible({ timeout: 15000 })
  await card.locator('h2').click()

  await expect(page).toHaveURL(/\/project\//)
  const match = page.url().match(/\/project\/([^/?#]+)/)
  if (!match) throw new Error(`Cannot parse project id from ${page.url()}`)
  return match[1]
}

async function createChapterAndOpenWorkbench(page: Page) {
  await page.getByRole('button', { name: '新建章节' }).click()
  const modal = page.locator('.modal-card').first()
  await expect(modal).toBeVisible()

  await modal.locator('input[type="number"]').fill('1')
  await modal.locator('input.input').nth(1).fill('第一章')
  await modal.locator('textarea').fill('用于 Phase 0 基线路径的测试章节')
  await modal.getByRole('button', { name: '创建并进入' }).click()

  await expect(page.getByRole('heading', { name: /第\s*1\s*章/ })).toBeVisible({ timeout: 15000 })
  const match = page.url().match(/\/chapter\/([^/?#]+)/)
  if (!match) throw new Error(`Cannot parse chapter id from ${page.url()}`)
  return match[1]
}

async function saveChapterDraft(page: Page, request: APIRequestContext, chapterId: string) {
  const editor = page.locator('.workbench-channel-viewer__textarea')
  await expect(editor).toBeVisible()
  await editor.fill('Phase 0 保存基线正文。')
  await page.getByRole('button', { name: '保存编辑并重检' }).click()

  await expect(page.getByText('草稿保存成功')).toBeVisible({ timeout: 15000 })

  const chapterRes = await request.get(`${API_BASE}/chapters/${chapterId}`)
  expect(chapterRes.ok()).toBeTruthy()
  const chapterPayload = await chapterRes.json()
  expect(String(chapterPayload.draft || '')).toContain('Phase 0 保存基线正文。')
}

async function captureCriticalPath(page: Page, request: APIRequestContext, viewportKey: string) {
  const projectName = `Phase0基线-${viewportKey}-${Date.now()}`
  let projectId: string | null = null

  try {
    projectId = await createProjectFromModal(page, projectName)
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOT_DIR}/phase0_${viewportKey}_01_project-detail.png`, fullPage: true })

    await page.goto(`/project/${projectId}/write`)
    await expect(page.getByRole('heading', { name: '创作控制台' })).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOT_DIR}/phase0_${viewportKey}_02_write.png`, fullPage: true })

    await page.goto(`/project/${projectId}`)
    const chapterId = await createChapterAndOpenWorkbench(page)
    await saveChapterDraft(page, request, chapterId)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/phase0_${viewportKey}_03_chapter-save.png`, fullPage: true })

    await page.goto(`/project/${projectId}/graph`)
    await expect(page.getByRole('heading', { name: '知识图谱' })).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOT_DIR}/phase0_${viewportKey}_04_graph.png`, fullPage: true })

    await page.goto(`/project/${projectId}/trace`)
    await expect(page.getByRole('heading', { name: /决策回放/ })).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOT_DIR}/phase0_${viewportKey}_05_trace.png`, fullPage: true })
  } finally {
    if (projectId) {
      await request.delete(`${API_BASE}/projects/${projectId}`)
    }
  }
}

for (const [viewportKey, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`workspace foundation ${viewportKey}`, () => {
    test.use({ viewport })

    test(`covers critical path on ${viewportKey}`, async ({ page, request }) => {
      await captureCriticalPath(page, request, viewportKey)
    })
  })
}
