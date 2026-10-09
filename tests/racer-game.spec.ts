import { expect, test, type Page } from '@playwright/test'

declare global { interface Window { __racerDraws: number } }
const errors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  errors.set(page, [])
  page.on('pageerror', (error) => errors.get(page)!.push(error.message))
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.addInitScript(() => {
    window.__racerDraws = 0
    const proto = WebGL2RenderingContext.prototype
    const drawArrays = proto.drawArrays
    proto.drawArrays = function (mode, first, count) {
      drawArrays.call(this, mode, first, count)
      if ((this.canvas as HTMLCanvasElement).dataset.testid === 'racer-canvas') window.__racerDraws++
    }
  })
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
})
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]))

async function openRacer(page: Page, width = 1280, height = 800) {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('./#/games/racer')
  await expect(page.locator('.racer-stage')).toHaveAttribute('data-renderer', 'ready')
  await expect(page.getByTestId('racer-canvas')).toBeVisible()
  await page.clock.runFor(100)
}

async function canvasStats(page: Page) {
  const buffer = await page.getByTestId('racer-canvas').screenshot()
  return page.evaluate(async (base64) => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 96
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0, 128, 96)
    const data = context.getImageData(0, 0, 128, 96).data
    const values: number[] = []
    for (let index = 0; index < data.length; index += 4) values.push((data[index] + data[index + 1] + data[index + 2]) / 3)
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    return { range: Math.max(...values) - Math.min(...values), deviation: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) }
  }, buffer.toString('base64'))
}

test('纸绘赛道首帧非空白，开始后速度与进度推进', async ({ page }, info) => {
  await openRacer(page)
  const initial = await canvasStats(page)
  expect(initial.range).toBeGreaterThan(30)
  expect(initial.deviation).toBeGreaterThan(5)
  await page.screenshot({ path: info.outputPath('racer-ready.png') })
  await page.getByRole('button', { name: '开始比赛' }).click()
  await expect(page.locator('.racer-stage')).toHaveAttribute('data-phase', 'racing')
  await page.clock.runFor(1200)
  await expect(page.getByText('km/h')).toBeVisible()
  const hud = await page.locator('.racer-hud').innerText()
  expect(hud).toMatch(/速度\s*\d+/)
  expect(hud).toMatch(/进度\s*[1-9]\d?%|进度\s*100%/)
  const running = await canvasStats(page)
  expect(running.range).toBeGreaterThan(30)
  expect(running.deviation).toBeGreaterThan(5)
  await page.screenshot({ path: info.outputPath('racer-running.png') })
})

test('键盘左右控制不报错，暂停与重新开始可用', async ({ page }) => {
  await openRacer(page)
  await page.getByRole('button', { name: '开始比赛' }).click()
  await page.clock.runFor(300)
  await page.keyboard.down('ArrowLeft')
  await page.clock.runFor(300)
  await page.keyboard.up('ArrowLeft')
  await page.keyboard.down('d')
  await page.clock.runFor(300)
  await page.keyboard.up('d')
  await page.getByRole('button', { name: '暂停比赛' }).click()
  await expect(page.locator('.racer-stage')).toHaveAttribute('data-phase', 'paused')
  const before = await page.evaluate(() => window.__racerDraws)
  await page.clock.runFor(800)
  expect(await page.evaluate(() => window.__racerDraws)).toBe(before)
  await page.getByRole('dialog', { name: '比赛已暂停' }).getByRole('button', { name: '继续比赛' }).click()
  await expect(page.locator('.racer-stage')).toHaveAttribute('data-phase', 'racing')
  await page.getByRole('button', { name: '重新开始' }).click()
  await expect(page.locator('.racer-stage')).toHaveAttribute('data-phase', 'ready')
  await expect(page.getByText('开始比赛')).toBeVisible()
})

test('移动端触控转向控件可见且无横向溢出', async ({ page }, info) => {
  await openRacer(page, 390, 844)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: '开始比赛' }).click()
  await expect(page.getByRole('button', { name: '向左转' })).toBeVisible()
  await expect(page.getByRole('button', { name: '向右转' })).toBeVisible()
  await page.getByRole('button', { name: '向左转' }).dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true })
  await page.clock.runFor(300)
  await page.getByRole('button', { name: '向左转' }).dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true })
  await page.clock.runFor(300)
  await page.screenshot({ path: info.outputPath('racer-mobile.png') })
})

test('WebGL2 不可用时赛车给出明确降级提示', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, options: any) {
      if (type === 'webgl2') return null
      return getContext.call(this, type as any, options)
    } as typeof getContext
  })
  await page.goto('./#/games/racer')
  await expect(page.locator('.racer-stage')).toHaveAttribute('data-renderer', 'error')
  await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible()
})
