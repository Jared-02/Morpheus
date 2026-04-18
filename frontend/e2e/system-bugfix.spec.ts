import { expect, test, type Page } from '@playwright/test'

declare const process: { env: Record<string, string | undefined> }

const API_BASE = process.env.E2E_API_BASE_URL || 'http://localhost:8000/api'
const SCREENSHOT_DIR = '../output/playwright'

async function createProjectFromModal(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: '新建项目' }).click()

  const modal = page.locator('.modal-card')
  await expect(modal).toBeVisible()

  await modal.locator('input').first().fill(name)

  const genreInput = modal.getByPlaceholder('例如：赛博修仙 / 太空歌剧 / 克苏鲁')
  await genreInput.fill('太空歌剧')
  await expect(genreInput).toBeFocused()

  const styleInput = modal.getByRole('textbox', { name: '文风契约' })
  await styleInput.fill('冷峻现实主义')
  await expect(styleInput).toBeFocused()

  await modal.getByRole('button', { name: '创建项目' }).click()
  await expect(page.locator('.modal-card')).toHaveCount(0)

  const heading = page.locator('.project-card h2', { hasText: name }).first()
  await expect(heading).toBeVisible({ timeout: 15000 })
  await heading.click()

  await expect(page).toHaveURL(/\/project\//)
  const match = page.url().match(/\/project\/([^/?#]+)/)
  if (!match) throw new Error(`Cannot parse project id from url: ${page.url()}`)
  return match[1]
}

test('system bugfix regression', async ({ page, request }) => {
  const ts = Date.now()
  const nameA = `PW系统除虫-${ts}-A`
  const nameB = `PW系统除虫-${ts}-B`
  const created: string[] = []

  const projectA = await createProjectFromModal(page, nameA)
  created.push(projectA)

  await expect(page.getByRole('heading', { name: nameA })).toBeVisible()
  await page.locator('.sidebar').getByRole('link', { name: '创作控制台' }).click()
  await expect(page.getByRole('heading', { name: '文本创作' })).toBeVisible()
  await expect(page.getByText(`${nameA} · 批量生成与逐章编辑收敛到同一路由。`)).toBeVisible()
  await page.screenshot({ path: `${SCREENSHOT_DIR}/system_bugfix_01_write_project_a.png`, fullPage: true })

  const projectB = await createProjectFromModal(page, nameB)
  created.push(projectB)

  await expect(page.getByRole('heading', { name: nameB })).toBeVisible()
  await page.locator('.sidebar').getByRole('link', { name: '创作控制台' }).click()
  await expect(page.getByRole('heading', { name: '文本创作' })).toBeVisible()
  await expect(page.getByText(`${nameB} · 批量生成与逐章编辑收敛到同一路由。`)).toBeVisible()
  await expect(page.getByText(`${nameA} · 批量生成与逐章编辑收敛到同一路由。`)).toHaveCount(0)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/system_bugfix_02_write_project_b.png`, fullPage: true })

  await page.goto(`/project/${projectB}`)
  await page.getByRole('button', { name: '新建章节' }).click()
  const chapterModal = page.locator('.modal-card')
  const chapterNumberInput = chapterModal.locator('input[type="number"]')

  await chapterNumberInput.fill('')
  await expect(chapterNumberInput).toHaveValue('')
  await chapterNumberInput.fill('8')
  await expect(chapterNumberInput).toHaveValue('8')

  await chapterModal.locator('input.input').nth(1).fill('第一章')
  await chapterModal.locator('textarea').fill('用于回归测试的一章')
  await chapterModal.getByRole('button', { name: '创建并进入' }).click()

  await expect(page.getByRole('heading', { name: /第\s*\d+\s*章/ })).toBeVisible()

  await expect(page.getByRole('button', { name: '重做正文' })).toBeVisible()
  await expect(page.getByText('方向提示')).toBeVisible()
  await expect(page.getByPlaceholder('给本章增加明确的重做方向，留空则沿用章节目标。')).toBeVisible()
  await page.screenshot({ path: `${SCREENSHOT_DIR}/system_bugfix_03_writing_studio_chapter.png`, fullPage: true })

  const delResp = await request.delete(`${API_BASE}/projects/${projectB}`)
  expect(delResp.ok()).toBeTruthy()

  await page.goto(`/project/${projectB}`)
  await expect(page.getByText(/项目不存在或加载失败|Project not found/)).toBeVisible()
  await expect(page.locator('.sidebar').getByText('项目概览')).toHaveCount(0)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/system_bugfix_04_not_found_sidebar.png`, fullPage: true })

  for (const projectId of created) {
    await request.delete(`${API_BASE}/projects/${projectId}`)
  }
})
