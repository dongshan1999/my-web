import { expect, test } from '@playwright/test'

const viewportCases = [
  { width: 320, height: 568, theme: 'dark' },
  { width: 390, height: 844, theme: 'dark' },
  { width: 390, height: 844, theme: 'light' },
  { width: 736, height: 974, theme: 'light' },
  { width: 893, height: 974, theme: 'dark' },
  { width: 1440, height: 900, theme: 'dark' },
  { width: 1440, height: 900, theme: 'light' },
  { width: 1920, height: 1080, theme: 'dark' },
  { width: 1280, height: 600, theme: 'dark' },
] as const

const errors: string[] = []
test.beforeEach(async ({ page }) => {
  errors.length = 0
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
})
test.afterEach(() => expect(errors).toEqual([]))

for (const viewport of viewportCases) {
  test(`正式首页 ${viewport.width}x${viewport.height} ${viewport.theme}：首屏层级与边界`, async ({ page }, info) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.emulateMedia({ colorScheme: viewport.theme, reducedMotion: 'reduce' })
    await page.goto('./#/')
    await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'webgl')
    const title = page.getByRole('heading', { name: '作品与记录', exact: true })
    await expect(title).toBeVisible()
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('.site-brand .brand-name')).toHaveText('作品与记录')
    await expect(page.locator('footer')).toContainText('作品与记录')
    await expect(page.locator('body')).not.toContainText('你的名字')
    const bounds = await page.evaluate(() => {
      const rectangle = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON()
      return {
        header: rectangle('header'),
        status: rectangle('.site-status'),
        title: rectangle('#site-title'),
        actions: rectangle('.site-actions'),
        works: rectangle('#home-works'),
        links: Array.from(document.querySelectorAll('header nav a')).map((element) => element.getBoundingClientRect().toJSON()),
        overflow: document.documentElement.scrollWidth,
      }
    })
    expect(bounds.overflow).toBeLessThanOrEqual(viewport.width)
    expect(bounds.status.top).toBeGreaterThan(bounds.header.bottom + 8)
    expect(bounds.title.top).toBeGreaterThan(bounds.status.bottom)
    expect(bounds.title.left).toBeGreaterThanOrEqual(16)
    expect(bounds.title.right).toBeLessThanOrEqual(viewport.width - 16)
    expect(bounds.actions.bottom).toBeLessThan(bounds.works.top)
    expect(bounds.works.bottom).toBeLessThan(viewport.height)
    for (let i = 0; i < bounds.links.length; i++) {
      expect(bounds.links[i].left).toBeGreaterThanOrEqual(0)
      expect(bounds.links[i].right).toBeLessThanOrEqual(viewport.width)
      if (i) expect(bounds.links[i].left).toBeGreaterThanOrEqual(bounds.links[i - 1].right)
    }
    const letterSpacing = await title.evaluate((element) => getComputedStyle(element).letterSpacing)
    expect(['normal', '0px']).toContain(letterSpacing)
    const image = page.locator('.work-cover img')
    await expect(image).toBeVisible()
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(1000)
    await image.evaluate((element: HTMLImageElement) => element.decode())
    await page.screenshot({ path: info.outputPath(`home-${viewport.width}-${viewport.theme}.png`) })
  })
}

test('正式站点的滚动玻璃导航与主题切换可用', async ({ page }, info) => {
  await page.setViewportSize({ width: 893, height: 974 })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('./#/')
  await expect(page.locator('#site-title')).toBeVisible()
  await page.evaluate(() => scrollTo({ top: 180, behavior: 'instant' }))
  await expect(page.locator('.header-bar')).toHaveClass(/header-glass/)
  const style = await page.locator('.header-bar').evaluate((element) => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, blur: style.backdropFilter, radius: style.borderRadius, height: element.getBoundingClientRect().height }
  })
  expect(style.background).toContain('0.58')
  expect(style.blur).toContain('blur')
  expect(style.height).toBeLessThanOrEqual(58)
  expect(style.radius).toBe('16px')
  await page.screenshot({ path: info.outputPath('home-scrolled-dark.png') })
  await page.getByRole('button', { name: '切换到浅色模式' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('navigation').getByRole('link', { name: '作品', exact: true }).click()
  await expect(page.getByRole('heading', { name: '作品', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '作品与记录 · 首页', exact: true }).click()
  await expect(page.getByRole('heading', { name: '作品与记录', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '浏览作品', exact: true }).click()
  await expect(page.getByRole('heading', { name: '作品', exact: true })).toBeVisible()
})

test('较长站点标题不会挤出首页或导航', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('./#/')
  await expect(page.locator('#site-title')).toBeVisible()
  for (const title of ['作品、记录与小游戏', 'ProjectsAndDocuments']) {
    await page.evaluate((value) => {
      document.querySelector('#site-title')!.textContent = value
      document.querySelector('.brand-name')!.textContent = value
    }, title)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    const heading = await page.locator('#site-title').boundingBox()
    const actions = await page.locator('.site-actions').boundingBox()
    expect(heading!.x).toBeGreaterThanOrEqual(16)
    expect(heading!.x + heading!.width).toBeLessThanOrEqual(304)
    expect(actions!.y).toBeGreaterThan(heading!.y + heading!.height)
  }
  await page.screenshot({ path: info.outputPath('home-long-title-mobile.png') })
})

test('手机首页的纸上公路入口可进入实际游戏', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('./#/')
  await page.locator('.site-actions').getByRole('link', { name: '纸上公路', exact: true }).click()
  await expect(page.locator('.racer-stage')).toHaveAttribute('data-renderer', 'ready')
  await expect(page.getByRole('heading', { name: '纸上公路', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始比赛', exact: true })).toBeVisible()
})
