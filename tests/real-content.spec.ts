import { expect, test } from '@playwright/test'

const errors: string[] = []
test.beforeEach(async ({ page }) => {
  errors.length = 0
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
})
test.afterEach(() => expect(errors).toEqual([]))

test('首页只展示真实作品，没有占位名字、示例或虚构发布日期', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('./#/')
  await expect(page).toHaveTitle('作品与记录')
  await expect(page.locator('.work-card')).toHaveCount(1)
  await expect(page.locator('.work-title-link')).toHaveText('跳一跳')
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/你的名字|我的名字|我的个人主页|你好，我是|示例作品|src\/content|2025-09/)
  await expect(page.locator('.content-overview')).toContainText('暂无文档，持续更新中。')
  await page.screenshot({ path: info.outputPath('real-content-home.png'), fullPage: true })
})

test('跳一跳封面加载真实画面并正确带部署路径', async ({ page }, info) => {
  await page.goto('./#/works')
  const image = page.getByRole('img', { name: '跳一跳实际画面', exact: true })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1200)
  await image.evaluate((element: HTMLImageElement) => element.decode())
  const src = await image.getAttribute('src')
  expect(src).toBe(new URL('images/jump-game.jpg', String(test.info().project.use.baseURL)).pathname)
  expect((await page.request.get(src!)).ok()).toBeTruthy()
  await expect(page.locator('.work-card')).toHaveCount(1)
  await page.screenshot({ path: info.outputPath('real-work-cover.png'), fullPage: true })
})

test('封面资源失效显示更新中，不退回文字渐变占位', async ({ page }, info) => {
  await page.route('**/images/jump-game.jpg', (route) => route.abort())
  await page.goto('./#/works')
  await expect(page.locator('.cover-empty')).toHaveText('封面持续更新中')
  await expect(page.locator('.work-cover img')).toHaveCount(0)
  const cover = await page.locator('.work-cover').boundingBox()
  expect(cover!.height).toBeGreaterThan(150)
  await expect(page.getByRole('link', { name: '在线游玩', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('missing-cover-state.png') })
})

test('公开文档为空时不出现模板文章或开发目录说明', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('./#/docs')
  await expect(page.getByRole('heading', { name: '文档', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('暂无文档')
  await expect(page.getByRole('status')).toContainText('持续更新中。')
  await expect(page.locator('.doc-list')).toHaveCount(0)
  expect(await page.locator('main').innerText()).not.toMatch(/如何添加|部署指南|src\/content|复制/)
  await page.screenshot({ path: info.outputPath('docs-empty-light.png') })
})

for (const slug of ['add-content', 'getting-started']) {
  test(`下线的维护教程 ${slug} 不再作为公开文章显示`, async ({ page }) => {
    await page.goto(`./#/docs/${slug}`)
    await expect(page.locator('main')).toContainText('这篇文档暂未发布。')
    await expect(page.locator('article')).toHaveCount(0)
    await page.getByRole('link', { name: '返回文档列表', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('暂无文档')
  })
}

test('示例作品已移除，旧地址不会展示模板内容', async ({ page }) => {
  await page.goto('./#/works/example-project')
  await expect(page.locator('main')).toContainText('没有找到这个作品。')
  await expect(page.locator('article')).toHaveCount(0)
  await page.getByRole('link', { name: '返回作品列表', exact: true }).click()
  await expect(page.locator('.work-card')).toHaveCount(1)
})

test('真实作品详情有封面和直接在线游玩的入口', async ({ page }) => {
  await page.goto('./#/works')
  await page.locator('.work-title-link').click()
  await expect(page.getByRole('heading', { name: '跳一跳', exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: '跳一跳实际画面', exact: true })).toBeVisible()
  await expect(page.locator('article')).toContainText('Three.js')
  await page.getByRole('link', { name: '在线游玩', exact: true }).click()
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-renderer', 'ready')
})
