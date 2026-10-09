import { expect, test } from '@playwright/test'
import { site } from '../src/profile'

test.use({ javaScriptEnabled: false })

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
})

test('不执行 JavaScript 也能读取首页和游戏链接的站点分享信息', async ({ page }) => {
  const description = '把想法做成作品。作品展示与在线小游戏，持续更新中。'
  for (const route of ['./#/', './#/games/jump']) {
    await page.goto('about:blank')
    const response = await page.goto(route)
    expect(response?.ok()).toBe(true)
    await expect(page).toHaveTitle(site.title)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description)
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', site.title)
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', site.title)
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', description)
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'zh_CN')
    await expect(page.locator('#app')).toBeEmpty()
  }
  expect(description).toContain(site.tagline)
})

test('分享地址是绝对 HTTPS 地址，缩略图跟随部署路径且可解码', async ({ page, request, baseURL }) => {
  await page.goto('./')
  const siteUrl = new URL((await page.locator('meta[property="og:url"]').getAttribute('content'))!)
  const imageUrl = new URL((await page.locator('meta[property="og:image"]').getAttribute('content'))!)
  expect(siteUrl.protocol).toBe('https:')
  expect(siteUrl.hostname).toBe('dongshan1999.github.io')
  expect(siteUrl.pathname).toBe(new URL(baseURL!).pathname)
  expect(siteUrl.hash).toBe('')
  expect(imageUrl.href).toBe(new URL('images/jump-game.jpg', siteUrl).href)

  const localImageUrl = new URL(imageUrl.pathname, page.url()).href
  const response = await request.get(localImageUrl)
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/jpeg')
  const size = await page.evaluate(async (url) => {
    const image = new Image()
    image.src = url
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  }, localImageUrl)
  expect(size).toEqual({ width: 1200, height: 676 })
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/jpeg')
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', String(size.width))
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', String(size.height))
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', /跳一跳/)
})
